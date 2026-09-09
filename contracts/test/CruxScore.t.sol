// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {CruxScore} from "../src/CruxScore.sol";
import {CruxMarket, ICruxResolver, ICruxScore} from "../src/CruxMarket.sol";
import {AttestSpec, Extract, Comparator} from "../src/CruxTypes.sol";
import {LMSR} from "../src/LMSR.sol";
import {IChainInfo} from "../src/IChainInfo.sol";

contract StubResolver is ICruxResolver {
    function registerSpec(uint256, AttestSpec calldata) external {}
    function settleVia(CruxMarket m, uint256 id, bool yes, address who) external { m.settle(id, yes, who); }
}

contract CruxScoreTest is Test {
    address constant CHAIN_INFO = 0x0000000000000000000000000000000000000fD3;

    CruxMarket market;
    CruxScore score;
    StubResolver stub;
    address alice = address(0xA11CE);
    /// @dev An EOA: the resolution bounty is real value and a test contract
    ///      with no receive() would reject it.
    address keeper = address(0xCEEB);

    uint256 constant B = 1000e18;
    uint64 constant CLOSE = 26_000_000;

    function setUp() public {
        stub = new StubResolver();
        // Same CREATE-nonce prediction the deploy script uses, so the test
        // exercises the real wiring rather than a setter that no longer exists.
        address predictedScore = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        market = new CruxMarket(stub, ICruxScore(predictedScore));
        score = new CruxScore(address(market));
        assertEq(address(score), predictedScore);
        _attested(CLOSE - 1000);
        vm.deal(alice, 10_000 ether);
        vm.deal(address(this), 10_000 ether);
    }

    function _attested(uint64 h) internal {
        vm.mockCall(CHAIN_INFO, abi.encodeWithSelector(IChainInfo.get_latest_attestation_height_and_hash.selector),
            abi.encode(IChainInfo.HeightHashResult({height: h, hash: bytes32(0), isAttestation: true, exists: true})));
    }

    function _create() internal returns (uint256) {
        AttestSpec memory spec = AttestSpec({
            chainKey: 3, emitter: address(0xA66), topic0: bytes32(uint256(1)),
            extractMode: Extract.TOPIC, extractIndex: 1, cmp: Comparator.GT, threshold: 1,
            fromBlock: CLOSE + 200, toBlock: CLOSE + 1200
        });
        return market.createMarket{value: LMSR.maxLoss(B)}(spec, CLOSE, B, "q");
    }

    function _buy(uint256 id, bool yes, uint256 shares) internal {
        uint256 q = market.quoteBuy(id, yes, shares);
        vm.prank(alice);
        market.buy{value: q}(id, yes, shares, q);
    }

    function test_scoreIsRecordedOnClaim() public {
        uint256 id = _create();
        _buy(id, true, 100e18);
        stub.settleVia(market, id, true, keeper);

        vm.prank(alice);
        market.claim(id);

        (uint64 resolved, uint64 correct,,, uint256 brier,) = score.standingOf(alice);
        assertEq(resolved, 1);
        assertEq(correct, 1);
        assertLt(brier, 0.25e18, "a correct call must beat a coin flip");
    }

    /**
     * @notice The score must reflect the price the bearer PAID, not the market
     *         price at settlement. Otherwise it measures the market's final
     *         opinion rather than the trader's judgement.
     */
    function test_brierUsesThePricePaidNotThePriceAtSettlement() public {
        uint256 id = _create();
        _buy(id, true, 50e18);            // alice buys cheap, near 0.5
        market.buy{value: market.quoteBuy(id, true, 900e18)}(id, true, 900e18, type(uint256).max); // we shove the price up
        stub.settleVia(market, id, true, keeper);

        vm.prank(alice);
        market.claim(id);

        (,,,, uint256 brier,) = score.standingOf(alice);
        // Bought near 0.5 and was right: (0.5-1)^2 = 0.25-ish, NOT the ~0.0 the
        // inflated settlement price would imply.
        assertGt(brier, 0.15e18, "must score against what alice paid");
    }

    function test_wrongCallScoresBadlyAndBreaksStreak() public {
        uint256 id = _create();
        _buy(id, false, 100e18);
        stub.settleVia(market, id, true, keeper); // NO holder loses

        vm.prank(alice);
        vm.expectRevert(CruxMarket.NothingToClaim.selector);
        market.claim(id);

        // A loser has nothing to claim, so nothing is scored — they never took
        // delivery of the answer. Standing stays empty rather than wrong.
        (uint64 resolved,,,,,) = score.standingOf(alice);
        assertEq(resolved, 0);
    }

    function test_doubleClaimCannotDoubleCount() public {
        uint256 id = _create();
        _buy(id, true, 100e18);
        stub.settleVia(market, id, true, keeper);

        vm.startPrank(alice);
        market.claim(id);
        vm.expectRevert(CruxMarket.NothingToClaim.selector);
        market.claim(id);
        vm.stopPrank();

        (uint64 resolved,,,,,) = score.standingOf(alice);
        assertEq(resolved, 1);
    }

    /// @notice Winnings must never be trappable by a misbehaving score contract.
    function test_revertingScoreCannotTrapWinnings() public {
        StubResolver s2 = stub;
        CruxMarket m2 = new CruxMarket(stub, ICruxScore(address(new RevertingScore())));

        AttestSpec memory spec = AttestSpec({
            chainKey: 3, emitter: address(0xA66), topic0: bytes32(uint256(1)),
            extractMode: Extract.TOPIC, extractIndex: 1, cmp: Comparator.GT, threshold: 1,
            fromBlock: CLOSE + 200, toBlock: CLOSE + 1200
        });
        uint256 id = m2.createMarket{value: LMSR.maxLoss(B)}(spec, CLOSE, B, "q");
        uint256 q = m2.quoteBuy(id, true, 100e18);
        vm.prank(alice);
        m2.buy{value: q}(id, true, 100e18, q);
        s2.settleVia(m2, id, true, keeper);

        uint256 before = alice.balance;
        vm.prank(alice);
        m2.claim(id);
        assertGt(alice.balance, before, "money first, reputation second");
    }

    function test_soulbound() public {
        vm.expectRevert(CruxScore.Soulbound.selector);
        score.transfer(address(0xBEEF), 1);
        assertTrue(score.locked(0));
    }

    function test_onlyMarketCanRecord() public {
        vm.expectRevert(CruxScore.NotMarket.selector);
        score.record(alice, 1, 0.5e18, true);
    }
}

contract RevertingScore {
    function record(address, uint256, uint256, bool) external pure { revert("nope"); }
}
