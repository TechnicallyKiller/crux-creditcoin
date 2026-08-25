/**
 * End-to-end demo driver.
 *
 * Emits `cast send` commands rather than broadcasting, because signing uses the
 * encrypted Foundry keystore and its password should be typed by a human, not
 * handed to a script.
 *
 * Why cast and not `forge script`: forge simulates a script locally before
 * broadcasting, and CRUX's transactions call precompiles, which are native code
 * with no EVM bytecode. A local simulation of them fails with "call to
 * non-contract address" no matter what the chain would do. cast sends without
 * local simulation and estimates gas via the node — whose estimates are
 * accurate, unlike forge's (docs/deployment.md D1, D5).
 *
 *   node --experimental-strip-types scripts/demo.ts plan
 *   node --experimental-strip-types scripts/demo.ts resolve <marketId>
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { Interface, JsonRpcProvider } from 'ethers';

const CC3 = process.env.CC3_RPC_URL ?? 'https://rpc.cc3-testnet.creditcoin.network';
const SEPOLIA_CHAINKEY = 1n;

const cc3 = JSON.parse(readFileSync('deployments/cc3-testnet.json', 'utf8'));
const sepolia = JSON.parse(readFileSync('deployments/sepolia.json', 'utf8'));

const CHAIN_INFO = '0x0000000000000000000000000000000000000fD3';
const SNAPSHOT_TOPIC0 = '0xc3b24b791df9fb85de5fb1dfa2076895e530aedd1285335927bcd2e1616d9c71';

const chainInfoAbi = new Interface([
  'function get_latest_attestation_height_and_hash(uint64) view returns (tuple(uint64 height, bytes32 hash, bool isAttestation, bool exists))',
]);

const marketAbi = new Interface([
  'function createMarket((uint64 chainKey,address emitter,bytes32 topic0,uint8 extractMode,uint8 extractIndex,uint8 cmp,int256 threshold,uint64 fromBlock,uint64 toBlock) spec, uint64 closeBlock, uint256 b, string question) payable returns (uint256)',
  'function LAG_BUFFER_BLOCKS() view returns (uint64)',
  'function nextMarketId() view returns (uint256)',
  'function isSettled(uint256) view returns (bool)',
]);

const resolverAbi = new Interface([
  'function resolveMarket(uint256 marketId, (uint64 blockHeight, bytes encodedTransaction, bytes32 merkleRoot, (bytes32 hash, bool isLeft)[] siblings, bytes32 lowerEndpointDigest, bytes32[] continuityRoots) proof)',
]);

const provider = new JsonRpcProvider(CC3);

async function attestedHeight(chainKey: bigint): Promise<bigint> {
  const data = chainInfoAbi.encodeFunctionData('get_latest_attestation_height_and_hash', [chainKey]);
  const raw = await provider.call({ to: CHAIN_INFO, data });
  const [r] = chainInfoAbi.decodeFunctionResult('get_latest_attestation_height_and_hash', raw);
  if (!r.exists) throw new Error(`no attestation for chainKey ${chainKey}`);
  return r.height;
}

const CAST = (to: string, data: string, extra = '') =>
  `cast send ${to} --data ${data} ${extra}--account crux-deployer --rpc-url cc3_testnet`;

async function plan(): Promise<void> {
  const attested = await attestedHeight(SEPOLIA_CHAINKEY);
  const buffer = 150n;

  // Trading closes shortly from now; the window opens a full buffer later, so
  // no event that could decide the market is visible while trading is open.
  const closeBlock = attested + 25n;
  const fromBlock = closeBlock + buffer;
  const toBlock = fromBlock + 600n;

  const b = 100_000000000000000000n; // 100e18

  // The contract requires msg.value >= LMSR.maxLoss(b), computed in PRBMath
  // fixed point. Reproducing that exactly in JS is not worth the risk: if this
  // lands even one wei low, createMarket reverts InsufficientSubsidy. Overpay
  // by a margin instead — surplus simply becomes extra collateral backing the
  // market, so the only cost of being generous is a rounding error's worth of
  // locked tCTC.
  const subsidy = (b * 693147180559945309n) / 10n ** 18n + 10n ** 15n;

  const spec = {
    chainKey: SEPOLIA_CHAINKEY,
    emitter: sepolia.CruxBeacon,
    topic0: SNAPSHOT_TOPIC0,
    extractMode: 0, // TOPIC
    extractIndex: 3, // CruxBeacon puts word0 at topics[3]
    cmp: 0, // GT
    threshold: 0n,
    fromBlock,
    toBlock,
  };

  const data = marketAbi.encodeFunctionData('createMarket', [
    [spec.chainKey, spec.emitter, spec.topic0, spec.extractMode, spec.extractIndex, spec.cmp, spec.threshold, spec.fromBlock, spec.toBlock],
    closeBlock,
    b,
    'Will CruxBeacon report a non-zero value on Sepolia?',
  ]);

  const marketId = await provider.call({
    to: cc3.CruxMarket,
    data: marketAbi.encodeFunctionData('nextMarketId', []),
  });

  writeFileSync(
    'deployments/market-plan.json',
    JSON.stringify(
      { marketId: Number(marketId), closeBlock: String(closeBlock), fromBlock: String(fromBlock), toBlock: String(toBlock), attestedAtPlan: String(attested), beacon: sepolia.CruxBeacon },
      null, 2,
    ),
  );

  console.log(`attested Sepolia height : ${attested}`);
  console.log(`trading closes at       : ${closeBlock}  (attested + 25)`);
  console.log(`observation window      : ${fromBlock} -> ${toBlock}`);
  console.log(`subsidy (b*ln2, rounded): ${subsidy} wei`);
  console.log(`this will be marketId   : ${Number(marketId)}\n`);
  console.log('Run:\n');
  console.log(`  ${CAST(cc3.CruxMarket, data, `--value ${subsidy} `)}\n`);
  console.log('Then wait until attested Sepolia height passes', fromBlock.toString());
  console.log('(check: npm run liveness), and fire the snapshot.');
}

async function resolve(marketId: string): Promise<void> {
  const f = JSON.parse(readFileSync('fixtures/sepolia-latest.json', 'utf8'));
  const proof = [
    BigInt(f.headerNumber),
    f.txBytes,
    f.merkleRoot,
    f.siblingHashes.map((h: string, i: number) => [h, f.siblingIsLeft[i]]),
    f.lowerEndpointDigest,
    f.continuityRoots,
  ];
  const data = resolverAbi.encodeFunctionData('resolveMarket', [BigInt(marketId), proof]);

  console.log(`proof source block : ${f.headerNumber}`);
  console.log(`calldata size      : ${(data.length - 2) / 2} bytes\n`);
  console.log('Run:\n');
  console.log(`  ${CAST(cc3.CruxAttestedResolver, data)}\n`);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'plan') await plan();
else if (cmd === 'resolve') await resolve(arg);
else {
  console.log('usage: demo.ts plan | demo.ts resolve <marketId>');
  process.exit(1);
}
