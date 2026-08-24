// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {USCBase} from "./usc/USCBase.sol";
import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol";

/**
 * @title CruxBaseProbe
 * @notice Phase 0 / prereq 6. Proves USCBase can actually be inherited and that
 *         the decoder composes with it — the exact shape CruxAttestedResolver
 *         will take in Phase 1 (plan §09), minus the market logic.
 */
contract CruxBaseProbe is USCBase {
    event Matched(bytes32 indexed queryId, address emitter, bytes32 operand);

    bytes32 public lastQueryId;
    uint256 public matchCount;

    function _processAndEmitEvent(uint8, bytes32 queryId, bytes memory encodedTransaction)
        internal
        override
    {
        uint8 txType = EvmV1Decoder.getTransactionType(encodedTransaction);
        require(EvmV1Decoder.isValidTransactionType(txType), "unsupported tx type");

        EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(encodedTransaction);
        require(receipt.receiptStatus == 1, "tx did not succeed"); // C3

        lastQueryId = queryId;
        matchCount = receipt.receiptLogs.length;
        emit Matched(queryId, address(0), bytes32(0));
    }
}
