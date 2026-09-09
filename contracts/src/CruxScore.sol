// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title CruxScore
 * @notice Soulbound record of how well a bearer forecasts.
 *
 * Standing is Brier calibration, not profit. A whale who guesses cannot buy a
 * place here, because the score measures whether your stated confidence was
 * honest rather than how much you staked on it.
 *
 * The claim this contract exists to make: every market behind these numbers was
 * decided by a cryptographic proof — no oracle voted, no committee reviewed, no
 * admin key intervened. The reputation is therefore provably untainted by
 * oracle manipulation, which is something no other prediction market can say
 * about its own leaderboard. That is only true because CruxMarket is the sole
 * writer and CruxMarket only settles on a verified proof.
 */
contract CruxScore {
    /// @dev Fixed-point scale for probabilities and the score itself.
    uint256 private constant ONE = 1e18;

    struct Standing {
        uint64 resolved;      // markets that have settled with a position held
        uint64 correct;
        uint64 streak;
        uint64 bestStreak;
        uint256 sumSqError;   // Σ (claimed − outcome)², scaled by ONE
        uint256 xp;
    }

    address public immutable MARKET;
    mapping(address => Standing) private _standing;
    /// @dev Guards double-counting if a market were ever claimed twice.
    mapping(address => mapping(uint256 => bool)) public counted;

    event Recorded(
        address indexed bearer,
        uint256 indexed marketId,
        uint256 claimedProbability,
        bool correct,
        uint256 brier
    );

    error NotMarket();
    error Soulbound();

    modifier onlyMarket() {
        if (msg.sender != MARKET) revert NotMarket();
        _;
    }

    constructor(address market) {
        MARKET = market;
    }

    /**
     * @notice Record one resolved position.
     * @param claimedProbability the price the bearer actually paid for the side
     *        they held, in 1e18 — which IS the probability they asserted.
     * @dev Called by CruxMarket on claim. Only on claim, and only once per
     *      market per bearer: a position the holder never claims is not scored,
     *      which is the honest reading — they never took delivery of the answer.
     */
    function record(address bearer, uint256 marketId, uint256 claimedProbability, bool correct)
        external
        onlyMarket
    {
        if (counted[bearer][marketId]) return;
        counted[bearer][marketId] = true;

        Standing storage s = _standing[bearer];

        // Brier term: (claimed − outcome)². Outcome is 1 or 0 in fixed point.
        uint256 outcome = correct ? ONE : 0;
        uint256 diff = claimedProbability > outcome
            ? claimedProbability - outcome
            : outcome - claimedProbability;
        s.sumSqError += (diff * diff) / ONE;

        s.resolved += 1;
        if (correct) {
            s.correct += 1;
            s.streak += 1;
            if (s.streak > s.bestStreak) s.bestStreak = s.streak;
            // Confidence is rewarded only when it was justified: a correct call
            // at 60% earns more than a correct call at 95%, because the former
            // was the harder thing to be right about.
            s.xp += 100 + (ONE - claimedProbability) / 1e16;
        } else {
            s.streak = 0;
            s.xp += 10; // resolving at all is worth something; being wrong is not
        }

        emit Recorded(bearer, marketId, claimedProbability, correct, brierOf(bearer));
    }

    /// @notice Mean squared error in 1e18. Lower is better; 0.25 is a coin flip.
    function brierOf(address bearer) public view returns (uint256) {
        Standing memory s = _standing[bearer];
        if (s.resolved == 0) return 0;
        return s.sumSqError / s.resolved;
    }

    function standingOf(address bearer)
        external
        view
        returns (uint64 resolved, uint64 correct, uint64 streak, uint64 bestStreak, uint256 brier, uint256 xp)
    {
        Standing memory s = _standing[bearer];
        return (s.resolved, s.correct, s.streak, s.bestStreak, brierOf(bearer), s.xp);
    }

    // ------------------------------------------------------- soulbound

    /**
     * @dev There is no transfer, approval or burn, by construction rather than
     *      by a modifier that could be forgotten. Standing describes a person's
     *      judgement; a judgement that can be sold is not a reputation.
     */
    function transfer(address, uint256) external pure { revert Soulbound(); }
    function transferFrom(address, address, uint256) external pure { revert Soulbound(); }
    function approve(address, uint256) external pure { revert Soulbound(); }

    /// @notice ERC-5192 — locked, always.
    function locked(uint256) external pure returns (bool) { return true; }
}
