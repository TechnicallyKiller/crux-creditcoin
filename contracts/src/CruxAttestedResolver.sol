// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {USCBase} from "./usc/USCBase.sol";
import {INativeQueryVerifier} from "./usc/VerifierInterface.sol";
import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol";
import {AttestSpec, Extract, Comparator} from "./CruxTypes.sol";
import {ICruxMarket} from "./ICruxMarket.sol";
import {ChainInfoLib} from "./IChainInfo.sol";

/**
 * @title CruxAttestedResolver
 * @notice Settles prediction markets by cryptographic proof of an Ethereum
 *         event. There is no admin key on this path and no dispute window:
 *         anyone may submit a resolving proof, the first valid one wins, and
 *         the outcome follows from the proof rather than from anyone's say-so.
 *
 * The only trust assumption is the Attestcoin attestor quorum — the same
 * assumption Creditcoin itself makes.
 *
 * @dev Inherits USCBase for proof verification, but deliberately does NOT use
 *      its `execute` entry point. See the replay-protection note below.
 */
/**
 * @notice One Attestcoin proof, as the prover API returns it.
 * @dev Grouped into a struct rather than passed as loose parameters: the flat
 *      form overflows the stack, and this matches the shape the off-chain
 *      worker already has in hand.
 */
struct Proof {
    uint64 blockHeight;
    bytes encodedTransaction;
    bytes32 merkleRoot;
    INativeQueryVerifier.MerkleProofEntry[] siblings;
    bytes32 lowerEndpointDigest;
    bytes32[] continuityRoots;
}

