/**
 * Re-verify a proof from the viewer's own browser.
 *
 * The most trust-inverting thing the product does, so it has to actually
 * happen. Two calls, neither to a server we operate:
 *
 *   1. GET the proof from the public Attestcoin prover
 *   2. eth_call the block-prover precompile on a public Creditcoin RPC
 *
 * Both send `access-control-allow-origin: *`, so a browser can do this
 * directly, and a sceptic can point step 2 at their own node.
 *
 * PROOFS EXPIRE — the reason this fetches rather than shipping a fixture.
 * A continuity proof chains a block to the CURRENT committed attestation, so as
 * Creditcoin advances an old proof stops verifying entirely rather than merely
 * costing more gas. Measured on one Chainlink transaction: a proof captured
 * four days earlier carried 5 continuity roots and was rejected with
 * "Continuity proof does not match attestation or checkpoint"; regenerated for
 * the identical transaction it carried 65 roots and returned true. The plan's
 * C4 treated staleness as a 10–100× gas penalty; it is harder than that — stale
 * proofs are invalid, not expensive.
 */
import { encodeFunctionData, decodeFunctionResult, parseAbi, type Hex } from 'viem';
import { ADDRESSES } from './chain';

const verifyAbi = parseAbi([
  'function verify(uint64 chainKey, uint64 height, bytes encodedTransaction, (bytes32 root, (bytes32 hash, bool isLeft)[] siblings) merkleProof, (bytes32 lowerEndpointDigest, bytes32[] roots) continuityProof) view returns (bool)',
]);

export const PROVER = 'https://prover.cc3-testnet.creditcoin.network';
/** Public endpoints. Neither is operated by us — substitute your own freely. */
export const PUBLIC_RPCS = [
  'https://creditcoin-testnet.blockscout.com/api/eth-rpc',
  'https://rpc.cc3-testnet.creditcoin.network',
];

export interface ProverProof {
  chainKey: number;
  headerNumber: number;
  txIndex: number;
  txHash: Hex;
  txBytes: Hex;
  merkleProof: { root: Hex; siblings: { hash: Hex; isLeft: boolean }[] };
  continuityProof: { lowerEndpointDigest: Hex; roots: Hex[] };
  generatedAt?: string;
}

export type Step = 'idle' | 'fetching' | 'verifying' | 'done' | 'failed';

export interface VerifyResult {
  ok: boolean;
  fetchMs: number;
  verifyMs: number;
  bytes: number;
  siblings: number;
  roots: number;
  rpc: string;
  detail: string;
  proof?: ProverProof;
}

export async function fetchProof(chainKey: number, txHash: string): Promise<ProverProof> {
  const res = await fetch(`${PROVER}/api/v1/proof-by-tx/${chainKey}/${txHash}`);
  if (!res.ok) throw new Error(`prover returned ${res.status}`);
  return (await res.json()) as ProverProof;
}

export function encodeVerifyCall(p: ProverProof): Hex {
  return encodeFunctionData({
    abi: verifyAbi,
    functionName: 'verify',
    args: [
      BigInt(p.chainKey),
      BigInt(p.headerNumber),
      p.txBytes,
      { root: p.merkleProof.root, siblings: p.merkleProof.siblings },
      { lowerEndpointDigest: p.continuityProof.lowerEndpointDigest, roots: p.continuityProof.roots },
    ],
  });
}

export async function reverify(
  chainKey: number,
  txHash: string,
  onStep?: (s: Step) => void,
  rpc = PUBLIC_RPCS[0],
): Promise<VerifyResult> {
  onStep?.('fetching');
  const t0 = performance.now();
  const proof = await fetchProof(chainKey, txHash);
  const fetchMs = Math.round(performance.now() - t0);

  const data = encodeVerifyCall(proof);
  const bytes = (data.length - 2) / 2;

  onStep?.('verifying');
  const t1 = performance.now();
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'eth_call',
      params: [{ to: ADDRESSES.blockProver, data }, 'latest'],
    }),
  });
  const json = await res.json();
  const verifyMs = Math.round(performance.now() - t1);

  const base = {
    fetchMs, verifyMs, bytes, rpc, proof,
    siblings: proof.merkleProof.siblings.length,
    roots: proof.continuityProof.roots.length,
  };

  if (json.error) {
    // The precompile reverts on a bad proof rather than returning false
    // (docs/phase-0.md F4), so this is a real negative result, reported as one.
    onStep?.('failed');
    return { ...base, ok: false, detail: String(json.error.message ?? json.error).slice(0, 160) };
  }

  const ok = decodeFunctionResult({ abi: verifyAbi, functionName: 'verify', data: json.result }) as boolean;
  onStep?.(ok ? 'done' : 'failed');
  return { ...base, ok, detail: ok ? 'precompile returned true' : 'precompile returned false' };
}
