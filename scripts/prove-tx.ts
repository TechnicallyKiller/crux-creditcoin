/**
 * Phase 0 / prereq 4 — end-to-end proof reproduction.
 *
 * Takes a source-chain transaction, asks the Attestcoin proof builder for its
 * Merkle + continuity proof, and has the Creditcoin precompile at 0x…0FD2
 * verify it. This is the whole trust mechanism of CRUX in ~40 lines; if this
 * passes, the proof lane is buildable.
 *
 * verifySingle is a staticcall (C6), so this needs no funds and no wallet —
 * which is why it can run before the faucet (prereq 1) is sorted.
 *
 *   node --experimental-strip-types scripts/prove-tx.ts <chainKey> [txHash]
 *
 * With no txHash, picks a transaction from a recently attested block, so the
 * run also exercises the cheapest case: a fresh proof, 1 continuity root (C4).
 */
import 'dotenv/config';
import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { JsonRpcProvider } from 'ethers';
import { blockProver, chainInfo, proofProvider } from '@gluwa/usc-sdk';

const CC3_RPC = process.env.CC3_RPC_URL ?? 'https://rpc.cc3-testnet.creditcoin.network';
const PROVER = process.env.PROVER_URL ?? 'https://prover.cc3-testnet.creditcoin.network';

const HEAD_RPC: Record<number, string> = {
  3: process.env.ETH_MAINNET_RPC_URL || 'https://ethereum-rpc.publicnode.com',
  1: process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
};

const chainKey = Number(process.argv[2] ?? 3);
let txHash = process.argv[3];

async function rpc(url: string, method: string, params: unknown[]): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(20_000),
  });
  const j = await res.json();
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
}

async function main(): Promise<void> {
  const provider = new JsonRpcProvider(CC3_RPC);
  const info = new chainInfo.PrecompileChainInfoProvider(provider);

  const attested = Number((await info.getLatestAttestedHeightAndHash(chainKey)).height);
  console.log(`chainKey ${chainKey} — latest attested height ${attested}`);

  // Pick a transaction from an attested block if none was supplied. Walk back
  // a little: the tip checkpoint is attested but we want a block comfortably
  // inside the attested range.
  if (!txHash) {
    const url = HEAD_RPC[chainKey];
    for (let h = attested - 5; h > attested - 40; h--) {
      const block = await rpc(url, 'eth_getBlockByNumber', ['0x' + h.toString(16), false]);
      if (block?.transactions?.length) {
        txHash = block.transactions[Math.floor(block.transactions.length / 2)];
        console.log(`picked tx from block ${h} (${block.transactions.length} txs)`);
        break;
      }
    }
    if (!txHash) throw new Error('no transaction found in the attested range');
  }
  console.log(`transaction    : ${txHash}`);

  const t0 = Date.now();
  const builder = new proofProvider.service.ProofBuilder(chainKey, PROVER);
  const result = await builder.getProof(txHash);
  const genMs = Date.now() - t0;

  if (!result.success || !result.data) throw new Error(`proof generation failed: ${result.error}`);
  const p = result.data;

  const txBytes = (p.txBytes as string).length / 2 - 1;
  console.log(`source block   : ${p.headerNumber}`);
  console.log(`proof gen      : ${genMs} ms`);
  console.log(`txBytes        : ${txBytes} bytes  (max ${blockProver.PrecompileBlockProver ? 449280 : '?'})`);
  console.log(`merkle siblings: ${p.merkleProof.siblings.length}`);
  // Root count tracks CHECKPOINT ALIGNMENT, not freshness: a tx in a
  // checkpoint block (height % 10 == 0) needs 1 root, one 5 blocks away needs
  // 6. Corrects the plan's C4, which attributes the 1-root case to freshness.
  const alignment = Number(p.headerNumber) % 10;
  console.log(`continuity     : ${p.continuityProof.roots.length} roots  (block ${alignment === 0 ? 'IS' : 'is not'} checkpoint-aligned, offset ${alignment})`);

  const t1 = Date.now();
  const prover = new blockProver.PrecompileBlockProver(provider);
  const ok = await prover.verifySingle(
    p.chainKey,
    p.headerNumber,
    p.txBytes,
    p.merkleProof,
    p.continuityProof,
  );
  const verifyMs = Date.now() - t1;

  console.log(`\nverify on 0x…0FD2 -> ${ok ? 'TRUE  ✓ PROVEN' : 'FALSE ✗ FAILED'} — ${verifyMs} ms`);

  // Persist as a Foundry test fixture. Phase 1 tests need real proofs and
  // cannot generate them in-process, so capture them here (plan §12 Phase 1).
  //
  // The sibling array is flattened into two parallel arrays: Foundry's JSON
  // cheatcodes have no JSONPath wildcard, so `siblings[*].hash` cannot be read.
  mkdirSync('fixtures', { recursive: true });
  const path = `fixtures/proof-chain${chainKey}-${p.headerNumber}.json`;
  writeFileSync(
    path,
    JSON.stringify(
      {
        chainKey: Number(p.chainKey),
        headerNumber: Number(p.headerNumber),
        txHash,
        txBytes: p.txBytes,
        merkleRoot: p.merkleProof.root,
        siblingHashes: p.merkleProof.siblings.map((s: any) => s.hash),
        siblingIsLeft: p.merkleProof.siblings.map((s: any) => s.isLeft),
        lowerEndpointDigest: p.continuityProof.lowerEndpointDigest,
        continuityRoots: p.continuityProof.roots,
        capturedAt: new Date().toISOString(),
        verified: ok,
      },
      (_k, v) => (typeof v === 'bigint' ? v.toString() : v),
      2,
    ),
  );
  // Stable alias so Foundry tests can reference a fixture by a fixed name.
  const alias = `fixtures/${chainKey === 3 ? 'mainnet' : 'sepolia'}-latest.json`;
  copyFileSync(path, alias);
  console.log(`fixture written -> ${path}  (alias ${alias})`);

  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
