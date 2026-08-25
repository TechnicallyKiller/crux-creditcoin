// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @notice ChainInfo precompile at 0x…0fd3. Only the members CRUX needs.
/// @dev Native code, like the block prover: `eth_getCode` returns 0x, so
///      forked tests must mock it (see docs/phase-0.md, F2).
interface IChainInfo {
    function getLatestAttestedHeightAndHash(uint64 chainKey)
        external
        view
        returns (uint64 height, bytes32 hash);
}
