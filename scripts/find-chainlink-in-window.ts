/**
 * Find a Chainlink ETH/USD update inside the mainnet market's observation
 * window, and prove it.
 *
 * Reads the window from deployments/mainnet-plan.json so it cannot drift from
 * the spec the market was actually created with.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const plan = JSON.parse(readFileSync('deployments/mainnet-plan.json', 'utf8'));
const PROVER = process.env.PROVER_URL ?? 'https://prover.cc3-testnet.creditcoin.network';
const ANSWER_UPDATED = '0x0559884fd3a460db3073b7fc896cc77986f16e378210ded43186175bf646fc5f';

// C8 — most public mainnet RPCs reject archive eth_getLogs outright.
const RPCS = [process.env.ETH_MAINNET_RPC_URL, 'https://eth.drpc.org', 'https://rpc.flashbots.net'].filter(Boolean) as string[];

async function getLogs(from: bigint, to: bigint): Promise<any[]> {
  for (const url of RPCS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1, method: 'eth_getLogs',
          params: [{ address: plan.aggregator, topics: [ANSWER_UPDATED], fromBlock: '0x' + from.toString(16), toBlock: '0x' + to.toString(16) }],
        }),
        signal: AbortSignal.timeout(25_000),
      });
      const j = await res.json();
      if (!j.error) return j.result;
      console.log(`  ${new URL(url).host}: ${j.error.message.slice(0, 60)}`);
    } catch (e) { console.log(`  ${new URL(url).host}: ${(e as Error).message.slice(0, 60)}`); }
  }
  return [];
}

const attested = BigInt((await (await fetch(`${PROVER}/api/v1/attested-height/3`)).json()).attestedHeight);
const from = BigInt(plan.fromBlock);
const to = BigInt(plan.toBlock);

console.log(`window          : ${from} -> ${to}`);
console.log(`attested now    : ${attested}`);

if (attested < from) {
  console.log(`\nWindow has not opened yet — ${from - attested} blocks to go (~${Number(from - attested) * 12 / 60 | 0} min).`);
  process.exit(1);
}

// Only search the attested portion; an event past the attested tip cannot be
// proven yet even though it has happened.
const searchTo = attested < to ? attested : to;
const logs = await getLogs(from, searchTo);

if (!logs.length) {
  console.log(`\nNo AnswerUpdated in ${from}-${searchTo} yet. ETH/USD updates on a 0.5%`);
  console.log('deviation or a ~1h heartbeat, so a quiet market means waiting.');
  process.exit(1);
}

const hit = logs[logs.length - 1];
const price = BigInt(hit.topics[1]);
console.log(`\nFOUND AnswerUpdated`);
console.log(`  block  : ${parseInt(hit.blockNumber, 16)}`);
console.log(`  tx     : ${hit.transactionHash}`);
console.log(`  price  : $${(Number(price) / 1e8).toFixed(2)}`);
console.log(`  vs YES threshold $${(Number(BigInt(plan.thresholdYes)) / 1e8).toFixed(0)} -> ${price > BigInt(plan.thresholdYes) ? 'YES provable' : 'below threshold'}`);
console.log(`\nProving...\n`);

execSync(`node --experimental-strip-types scripts/prove-tx.ts 3 ${hit.transactionHash}`, { stdio: 'inherit' });
console.log(`\nNow: node --experimental-strip-types scripts/demo.ts resolve <marketId-A> --mainnet`);
