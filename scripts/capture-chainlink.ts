/**
 * Capture a real Chainlink ETH/USD `AnswerUpdated` from Ethereum mainnet,
 * inside the Attestcoin-attested range, as a test fixture.
 *
 * This is the flagship market template (plan §3.9): the price sits in indexed
 * topics[1], so it comes straight out of LogEntry with no ABI decoding.
 *
 * Note the aggregator is resolved from the proxy at runtime, never hardcoded —
 * Chainlink rotates aggregators when it upgrades a feed (R6), and a market
 * pinned to a stale aggregator silently stops resolving.
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';

/**
 * C8 — most public mainnet RPCs reject archive `eth_getLogs` outright
 * ("Archive requests require a personal token"). These two currently serve it.
 * A paid key (prereq 2) is still the right answer for the Phase 2 worker, which
 * scans continuously and will hit rate limits; this list only unblocks fixture
 * capture. First entry wins if ETH_MAINNET_RPC_URL is set.
 */
const RPCS = [
  process.env.ETH_MAINNET_RPC_URL,
  'https://eth.drpc.org',
  'https://rpc.flashbots.net',
].filter(Boolean) as string[];
let RPC = RPCS[0];
const PROVER = process.env.PROVER_URL ?? 'https://prover.cc3-testnet.creditcoin.network';

const ETH_USD_PROXY = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419';
const ANSWER_UPDATED = '0x0559884fd3a460db3073b7fc896cc77986f16e378210ded43186175bf646fc5f';

async function rpc(method: string, params: unknown[]): Promise<any> {
  let lastErr: Error | null = null;
  for (const url of RPCS) {
    try {
      const out = await rpcOn(url, method, params);
      RPC = url;
      return out;
    } catch (e) {
      lastErr = e as Error;
    }
  }
  throw lastErr;
}

async function rpcOn(url: string, method: string, params: unknown[]): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(25_000),
  });
  const j = await res.json();
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
}

const attested = (await (await fetch(`${PROVER}/api/v1/attested-height/3`)).json()).attestedHeight;
console.log(`attested height : ${attested}`);

// R6 — resolve the live aggregator rather than trusting a constant.
const aggregator =
  '0x' + (await rpc('eth_call', [{ to: ETH_USD_PROXY, data: '0x245a7bfc' }, 'latest'])).slice(26);
console.log(`proxy           : ${ETH_USD_PROXY}`);
console.log(`aggregator      : ${aggregator}  (resolved live, not hardcoded)`);

// Scan backwards in small windows; public RPCs cap eth_getLogs ranges.
let found: any = null;
for (let hi = attested; hi > attested - 600 && !found; hi -= 100) {
  const logs = await rpc('eth_getLogs', [
    {
      address: aggregator,
      topics: [ANSWER_UPDATED],
      fromBlock: '0x' + (hi - 99).toString(16),
      toBlock: '0x' + hi.toString(16),
    },
  ]).catch((e: Error) => {
    console.log(`  window ${hi - 99}-${hi}: ${e.message}`);
    return [];
  });
  if (logs.length) found = logs[logs.length - 1];
}

if (!found) {
  console.log('\nNo AnswerUpdated in the attested range. ETH/USD updates on a');
  console.log('deviation threshold plus a heartbeat, so quiet markets mean gaps.');
  process.exit(1);
}

const price = BigInt(found.topics[1]);
const blockNumber = parseInt(found.blockNumber, 16);
console.log(`\nFOUND AnswerUpdated`);
console.log(`  block   : ${blockNumber}  (attested: ${blockNumber <= attested})`);
console.log(`  tx      : ${found.transactionHash}`);
console.log(`  price   : ${price} (8dp) = $${(Number(price) / 1e8).toFixed(2)}`);
console.log(`  roundId : ${BigInt(found.topics[2])}`);

writeFileSync(
  'fixtures/chainlink-meta.json',
  JSON.stringify(
    {
      proxy: ETH_USD_PROXY,
      aggregator,
      topic0: ANSWER_UPDATED,
      txHash: found.transactionHash,
      blockNumber,
      priceRaw: price.toString(),
      priceUsd: Number(price) / 1e8,
      capturedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
console.log(`\nmeta -> fixtures/chainlink-meta.json`);
console.log(`Now run: node --experimental-strip-types scripts/prove-tx.ts 3 ${found.transactionHash}`);
