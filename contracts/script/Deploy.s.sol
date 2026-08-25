// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console} from "forge-std/Script.sol";
import {CruxMarket, ICruxResolver} from "../src/CruxMarket.sol";
import {CruxAttestedResolver} from "../src/CruxAttestedResolver.sol";
import {ICruxMarket} from "../src/ICruxMarket.sol";

/**
 * @notice Deploys the proof lane to Creditcoin CC3 testnet.
 *
 * Market and resolver each need the other's address. The cycle is broken by
 * predicting the resolver's CREATE address from the deployer's nonce, so both
 * references are immutable and NO wiring transaction is needed.
 *
 * That is not just tidiness. The earlier design used a one-shot `setResolver`,
 * and it failed two deployments in a row: Foundry under-estimates call gas on
 * CC3 by more than 3x, so the wiring transaction ran out of gas while both
 * contracts deployed successfully — producing a market that looked live and
 * could not process a single trade. Deleting the step deletes the failure.
 *
 *   forge script script/Deploy.s.sol --account crux-deployer \
 *     --rpc-url cc3_testnet --broadcast
 *
 * @dev Idempotent redeploy matters here (R5): CC3 is testnet and may be reset,
 *      so this must stay a single command with no manual steps.
 */
contract Deploy is Script {
    function run() external returns (CruxMarket market, CruxAttestedResolver resolver) {
        // The resolver is deployed immediately after the market, so its
        // address is the deployer's next-but-one CREATE address. Asserted
        // below rather than trusted.
        address deployer = msg.sender;
        uint64 nonce = vm.getNonce(deployer);
        address predictedResolver = vm.computeCreateAddress(deployer, nonce + 1);

        vm.startBroadcast();
        market = new CruxMarket(ICruxResolver(predictedResolver));
        resolver = new CruxAttestedResolver(ICruxMarket(address(market)));
        vm.stopBroadcast();

        require(address(resolver) == predictedResolver, "resolver address prediction failed");

        console.log("CruxMarket          :", address(market));
        console.log("CruxAttestedResolver:", address(resolver));
        console.log("resolver wired      :", address(market.resolver()) == address(resolver));
        console.log("(immutable - no wiring transaction, nothing left to fail)");

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