contract CruxAttestedResolver is USCBase {
    ICruxMarket public immutable MARKET;

    /**
     * @notice How far past a market's window must be attested before anyone may
     *         settle it NO. ~30 minutes of Ethereum.
     *
     * @dev Without this, settleNo is a RACE, and losing it settles a market
     *      against the truth.
     *
     *      settleNo takes no proof — it cannot, since absence is not provable.
     *      It infers absence from the window being fully attested with no YES
     *      proof submitted. But "no proof submitted yet" and "no event
     *      occurred" are not the same thing, and the gap between them is
     *      exactly as long as it takes an honest resolver to notice, fetch a
     *      proof (~1s) and land a transaction.
     *
     *      A holder of NO shares is RATIONALLY MOTIVATED to exploit that gap:
     *      call settleNo the instant `toBlock` is attested and win a market
     *      that the chain can prove they lost. That is not griefing, it is the
     *      profit-maximising play, so the bounty in D6 does not deter it — the
     *      NO position is worth far more than the bounty.
     *
     *      The grace period makes the honest path unmissable: anyone watching
     *      has a guaranteed half hour to submit a proof that already exists,
     *      against a proof-generation time measured in seconds. Losing after
     *      that means nobody was watching at all, which is the only case where
     *      inferring absence is honest.
     */
    uint64 public constant SETTLE_NO_GRACE_BLOCKS = 150;

    mapping(uint256 => AttestSpec) private _specs;
    mapping(uint256 => bool) public specRegistered;

    /**
     * @dev Replay protection, at PER-MARKET granularity.
     *
     * USCBase keys `processedQueries` on keccak(chainKey, blockHeight, txIndex)
     * — the transaction alone. That is too coarse here. One Ethereum
     * transaction routinely resolves several CRUX markets at once: a single
     * Chainlink `AnswerUpdated` at $1,900 settles "ETH above $1,800?" AND "ETH
     * above $1,850?" AND "ETH above $1,900?" simultaneously. Under USCBase's
     * key the first resolution would consume the transaction and every other
     * market referencing it would revert with "Query already processed",
     * permanently unresolvable by that event.
     *
     * So we bind the market into the key. Replaying the same proof against the
     * same market is still blocked, which is the property that matters.
     */
    mapping(bytes32 => bool) public resolvedQueries;

    event SpecRegistered(uint256 indexed marketId, uint64 chainKey, address emitter, bytes32 topic0);
    event MarketResolved(
        uint256 indexed marketId,
        bool indexed outcome,
        address indexed resolver,
        uint64 sourceBlock,
        int256 operand
    );
    event SettledNoByTimeout(uint256 indexed marketId, uint64 attestedHeight);

    error SpecAlreadyRegistered(uint256 marketId);
    error SpecMissing(uint256 marketId);
    error AlreadyResolvedForMarket(uint256 marketId);
    error ProofVerificationFailed();
    error TransactionReverted();
    error UnsupportedTransactionType(uint8 txType);
    error BlockOutsideWindow(uint64 blockHeight, uint64 fromBlock, uint64 toBlock);
    error NoMatchingLog();
    error PredicateNotMet();
    error WindowNotYetAttested(uint64 attested, uint64 requiredHeight);
    error MarketAlreadySettled(uint256 marketId);

    constructor(ICruxMarket market) {
        MARKET = market;
    }

    // ---------------------------------------------------------------- specs

    function registerSpec(uint256 marketId, AttestSpec calldata spec) external {
        if (msg.sender != address(MARKET)) revert("only market");
        if (specRegistered[marketId]) revert SpecAlreadyRegistered(marketId);
        specRegistered[marketId] = true;
        _specs[marketId] = spec;
        emit SpecRegistered(marketId, spec.chainKey, spec.emitter, spec.topic0);
    }

    function specOf(uint256 marketId) external view returns (AttestSpec memory) {
        if (!specRegistered[marketId]) revert SpecMissing(marketId);
        return _specs[marketId];
    }

    // ------------------------------------------------------------ resolving

    /**
     * @notice Submit a proof that the market's event occurred. Permissionless.
     * @dev Mirrors USCBase.execute, plus a marketId. The ordering of checks is
     *      load-bearing and must not be rearranged.
     */
    function resolveMarket(uint256 marketId, Proof calldata proof) external {
        if (!specRegistered[marketId]) revert SpecMissing(marketId);
        if (MARKET.isSettled(marketId)) revert MarketAlreadySettled(marketId);

        AttestSpec memory spec = _specs[marketId];

        _guardReplay(marketId, spec.chainKey, proof);

        bool verified = _verifyProof(
            spec.chainKey,
            proof.blockHeight,
            proof.encodedTransaction,
            proof.merkleRoot,
            proof.siblings,
            proof.lowerEndpointDigest,
            proof.continuityRoots
        );
        if (!verified) revert ProofVerificationFailed();

        int256 operand = _matchSpec(spec, proof.blockHeight, proof.encodedTransaction);

        MARKET.settle(marketId, true, msg.sender);
        emit MarketResolved(marketId, true, msg.sender, proof.blockHeight, operand);
    }

    /// @dev Split out to keep `resolveMarket` under the stack limit.
    function _guardReplay(uint256 marketId, uint64 chainKey, Proof calldata proof) internal {
        bytes32 queryId =
            _computeQueryId(chainKey, proof.blockHeight, proof.merkleRoot, proof.siblings);
        bytes32 marketQueryId = keccak256(abi.encodePacked(marketId, queryId));
        if (resolvedQueries[marketQueryId]) revert AlreadyResolvedForMarket(marketId);
        resolvedQueries[marketQueryId] = true;
    }

    /**
     * @notice Settle NO once the observation window is fully attested, plus a
     *         grace period, and no valid proof ever arrived. Permissionless,
     *         and needs no proof: absence is established by attested time.
     */
    function settleNo(uint256 marketId) external {
        if (!specRegistered[marketId]) revert SpecMissing(marketId);
        if (MARKET.isSettled(marketId)) revert MarketAlreadySettled(marketId);

        AttestSpec memory spec = _specs[marketId];
        uint64 attested = ChainInfoLib.attestedHeight(spec.chainKey);

        // Two separate guards, for two separate failure modes.
        //
        // `toBlock` must be strictly behind the attested tip, or a matching
        // event could still be sitting in an unattested block — settling NO on
        // an event that did happen.
        //
        // And the grace period on top, so a resolver holding a valid proof has
        // a guaranteed window to land it before anyone can close the market
        // against them. See SETTLE_NO_GRACE_BLOCKS.
        uint64 required = spec.toBlock + SETTLE_NO_GRACE_BLOCKS;
        if (attested <= required) revert WindowNotYetAttested(attested, required);

        MARKET.settle(marketId, false, msg.sender);
        emit SettledNoByTimeout(marketId, attested);
    }

    // -------------------------------------------------------------- matching

    /**
     * @dev Decode the attested transaction and test it against the spec.
     *      Reverts unless the predicate is satisfied.
     */
    function _matchSpec(AttestSpec memory spec, uint64 blockHeight, bytes memory encodedTransaction)
        internal
        pure
        returns (int256 operand)
    {
        uint8 txType = EvmV1Decoder.getTransactionType(encodedTransaction);
        if (!EvmV1Decoder.isValidTransactionType(txType)) revert UnsupportedTransactionType(txType);

        EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(encodedTransaction);

        // C3 — INCLUSION IS NOT SUCCESS. The precompile proves a transaction was
        // included, not that it succeeded, and this is not hypothetical: a real
        // reverted mainnet transaction verifies TRUE (see docs/phase-0.md).
        // Without this check an attacker resolves any market by broadcasting a
        // transaction they know will revert. Do not remove it.
        if (receipt.receiptStatus != 1) revert TransactionReverted();

        if (blockHeight < spec.fromBlock || blockHeight > spec.toBlock) {
            revert BlockOutsideWindow(blockHeight, spec.fromBlock, spec.toBlock);
        }

        EvmV1Decoder.LogEntry[] memory logs =
            EvmV1Decoder.getLogsByEventSignature(receipt, spec.topic0);

        for (uint256 i = 0; i < logs.length; i++) {
            // A matching topic0 from the wrong contract is an attack, not a
            // match. See the note in CruxTypes.sol.
            if (logs[i].address_ != spec.emitter) continue;

            if (spec.cmp == Comparator.EXISTS) return 0;

            (bool ok, int256 value) = _extract(logs[i], spec);
            if (!ok) continue;
            if (_compare(value, spec.cmp, spec.threshold)) return value;
        }

        // Distinguish "no such log" from "log found but predicate false", so a
        // failed resolution attempt is diagnosable off-chain.
        if (logs.length == 0) revert NoMatchingLog();
        revert PredicateNotMet();
    }

    function _extract(EvmV1Decoder.LogEntry memory log, AttestSpec memory spec)
        internal
        pure
        returns (bool ok, int256 value)
    {
        if (spec.extractMode == Extract.TOPIC) {
            // topics[0] is the signature itself, so a 0 index is always a bug.
            if (spec.extractIndex == 0 || spec.extractIndex >= log.topics.length) return (false, 0);
            return (true, int256(uint256(log.topics[spec.extractIndex])));
        }

        uint256 offset = uint256(spec.extractIndex) * 32;
        if (log.data.length < offset + 32) return (false, 0);

        bytes memory data = log.data;
        bytes32 word;
        assembly {
            word := mload(add(add(data, 32), offset))
        }
        return (true, int256(uint256(word)));
    }

    function _compare(int256 value, Comparator cmp, int256 threshold) internal pure returns (bool) {
        if (cmp == Comparator.GT) return value > threshold;
        if (cmp == Comparator.GTE) return value >= threshold;
        if (cmp == Comparator.LT) return value < threshold;
        if (cmp == Comparator.LTE) return value <= threshold;
        if (cmp == Comparator.EQ) return value == threshold;
        return true; // EXISTS, handled before extraction
    }

    /// @dev USCBase's generic entry point is unused; resolveMarket replaces it.
    function _processAndEmitEvent(uint8, bytes32, bytes memory) internal pure override {
        revert("use resolveMarket");
    }
}
