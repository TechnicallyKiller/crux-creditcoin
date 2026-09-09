/**
 * Market data, read straight from Creditcoin.
 *
 * Deliberately no backend in the read path: everything the UI shows about a
 * market comes from the contracts, so the app cannot show you a number the
 * chain disagrees with. The indexer exists for history and leaderboards, not
 * for truth.
 */
import { useEffect, useState } from 'react';
import { publicClient, ADDRESSES, marketAbi, resolverAbi, chainInfoAbi, CMP } from './chain';

export interface Spec {
  chainKey: number;
  emitter: `0x${string}`;
  topic0: `0x${string}`;
  extractMode: number;
  extractIndex: number;
  cmp: (typeof CMP)[number];
  threshold: bigint;
  fromBlock: number;
  toBlock: number;
}

export interface Market {
  id: number;
  question: string;
  creator: `0x${string}`;
  settled: boolean;
  outcome: boolean;
  chainKey: number;
  tradingCloseBlock: number;
  b: bigint;
  qYes: bigint;
  qNo: bigint;
  collateral: bigint;
  priceYes: number;
  spec: Spec | null;
  /** Attested height of this market's source chain, at read time. */
  attested: number;
}

/**
 * Questions live in the MarketCreated event, not in storage — storing a string
 * per market would cost gas forever for something only the UI reads. We recover
 * them from logs and fall back to the spec if a log is unavailable.
 */
async function questionsFromLogs(): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  try {
    const logs = await publicClient.getLogs({
      address: ADDRESSES.market as `0x${string}`,
      event: {
        type: 'event',
        name: 'MarketCreated',
        inputs: [
          { indexed: true, name: 'marketId', type: 'uint256' },
          { indexed: true, name: 'creator', type: 'address' },
          { indexed: false, name: 'chainKey', type: 'uint64' },
          { indexed: false, name: 'b', type: 'uint256' },
          { indexed: false, name: 'question', type: 'string' },
        ],
      },
      fromBlock: 5459517n,
      toBlock: 'latest',
    });
    for (const l of logs) {
      const a = l.args as { marketId?: bigint; question?: string };
      if (a.marketId !== undefined && a.question) out.set(Number(a.marketId), a.question);
    }
  } catch {
    /* logs are a convenience; the app still works without them */
  }
  return out;
}

async function attestedHeight(chainKey: number): Promise<number> {
  try {
    const r = await publicClient.readContract({
      address: ADDRESSES.chainInfo as `0x${string}`,
      abi: chainInfoAbi,
      functionName: 'get_latest_attestation_height_and_hash',
      args: [BigInt(chainKey)],
    });
    return r.exists ? Number(r.height) : 0;
  } catch {
    return 0;
  }
}

export async function fetchMarkets(): Promise<Market[]> {
  const next = await publicClient.readContract({
    address: ADDRESSES.market as `0x${string}`, abi: marketAbi, functionName: 'nextMarketId',
  });
  const ids = Array.from({ length: Number(next) - 1 }, (_, i) => i + 1);
  if (!ids.length) return [];

  const questions = await questionsFromLogs();
  const attestedCache = new Map<number, number>();

  const markets = await Promise.all(ids.map(async (id): Promise<Market | null> => {
    try {
      const [m, price] = await Promise.all([
        publicClient.readContract({
          address: ADDRESSES.market as `0x${string}`, abi: marketAbi, functionName: 'markets', args: [BigInt(id)],
        }),
        publicClient.readContract({
          address: ADDRESSES.market as `0x${string}`, abi: marketAbi, functionName: 'priceYes', args: [BigInt(id)],
        }).catch(() => 5n * 10n ** 17n),
      ]);

      let spec: Spec | null = null;
      try {
        const s = await publicClient.readContract({
          address: ADDRESSES.resolver as `0x${string}`, abi: resolverAbi, functionName: 'specOf', args: [BigInt(id)],
        });
        spec = {
          chainKey: Number(s.chainKey), emitter: s.emitter, topic0: s.topic0,
          extractMode: Number(s.extractMode), extractIndex: Number(s.extractIndex),
          cmp: CMP[Number(s.cmp)] ?? 'GT', threshold: s.threshold,
          fromBlock: Number(s.fromBlock), toBlock: Number(s.toBlock),
        };
      } catch { /* spec may be unreadable on a superseded deployment */ }

      const chainKey = Number(m[5]);
      if (!attestedCache.has(chainKey)) attestedCache.set(chainKey, await attestedHeight(chainKey));

      return {
        id,
        question: questions.get(id) ?? `Market ${id}`,
        creator: m[0], settled: m[2], outcome: m[3],
        tradingCloseBlock: Number(m[4]), chainKey,
        b: m[6], qYes: m[7], qNo: m[8], collateral: m[10],
        priceYes: Number(price) / 1e18,
        spec,
        attested: attestedCache.get(chainKey) ?? 0,
      };
    } catch {
      return null;
    }
  }));

  return markets.filter((m): m is Market => m !== null).reverse();
}

export function useMarkets() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchMarkets()
        .then((m) => { if (alive) { setMarkets(m); setError(null); } })
        .catch((e) => { if (alive) setError(String(e?.message ?? e)); })
        .finally(() => { if (alive) setLoading(false); });
    load();
    const t = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return { markets, loading, error };
}

/** Which of the four proof-drop states a market is currently in. */
export type Stage = 'watching' | 'attesting' | 'proving' | 'proven' | 'void';

export function stageOf(m: Market): Stage {
  if (m.settled) return m.outcome ? 'proven' : 'void';
  if (!m.spec) return 'watching';
  if (m.attested >= m.spec.toBlock) return 'proving';
  if (m.attested >= m.spec.fromBlock) return 'attesting';
  return 'watching';
}

/** Renders a spec as the sentence a person can actually check. */
export function ruleSentence(spec: Spec, question: string): string {
  const v = spec.cmp === 'EXISTS'
    ? 'any matching event occurs'
    : `a value ${{ GT: 'above', GTE: 'at or above', LT: 'below', LTE: 'at or below', EQ: 'exactly equal to', EXISTS: '' }[spec.cmp]} ${spec.threshold.toString()}`;
  return `Settles YES if ${spec.emitter.slice(0, 6)}…${spec.emitter.slice(-4)} emits the watched event with ${v}, in blocks ${spec.fromBlock.toLocaleString()} – ${spec.toBlock.toLocaleString()}. ${question}`;
}
