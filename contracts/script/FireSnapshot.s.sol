// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console} from "forge-std/Script.sol";
import {CruxBeacon} from "../src/CruxBeacon.sol";

/**
 * @notice Step 2: fire a beacon snapshot on Sepolia, inside the market's
 *         observation window. This is the "event happens" moment.
 *
 *   forge script script/FireSnapshot.s.sol --account crux-deployer \
 *     --rpc-url sepolia --broadcast --gas-estimate-multiplier 300
 *
 * @dev Targets the beacon's own `probe()`. Any view returning a non-zero word
 *      would do, but self-targeting keeps the demo free of external
 *      dependencies that could break on a testnet reset.
 */
contract FireSnapshot is Script {
    function run() external {
        string memory sep = vm.readFile("../deployments/sepolia.json");
        CruxBeacon beacon = CruxBeacon(vm.parseJsonAddress(sep, ".CruxBeacon"));

        vm.startBroadcast();
        bytes memory result =
            beacon.snapshotSelector(bytes32("crux-demo"), address(beacon), beacon.probe.selector);
        vm.stopBroadcast();

        console.log("snapshot fired. observed value:", abi.decode(result, (uint256)));
        console.log("Next: node --experimental-strip-types scripts/prove-tx.ts 1 <txHash>");
    }
}
