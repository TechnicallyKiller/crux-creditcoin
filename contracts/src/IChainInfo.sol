// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @notice ChainInfo precompile at 0x…0fD3.
 *
 * @dev The names here are snake_case and the returns are structs, which does
 *      not match the SDK. the SDK package exposes this as
 *      `getLatestAttestedHeightAndHash`, but that is the TypeScript wrapper's
 *      name — the Solidity ABI is `get_latest_attestation_height_and_hash`,
 *      and calling the camelCase form reverts with "Unknown selector".
 *
 *      Verified against live CC3 by scripts/check-abi.ts, which is the only
 *      way to check: precompiles are native code with no EVM bytecode, so a
 *      forked test cannot call them and a mocked test will happily validate an
 *      interface that does not exist (docs/phase-0.md, F2).
 */
interface IChainInfo {
    struct HeightHashResult {
        uint64 height;
        bytes32 hash;
        bool isAttestation; // true for attestation, false for checkpoint
        bool exists;
    }

    function get_latest_attestation_height_and_hash(uint64 chainKey)
        external
        view
        returns (HeightHashResult memory result);

    function is_height_attested(uint64 chainKey, uint64 targetHeight)
        external
        view
        returns (bool isAttested);
}

/// @notice Shared accessor so the market and the resolver cannot drift apart
///         on how they read attestation state.
library ChainInfoLib {
    IChainInfo internal constant CHAIN_INFO =
        IChainInfo(0x0000000000000000000000000000000000000fD3);

    error AttestationUnavailable(uint64 chainKey);

    /**
     * @notice Latest attested height for a source chain.
     * @dev Reverts when the precompile reports `exists == false`. Treating an
     *      absent attestation as height 0 would silently reopen trading on
     *      every market — failing closed is the only safe reading.
     */
    function attestedHeight(uint64 chainKey) internal view returns (uint64) {
        IChainInfo.HeightHashResult memory r =
            CHAIN_INFO.get_latest_attestation_height_and_hash(chainKey);
        if (!r.exists) revert AttestationUnavailable(chainKey);
        return r.height;
    }
}
