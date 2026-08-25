// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {LMSR} from "./LMSR.sol";
import {AttestSpec, Lane} from "./CruxTypes.sol";
import {ICruxMarket} from "./ICruxMarket.sol";
import {IChainInfo} from "./IChainInfo.sol";

interface ICruxResolver {
    function registerSpec(uint256 marketId, AttestSpec calldata spec) external;
}

/**
 * @title CruxMarket
 * @notice Binary prediction markets on Creditcoin, collateralised in native
 *         tCTC and priced by LMSR. One contract holds many markets — far
 *         cheaper than a deploy per market.
 *
 * Settlement is not performed here. It arrives from CruxAttestedResolver, which
 * will only call in after the Attestcoin precompile has verified a proof that
 * the market's event actually occurred on Ethereum.
 */
contract CruxMarket is ICruxMarket {
    IChainInfo public constant CHAIN_INFO =
        IChainInfo(0x0000000000000000000000000000000000000fD3);

    /**
     * @notice How far ahead of the observation window trading must close, in
     *         source-chain blocks. ~30 minutes of Ethereum.
     *
     * @dev THE MOST IMPORTANT ECONOMIC PARAMETER IN THE SYSTEM (R3), and the
     *      plan's statement of it was wrong in a way that matters.
     *
     *      The plan says trading must halt "safely before spec.toBlock". That
     *      is not sufficient. A market's outcome is determined by the FIRST
     *      matching event anywhere in [fromBlock, toBlock]. If the event lands
     *      early in the window, everyone watching Ethereum can see the answer
     *      while trading is still open — for potentially the entire window.
     *      Closing before `toBlock` leaves that whole span exploitable.
     *
     *      Trading must therefore close before `fromBlock`, with enough margin
     *      that the attestation lag cannot be used as a head start either. The
     *      on-chain clock is the ATTESTED height, which trails the real
     *      Ethereum head by ~38-45 blocks (measured). So when trading closes at
     *      attested == tradingCloseBlock, the true head is already around
     *      tradingCloseBlock + 45. Requiring a 150-block gap keeps the real
     *      head comfortably short of `fromBlock` even so.
     */
    uint64 public constant LAG_BUFFER_BLOCKS = 150;

    uint256 public constant FEE_BPS = 200; // 2% of trade cost
    uint256 public constant BOUNTY_BPS = 50; // 0.5% -> resolution bounty (D6)
    uint256 public constant CREATOR_BPS = 50; // 0.5% -> market creator
    // remainder (1%) accrues to the protocol

    struct Market {
        address creator;
        Lane lane;
        bool settled;
        bool outcome; // valid only once settled
        uint64 tradingCloseBlock; // SOURCE-chain height
        uint64 chainKey;
        uint256 b;
        uint256 qYes;
        uint256 qNo;
        uint256 subsidy; // escrowed b*ln(2)
        uint256 collateral; // paid in by traders, owed to winners
        uint256 bountyPool;
        uint256 creatorFees;
    }

    address public immutable OWNER;
    ICruxResolver public resolver;

    uint256 public nextMarketId = 1;
    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => uint256)) public yesShares;
    mapping(uint256 => mapping(address => uint256)) public noShares;
    uint256 public protocolFees;

    event MarketCreated(
        uint256 indexed marketId, address indexed creator, uint64 chainKey, uint256 b, string question
    );
    event Traded(
        uint256 indexed marketId,
        address indexed trader,
        bool indexed yes,
        bool isBuy,
        uint256 shares,
        uint256 amount,
        uint256 priceYesAfter
    );
    event Settled(uint256 indexed marketId, bool outcome, address indexed resolverCaller, uint256 bounty);
    event Claimed(uint256 indexed marketId, address indexed user, uint256 payout);

    error NotOwner();
    error ResolverAlreadySet();
    error NotResolver();
    error InsufficientSubsidy(uint256 required, uint256 supplied);
    error TradingWindowTooTight(uint64 tradingCloseBlock, uint64 fromBlock, uint64 required);
    error TradingClosed(uint64 attested, uint64 tradingCloseBlock);
    error AlreadySettled();
    error NotSettled();
    error SlippageExceeded(uint256 got, uint256 limit);
    error InsufficientShares();
    error NothingToClaim();
    error TransferFailed();

    modifier onlyResolver() {
        if (msg.sender != address(resolver)) revert NotResolver();
        _;
    }

    constructor() {
        OWNER = msg.sender;
    }

    /// @dev Set once, right after deployment. The resolver needs this contract's
    ///      address in its constructor, so the two cannot both be immutable.
    function setResolver(ICruxResolver r) external {
        if (msg.sender != OWNER) revert NotOwner();
        if (address(resolver) != address(0)) revert ResolverAlreadySet();
        resolver = r;
    }

    // -------------------------------------------------------------- creation

    /**
     * @notice Create a market. The creator escrows the LMSR subsidy b·ln(2),
     *         which is what lets the market quote a price with no liquidity
     *         providers and no trades yet.
     */
    function createMarket(
        AttestSpec calldata spec,
        uint64 closeBlock,
        uint256 b,
        string calldata question
    ) external payable returns (uint256 marketId) {
        uint256 required = LMSR.maxLoss(b);
        if (msg.value < required) revert InsufficientSubsidy(required, msg.value);

        // R3, enforced at creation rather than trusted to the UI.
        uint64 earliestSafeFrom = closeBlock + LAG_BUFFER_BLOCKS;
        if (spec.fromBlock < earliestSafeFrom) {
            revert TradingWindowTooTight(closeBlock, spec.fromBlock, earliestSafeFrom);
        }

        marketId = nextMarketId++;
        markets[marketId] = Market({
            creator: msg.sender,
            lane: Lane.PROOF,
            settled: false,
            outcome: false,
            tradingCloseBlock: closeBlock,
            chainKey: spec.chainKey,
            b: b,
            qYes: 0,
            qNo: 0,
            subsidy: msg.value,
            collateral: 0,
            bountyPool: 0,
            creatorFees: 0
        });

        resolver.registerSpec(marketId, spec);
        emit MarketCreated(marketId, msg.sender, spec.chainKey, b, question);
    }

    // --------------------------------------------------------------- trading

    function buy(uint256 marketId, bool yes, uint256 shares, uint256 maxCost) external payable {
        Market storage m = markets[marketId];
        _requireTradingOpen(m);

        uint256 cost = LMSR.buyCost(m.qYes, m.qNo, m.b, yes, shares);
        uint256 fee = (cost * FEE_BPS) / 10_000;
        uint256 total = cost + fee;
        if (total > maxCost) revert SlippageExceeded(total, maxCost);
        if (msg.value < total) revert SlippageExceeded(total, msg.value);

        if (yes) {
            m.qYes += shares;
            yesShares[marketId][msg.sender] += shares;
        } else {
            m.qNo += shares;
            noShares[marketId][msg.sender] += shares;
        }

        m.collateral += cost;
        _splitFee(m, cost, fee);

        // Refund any overpayment rather than keeping it.
        if (msg.value > total) _send(msg.sender, msg.value - total);

        emit Traded(marketId, msg.sender, yes, true, shares, total, LMSR.priceYes(m.qYes, m.qNo, m.b));
    }

    function sell(uint256 marketId, bool yes, uint256 shares, uint256 minProceeds) external {
        Market storage m = markets[marketId];
        _requireTradingOpen(m);

        mapping(address => uint256) storage book = yes ? yesShares[marketId] : noShares[marketId];
        if (book[msg.sender] < shares) revert InsufficientShares();

        uint256 gross = LMSR.sellProceeds(m.qYes, m.qNo, m.b, yes, shares);
        uint256 fee = (gross * FEE_BPS) / 10_000;
        uint256 net = gross - fee;
        if (net < minProceeds) revert SlippageExceeded(net, minProceeds);

        book[msg.sender] -= shares;
        if (yes) m.qYes -= shares;
        else m.qNo -= shares;

        m.collateral -= gross;
        _splitFee(m, gross, fee);

        _send(msg.sender, net);
        emit Traded(marketId, msg.sender, yes, false, shares, net, LMSR.priceYes(m.qYes, m.qNo, m.b));
    }

    function _splitFee(Market storage m, uint256, uint256 fee) internal {
        uint256 bounty = (fee * BOUNTY_BPS) / FEE_BPS;
        uint256 creatorCut = (fee * CREATOR_BPS) / FEE_BPS;
        m.bountyPool += bounty;
        m.creatorFees += creatorCut;
        protocolFees += fee - bounty - creatorCut;
    }

    /**
     * @dev Trading is gated on the ATTESTED source height, not on Creditcoin's
     *      own block number. Creditcoin has no idea where Ethereum is except
     *      through attestation, and the whole point of the gate is to close
     *      before the source chain reaches the observation window.
     */
    function _requireTradingOpen(Market storage m) internal view {
        if (m.settled) revert AlreadySettled();
        (uint64 attested,) = CHAIN_INFO.getLatestAttestedHeightAndHash(m.chainKey);
        if (attested >= m.tradingCloseBlock) revert TradingClosed(attested, m.tradingCloseBlock);
    }

    // ------------------------------------------------------------ settlement

    function settle(uint256 marketId, bool yes, address resolverCaller) external onlyResolver {
        Market storage m = markets[marketId];
        if (m.settled) revert AlreadySettled();

        m.settled = true;
        m.outcome = yes;

        // D6 — pay whoever produced the resolving proof. This is what makes
        // permissionless resolution actually happen: proofs get cheaper the
        // sooner they are submitted (C4), so somebody must want to submit one.
        uint256 bounty = m.bountyPool;
        m.bountyPool = 0;
        if (bounty > 0) _send(resolverCaller, bounty);

        emit Settled(marketId, yes, resolverCaller, bounty);
    }

    function claim(uint256 marketId) external {
        Market storage m = markets[marketId];
        if (!m.settled) revert NotSettled();

        mapping(address => uint256) storage book = m.outcome ? yesShares[marketId] : noShares[marketId];
        uint256 shares = book[msg.sender];
        if (shares == 0) revert NothingToClaim();

        book[msg.sender] = 0;
        _send(msg.sender, shares); // winning shares redeem 1:1
        emit Claimed(marketId, msg.sender, shares);
    }

    // ----------------------------------------------------------------- views

    function priceYes(uint256 marketId) external view returns (uint256) {
        Market storage m = markets[marketId];
        return LMSR.priceYes(m.qYes, m.qNo, m.b);
    }

    function quoteBuy(uint256 marketId, bool yes, uint256 shares) external view returns (uint256) {
        Market storage m = markets[marketId];
        uint256 cost = LMSR.buyCost(m.qYes, m.qNo, m.b, yes, shares);
        return cost + (cost * FEE_BPS) / 10_000;
    }

    function tradingCloseBlock(uint256 marketId) external view returns (uint64) {
        return markets[marketId].tradingCloseBlock;
    }

    function isSettled(uint256 marketId) external view returns (bool) {
        return markets[marketId].settled;
    }

    function _send(address to, uint256 amount) internal {
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    receive() external payable {}
}
