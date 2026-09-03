export const MARKET_ABI = [
  'function nextMarketId() view returns (uint256)',
  'function isSettled(uint256) view returns (bool)',
  'function markets(uint256) view returns (address creator, uint8 lane, bool settled, bool outcome, uint64 tradingCloseBlock, uint64 chainKey, uint256 b, uint256 qYes, uint256 qNo, uint256 subsidy, uint256 collateral, uint256 bountyPool, uint256 creatorFees)',
] as const;

export const RESOLVER_ABI = [
  'function specOf(uint256) view returns (tuple(uint64 chainKey, address emitter, bytes32 topic0, uint8 extractMode, uint8 extractIndex, uint8 cmp, int256 threshold, uint64 fromBlock, uint64 toBlock))',
  'function resolveMarket(uint256 marketId, (uint64 blockHeight, bytes encodedTransaction, bytes32 merkleRoot, (bytes32 hash, bool isLeft)[] siblings, bytes32 lowerEndpointDigest, bytes32[] continuityRoots) proof)',
  'function settleNo(uint256 marketId)',
] as const;

export const CHAIN_INFO_ABI = [
  'function get_latest_attestation_height_and_hash(uint64) view returns (tuple(uint64 height, bytes32 hash, bool isAttestation, bool exists))',
] as const;

export const CHAIN_INFO = '0x0000000000000000000000000000000000000fD3';

/**
 * Mirrors the Comparator and Extract enums in CruxTypes.sol.
 *
 * Plain objects rather than TS `enum`: Node's type-stripping runs in strip-only
 * mode, and an enum emits runtime code, so it is rejected outright.
 */
export const Cmp = { GT: 0, GTE: 1, LT: 2, LTE: 3, EQ: 4, EXISTS: 5 } as const;
export const Extract = { TOPIC: 0, DATA_WORD: 1 } as const;
