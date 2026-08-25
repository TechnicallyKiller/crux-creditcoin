// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console} from "forge-std/Script.sol";
import {CruxMarket, ICruxResolver} from "../src/CruxMarket.sol";
import {CruxAttestedResolver} from "../src/CruxAttestedResolver.sol";
import {ICruxMarket} from "../src/ICruxMarket.sol";

/**
 * @notice Deploys the proof lane to Creditcoin CC3 testnet.
 *
 * Market and resolver each need the other's address, so the cycle is broken by
 * a one-shot `setResolver` rather than by making either mutable. `setResolver`
 * reverts on a second call, so the wiring cannot be changed after this script
 * runs — there is no lingering admin power over settlement.
 *
 *   forge script script/Deploy.s.sol --account crux-deployer \
 *     --rpc-url cc3_testnet --broadcast
 *
 * @dev Idempotent redeploy matters here (R5): CC3 is testnet and may be reset,
 *      so this must stay a single command with no manual steps.
 */
contract Deploy is Script {
    function run() external returns (CruxMarket market, CruxAttestedResolver resolver) {
        vm.startBroadcast();

        market = new CruxMarket();
        resolver = new CruxAttestedResolver(ICruxMarket(address(market)));
        market.setResolver(ICruxResolver(address(resolver)));

        vm.stopBroadcast();

        console.log("CruxMarket          :", address(market));
        console.log("CruxAttestedResolver:", address(resolver));
        console.log("resolver wired      :", address(market.resolver()) == address(resolver));

        // Record addresses so the market-lifecycle scripts and the off-chain
        // worker need no hand-copied constants. R5: after a testnet reset this
        // file is the only thing that has to change, and it rewrites itself.
        string memory out = "deployment";
        vm.serializeAddress(out, "CruxMarket", address(market));
        vm.serializeAddress(out, "CruxAttestedResolver", address(resolver));
        vm.serializeUint(out, "chainId", block.chainid);
        string memory json = vm.serializeUint(out, "deployedAtBlock", block.number);
        vm.writeJson(json, "../deployments/cc3-testnet.json");
    }
}
