// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @notice The slice of CruxMarket the resolver is allowed to touch.
interface ICruxMarket {
    /// @param yes true settles YES, false settles NO.
    /// @param resolver who submitted the resolving proof, paid the bounty.
    function settle(uint256 marketId, bool yes, address resolver) external;

    /// @notice Source-chain block after which trading is closed for a market.
    function tradingCloseBlock(uint256 marketId) external view returns (uint64);

    function isSettled(uint256 marketId) external view returns (bool);
}
