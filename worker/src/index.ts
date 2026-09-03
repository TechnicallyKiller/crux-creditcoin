/**
 * crux-worker — permissionless resolution service.
 *
 * Watches open markets, finds the source-chain event that decides each one,
 * and submits the proof. Also settles NO once a window lapses unproven.
 *
 * This worker is a CONVENIENCE, NOT A TRUST ASSUMPTION. Anyone can run one,
 * the resolver has no privileged caller, and whoever lands a valid proof first
 * collects the market's bounty. If this process dies, markets still resolve —
 * somebody else is paid to do it. That is the whole point of the bounty (D6),
 * and it is why the proof lane has no admin key anywhere in it.
 *
 * Idempotent by construction: on-chain replay protection means a duplicate
 * submission is a wasted transaction, never a double settlement, so the worker
 * can crash and restart at any point without reconciling anything.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { blockProver, proofProvider } from '@gluwa/usc-sdk';
import { MARKET_ABI, RESOLVER_ABI, CHAIN_INFO_ABI, CHAIN_INFO, Cmp, Extract } from './abi.ts';
import { load, save } from './state.ts';

const CC3 = process.env.CC3_RPC_URL ?? 'https://rpc.cc3-testnet.creditcoin.network';
const PROVER = process.env.PROVER_URL ?? 'https://prover.cc3-testnet.creditcoin.network';
const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 60_000);

/** Source-chain RPCs by chainKey. Public fallbacks reject archive getLogs (C8). */
const SOURCE_RPC: Record<number, string[]> = {
  3: [process.env.ETH_MAINNET_RPC_URL, 'https://eth.drpc.org', 'https://rpc.flashbots.net'].filter(Boolean) as string[],
  1: [process.env.SEPOLIA_RPC_URL, 'https://ethereum-sepolia-rpc.publicnode.com'].filter(Boolean) as string[],
};

const cc3 = JSON.parse(readFileSync('deployments/cc3-testnet.json', 'utf8'));
const provider = new JsonRpcProvider(CC3);

/**
 * Dry run reports what it would submit without signing anything, so the scan,
 * predicate and proof path can all be exercised without a funded key. Proof
 * verification still runs for real — it is a staticcall, so it costs nothing.
 */
const DRY = process.argv.includes('--dry-run');

const key = process.env.WORKER_PRIVATE_KEY;
if (!key && !DRY) {
  console.error('WORKER_PRIVATE_KEY not set. Use a throwaway key funded with tCTC —');
  console.error('this process holds it in memory and only ever pays gas to submit proofs.');
  console.error('Or pass --dry-run to scan without signing.');
  process.exit(1);
}
const wallet = key ? new Wallet(key, provider) : Wallet.createRandom().connect(provider);

const market = new Contract(cc3.CruxMarket, MARKET_ABI, provider);
const resolver = new Contract(cc3.CruxAttestedResolver, RESOLVER_ABI, DRY ? provider : wallet);
const chainInfo = new Contract(CHAIN_INFO, CHAIN_INFO_ABI, provider);

const state = load();

async function attestedHeight(chainKey: number): Promise<number> {
  const r = await chainInfo.get_latest_attestation_height_and_hash(chainKey);
  if (!r.exists) throw new Error(`no attestation for chainKey ${chainKey}`);
  return Number(r.height);
}

async function getLogs(chainKey: number, address: string, topic0: string, from: number, to: number) {
  let lastErr: unknown;
  for (const url of SOURCE_RPC[chainKey] ?? []) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1, method: 'eth_getLogs',
          params: [{ address, topics: [topic0], fromBlock: '0x' + from.toString(16), toBlock: '0x' + to.toString(16) }],
        }),
        signal: AbortSignal.timeout(25_000),
      });
      const j = await res.json();
      if (!j.error) return j.result as any[];
      lastErr = j.error.message;
    } catch (e) { lastErr = e; }
  }
  throw new Error(`eth_getLogs failed on every RPC for chainKey ${chainKey}: ${lastErr}`);
}

/** Mirrors CruxAttestedResolver._extract / _compare, so the worker only spends
 *  gas on proofs the contract will actually accept. */
function satisfies(log: any, spec: any): boolean {
  let value: bigint;
  if (Number(spec.extractMode) === Extract.TOPIC) {
    const i = Number(spec.extractIndex);
    if (i === 0 || i >= log.topics.length) return false;
    value = BigInt(log.topics[i]);
  } else {
    const off = Number(spec.extractIndex) * 64 + 2;
    if (log.data.length < off + 64) return false;
    value = BigInt('0x' + log.data.slice(off, off + 64));
  }
  const t = BigInt(spec.threshold);
  switch (Number(spec.cmp)) {
    case Cmp.GT: return value > t;
    case Cmp.GTE: return value >= t;
    case Cmp.LT: return value < t;
    case Cmp.LTE: return value <= t;
    case Cmp.EQ: return value === t;
    case Cmp.EXISTS: return true;
    default: return false;
  }
}

