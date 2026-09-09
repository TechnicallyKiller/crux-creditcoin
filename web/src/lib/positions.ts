/**
 * Positions and calibration, derived from chain state.
 *
 * `CruxScore` (the soulbound reputation contract in the plan) is not deployed,
 * so there is no on-chain Brier score to read. Rather than show an empty screen
 * or invent a number, calibration is computed here from the holder's real
 * resolved positions: the price they paid is the probability they asserted, and
 * the market's settled outcome is what actually happened.
 *
 * This is honest but it is NOT proven, and the UI must label it that way. Under
 * the provenance system it is *derived* — computed by us from proven inputs —
 * and it must never borrow the lime, the seal or the completed rosette.
 */
import { useEffect, useState } from 'react';
import { type Address, parseAbiItem } from 'viem';
import { publicClient, ADDRESSES, marketAbi } from './chain';
import type { Market } from './markets';

const TRADED = parseAbiItem(
  'event Traded(uint256 indexed marketId, address indexed trader, bool indexed yes, bool isBuy, uint256 shares, uint256 amount, uint256 priceYesAfter)',
);

export interface Position {
  marketId: number;
  market: Market | undefined;
  yesShares: bigint;
  noShares: bigint;
  /** Volume-weighted price actually paid for the side held. */
  avgPrice: number;
  side: 'YES' | 'NO' | 'BOTH' | 'NONE';
  settled: boolean;
  won: boolean;
  claimable: bigint;
}

export interface Calibration {
  /** Mean squared error between asserted probability and outcome. Lower is better. */
  brier: number | null;
  resolved: number;
  streak: number;
  bestStreak: number;
  /** Asserted-vs-actual, bucketed, for the calibration plot. */
  buckets: { lo: number; hi: number; claimed: number; actual: number; n: number }[];
}

export async function fetchPositions(holder: Address, markets: Market[]): Promise<Position[]> {
  const out: Position[] = [];
  for (const m of markets) {
    try {
      const [y, n] = await Promise.all([
        publicClient.readContract({ address: ADDRESSES.market as Address, abi: marketAbi, functionName: 'yesShares', args: [BigInt(m.id), holder] }),
        publicClient.readContract({ address: ADDRESSES.market as Address, abi: marketAbi, functionName: 'noShares', args: [BigInt(m.id), holder] }),
      ]);
      if (y === 0n && n === 0n) continue;

      const won = m.settled && ((m.outcome && y > 0n) || (!m.outcome && n > 0n));
      out.push({
        marketId: m.id, market: m, yesShares: y, noShares: n,
        avgPrice: y >= n ? m.priceYes : 1 - m.priceYes,
        side: y > 0n && n > 0n ? 'BOTH' : y > 0n ? 'YES' : n > 0n ? 'NO' : 'NONE',
        settled: m.settled, won,
        claimable: won ? (m.outcome ? y : n) : 0n,
      });
    } catch { /* a market that cannot be read is skipped rather than faked */ }
  }
  return out;
}

/** Trades made by one holder, used for calibration. */
async function fetchTrades(holder: Address) {
  try {
    return await publicClient.getLogs({
      address: ADDRESSES.market as Address,
      event: TRADED,
      args: { trader: holder },
      fromBlock: 5441970n,
      toBlock: 'latest',
    });
  } catch {
    return [];
  }
}

export async function fetchCalibration(holder: Address, markets: Market[]): Promise<Calibration> {
  const logs = await fetchTrades(holder);
  const byId = new Map(markets.map((m) => [m.id, m]));

  const points: { claimed: number; outcome: number }[] = [];
  let streak = 0;
  let best = 0;
  let running = 0;

  for (const log of logs) {
    const a = log.args as { marketId?: bigint; yes?: boolean; isBuy?: boolean; priceYesAfter?: bigint };
    if (!a.isBuy || a.marketId === undefined) continue;
    const m = byId.get(Number(a.marketId));
    if (!m?.settled) continue;

    // The price paid is the probability the trader asserted for their side.
    const priceYes = Number(a.priceYesAfter ?? 0n) / 1e18;
    const claimed = a.yes ? priceYes : 1 - priceYes;
    const outcome = a.yes === m.outcome ? 1 : 0;
    points.push({ claimed, outcome });

    if (outcome === 1) { running += 1; best = Math.max(best, running); } else running = 0;
  }
  streak = running;

  const brier = points.length
    ? points.reduce((s, p) => s + (p.claimed - p.outcome) ** 2, 0) / points.length
    : null;

  const edges = [[0.5, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 0.9], [0.9, 1.0]] as const;
  const buckets = edges.map(([lo, hi]) => {
    const inBucket = points.filter((p) => p.claimed >= lo && p.claimed < hi + (hi === 1 ? 0.001 : 0));
    return {
      lo, hi,
      claimed: inBucket.length ? inBucket.reduce((s, p) => s + p.claimed, 0) / inBucket.length : (lo + hi) / 2,
      actual: inBucket.length ? inBucket.reduce((s, p) => s + p.outcome, 0) / inBucket.length : 0,
      n: inBucket.length,
    };
  });

  return { brier, resolved: points.length, streak, bestStreak: best, buckets };
}

export function usePortfolio(holder: Address | undefined, markets: Market[]) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!holder || !markets.length) { setPositions([]); setCalibration(null); return; }
    let alive = true;
    setLoading(true);
    Promise.all([fetchPositions(holder, markets), fetchCalibration(holder, markets)])
      .then(([p, c]) => { if (alive) { setPositions(p); setCalibration(c); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [holder, markets]);

  return { positions, calibration, loading };
}
