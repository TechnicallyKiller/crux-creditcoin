// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {SD59x18, sd, convert} from "@prb/math/SD59x18.sol";

/**
 * @title LMSR
 * @notice Hanson's Logarithmic Market Scoring Rule over a binary outcome.
 *
 *     C(q) = b · ln( Σ exp(qᵢ/b) )
 *     pᵢ   = exp(qᵢ/b) / Σ exp(qⱼ/b)
 *
 * Chosen because it is always quotable against a protocol-subsidised `b`, so a
 * market is tradeable from block one with zero liquidity providers — decisive
 * when you have no users yet. Loss is bounded by b·ln(2) for a binary market,
 * which is a known, budgetable subsidy rather than an open-ended risk.
 *
 * @dev Everything is computed in the shifted form
 *
 *     C(q) = b · ( m + ln( Σ exp(qᵢ/b − m) ) )   where m = max(qᵢ/b)
 *
 * which is not a micro-optimisation but a correctness requirement. Computing
 * `exp(qᵢ/b)` directly overflows PRBMath once qᵢ/b exceeds ~133, i.e. at
 * entirely ordinary trade sizes. After shifting, every exponent is ≤ 0, so each
 * term lands in (0, 1] and the sum in [1, 2] for a binary market — numerically
 * boring by construction, whatever the trade size.
 */
library LMSR {
    error InvalidLiquidity();
    error ValueTooLarge();

    /// @notice Cost function C(q), in collateral wei.
    function cost(uint256 qYes, uint256 qNo, uint256 b) internal pure returns (uint256) {
        if (b == 0) revert InvalidLiquidity();

        SD59x18 bb = _toSd(b);
        SD59x18 aYes = _toSd(qYes).div(bb);
        SD59x18 aNo = _toSd(qNo).div(bb);
        SD59x18 m = aYes.gt(aNo) ? aYes : aNo;

        SD59x18 sum = aYes.sub(m).exp().add(aNo.sub(m).exp());
        return uint256(SD59x18.unwrap(bb.mul(m.add(sum.ln()))));
    }

    /**
     * @notice Cost of moving the book from q to q'. Always >= 0 for a buy.
     * @dev A difference of two cost() calls rather than a closed form: the
     *      closed form is cheaper but loses precision badly when the trade is
     *      small relative to b, which is the common case.
     */
    function buyCost(uint256 qYes, uint256 qNo, uint256 b, bool yes, uint256 shares)
        internal
        pure
        returns (uint256)
    {
        uint256 before = cost(qYes, qNo, b);
        uint256 after_ = yes ? cost(qYes + shares, qNo, b) : cost(qYes, qNo + shares, b);
        // C is non-decreasing in q, so this cannot underflow on a real buy.
        return after_ - before;
    }

    /// @notice Proceeds from selling `shares`. The caller must already have
    ///         checked the seller actually holds them.
    function sellProceeds(uint256 qYes, uint256 qNo, uint256 b, bool yes, uint256 shares)
        internal
        pure
        returns (uint256)
    {
        uint256 before = cost(qYes, qNo, b);
        uint256 after_ = yes ? cost(qYes - shares, qNo, b) : cost(qYes, qNo - shares, b);
        return before - after_;
    }

    /// @notice Marginal price of YES as an 18-decimal fraction of 1e18.
    /// @dev priceNo is derived by callers as 1e18 - priceYes rather than
    ///      computed independently, so the two always sum to exactly 1e18 with
    ///      no rounding drift. The invariant is structural, not approximate.
    function priceYes(uint256 qYes, uint256 qNo, uint256 b) internal pure returns (uint256) {
        if (b == 0) revert InvalidLiquidity();

        SD59x18 bb = _toSd(b);
        SD59x18 aYes = _toSd(qYes).div(bb);
        SD59x18 aNo = _toSd(qNo).div(bb);
        SD59x18 m = aYes.gt(aNo) ? aYes : aNo;

        SD59x18 eYes = aYes.sub(m).exp();
        SD59x18 eNo = aNo.sub(m).exp();
        return uint256(SD59x18.unwrap(eYes.div(eYes.add(eNo))));
    }

    /**
     * @notice Maximum the market maker can lose: b·ln(2) for two outcomes.
     *         This is the subsidy a market creator must escrow.
     *
     * @dev Deliberately rounded UP. In exact arithmetic b·ln(2) is a hard
     *      ceiling on the maker's shortfall, but `cost()` accumulates fixed-
     *      point error, and measured against a 1000e18 book the realised
     *      shortfall overshot the computed bound by ~600 wei. Escrowing exactly
     *      this figure would leave a market a few hundred wei short of paying
     *      its winners — insolvent by a rounding error, which is still
     *      insolvent. The buffer is economically nil (1 gwei) and removes the
     *      whole class of problem.
     */
    uint256 internal constant PRECISION_BUFFER = 1e9;

    function maxLoss(uint256 b) internal pure returns (uint256) {
        SD59x18 ln2 = convert(int256(2)).ln();
        return uint256(SD59x18.unwrap(_toSd(b).mul(ln2))) + PRECISION_BUFFER;
    }

    /// @dev Guarded rather than a bare cast: share counts and `b` come from
    ///      user input, and a uint256 above int256.max would silently wrap to a
    ///      negative fixed-point value and corrupt every price in the market.
    function _toSd(uint256 x) private pure returns (SD59x18) {
        if (x > uint256(type(int256).max)) revert ValueTooLarge();
        return sd(int256(x));
    }
}
