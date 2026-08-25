// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console} from "forge-std/Script.sol";
import {CruxBeacon} from "../src/CruxBeacon.sol";

/**
 * @notice Deploys CruxBeacon to Sepolia (chainKey 1).
 *
 * Sepolia rather than mainnet for two reasons: snapshotting mainnet would cost
 * real ETH, and Sepolia is where we can fire an event on demand during a live
 * demo instead of waiting for the world to produce one.
 *
 *   forge script script/DeployBeacon.s.sol --account crux-deployer \
 *     --rpc-url sepolia --broadcast
 */
contract DeployBeacon is Script {
    function run() external returns (CruxBeacon beacon) {
        vm.startBroadcast();
        beacon = new CruxBeacon();
        vm.stopBroadcast();

        console.log("CruxBeacon (Sepolia):", address(beacon));
    }
}
