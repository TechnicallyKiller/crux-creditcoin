/**
 * Chain access.
 *
 * Reads go through Blockscout's proxy by default: the official CC3 endpoint
 * degraded to ~15.7s per call while the proxy answers the same queries in under
 * a second (docs/deployment.md). A UI that waits 15s for a price looks broken
 * even when the chain is healthy, so the fast path is the default and the
 * official endpoint is the fallback.
 */
import { createPublicClient, http, fallback, defineChain, parseAbi } from 'viem';

export const cc3 = defineChain({
  id: 102031,
  name: 'Creditcoin CC3 Testnet',
  nativeCurrency: { name: 'Test Creditcoin', symbol: 'tCTC', decimals: 18 },
  rpcUrls: { default: { http: ['https://creditcoin-testnet.blockscout.com/api/eth-rpc'] } },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://creditcoin-testnet.blockscout.com' },
  },
  testnet: true,
});

export const publicClient = createPublicClient({
  chain: cc3,
  transport: fallback([
    http('https://creditcoin-testnet.blockscout.com/api/eth-rpc', { timeout: 20_000 }),
    http('https://rpc.cc3-testnet.creditcoin.network', { timeout: 30_000 }),
  ]),
});

export const ADDRESSES = {
  market: '0x34a712c4206a826d3E44be50FFcc33bE1Fa3dA3C',
  resolver: '0x3a2153c98B967578F764c5Df340dc7c5E99B8757',
  decoder: '0x6e94c85Bf6b80394a4c051d03EC93Eefc854423F',
  blockProver: '0x0000000000000000000000000000000000000FD2',
  chainInfo: '0x0000000000000000000000000000000000000fD3',
  beacon: '0x0F1bf92EE0C79F7Ca5C1e30E9412aD5BFF45c7C8',
} as const;

export const marketAbi = parseAbi([
  'function nextMarketId() view returns (uint256)',
  'function isSettled(uint256) view returns (bool)',
  'function priceYes(uint256) view returns (uint256)',
  'function markets(uint256) view returns (address creator, uint8 lane, bool settled, bool outcome, uint64 tradingCloseBlock, uint64 chainKey, uint256 b, uint256 qYes, uint256 qNo, uint256 subsidy, uint256 collateral, uint256 bountyPool, uint256 creatorFees)',
  'function quoteBuy(uint256 marketId, bool yes, uint256 shares) view returns (uint256)',
  'function yesShares(uint256, address) view returns (uint256)',
  'function noShares(uint256, address) view returns (uint256)',
  'function buy(uint256 marketId, bool yes, uint256 shares, uint256 maxCost) payable',
  'function claim(uint256 marketId)',
  'function LAG_BUFFER_BLOCKS() view returns (uint64)',
]);

export const resolverAbi = parseAbi([
  'function specOf(uint256) view returns ((uint64 chainKey, address emitter, bytes32 topic0, uint8 extractMode, uint8 extractIndex, uint8 cmp, int256 threshold, uint64 fromBlock, uint64 toBlock))',
  'function SETTLE_NO_GRACE_BLOCKS() view returns (uint64)',
]);

export const chainInfoAbi = parseAbi([
  'function get_latest_attestation_height_and_hash(uint64) view returns ((uint64 height, bytes32 hash, bool isAttestation, bool exists))',
]);

/** Human names for the source chains Attestcoin attests. */
export const CHAIN_NAMES: Record<number, string> = {
  3: 'ETHEREUM MAINNET',
  1: 'ETHEREUM SEPOLIA',
};

export const CMP = ['GT', 'GTE', 'LT', 'LTE', 'EQ', 'EXISTS'] as const;

export function explorerTx(hash: string) {
  return `https://creditcoin-testnet.blockscout.com/tx/${hash}`;
}
export function ethExplorerTx(hash: string, chainKey: number) {
  return chainKey === 3
    ? `https://etherscan.io/tx/${hash}`
    : `https://sepolia.etherscan.io/tx/${hash}`;
}
