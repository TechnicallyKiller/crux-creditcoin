/**
 * Composing an AttestSpec from a human intent.
 *
 * The point of the product is that a market's resolution rule is DATA, so
 * issuing one deploys no code: the app resolves the aggregator address, the
 * event signature and the block window, and hands the resolver ten fields.
 *
 * Everything here mirrors a constraint the contracts actually enforce, so the
 * form cannot compose a spec that would be rejected on submission.
 */
import { publicClient, ADDRESSES, marketAbi, chainInfoAbi } from './chain';

export const TEMPLATES = [
  {
    id: 'chainlink',
    label: 'A price crossing a level',
    source: 'CHAINLINK',
    chainKey: 3,
    /** ETH/USD proxy on Ethereum mainnet. The aggregator behind it is resolved live. */
    proxy: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419' as const,
    topic0: '0x0559884fd3a460db3073b7fc896cc77986f16e378210ded43186175bf646fc5f' as const,
    event: 'AnswerUpdated',
    extractMode: 0, // TOPIC
    extractIndex: 1, // Chainlink puts the price in indexed topics[1]
    decimals: 8,
    asset: 'ETH / USD',
  },
] as const;

export type Template = (typeof TEMPLATES)[number];

export interface Draft {
  template: Template;
  direction: 'ABOVE' | 'BELOW';
  threshold: number;   // human units, e.g. 1903 dollars
  windowHours: number;
}

export interface ComposedSpec {
  chainKey: bigint;
  emitter: `0x${string}`;
  topic0: `0x${string}`;
  extractMode: number;
  extractIndex: number;
  cmp: number;         // 0 GT, 2 LT
  threshold: bigint;
  fromBlock: bigint;
  toBlock: bigint;
  closeBlock: bigint;
  question: string;
  subsidy: bigint;
  b: bigint;
}

/** ~12s per Ethereum block. */
const SRC_BLOCK_SECONDS = 12;

/**
 * R6 — resolve the aggregator from the proxy at composition time and pin it.
 * Chainlink rotates aggregators when it upgrades a feed, and a market pinned to
 * a retired one silently stops resolving.
 */
export async function resolveAggregator(proxy: `0x${string}`): Promise<`0x${string}`> {
  const raw = await publicClientCall(proxy, '0x245a7bfc'); // aggregator()
  return ('0x' + raw.slice(26)) as `0x${string}`;
}

async function publicClientCall(to: `0x${string}`, data: `0x${string}`) {
  const res = await fetch('https://eth.drpc.org', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message);
  return j.result as string;
}

export async function currentPrice(proxy: `0x${string}`, decimals: number): Promise<number> {
  const raw = await publicClientCall(proxy, '0x50d25bcd'); // latestAnswer()
  return Number(BigInt(raw)) / 10 ** decimals;
}

async function attestedHeight(chainKey: number): Promise<bigint> {
  const r = await publicClient.readContract({
    address: ADDRESSES.chainInfo as `0x${string}`,
    abi: chainInfoAbi,
    functionName: 'get_latest_attestation_height_and_hash',
    args: [BigInt(chainKey)],
  });
  if (!r.exists) throw new Error('source chain has no attestation');
  return r.height;
}

export async function compose(draft: Draft): Promise<ComposedSpec> {
  const t = draft.template;
  const [emitter, attested, buffer] = await Promise.all([
    resolveAggregator(t.proxy),
    attestedHeight(t.chainKey),
    publicClient.readContract({
      address: ADDRESSES.market as `0x${string}`, abi: marketAbi, functionName: 'LAG_BUFFER_BLOCKS',
    }),
  ]);

  // R3 — trading must close before the observation window OPENS, with the lag
  // buffer on top, or an event landing early in the window is public while
  // people can still trade on it. The contract enforces this; the form respects
  // it so a draft can never be rejected for it.
  const closeBlock = attested + 25n;
  const fromBlock = closeBlock + BigInt(buffer);
  const toBlock = fromBlock + BigInt(Math.round((draft.windowHours * 3600) / SRC_BLOCK_SECONDS));

  const b = 100n * 10n ** 18n;
  // b·ln(2), rounded up — matching LMSR.maxLoss, with margin so a rounding
  // difference can never make createMarket revert InsufficientSubsidy.
  const subsidy = (b * 693147180559945309n) / 10n ** 18n + 10n ** 15n;

  const threshold = BigInt(Math.round(draft.threshold * 10 ** t.decimals));
  const above = draft.direction === 'ABOVE';

  return {
    chainKey: BigInt(t.chainKey),
    emitter,
    topic0: t.topic0,
    extractMode: t.extractMode,
    extractIndex: t.extractIndex,
    cmp: above ? 0 : 2, // GT : LT
    threshold,
    fromBlock, toBlock, closeBlock,
    b, subsidy,
    question: `Will ${t.asset.split(' / ')[0]} trade ${above ? 'above' : 'below'} $${draft.threshold.toLocaleString()} before block ${toBlock.toLocaleString()}?`,
  };
}
