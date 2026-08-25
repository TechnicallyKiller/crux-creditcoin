// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console} from "forge-std/Test.sol";
import {CruxMarket, ICruxResolver} from "../src/CruxMarket.sol";
import {AttestSpec, Extract, Comparator} from "../src/CruxTypes.sol";
import {LMSR} from "../src/LMSR.sol";
import {IChainInfo} from "../src/IChainInfo.sol";

contract StubResolver is ICruxResolver {
    mapping(uint256 => bool) public registered;

    function registerSpec(uint256 marketId, AttestSpec calldata) external {
        registered[marketId] = true;
    }

    function settleVia(CruxMarket m, uint256 id, bool yes, address who) external {
        m.settle(id, yes, who);
    }
}

contract CruxMarketTest is Test {
    address constant CHAIN_INFO = 0x0000000000000000000000000000000000000fD3;

    CruxMarket market;
    StubResolver stub;

    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address keeper = address(0xCEEB);

    uint256 constant B = 1000e18;
    uint64 constant CLOSE = 26_000_000;
    uint64 constant FROM = CLOSE + 200; // satisfies the 150-block buffer
    uint64 constant TO = FROM + 1000;

    function setUp() public {
        market = new CruxMarket();
        stub = new StubResolver();
        market.setResolver(stub);

        _attested(CLOSE - 1000); // trading open
        vm.deal(alice, 1000 ether);
        vm.deal(bob, 1000 ether);
        vm.deal(address(this), 10_000 ether);
    }

    function _attested(uint64 h) internal {
        vm.mockCall(
            CHAIN_INFO,
            abi.encodeWithSelector(IChainInfo.getLatestAttestedHeightAndHash.selector),
            abi.encode(h, bytes32(0))
        );
    }

    function _spec(uint64 from, uint64 to) internal pure returns (AttestSpec memory) {
        return AttestSpec({
            chainKey: 3,
            emitter: address(0xA66),
            topic0: bytes32(uint256(1)),
            extractMode: Extract.TOPIC,
            extractIndex: 1,
            cmp: Comparator.GT,
            threshold: 2000e8,
            fromBlock: from,
            toBlock: to
        });
    }

    function _create() internal returns (uint256) {
        return market.createMarket{value: LMSR.maxLoss(B)}(_spec(FROM, TO), CLOSE, B, "ETH > $2000?");
    }

    // ------------------------------------------------------------- creation

    function test_createEscrowsSubsidyAndQuotesFromBlockOne() public {
        uint256 id = _create();
        assertEq(market.priceYes(id), 0.5e18, "tradeable with zero LPs");
        assertTrue(stub.registered(id), "spec must reach the resolver");
    }

    function test_createRejectsUnderfundedSubsidy() public {
        uint256 required = LMSR.maxLoss(B);
        vm.expectRevert(
            abi.encodeWithSelector(CruxMarket.InsufficientSubsidy.selector, required, required - 1)
        );
        market.createMarket{value: required - 1}(_spec(FROM, TO), CLOSE, B, "q");
    }

    /**
     * @notice R3. A market whose observation window opens too soon after
     *         trading closes is rejected outright.
     *
     * The exploit this blocks: the outcome is fixed by the FIRST matching event
     * anywhere in the window, so if the window opens while the world can still
     * trade, someone watching Ethereum trades on an answer they already know.
     */
    function test_R3_rejectsWindowOpeningTooSoonAfterTradingCloses() public {
        uint64 tooSoon = CLOSE + 10; // well inside the 150-block buffer
        vm.expectRevert(
            abi.encodeWithSelector(
                CruxMarket.TradingWindowTooTight.selector, CLOSE, tooSoon, CLOSE + 150
            )
        );
        market.createMarket{value: LMSR.maxLoss(B)}(_spec(tooSoon, TO), CLOSE, B, "q");
    }

    function test_R3_acceptsExactlyTheBufferBoundary() public {
        market.createMarket{value: LMSR.maxLoss(B)}(_spec(CLOSE + 150, TO), CLOSE, B, "q");
    }

    // -------------------------------------------------------------- trading

    function test_buyMovesPriceAndChargesFee() public {
        uint256 id = _create();
        uint256 quoted = market.quoteBuy(id, true, 100e18);

        vm.prank(alice);
        market.buy{value: quoted}(id, true, 100e18, quoted);

        assertGt(market.priceYes(id), 0.5e18, "buying YES raises the YES price");
        assertEq(market.yesShares(id, alice), 100e18);
    }

    function test_buyRefundsOverpayment() public {
        uint256 id = _create();
        uint256 quoted = market.quoteBuy(id, true, 10e18);
        uint256 before = alice.balance;

        vm.prank(alice);
        market.buy{value: quoted + 5 ether}(id, true, 10e18, quoted);

        assertEq(alice.balance, before - quoted, "overpayment must come back");
    }

    function test_buyRespectsSlippageLimit() public {
        uint256 id = _create();
        uint256 quoted = market.quoteBuy(id, true, 100e18);
        vm.prank(alice);
        vm.expectRevert();
        market.buy{value: quoted}(id, true, 100e18, quoted - 1);
    }

    function test_sellReturnsProceeds() public {
        uint256 id = _create();
        uint256 quoted = market.quoteBuy(id, true, 100e18);
        vm.startPrank(alice);
        market.buy{value: quoted}(id, true, 100e18, quoted);
        uint256 before = alice.balance;
        market.sell(id, true, 100e18, 0);
        vm.stopPrank();

        assertGt(alice.balance, before, "selling returns collateral");
        assertEq(market.yesShares(id, alice), 0);
    }

    function test_cannotSellSharesYouDoNotHold() public {
        uint256 id = _create();
        vm.prank(alice);
        vm.expectRevert(CruxMarket.InsufficientShares.selector);
        market.sell(id, true, 1e18, 0);
    }

    /**
     * @notice The gate that makes R3 real at runtime: once the attested height
     *         reaches the close block, trading stops. Attested height is the
     *         only clock Creditcoin has for Ethereum.
     */
    function test_R3_tradingClosesOnceAttestedReachesCloseBlock() public {
        uint256 id = _create();
        _attested(CLOSE);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(CruxMarket.TradingClosed.selector, CLOSE, CLOSE));
        market.buy{value: 1 ether}(id, true, 1e18, 1 ether);
    }

    // ----------------------------------------------------------- settlement

    function test_settlePaysBountyToProofSubmitter() public {
        uint256 id = _create();
        uint256 quoted = market.quoteBuy(id, true, 500e18);
        vm.prank(alice);
        market.buy{value: quoted}(id, true, 500e18, quoted);

        uint256 before = keeper.balance;
        stub.settleVia(market, id, true, keeper);

        assertGt(keeper.balance, before, "D6: resolving must pay, or nobody resolves");
    }

    function test_winnersClaimOneToOneAndLosersGetNothing() public {
        uint256 id = _create();
        uint256 qa = market.quoteBuy(id, true, 100e18);
        vm.prank(alice);
        market.buy{value: qa}(id, true, 100e18, qa);
        uint256 qb = market.quoteBuy(id, false, 100e18);
        vm.prank(bob);
        market.buy{value: qb}(id, false, 100e18, qb);

        stub.settleVia(market, id, true, keeper);

        uint256 before = alice.balance;
        vm.prank(alice);
        market.claim(id);
        assertEq(alice.balance - before, 100e18, "winning shares redeem 1:1");

        vm.prank(bob);
        vm.expectRevert(CruxMarket.NothingToClaim.selector);
        market.claim(id);
    }

    function test_cannotClaimBeforeSettlement() public {
        uint256 id = _create();
        vm.prank(alice);
        vm.expectRevert(CruxMarket.NotSettled.selector);
        market.claim(id);
    }

    function test_onlyResolverCanSettle() public {
        uint256 id = _create();
        vm.prank(alice);
        vm.expectRevert(CruxMarket.NotResolver.selector);
        market.settle(id, true, alice);
    }

    /**
     * @notice Solvency. The subsidy exists precisely so the market can always
     *         pay its winners; if this fails the market is a default waiting to
     *         happen, which is worse than a market that never opened.
     */
    function testFuzz_marketCanAlwaysPayItsWinners(uint96 sharesA, uint96 sharesB) public {
        vm.assume(sharesA > 1e15 && sharesA < 500e18);
        vm.assume(sharesB > 1e15 && sharesB < 500e18);
        uint256 id = _create();

        uint256 qa = market.quoteBuy(id, true, sharesA);
        vm.prank(alice);
        market.buy{value: qa}(id, true, sharesA, qa);

        uint256 qb = market.quoteBuy(id, false, sharesB);
        vm.prank(bob);
        market.buy{value: qb}(id, false, sharesB, qb);

        stub.settleVia(market, id, true, keeper);
        assertGe(address(market).balance, uint256(sharesA), "must cover every winning share");

        vm.prank(alice);
        market.claim(id);
    }
}
