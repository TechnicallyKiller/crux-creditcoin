// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console} from "forge-std/Script.sol";
import {CruxAttestedResolver, Proof} from "../src/CruxAttestedResolver.sol";
import {CruxMarket} from "../src/CruxMarket.sol";
import {INativeQueryVerifier} from "../src/usc/VerifierInterface.sol";

/**
 * @notice Step 4: submit the proof and let the market settle itself.
 *
 *   forge script script/ResolveMarket.s.sol --account crux-deployer \
 *     --rpc-url cc3_testnet --broadcast --gas-estimate-multiplier 300
 *
 * @dev Reads the proof captured by scripts/prove-tx.ts. Anyone may run this —
 *      the resolver has no privileged caller, and whoever lands the proof
 *      collects the market's bounty (D6). Our running it is a convenience, not
 *      a trust assumption: if we vanish, someone else is paid to do it.
 */
contract ResolveMarket is Script {
    function run() external {
        string memory cc3 = vm.readFile("../deployments/cc3-testnet.json");
        CruxAttestedResolver resolver =
            CruxAttestedResolver(vm.parseJsonAddress(cc3, ".CruxAttestedResolver"));
        CruxMarket market = CruxMarket(payable(vm.parseJsonAddress(cc3, ".CruxMarket")));

        uint256 marketId =
            vm.parseJsonUint(vm.readFile("../deployments/market-latest.json"), ".marketId");

        Proof memory p = _loadProof("sepolia-latest.json");

        console.log("marketId      :", marketId);
        console.log("source block  :", p.blockHeight);
        console.log("settled before:", market.isSettled(marketId));

        vm.startBroadcast();
        resolver.resolveMarket(marketId, p);
        vm.stopBroadcast();

        console.log("settled after :", market.isSettled(marketId));
        console.log("outcome       :", _outcomeOf(market, marketId) ? "YES" : "NO");
    }

    /**
     * @dev Reads just the `outcome` field. Destructuring the full 13-field
     *      Market tuple overflows the stack, and every field is statically
     *      encoded, so the fourth word of the return data is the one we want.
     */
    function _outcomeOf(CruxMarket market, uint256 marketId) internal view returns (bool) {
        (bool ok, bytes memory data) =
            address(market).staticcall(abi.encodeWithSignature("markets(uint256)", marketId));
        require(ok && data.length >= 128, "markets() read failed");
        uint256 word;
        assembly {
            word := mload(add(data, 128)) // 32 (length) + 3 * 32 (skip 3 fields)
        }
        return word != 0;
    }

    function _loadProof(string memory file) internal view returns (Proof memory p) {
        string memory json = vm.readFile(string.concat("../fixtures/", file));
        p.blockHeight = uint64(vm.parseJsonUint(json, ".headerNumber"));
        p.encodedTransaction = vm.parseJsonBytes(json, ".txBytes");
        p.merkleRoot = vm.parseJsonBytes32(json, ".merkleRoot");

        bytes32[] memory hashes = vm.parseJsonBytes32Array(json, ".siblingHashes");
        bool[] memory isLefts = vm.parseJsonBoolArray(json, ".siblingIsLeft");
        p.siblings = new INativeQueryVerifier.MerkleProofEntry[](hashes.length);
        for (uint256 i = 0; i < hashes.length; i++) {
            p.siblings[i] =
                INativeQueryVerifier.MerkleProofEntry({hash: hashes[i], isLeft: isLefts[i]});
        }
        p.lowerEndpointDigest = vm.parseJsonBytes32(json, ".lowerEndpointDigest");
        p.continuityRoots = vm.parseJsonBytes32Array(json, ".continuityRoots");
    }
}
