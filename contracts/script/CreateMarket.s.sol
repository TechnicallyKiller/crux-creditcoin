// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console} from "forge-std/Script.sol";
import {CruxMarket} from "../src/CruxMarket.sol";
import {AttestSpec, Extract, Comparator} from "../src/CruxTypes.sol";
import {LMSR} from "../src/LMSR.sol";
import {ChainInfoLib} from "../src/IChainInfo.sol";

/**
 * @notice Step 1 of the end-to-end demo: open a market whose answer lives on
 *         Sepolia, resolvable by a CruxBeacon snapshot.
 *
 *   forge script script/CreateMarket.s.sol --account crux-deployer \
 *     --rpc-url cc3_testnet --broadcast --gas-estimate-multiplier 300
 *
 * @dev The observation window is computed from the CURRENT attested Sepolia
 *      height, not from wall-clock guesses, because the market contract
 *      enforces its safety margin in source-chain blocks (R3). Trading closes
 *      LAG_BUFFER_BLOCKS before the window opens, so the market is shut well
 *      before any event that could decide it becomes visible on Sepolia.
 */
contract CreateMarket is Script {
    uint64 constant SEPOLIA = 1;
    bytes32 constant SNAPSHOT_TOPIC0 =
        0xc3b24b791df9fb85de5fb1dfa2076895e530aedd1285335927bcd2e1616d9c71;

    function run() external {
        string memory cc3 = vm.readFile("../deployments/cc3-testnet.json");
        CruxMarket market = CruxMarket(payable(vm.parseJsonAddress(cc3, ".CruxMarket")));

        string memory sep = vm.readFile("../deployments/sepolia.json");
        address beacon = vm.parseJsonAddress(sep, ".CruxBeacon");

        uint64 attested = ChainInfoLib.attestedHeight(SEPOLIA);

        // Trading closes shortly from now; the window opens a safety buffer
        // after that, and runs long enough to fire a snapshot inside it.
        uint64 closeBlock = attested + 25;
        uint64 fromBlock = closeBlock + market.LAG_BUFFER_BLOCKS();
        uint64 toBlock = fromBlock + 600;

        AttestSpec memory spec = AttestSpec({
            chainKey: SEPOLIA,
            emitter: beacon,
            topic0: SNAPSHOT_TOPIC0,
            // CruxBeacon promotes the first word of return data to topics[3],
            // which is the only stable place a spec can address it from.
            extractMode: Extract.TOPIC,
            extractIndex: 3,
            cmp: Comparator.GT,
            threshold: 0,
            fromBlock: fromBlock,
            toBlock: toBlock
        });

        uint256 b = 100e18;
        uint256 subsidy = LMSR.maxLoss(b);

        vm.startBroadcast();
        uint256 marketId = market.createMarket{value: subsidy}(
            spec, closeBlock, b, "Will CruxBeacon report a non-zero value on Sepolia?"
        );
        vm.stopBroadcast();

        console.log("marketId          :", marketId);
        console.log("beacon (Sepolia)  :", beacon);
        console.log("attested now      :", attested);
        console.log("trading closes at :", closeBlock);
        console.log("window            :", fromBlock, "->", toBlock);
        console.log("subsidy escrowed  :", subsidy);

        string memory out = "market";
        vm.serializeUint(out, "marketId", marketId);
        vm.serializeUint(out, "fromBlock", fromBlock);
        vm.serializeUint(out, "toBlock", toBlock);
        vm.serializeUint(out, "tradingCloseBlock", closeBlock);
        string memory json = vm.serializeAddress(out, "beacon", beacon);
        vm.writeJson(json, "../deployments/market-latest.json");
    }
}