async function submitProof(marketId: number, txHash: string): Promise<void> {
  const spec = await resolver.specOf(marketId);
  const builder = new proofProvider.service.ProofBuilder(Number(spec.chainKey), PROVER);
  const result = await builder.getProof(txHash);
  if (!result.success || !result.data) throw new Error(`proof generation failed: ${result.error}`);
  const p = result.data;

  // Verify before spending gas. verifySingle is a staticcall, so this costs
  // nothing and turns a failed transaction into a log line.
  const ok = await new blockProver.PrecompileBlockProver(provider).verifySingle(
    p.chainKey, p.headerNumber, p.txBytes, p.merkleProof, p.continuityProof,
  );
  if (!ok) throw new Error('precompile rejected the proof; not submitting');
  console.log(`  proof PROVEN by precompile (block ${p.headerNumber}, ${p.continuityProof.roots.length} continuity roots)`);

  if (DRY) { console.log(`  [dry-run] would submit resolveMarket(${marketId})`); return; }

  const tx = await resolver.resolveMarket(marketId, {
    blockHeight: p.headerNumber,
    encodedTransaction: p.txBytes,
    merkleRoot: p.merkleProof.root,
    siblings: p.merkleProof.siblings.map((s: any) => ({ hash: s.hash, isLeft: s.isLeft })),
    lowerEndpointDigest: p.continuityProof.lowerEndpointDigest,
    continuityRoots: p.continuityProof.roots,
  });
  console.log(`  submitted resolveMarket(${marketId}) tx ${tx.hash}`);
  await tx.wait();
  state.resolved[marketId] = tx.hash;
  save(state);
  console.log(`  market ${marketId} RESOLVED YES`);
}

async function tick(): Promise<void> {
  const next = Number(await market.nextMarketId());

  for (let id = 1; id < next; id++) {
    if (await market.isSettled(id)) continue;

    let spec: any;
    try { spec = await resolver.specOf(id); } catch { continue; }

    const chainKey = Number(spec.chainKey);
    const from = Number(spec.fromBlock);
    const to = Number(spec.toBlock);
    const attested = await attestedHeight(chainKey);

    if (attested < from) {
      console.log(`market ${id}: window opens at ${from}, attested ${attested} (${from - attested} to go)`);
      continue;
    }

    // Only scan what is attested; an event past the attested tip has happened
    // but cannot be proven yet.
    const scanTo = Math.min(to, attested);
    const scanFrom = Math.max(from, state.scannedTo[id] ?? from);

    if (scanFrom <= scanTo) {
      const logs = await getLogs(chainKey, spec.emitter, spec.topic0, scanFrom, scanTo);
      const hit = logs.find((l) => satisfies(l, spec));
      console.log(
        `market ${id}: scanned ${scanFrom}-${scanTo} on chainKey ${chainKey} — ` +
        `${logs.length} event(s), ${logs.filter((l) => satisfies(l, spec)).length} satisfying the predicate`,
      );
      if (hit) {
        console.log(`market ${id}: match at block ${parseInt(hit.blockNumber, 16)}`);
        try { await submitProof(id, hit.transactionHash); continue; }
        catch (e) { console.log(`  ${(e as Error).message}`); }
      }
      state.scannedTo[id] = scanTo;
      save(state);
    }

    // C4 — resolve promptly, because continuity proofs get more expensive as
    // they age. NO costs nothing to establish once the window is fully behind
    // the attested tip.
    if (attested > to) {
      console.log(`market ${id}: window ${from}-${to} fully attested with no match -> settleNo`);
      if (DRY) { console.log(`  [dry-run] would submit settleNo(${id})`); continue; }
      try {
        const tx = await resolver.settleNo(id);
        await tx.wait();
        console.log(`  market ${id} RESOLVED NO (${tx.hash})`);
      } catch (e) { console.log(`  settleNo failed: ${(e as Error).message.slice(0, 120)}`); }
    }
  }
}

console.log(`crux-worker up as ${DRY ? '(dry run, unsigned)' : wallet.address}`);
console.log(`market ${cc3.CruxMarket} · resolver ${cc3.CruxAttestedResolver}\n`);

for (;;) {
  try { await tick(); }
  catch (e) { console.error(`tick failed: ${(e as Error).message.slice(0, 200)}`); }
  if (process.argv.includes('--once')) break;
  await new Promise((r) => setTimeout(r, POLL_MS));
}
