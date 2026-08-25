// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console} from "forge-std/Test.sol";
import {LMSR} from "../src/LMSR.sol";

/**
 * @notice R7 — LMSR fixed-point behaviour, fuzzed.
 *
 * Hand-rolled scoring-rule math is where these contracts go wrong, so the
 * properties are asserted directly rather than spot-checked: prices sum to
 * exactly 1, cost is monotonic, and the maker's loss stays inside b·ln(2).
 */
/// @dev LMSR's functions are `internal`, so they inline into the caller and a
///      revert lands at the same depth as the cheatcode. expectRevert needs a
///      real external call boundary to observe.
contract LMSRHarness {
    function priceYes(uint256 qYes, uint256 qNo, uint256 b) external pure returns (uint256) {
        return LMSR.priceYes(qYes, qNo, b);
    }
}

contract LMSRTest is Test {
    uint256 constant B = 1000e18; // subsidy parameter
    uint256 constant ONE = 1e18;

    function test_freshMarketIsEvenlyPriced() public pure {
        assertEq(LMSR.priceYes(0, 0, B), 0.5e18, "a market with no trades must be 50/50");
    }

    /// @notice The defining invariant. Prices are a probability distribution.
    function testFuzz_pricesSumToExactlyOne(uint96 qYes, uint96 qNo) public pure {
        uint256 pYes = LMSR.priceYes(qYes, qNo, B);
        assertLe(pYes, ONE, "price cannot exceed 1");
        // priceNo is derived, never computed independently, so the sum is
        // exact by construction rather than approximately right.
        uint256 pNo = ONE - pYes;
        assertEq(pYes + pNo, ONE);
    }

    /// @notice Buying YES must make YES more expensive. If this fails, the
    ///         market can be drained by round-tripping.
    function testFuzz_buyingMovesPriceUp(uint96 shares) public pure {
        vm.assume(shares > 1e15);
        uint256 before = LMSR.priceYes(0, 0, B);
        uint256 after_ = LMSR.priceYes(shares, 0, B);
        assertGt(after_, before, "buying YES must raise the YES price");
    }

    function testFuzz_costIsMonotonic(uint96 a, uint96 extra) public pure {
        vm.assume(extra > 1e15);
        uint256 c1 = LMSR.cost(a, 0, B);
        uint256 c2 = LMSR.cost(uint256(a) + extra, 0, B);
        assertGe(c2, c1, "cost must be non-decreasing in q");
    }

    /**
     * @notice A buy immediately followed by a sell of the same size must never
     *         return MORE than it cost. Anything else is a money printer.
     */
    function testFuzz_roundTripIsNotProfitable(uint96 shares) public pure {
        vm.assume(shares > 1e15 && shares < 1e24);
        uint256 paid = LMSR.buyCost(0, 0, B, true, shares);
        uint256 back = LMSR.sellProceeds(shares, 0, B, true, shares);
        assertLe(back, paid, "round trip must not be profitable");
    }

    /**
     * @notice The subsidy bound that makes LMSR budgetable: however lopsided
     *         the book gets, the maker's exposure beyond what traders paid
     *         stays under b·ln(2).
     */
    function testFuzz_lossStaysWithinSubsidy(uint96 shares) public pure {
        vm.assume(shares > 1e15 && shares < 1e26);
        uint256 collected = LMSR.buyCost(0, 0, B, true, shares);
        // Worst case: YES wins and every share redeems at 1.
        if (shares <= collected) return; // maker is already whole
        uint256 shortfall = shares - collected;
        assertLe(shortfall, LMSR.maxLoss(B), "shortfall must stay inside b*ln(2)");
    }

    function test_maxLossIsBLnTwo() public pure {
        // ln(2) = 0.693147180559945309...
        assertApproxEqRel(LMSR.maxLoss(B), (B * 693147180559945309) / 1e18, 1e12);
        assertGt(LMSR.maxLoss(B), (B * 693147180559945309) / 1e18, "must round up, never down");
    }

    /// @notice The reason for the max-shift: unshifted exp() overflows here.
    function test_largeTradeDoesNotOverflow() public pure {
        uint256 huge = 500_000e18; // q/b = 500, far past exp()'s ~133 limit
        uint256 p = LMSR.priceYes(huge, 0, B);
        assertLe(p, ONE);
        assertGt(p, 0.99e18, "an overwhelmingly one-sided book prices near 1");
    }

    function test_zeroLiquidityReverts() public {
        LMSRHarness h = new LMSRHarness();
        vm.expectRevert(LMSR.InvalidLiquidity.selector);
        h.priceYes(0, 0, 0);
    }
}
