// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title CruxBeacon
 * @notice Turns any `view`-readable EVM state into an attestable event.
 *
 * Attestcoin can prove transactions and the logs they emitted — never raw
 * storage slots. So "what is Uniswap's reserve right now" is unprovable, while
 * "this transaction emitted that number" is provable. The beacon converts the
 * former into the latter: anyone may call it, it staticcalls a target, and it
 * emits whatever came back.
 *
 * That generalises CRUX from "markets about events" to "markets about any
 * on-chain state", and it is the strongest original contribution in the stack.
 *
 * @dev Deployed on Sepolia only. Snapshotting mainnet would cost real ETH, and
 *      mainnet already emits plenty of events worth building markets on.
 */
contract CruxBeacon {
    /**
     * @notice A recorded observation of foreign state.
     *
     * @param specId   caller-chosen tag, so a market can pin the exact query it
     *                 cares about and ignore everybody else's snapshots.
     * @param target   the contract that was read.
     * @param word0    the FIRST 32 bytes of the return data, promoted to an
     *                 indexed topic.
     * @param selector the function that was called.
     * @param result   the full return data, for anything richer than one word.
     *
     * @dev `word0` is indexed deliberately, and it is the detail that makes
     *      this contract usable rather than merely clever. CruxAttestedResolver
     *      extracts its comparison operand either from an indexed topic or from
     *      a fixed 32-byte word of log data. Return data lands in `result`,
     *      which is dynamically encoded — its true offset depends on the ABI
     *      head/tail layout, so no constant word index can address it. Lifting
     *      the first word into a topic gives specs a stable, cheap operand at
     *      topics[3], which covers every `view` returning a single uint, int,
     *      bool, or address — i.e. nearly all of them.
     */
    event Snapshot(
        bytes32 indexed specId,
        address indexed target,
        bytes32 indexed word0,
        bytes4 selector,
        uint256 blockNumber,
        bytes result
    );

    error SnapshotFailed(address target, bytes reason);
    error EmptyCalldata();

    /**
     * @notice Read `target` and emit the answer. Permissionless by design:
     *         a market must never depend on a privileged party choosing to
     *         publish, or the beacon becomes exactly the trusted reporter this
     *         whole project exists to remove.
     */
    function snapshot(bytes32 specId, address target, bytes calldata data)
        external
        returns (bytes memory result)
    {
        if (data.length < 4) revert EmptyCalldata();

        bool ok;
        (ok, result) = target.staticcall(data);
        // Reverting rather than emitting a failure is deliberate: a failed read
        // must not become an attestable "fact" that a resolver could match on.
        if (!ok) revert SnapshotFailed(target, result);

        bytes32 word0;
        if (result.length >= 32) {
            assembly {
                word0 := mload(add(result, 32))
            }
        }

        emit Snapshot(specId, target, word0, bytes4(data[:4]), block.number, result);
    }

    /**
     * @notice A trivially non-zero view, so the beacon can snapshot itself.
     *
     * @dev Exists so an end-to-end test or a live demo has a guaranteed
     *      readable target on the source chain with no external dependency —
     *      nothing to go stale when a testnet resets, and nothing whose
     *      address has to be looked up. Returns the source-chain block height,
     *      which is always non-zero and always changing, so a snapshot of it
     *      is never confusable with a stale one.
     */
    function probe() external view returns (uint256) {
        return block.number;
    }

    /// @notice Convenience for the common zero-argument getter.
    function snapshotSelector(bytes32 specId, address target, bytes4 selector)
        external
        returns (bytes memory)
    {
        return this.snapshot(specId, target, abi.encodePacked(selector));
    }
}
