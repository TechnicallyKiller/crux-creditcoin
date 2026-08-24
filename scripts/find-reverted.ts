/**
 * Phase 0 — empirically confirm C3 / R4.
 *
 * The plan's highest-severity claim is that inclusion != success: the
 * precompile proves a transaction was INCLUDED, not that it SUCCEEDED, so a
 * market could be resolved with a deliberately reverted transaction unless
 * `receiptStatus == 1` is enforced.
 *
 * That is worth proving rather than believing. This finds a genuinely reverted
 * transaction inside the attested range and captures it as a fixture, so the
 * adversarial test in Phase 1 runs against a real failed mainnet tx.
 */
import 'dotenv/config';

const chainKey = Number(process.argv[2] ?? 3);
const HEAD_RPC: Record<number, string> = {
  3: process.env.ETH_MAINNET_RPC_URL || 'https://ethereum-rpc.publicnode.com',
  1: process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
};
const PROVER = process.env.PROVER_URL ?? 'https://prover.cc3-testnet.creditcoin.network';

async function rpc(method: string, params: unknown[]): Promise<any> {
  const res = await fetch(HEAD_RPC[chainKey], {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(20_000),
  });
  const j = await res.json();
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
}

const attested = (await (await fetch(`${PROVER}/api/v1/attested-height/${chainKey}`)).json()).attestedHeight;
console.log(`chainKey ${chainKey} — attested height ${attested}`);

// Prefer checkpoint-aligned blocks: 1 continuity root instead of ~6 (see the
// checkpoint-alignment finding in prove-tx.ts).
for (let h = attested; h > attested - 100; h -= 10) {
  const block = await rpc('eth_getBlockByNumber', ['0x' + h.toString(16), false]);
  if (!block?.transactions?.length) continue;

  const receipts = await rpc('eth_getBlockReceipts', ['0x' + h.toString(16)]).catch(() => null);
  if (!receipts) continue;

  const failed = receipts.find((r: any) => r.status === '0x0');
  if (failed) {
    console.log(`\nFOUND a reverted transaction inside the attested range:`);
    console.log(`  block  : ${h}  (checkpoint-aligned: ${h % 10 === 0})`);
    console.log(`  tx     : ${failed.transactionHash}`);
    console.log(`  status : ${failed.status}  <- REVERTED`);
    console.log(`\nThis transaction is attestable. Prove it with:`);
    console.log(`  node --experimental-strip-types scripts/prove-tx.ts ${chainKey} ${failed.transactionHash}`);
    console.log(`\nIf that returns TRUE, C3 is confirmed: the protocol will happily`);
    console.log(`prove a FAILED transaction, and receiptStatus==1 is the only defence.`);
    process.exit(0);
  }
}
console.log('no reverted transaction found in the scanned range');
process.exit(1);
