// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol";
import {
    INativeQueryVerifier,
    NativeQueryVerifierLib
} from "@gluwa/usc-contracts/contracts/write-ability/INativeQueryVerifier.sol";

/**
 * @title DecoderProbe
 * @notice Phase 0 / prereq 6. Not product code — this exists to prove that the
 *         EvmV1Decoder import path, the library linking, and the precompile
 *         interface all actually compile and behave as the plan assumes,
 *         before CruxAttestedResolver is written on top of them (plan §09).
 *
 *         Everything here is the exact call sequence _processAndEmitEvent will
 *         perform, so if this compiles and runs, Phase 1 has no unknowns left
 *         in the decode path.
 */
contract DecoderProbe {
    /// @dev Mirrors the ordered checks in plan §09.
    struct Extracted {
        uint8 txType;
        uint8 receiptStatus;
        uint256 logCount;
        uint256 matchCount;
        address firstEmitter;
        bytes32 firstOperand;
    }

    /**
     * @notice Decode an attested transaction and pull out the logs matching a
     *         signature, applying the C3 receipt-status guard.
     * @dev C3 is the highest-severity foot-gun in the stack: inclusion is not
     *      success. A deliberately reverted transaction is still provably
     *      included, so without this require an attacker resolves a market with
     *      a failed tx.
     */
    function extract(bytes memory encodedTransaction, bytes32 topic0, address emitter)
        public
        pure
        returns (Extracted memory out)
    {
        out.txType = EvmV1Decoder.getTransactionType(encodedTransaction);
        require(EvmV1Decoder.isValidTransactionType(out.txType), "unsupported tx type");

        EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(encodedTransaction);
        require(receipt.receiptStatus == 1, "tx did not succeed"); // C3 — non-negotiable

        out.receiptStatus = uint8(receipt.receiptStatus);
        out.logCount = receipt.receiptLogs.length;

        EvmV1Decoder.LogEntry[] memory logs = EvmV1Decoder.getLogsByEventSignature(receipt, topic0);

        // A matching topic0 from the WRONG contract is an attack, not a match.
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].address_ != emitter) continue;
            if (out.matchCount == 0) {
                out.firstEmitter = logs[i].address_;
                // topics[1] is where Chainlink's AnswerUpdated price sits (§3.9)
                out.firstOperand = logs[i].topics.length > 1 ? logs[i].topics[1] : bytes32(0);
            }
            out.matchCount++;
        }
    }

    /// @notice Confirms the precompile address the library resolves to.
    function verifierAddress() public pure returns (address) {
        return address(NativeQueryVerifierLib.getVerifier());
    }

    /**
     * @notice Live precompile call. `verify` is a `view` that REVERTS on
     *         failure rather than returning false, so a plain call cannot
     *         distinguish "invalid proof" from "returned false". We wrap it.
     */
    function tryVerify(
        uint64 chainKey,
        uint64 height,
        bytes calldata encodedTransaction,
        INativeQueryVerifier.MerkleProof calldata merkleProof,
        INativeQueryVerifier.ContinuityProof calldata continuityProof
    ) external view returns (bool ok, string memory err) {
        try NativeQueryVerifierLib.getVerifier().verify(
            chainKey, height, encodedTransaction, merkleProof, continuityProof
        ) returns (bool result) {
            return (result, "");
        } catch Error(string memory reason) {
            return (false, reason);
        } catch {
            return (false, "precompile reverted");
        }
    }
}
