/**
 * Precompile ABI conformance.
 *
 * Every precompile selector the contracts depend on is asserted to actually
 * exist on live CC3. This is not paranoia — it caught a real bug.
 *
 * `IChainInfo` was originally written against the SDK's TypeScript method
 * names (`getLatestAttestedHeightAndHash`). The Solidity ABI is snake_case
 * (`get_latest_attestation_height_and_hash`) and returns a struct, so the
 * deployed contracts reverted "Unknown selector" on every trade — while the
 * test suite passed, because it mocked the interface it had invented.
 *
 * Neither kind of test can catch that on its own:
 *   - mocked tests validate the mock, not the chain;
 *   - forked tests cannot call precompiles at all, because they are native
 *     code with no EVM bytecode (docs/phase-0.md, F2).
 *
 * So this check has to exist, and it has to run against the real network.
 */
import 'dotenv/config';
import { id } from 'ethers';

const RPC = process.env.CC3_RPC_URL ?? 'https://rpc.cc3-testnet.creditcoin.network';

const BLOCK_PROVER = '0x0000000000000000000000000000000000000FD2';
const CHAIN_INFO = '0x0000000000000000000000000000000000000fD3';

/** Every signature the contracts actually call. */
const REQUIRED: Array<{ addr: string; sig: string; usedBy: string }> = [
  {
    addr: BLOCK_PROVER,
    sig: 'verifyAndEmit(uint64,uint64,bytes,(bytes32,(bytes32,bool)[]),(bytes32,bytes32[]))',
    usedBy: 'USCBase._verifyProof',
  },
  {
    addr: BLOCK_PROVER,
    sig: 'calculateTxIndex((bytes32,(bytes32,bool)[]))',
    usedBy: 'USCBase._computeQueryId',
  },
  {
    addr: CHAIN_INFO,
    sig: 'get_latest_attestation_height_and_hash(uint64)',
    usedBy: 'ChainInfoLib.attestedHeight -> CruxMarket trading gate, resolver settleNo',
  },
];

const selector = (sig: string) => id(sig).slice(0, 10);

async function exists(addr: string, sig: string): Promise<boolean> {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to: addr, data: selector(sig) }, 'latest'],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  // A present selector fails on argument decoding; an absent one is rejected
  // by the precompile's dispatcher with "Unknown selector".
  return !/unknown selector/i.test(text);
}

let failed = 0;
console.log('Precompile ABI conformance — live CC3\n');
for (const r of REQUIRED) {
  const ok = await exists(r.addr, r.sig);
  console.log(`${ok ? 'OK     ' : 'MISSING'}  ${selector(r.sig)}  ${r.sig}`);
  console.log(`          used by ${r.usedBy}`);
  if (!ok) failed++;
}

console.log(
  failed === 0
    ? '\nAll required selectors present.'
    : `\n${failed} MISSING — deployed contracts will revert "Unknown selector" at runtime.`,
);
process.exit(failed === 0 ? 0 : 1);
