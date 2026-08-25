// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, Vm} from "forge-std/Test.sol";
import {CruxBeacon} from "../src/CruxBeacon.sol";

contract Counter {
    uint256 public value = 42;
    function boom() external pure returns (uint256) {
        revert("nope");
    }
}

contract CruxBeaconTest is Test {
    CruxBeacon beacon;
    Counter counter;

    function setUp() public {
        beacon = new CruxBeacon();
        counter = new Counter();
    }

    /// @notice The point of the contract: unprovable storage becomes a
    ///         provable log.
    function test_snapshotEmitsReadValue() public {
        vm.recordLogs();
        beacon.snapshotSelector(bytes32("eth-reserve"), address(counter), counter.value.selector);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1);
        assertEq(logs[0].topics[1], bytes32("eth-reserve"), "specId pins the query");
        assertEq(uint256(logs[0].topics[3]), 42, "word0 carries the value at topics[3]");
    }

    /// @notice word0 must be at a FIXED topic index, because that is what the
    ///         resolver's Extract.TOPIC mode addresses.
    function test_word0IsExtractableAtTopicIndexThree() public {
        vm.recordLogs();
        beacon.snapshotSelector(bytes32(0), address(counter), counter.value.selector);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs[0].topics.length, 4, "topic0 + three indexed");
        assertEq(int256(uint256(logs[0].topics[3])), int256(42));
    }

    /**
     * @notice A failed read must revert rather than emit. Otherwise the failure
     *         itself becomes an attestable event a market could match on —
     *         letting someone resolve a market by making a read fail.
     */
    function test_failedReadRevertsAndEmitsNothing() public {
        vm.recordLogs();
        vm.expectRevert();
        beacon.snapshotSelector(bytes32(0), address(counter), counter.boom.selector);
        assertEq(vm.getRecordedLogs().length, 0, "no log may survive a failed read");
    }

    function test_rejectsCalldataTooShortToBeACall() public {
        vm.expectRevert(CruxBeacon.EmptyCalldata.selector);
        beacon.snapshot(bytes32(0), address(counter), hex"1234");
    }

    /// @notice The beacon must be able to snapshot itself, so the end-to-end
    ///         demo has no external dependency on the source chain.
    function test_beaconCanSnapshotItself() public {
        vm.roll(12345);
        vm.recordLogs();
        beacon.snapshotSelector(bytes32("crux-demo"), address(beacon), beacon.probe.selector);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(uint256(logs[0].topics[3]), 12345, "self-snapshot lands at topics[3] like any other");
    }

    function test_anyoneCanSnapshot() public {
        vm.prank(address(0xDEAD));
        beacon.snapshotSelector(bytes32(0), address(counter), counter.value.selector);
    }
}
