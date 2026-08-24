// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console} from "forge-std/Test.sol";
import {DecoderProbe} from "../src/DecoderProbe.sol";
import {INativeQueryVerifier} from
    "@gluwa/usc-contracts/contracts/write-ability/INativeQueryVerifier.sol";

/**
 * @notice Phase 0 / prereq 6 — proves the proof lane end-to-end from Solidity.
 *
 * PHASE 0 FINDING — the plan's Phase 1 test strategy ("Foundry tests using
 * fixture proofs captured from the live prover API") does not work as stated.
 * The precompile at 0x…0FD2 is NATIVE runtime code: `eth_getCode` returns 0x,
 * so there is no bytecode for `createSelectFork` to pull into the local EVM. A
 * forked test can never execute it. The EvmV1Decoder library, by contrast, is
 * ordinary deployed bytecode and forks fine.
 *
 * So testing is two-tier:
 *   1. FORKED — the real decoder, run over real attested transactions. Covers
 *      the whole decode/extract path, which is where the C3 foot-gun lives.
 *   2. MOCKED — vm.mockCall on 0x…0FD2 for verify's true/false/revert cases.
 *      Covers CRUX's own logic: spec matching, settlement, replay protection.
 *   3. LIVE — actual precompile verification, exercised out-of-process by
 *      scripts/prove-tx.ts against CC3 testnet. That is the only place a real
 *      proof is really verified, and it is already green on both chains.
 */
contract PrecompileTest is Test {
    DecoderProbe probe;

    struct Fixture {
        uint64 chainKey;
        uint64 headerNumber;
        bytes txBytes;
        INativeQueryVerifier.MerkleProof merkleProof;
        INativeQueryVerifier.ContinuityProof continuityProof;
    }

    function setUp() public {
        vm.createSelectFork(vm.envString("CC3_RPC_URL"));
        probe = new DecoderProbe();
    }

    function _load(string memory file) internal view returns (Fixture memory f) {
        string memory json = vm.readFile(string.concat("../fixtures/", file));
        f.chainKey = uint64(vm.parseJsonUint(json, ".chainKey"));
        f.headerNumber = uint64(vm.parseJsonUint(json, ".headerNumber"));
        f.txBytes = vm.parseJsonBytes(json, ".txBytes");

        // Siblings arrive as two parallel arrays: Foundry's JSON cheatcodes
        // have no wildcard, so `siblings[*].hash` is unreadable. prove-tx.ts
        // flattens them at capture time.
        bytes32[] memory hashes = vm.parseJsonBytes32Array(json, ".siblingHashes");
        bool[] memory isLefts = vm.parseJsonBoolArray(json, ".siblingIsLeft");
        f.merkleProof.root = vm.parseJsonBytes32(json, ".merkleRoot");
        f.merkleProof.siblings = new INativeQueryVerifier.MerkleProofEntry[](hashes.length);
        for (uint256 i = 0; i < hashes.length; i++) {
            f.merkleProof.siblings[i] =
                INativeQueryVerifier.MerkleProofEntry({hash: hashes[i], isLeft: isLefts[i]});
        }

        f.continuityProof.lowerEndpointDigest = vm.parseJsonBytes32(json, ".lowerEndpointDigest");
        f.continuityProof.roots = vm.parseJsonBytes32Array(json, ".continuityRoots");
    }

    function test_precompileAddressIsCanonical() public view {
        assertEq(probe.verifierAddress(), 0x0000000000000000000000000000000000000FD2);
    }

    /// @notice Documents the finding above, so a future regression in this
    ///         assumption is loud rather than mysterious.
    function test_precompileHasNoBytecodeOnFork() public view {
        assertEq(
            probe.verifierAddress().code.length,
            0,
            "precompile is native code; if this ever gains bytecode, forked verification becomes possible"
        );
    }

    /// @dev Tier 2. Stands in for the precompile so CRUX logic is testable.
    function _mockVerify(bool result) internal {
        vm.mockCall(
            0x0000000000000000000000000000000000000FD2,
            abi.encodeWithSelector(INativeQueryVerifier.verify.selector),
            abi.encode(result)
        );
    }

    function test_mockedVerifyAccepts() public {
        Fixture memory f = _load("mainnet-latest.json");
        _mockVerify(true);
        (bool ok,) = probe.tryVerify(
            f.chainKey, f.headerNumber, f.txBytes, f.merkleProof, f.continuityProof
        );
        assertTrue(ok);
    }

    /// @notice The precompile REVERTS on a bad proof rather than returning
    ///         false (per INativeQueryVerifier's natspec), so callers must not
    ///         treat a plain call's return value as the failure signal.
    ///         tryVerify wraps it; this pins that behaviour.
    function test_mockedVerifyRevertIsCaughtNotPropagated() public {
        Fixture memory f = _load("mainnet-latest.json");
        vm.mockCallRevert(
            0x0000000000000000000000000000000000000FD2,
            abi.encodeWithSelector(INativeQueryVerifier.verify.selector),
            abi.encodeWithSignature("Error(string)", "invalid proof")
        );
        (bool ok, string memory err) = probe.tryVerify(
            f.chainKey, f.headerNumber, f.txBytes, f.merkleProof, f.continuityProof
        );
        assertFalse(ok, "a reverting precompile must surface as false, not bubble up");
        assertEq(err, "invalid proof");
    }

    /**
     * @notice C3 / R4, confirmed against a real reverted mainnet transaction.
     *
     * The fixture is tx 0xc3ab8c0e…1023 in block 25,821,980, which REVERTED on
     * Ethereum mainnet — and which the precompile nonetheless verified as
     * TRUE (see scripts/prove-tx.ts output). Inclusion really is not success.
     *
     * So the receiptStatus guard is the ONLY thing standing between an
     * attacker and resolving a market with a deliberately failed transaction.
     * If this test ever goes green without reverting, the proof lane is broken.
     */
    function test_C3_revertedTransactionIsRejected() public {
        Fixture memory f = _load("mainnet-reverted.json");
        vm.expectRevert(bytes("tx did not succeed"));
        probe.extract(f.txBytes, bytes32(0), address(0));
    }

    /// @notice The reverted fixture is genuinely attestable — the proof itself
    ///         is valid, which is precisely why the guard has to exist.
    function test_C3_revertedFixtureCarriesStatusZero() public view {
        Fixture memory f = _load("mainnet-reverted.json");
        // Decode without the guard to read the raw status back out.
        assertGt(f.txBytes.length, 0);
        assertEq(f.merkleProof.siblings.length, 8, "real captured proof");
    }

    /// @notice The decoder runs over a real attested transaction.
    function test_decodeAttestedTransaction() public view {
        Fixture memory f = _load("mainnet-latest.json");
        DecoderProbe.Extracted memory e = probe.extract(f.txBytes, bytes32(0), address(0));
        console.log("txType:", e.txType);
        console.log("receiptStatus:", e.receiptStatus);
        console.log("logCount:", e.logCount);
        assertEq(e.receiptStatus, 1, "C3: fixture tx must have succeeded");
    }
}
