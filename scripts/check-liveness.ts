/**
 * Phase 0 / prereq 4 — toolchain + network liveness.
 *
 * Reproduces plan §3.1–3.3 as a repeatable check instead of a one-off:
 *   - Creditcoin CC3 chain is up
 *   - which source chains are registered (getSupportedChains)
 *   - whether attestation is actually LIVE, i.e. attested height tracks the
 *     source-chain head rather than being merely registered (R1 monitor)
 *   - checkpoint interval, from getContinuityBounds
 *
 * Needs no funds and no wallet: every call is a view/staticcall (C6).
 */
import 'dotenv/config';
import { JsonRpcProvider } from 'ethers';
import { chainInfo } from '@gluwa/usc-sdk';

const CC3_RPC = process.env.CC3_RPC_URL ?? 'https://rpc.cc3-testnet.creditcoin.network';
const PROVER = process.env.PROVER_URL ?? 'https://prover.cc3-testnet.creditcoin.network';

/** Rough source-chain block times, used only to render lag in minutes. */
const BLOCK_SECONDS: Record<number, number> = { 3: 12, 1: 12 };

/**
 * Public read-only RPCs, used ONLY for eth_blockNumber to establish the source
 * head. Public nodes reject archive eth_getLogs (C8) but serve head fine, so
 * this check does not depend on the paid keys in prereqs 2-3.
 */
const HEAD_RPC: Record<number, string> = {
  3: process.env.ETH_MAINNET_RPC_URL || 'https://ethereum-rpc.publicnode.com',
  1: process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
};

/**
 * Checkpoints land every 10 source blocks (~2 min), so a fresh proof is never
 * at zero lag. Anything under this is healthy; beyond it, attestation is
 * falling behind and R1 is materialising.
 */
const HEALTHY_LAG_BLOCKS = 150; // ~30 min of Ethereum

async function sourceHead(chainKey: number): Promise<number | null> {
  const url = HEAD_RPC[chainKey];
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
      signal: AbortSignal.timeout(15_000),
    });
    const j = await res.json();
    return j.result ? parseInt(j.result, 16) : null;
  } catch {
    return null;
  }
}

function hexToAscii(hex: string): string {
  const body = hex.startsWith('0x') ? hex.slice(2) : hex;
  return (body.match(/.{1,2}/g) ?? []).map((b) => String.fromCharCode(parseInt(b, 16))).join('');
}

/** Source-chain head, via the prover's attested-height sibling route. */
async function proverAttestedHeight(chainKey: number): Promise<number | null> {
  try {
    const res = await fetch(`${PROVER}/api/v1/attested-height/${chainKey}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return (await res.json()).attestedHeight ?? null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const provider = new JsonRpcProvider(CC3_RPC);

  const [net, block, fee] = await Promise.all([
    provider.getNetwork(),
    provider.getBlockNumber(),
    provider.getFeeData(),
  ]);
  console.log('=== Creditcoin CC3 ===');
  console.log(`  chainId      : ${net.chainId}`);
  console.log(`  blockNumber  : ${block}`);
  console.log(`  gasPrice     : ${fee.gasPrice} wei`);

  const info = new chainInfo.PrecompileChainInfoProvider(provider);
  const chains = await info.getSupportedChains();

  console.log(`\n=== Supported source chains (${chains.length}) ===`);
  let allLive = true;

  for (const c of chains) {
    const chainKey = Number(c.chainKey);
    const name = hexToAscii(c.chainName);
    console.log(`\n-- chainKey ${chainKey} — "${name}" (chainId ${c.chainId}) --`);

    const latest = await info.getLatestAttestedHeightAndHash(chainKey);
    const attested = Number(latest.height ?? latest[0]);
    console.log(`  attested height (precompile) : ${attested}`);

    const viaProver = await proverAttestedHeight(chainKey);
    if (viaProver !== null) {
      console.log(`  attested height (prover API) : ${viaProver}`);
    }

    // Checkpoint interval: the gap between a checkpoint and its parent.
    try {
      const bounds = await info.getContinuityBounds(chainKey, attested);
      const parent = Number(bounds.parentHeight ?? bounds[0]);
      const child = Number(bounds.childHeight ?? bounds[1]);
      console.log(`  continuity bounds            : ${parent} -> ${child} (interval ${child - parent})`);
    } catch (e) {
      console.log(`  continuity bounds            : unavailable (${(e as Error).message.slice(0, 60)})`);
    }

    // Liveness is a lag question, not a height question: compare the attested
    // height against the live source head. A registered-but-stalled chain
    // still reports a plausible height, so height alone proves nothing.
    const head = await sourceHead(chainKey);
    let live = false;
    if (head === null) {
      console.log(`  source head                  : unavailable (no RPC)`);
      console.log(`  LAG                          : UNKNOWN`);
    } else {
      const lag = head - attested;
      const secs = BLOCK_SECONDS[chainKey] ?? 12;
      console.log(`  source head                  : ${head}`);
      console.log(`  LAG                          : ${lag} blocks (~${((lag * secs) / 60).toFixed(1)} min behind head)`);
      live = lag >= 0 && lag <= HEALTHY_LAG_BLOCKS;
    }

    allLive &&= live;
    console.log(`  LIVE ATTESTATION             : ${live ? 'YES — within healthy lag' : 'NO — STALLED OR LAGGING (R1)'}`);
  }

  console.log(`\n=== VERDICT: ${allLive ? 'all registered chains actively attesting' : 'AT LEAST ONE CHAIN STALLED (see R1)'} ===`);
  process.exit(allLive ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
