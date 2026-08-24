# CRUX — Attestation-Settled Prediction Markets

**BUIDL CTC 2026 Fall · Attestcoin Protocol · Tracks: DeFi (primary), AI (secondary)**

> Built on Creditcoin. Settled by Ethereum reality.
>
> Every prediction market dies at the oracle. CRUX markets settle themselves: resolution is a
> cryptographic proof that an event occurred on Ethereum, verified inside a single Creditcoin
> block by the Attestcoin precompile. No committee, no admin key, no trusted reporter.

This document is the complete research record, verification log, decision register, and build plan.
Everything marked **VERIFIED** was executed against the live network on 2026-08-11, not read from docs.

---

## Table of contents

1. [Verdict](#1-verdict)
2. [Research: what the Attestcoin Protocol actually is](#2-research-what-the-attestcoin-protocol-actually-is)
3. [Verification log — what I ran and what came back](#3-verification-log--what-i-ran-and-what-came-back)
4. [Constraints derived from verification](#4-constraints-derived-from-verification)
5. [Competitive research](#5-competitive-research)
6. [Decision register](#6-decision-register)
7. [Product concept](#7-product-concept)
8. [Architecture](#8-architecture)
9. [Contract specifications](#9-contract-specifications)
10. [Off-chain services](#10-off-chain-services)
11. [Frontend](#11-frontend)
12. [Prerequisites — blocking, do first](#12-prerequisites--blocking-do-first)
13. [Timeline](#13-timeline)
14. [Risk register](#14-risk-register)
15. [Submission checklist](#15-submission-checklist)
16. [Open questions](#16-open-questions)
17. [Reference appendix](#17-reference-appendix)

---

## 1. Verdict

**Feasible. Proven end-to-end before a line of product code was written.**

The full pipeline — take a real Ethereum **mainnet** transaction, generate a Merkle + continuity
proof, and have Creditcoin's precompile cryptographically confirm it — was executed successfully:

```
chainKey 3 — ETHEREUM MAINNET
  block 25733720  tx 0x36cc3c251f4906a0ff794687742c4a8fe44d34b4ec2bc872979d1a5f2c43f62a
  proof gen         : 875ms
  txBytes           : 4224 bytes (max 449280)
  merkle siblings   : 10
  continuity roots  : 1
  VERIFY on 0x0FD2  : TRUE  ✓ PROVEN   (257ms)

chainKey 1 — SEPOLIA
  block 11468100  tx 0x9b44698fc4886b62af865ce874b7796b70165d1f24a7c7b86024da9fd519f01d
  proof gen         : 233ms
  txBytes           : 2208 bytes
  merkle siblings   : 7
  continuity roots  : 1
  VERIFY on 0x0FD2  : TRUE  ✓ PROVEN   (240ms)
```

### The discovery that shapes the entire project

**Creditcoin *testnet* attests Ethereum *mainnet*.** Not only Sepolia.

The hackathon requires deployment on a testnet. Normally that means every demo is synthetic. Here it
does not: markets can be written against **real Chainlink prices, real whale transfers, real DAO
votes**, resolved by cryptographic proof, while the dApp itself sits on Creditcoin testnet exactly as
the rules require.

This is the single highest-leverage fact in the whole document, and it is why the demo will not look
like a toy.

### Why this fit is unusually good

The hardest unsolved problem in prediction markets is the oracle. Polymarket needs UMA's optimistic
oracle — bonds, disputes, a two-hour challenge window, human token-holders voting. Kalshi needs a
CFTC-registered clearinghouse and a review committee.

Attestcoin makes that machinery unnecessary for any question whose answer is an Ethereum event.
Resolution stops being a governance problem and becomes a proof. That is not a bolt-on integration —
it is the product, which is precisely what *"depth of Attestcoin Protocol utilization will be
evaluated as one of the core scoring criteria"* is asking for.

---

## 2. Research: what the Attestcoin Protocol actually is

Formerly *Universal Smart Contracts (USC)*. It extends Creditcoin with decentralized infrastructure
for verified cross-chain data, replacing centralized oracle operators.

### Mechanism

**Attestors** independently monitor source-chain blocks and gossip attestations over libp2p. Creditcoin
trusts no single attestor; a decentralized set must reach consensus. Votes are signed **SR25519** for
identity and **BLS** for aggregation, so many votes collapse into one verifiable aggregate signature.
**Validators** receive attestation transactions and include them in blocks; the runtime verifies the
BLS aggregate and checks quorum before committing to on-chain storage.

Storing an attestation for every source block would be prohibitively expensive, so attestations are
committed at intervals — **VERIFIED: every 10 blocks** on both Ethereum mainnet and Sepolia.

### The two proofs

| Proof | Proves |
|---|---|
| **Merkle proof** | this transaction is included in that block |
| **Continuity proof** | that block is part of the finalized chain, linking it to a committed attestation |

A **precompile at `0x0000000000000000000000000000000000000FD2`** verifies both synchronously, in
compiled Rust, within a single Creditcoin block. So a foreign transaction can be validated, decoded,
and acted on inside one transaction.

### Readability vs. writability

- **Readability** (Creditcoin reads other chains) — live on mainnet and testnet. This is what we use.
- **Writability** (Creditcoin writes to other chains) — **not available.** Docs state it is undergoing
  third-party testing and audits, and that details will appear *"once the writability feature is
  mature and released on Creditcoin testnet."* It is not on testnet. Not usable this hackathon.

### Developer surface

- **`@gluwa/usc-sdk`** — TypeScript, peer-dep ethers v6. Proof generation and verification.
- **`@gluwa/usc-contracts`** — Solidity, distributed as source for Foundry. Ships `EvmV1Decoder`.
- **Proof Builder** — hosted REST service that builds proofs so dApps don't compute them.
- **`github.com/gluwa/usc-testnet-bridge-examples`** — working reference contracts and worker.

### The decoder is the whole ballgame

`EvmV1Decoder` is what turns "prove a transaction happened" into "read the data inside it". From the
reference `USCMinter.sol`:

```solidity
uint8 txType = EvmV1Decoder.getTransactionType(encodedTransaction);
require(EvmV1Decoder.isValidTransactionType(txType), "Unsupported transaction type");

EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(encodedTransaction);
require(receipt.receiptStatus == 1, "Transaction did not succeed");

EvmV1Decoder.LogEntry[] memory logs =
    EvmV1Decoder.getLogsByEventSignature(receipt, EVENT_SIGNATURE);
```

`LogEntry` carries `address_`, `topics[]`, and `data` — everything needed to reconstruct any Ethereum
event inside Solidity on Creditcoin.

**A prediction market is exactly this, plus a comparator, plus a payout.**

---

## 3. Verification log — what I ran and what came back

Every item below was executed live on **2026-08-11**. Nothing here is quoted from documentation.

### 3.1 Chain liveness

```
chainId       : 102031
blockNumber   : 5292523
gasPrice      : 500000000 wei   (0.5 gwei)
maxFeePerGas  : 1000000000 wei
```

### 3.2 Supported source chains — `getSupportedChains()` via ChainInfo precompile

```json
[
  { "chainKey": 3, "chainId": 1,        "chainName": "0x457468657265756d",         "chainEncoding": 1 },
  { "chainKey": 1, "chainId": 11155111, "chainName": "0x5365706f6c696120657468657265756d", "chainEncoding": 1 }
]
```

Hex-decoded: chainKey 3 = `"Ethereum"` (mainnet), chainKey 1 = `"Sepolia ethereum"`.

**Both are registered on Creditcoin _testnet_.** Registration alone proves nothing, so:

### 3.3 Live attestation lag — is it actually running?

```
======== chainKey 3 — Ethereum Mainnet ========
attestation genesis height : 0
latest ATTESTED height     : 25733640
source chain HEAD          : 25733678
  >> LAG: 38 blocks (~7.6 min behind head)
  >> LIVE ATTESTATION: YES — actively attesting

======== chainKey 1 — Sepolia ========
latest ATTESTED height     : 11468020
source chain HEAD          : 11468058
  >> LAG: 38 blocks (~7.6 min behind head)
  >> LIVE ATTESTATION: YES — actively attesting
```

Checkpoint interval, from `getContinuityBounds`:

```json
{ "parentHeight": 25733630, "childHeight": 25733640,
  "parentIsAttestation": true, "childIsAttestation": true, "isAttested": true }
```

→ **attestation checkpoints every 10 source blocks**, both chains.

### 3.4 SDK is real and installs clean

```
├── @gluwa/usc-sdk@0.18.0
└── ethers@6.17.0
```

Exported surface:

```
chainInfo     : CHAIN_INFO_PRECOMPILE_ADDRESS, PrecompileChainInfoProvider
blockProver   : BLOCK_PROVER_PRECOMPILE_ADDRESS, PrecompileBlockProver
proofProvider : raw, service, merkle, mergeProofs

PrecompileBlockProver methods:
  computeTransactionIndex, verifySingle, verifyAndEmitSingle, verifyBatch, verifyAndEmitBatch

PrecompileChainInfoProvider methods:
  getAttestationGenesisHeight, getAttestationHeightForDigest, getCheckpointForHeight,
  getContinuityBounds, getLatestAttestedHeightAndHash, getSupportedChainByKey,
  waitUntilHeightAttested

Constant: MAX_ENCODED_SIZE = 449280
```

`@gluwa/usc-contracts@0.1.2` also exists — *"Solidity contracts and libraries for the USC ecosystem…
Distributed as source for consumption by Foundry/forge."*

### 3.5 Proof Builder REST API

The docs give two conflicting hostnames. **Both are live and both work** (identical Swagger UI):

- `https://prover.cc3-testnet.creditcoin.network`
- `https://proof-gen-api.cc3-testnet.creditcoin.network`

No OpenAPI JSON is served (all spec paths 404), so routes were recovered from SDK source:

```
GET /api/v1/attested-height/{chainKey}
GET /api/v1/proof-by-tx/{chainKey}/{transactionHash}
GET /api/v1/proof-batch-by-tx
```

Live responses:

```
GET /api/v1/attested-height/1  →  {"attestedHeight":11468110}
GET /api/v1/attested-height/3  →  {"attestedHeight":25733730}
```

### 3.6 Proof generation latency

```
SEPOLIA          proof-by-tx  →  HTTP 200  0.916s   15098 byte payload
ETHEREUM MAINNET proof-by-tx  →  HTTP 200  0.910s    9873 byte payload
```

**~1 second on both chains.** An earlier 25-minute hang was my own `eth_getLogs` scan against rate-limited
public RPCs, *not* the protocol. Worth recording because it nearly produced a false negative.

### 3.7 End-to-end verification (the decisive test)

Results in [§1](#1-verdict). Both chains returned `TRUE`.

**Critical property discovered:** `verifySingle` is a **staticcall**. Proofs can be verified with **zero
funds and no wallet**. This unblocks all development before the faucet is sorted, and lets the frontend
verify proofs client-side for free.

### 3.8 Reference implementation exists

Docs claim *"No code examples or reference implementations are provided."* **This is wrong.**
`github.com/gluwa/usc-testnet-bridge-examples` clones and contains:

```
contracts/sol/  USCBase.sol  VerifierInterface.sol  USCMinter.sol  USCLoanManager.sol
                AuxiliaryLoanContract.sol  LoanTypes.sol  MintableToken.sol
                BridgeTestToken.sol  TestERC20.sol
bridge-offchain-worker/worker.ts
hello-bridge/  custom-contracts-bridging/  loan-flow/  utils/
```

`VerifierInterface.sol` — the complete precompile interface, verbatim:

```solidity
interface INativeQueryVerifier {
    struct MerkleProofEntry { bytes32 hash; bool isLeft; }
    struct MerkleProof { bytes32 root; MerkleProofEntry[] siblings; }
    struct ContinuityProof { bytes32 lowerEndpointDigest; bytes32[] roots; }

    function verifyAndEmit(
        uint64 chainKey,
        uint64 height,
        bytes calldata encodedTransaction,
        MerkleProof calldata merkleProof,
        ContinuityProof calldata continuityProof
    ) external returns (bool);

    function calculateTxIndex(MerkleProof calldata merkle_proof) external view returns (uint64);
}

library NativeQueryVerifierLib {
    address constant PRECOMPILE_ADDRESS = 0x0000000000000000000000000000000000000FD2;
    function getVerifier() internal pure returns (INativeQueryVerifier) {
        return INativeQueryVerifier(PRECOMPILE_ADDRESS);
    }
}
```

`USCBase.sol` gives us verify-then-dispatch with replay protection for free. We inherit it directly:

```solidity
abstract contract USCBase {
    INativeQueryVerifier public immutable VERIFIER;
    mapping(bytes32 => bool) public processedQueries;

    function _processAndEmitEvent(uint8 action, bytes32 queryId, bytes memory encodedTransaction)
        internal virtual;

    function execute(
        uint8 action, uint64 chainKey, uint64 blockHeight,
        bytes calldata encodedTransaction, bytes32 merkleRoot,
        INativeQueryVerifier.MerkleProofEntry[] calldata siblings,
        bytes32 lowerEndpointDigest, bytes32[] calldata continuityRoots
    ) external returns (bool success);
}
```

`queryId` is `keccak256(chainKey ‖ blockHeight ‖ txIndex)` — replay protection is per source
transaction, which is exactly the granularity a resolver needs.

### 3.9 Chainlink on Ethereum mainnet (our flagship data source)

```
ETH/USD proxy       : 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419
current aggregator  : 0x7d4E742018fb52E48b08BE73d041C18B21de6Fb5
latest answer       : $1863.15 @ 2026-08-11T18:38:47Z
AnswerUpdated topic0: 0x0559884fd3a460db3073b7fc896cc77986f16e378210ded43186175bf646fc5f
```

`event AnswerUpdated(int256 indexed current, uint256 indexed roundId, uint256 updatedAt)` — the price
sits in **indexed topic[1]**, so it is trivially extractable from `LogEntry.topics[1]` with no ABI
decoding. Chainlink price markets are the cheapest possible thing to build on this stack.

> ⚠ The aggregator address changes when Chainlink upgrades a feed. Resolve `proxy.aggregator()` at
> market-creation time and pin it into the market's spec; never hardcode it in a contract.

### 3.10 Local toolchain

```
node    v24.18.0        yarn 1.22.22      npm 11.16.0      pnpm 11.13.1
forge   1.7.1           git  2.43.0
docker  NOT AVAILABLE (WSL2 integration disabled)
```

Two notes: the examples repo pins **foundry v1.2.3** and we have 1.7.1 — pin per-project if the repo
misbehaves. Docker is only needed to run an *attestor node*, which we are not doing, so its absence is
harmless.

### 3.11 Facts taken from docs but NOT independently verified

Recorded honestly so nobody mistakes them for measurements:

- Gas formula `CTC ≈ 2.3e-5 + 2.9e-7 × (continuity hash count)`; 10–100× penalty for stale proofs.
- Batch limits: 10 proofs per batch, 1000-block range.
- Block time 15s, finality 1–3 blocks, block gas limit 75,000,000.
- Testnet faucet is a Discord bot in `#token-faucet`; rate limits undocumented.
- Writability status (under audit, not on testnet).
- Decoder contracts: testnet `0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f`,
  mainnet `0x9D094C9f22B10FCf842c2fC6A0981630A4F94B5C`.

---

## 4. Constraints derived from verification

These are load-bearing. Every design decision below traces back to one of them.

| # | Constraint | Consequence for CRUX |
|---|---|---|
| C1 | **Writability unavailable.** No Creditcoin → Ethereum messaging. | All collateral, trading and payout live on Creditcoin. Ethereum is read-only truth. Nothing to bridge back. |
| C2 | **~7.6 min attestation lag** + Ethereum finality. | Minimum honest market cycle ≈ 15 min. **CRSHMARKET's 60-second markets are impossible on cross-chain data.** Design around it, don't pretend. |
| C3 | **Inclusion ≠ success.** The precompile proves a tx was *included*, not that it *succeeded*. | `require(receipt.receiptStatus == 1)` is mandatory. Omitting it lets an attacker resolve a market with a deliberately reverted transaction. Highest-severity foot-gun in the stack. |
| C4 | **Stale proofs cost 10–100×** (continuity proof lengthens as checkpoints thin out). | Resolve promptly. Fund a resolution bounty so somebody always wants to. Our fresh proofs used **1 continuity root** — the cheapest case. |
| C5 | **Payload cap 449,280 bytes**; batch cap 10 proofs / 1000 blocks. | Fine for events (ours were 2–4 KB). Batch-resolve markets sharing a continuity proof to amortise gas. |
| C6 | **Proof gen ~1s, verify ~250ms, staticcall.** | Resolution feels instant once the block is attested. Verification needs no gas — the UI can prove client-side for free. |
| C7 | **No subgraph / indexer on Creditcoin.** | Write a small custom event indexer. Budget ~1 day. |
| C8 | **Public Ethereum RPCs block archive `eth_getLogs`.** | A real RPC key (Alchemy/Infura) with mainnet archive access is a **blocking** prerequisite. |
| C9 | **Only Ethereum mainnet + Sepolia** are attested. No BTC, no L2s. | Market universe = Ethereum L1 events. Ample, but scope the pitch honestly. |

---

## 5. Competitive research

### 5.1 CRSHMARKET (Monad) — the stated inspiration

**Confidence: LOW.** Public sources are thin and much of what matters could not be confirmed.

What sources support:

- Livestream-native prediction market on Monad — pitched as "Twitch × Kalshi". Viewers predict
  outcomes during live esports/IRL/creator streams.
- Markets settle in as little as **60 seconds**, leaning on Monad's ~0.4s blocks.
- Blink integration for one-tap stablecoin deposits without leaving the stream.
- Reported ~20,000 users and ~$175K volume; ~$1.25M raised. *(Single low-authority interview source —
  treat as indicative, not factual.)*

What could **not** be verified — and we should not claim:

- Market microstructure (AMM vs CLOB vs parimutuel) — undocumented publicly.
- Resolution mechanism — undocumented. For 60s settlement it is likely a streamer/operator report,
  i.e. centralized.
- Specific gamification features (streaks, XP, leaderboards) — plausible, unconfirmed.

**Conclusion we can act on:** CRSHMARKET's edge is **distribution and UX**, not market design. Its
resolution is very likely its weakest link — the exact thing Attestcoin lets us make our strongest.
So: borrow the consumer-app energy, invert the trust model.

### 5.2 Landscape

| Protocol | Mechanism | Resolution | Collateral |
|---|---|---|---|
| Polymarket | CLOB + conditional tokens | UMA optimistic oracle, ~2h challenge, bonded | USDC |
| Kalshi | CLOB | CFTC-regulated clearinghouse + review committee | USD |
| Azuro | vAMM, shared liquidity pool | Data provider + DAO arbitration | Stablecoin |
| Drift BET | Orderbook + AMM backstop | Oracle, price-bounded 0–1 | Stablecoin |
| Limitless | CLOB + CFMM hybrid | Chainlink / Pyth automated | USDC |
| Myriad | vAMM + CLOB hybrid | Oracle-submitted outcome | Stablecoin |
| SX Bet | P2P CLOB | On-chain reporter, objective sports | Fully collateralized |
| Parimutuel | Pooled, proportional payout | Pool-determined | Pool |

**Every single one** either trusts a reporter, a committee, a regulator, or a bonded optimistic game.
**None resolve by cryptographic proof of the underlying event.** That gap is the product.

---

## 6. Decision register

Every decision, who made it, and why.

### D1 — Resolution model: cryptographic + AI, with disputes on the AI path only
**Decided by: user.**

Two lanes with a hard boundary:

- **Proof lane** (default): questions about Ethereum events. Resolved by Attestcoin proof. No dispute
  window — you cannot dispute mathematics. Instant finality once attested.
- **AI lane**: off-chain questions cryptography cannot reach. An AI resolver posts an outcome plus a
  bond and an evidence hash, followed by a dispute window in which anyone can challenge with a
  counter-bond.

*Why this is right:* an AI oracle is centralized, and that would undercut the whole thesis if applied
everywhere. Confining it to questions that are *provably* outside cryptography's reach — and bonding
it — contains the damage. The trustless claim stays honest and precise: **"if it happened on Ethereum,
no human can change the outcome."** Also earns a legitimate AI track claim.

### D2 — AI scope: off-chain events only
**Decided by: user.**

AI handles sports, politics, news, "did X ship by date Y". It never reinterprets on-chain data. Clean
conceptual split, trivially explainable to judges, keeps lane boundaries from blurring.

### D3 — Market mechanism: LMSR
**Decided by: user.**

Cost function `C(q) = b·ln(Σ exp(qᵢ/b))`, price `pᵢ = exp(qᵢ/b) / Σ exp(qⱼ/b)`.

*Why:* always quotable against a protocol-subsidized `b`, so a market is tradeable from block one with
zero LPs — decisive in a hackathon with no users. Prices move on every trade, which is what makes the
odds bar feel alive in a swipe UI. Loss is bounded by `b·ln(n)`, a known, budgetable subsidy.
Rejected: parimutuel (no live price discovery — kills the gamification), CPMM (needs real LPs we won't have).

### D4 — Fact source: Ethereum mainnet (chainKey 3) + Sepolia (chainKey 1)
**Decided by: user.**

Mainnet carries the flagship demo — real Chainlink prices, real whale moves. Sepolia is the test
harness, where we deploy our own contracts and fire any event on demand with free gas.

*Why both:* mainnet alone means we cannot force an event during a live demo; Sepolia alone means every
market is visibly synthetic. Together we get real-world credibility plus deterministic tests.

### D5 — Collateral: native tCTC
**Decided by: me.** No trusted stablecoin exists on CC3 testnet; introducing a mock one adds surface
and teaches judges nothing. Native token keeps the faucet as the only funding dependency.

### D6 — Permissionless, bounty-paid resolution
**Decided by: me.** Anyone may submit a resolving proof; the first valid one wins and collects a bounty
from the market's fee pool.

*Why:* directly answers C4 — it manufactures an economic incentive to resolve *fast*, when proofs are
cheapest. It also removes the privileged-resolver role, so there is no admin key in the proof lane.
Our worker becomes a convenience, not a trust assumption. This is the design detail most likely to
impress a technical judge.

### D7 — Window/EXISTS predicate as the primary market shape
**Decided by: me.** Markets ask *"will a matching event occur in block window [from, to]?"*

*Why:* it makes YES provable by a single proof and NO provable by the mere passage of time (once `to`
is attested, absence is established). Asymmetric, cheap, and it covers the natural shape of almost all
prediction markets — *"will X happen by T"*. The alternative — "what was the value exactly at block
N" — requires pinning a specific Chainlink round and is far more brittle.

### D8 — `CruxBeacon` state-snapshot primitive on Sepolia
**Decided by: me.** A permissionless contract that `staticcall`s any target and emits the returned
bytes as an event.

*Why:* Attestcoin can only prove *transactions and their logs*, not raw storage slots. A beacon
converts any `view`-readable EVM state into an attestable event, generalizing the system from
"markets about events" to "markets about any on-chain state". This is our strongest original technical
contribution. Sepolia-only, since snapshotting on mainnet costs real ETH.

### D9 — Latency reframed as spectacle, not hidden
**Decided by: me.** C2 makes sub-minute cross-chain markets impossible. Rather than disguise ~15
minutes, make resolution the highlight: a **Proof Drop** that animates the Merkle path and stamps
`PROVEN · ETHEREUM MAINNET · BLOCK 25,733,720`.

*Why:* no competitor can render that screen, because none of them actually prove anything. Split the
clock — the game loop runs at Creditcoin's 15s blocks and feels instant; the truth loop runs at
Ethereum's pace and feels weighty.

### D10 — Brier calibration score as soulbound reputation
**Decided by: me.** Each user accrues an on-chain Brier score, streak, and season XP in a
non-transferable token.

*Why:* gamification that argues the thesis instead of decorating it. Because resolution is
cryptographic, the reputation is *provably* untainted by oracle manipulation — a claim literally no
other prediction market can make. It also gives us leaderboards and seasons for free.

### D11 — Name: CRUX
**Decided by: me — open to change.** "The decisive point." Phonetically echoes CRSHMARKET, which is a
nice nod to the inspiration without imitating it.

---

## 7. Product concept

**CRUX** is a mobile-first, gamified prediction market on Creditcoin where markets about Ethereum
settle themselves by cryptographic proof.

### Two clocks

| | Runs on | Cadence | What happens |
|---|---|---|---|
| **Game loop** | Creditcoin | 15s blocks | Swipe, trade, live LMSR odds, streaks, XP, leaderboard. Feels instant. |
| **Truth loop** | Attestcoin | ~15 min | Attestation, proof, verification, settlement. Feels weighty. |

### Market catalogue at launch

| Template | Source | Event | Lane |
|---|---|---|---|
| "ETH above $X before T" | Mainnet | Chainlink `AnswerUpdated` topic[1] | Proof |
| "Whale wallet moves > N ETH" | Mainnet | ERC-20 / native `Transfer` | Proof |
| "Uniswap proposal #N executes" | Mainnet | Governor `ProposalExecuted` | Proof |
| "Gas above N gwei before T" | Sepolia | `CruxBeacon` snapshot | Proof |
| "Contract X hits N total swaps" | Sepolia | Beacon snapshot | Proof |
| "Will \<off-chain event\> occur" | — | AI resolver + bonded dispute | AI |

Anyone can create a market by composing a spec from the template gallery, and earns a share of its
fees.

### The demo, in one sentence

Open a market on the real ETH price, watch Chainlink update on Ethereum mainnet, watch the proof land
on Creditcoin ~8 minutes later, and watch the market settle itself with no human involved anywhere.

---

## 8. Architecture

```
┌──────────────────────── ETHEREUM (source of truth) ────────────────────────┐
│                                                                            │
│  MAINNET (chainKey 3)                    SEPOLIA (chainKey 1)              │
│  ├─ Chainlink AnswerUpdated              ├─ CruxBeacon.sol   ← we deploy   │
│  ├─ ERC-20 / native Transfer             │    staticcall → emit Snapshot   │
│  └─ Governor ProposalExecuted            └─ test event emitters            │
└────────────────────────────────────────────────────────────────────────────┘
                │  attestors gossip · BLS aggregate · quorum
                │  VERIFIED: checkpoint every 10 blocks, ~7.6 min lag
                ▼
┌──────────────────────── CREDITCOIN CC3 TESTNET (102031) ───────────────────┐
│                                                                            │
│   precompile 0x0FD2  ── verify(merkle, continuity) ─→ bool  [~250ms]       │
│            │                                                               │
│            ▼                                                               │
│   CruxAttestedResolver is USCBase        CruxAIResolver                    │
│   • receiptStatus == 1  (C3)             • AI posts outcome + bond         │
│   • match emitter + topic0               • dispute window, counter-bond    │
│   • extract operand, compare             • escalate → committee            │
│   • pay resolution bounty (D6)           • finalize if unchallenged        │
│            │                                      │                        │
│            └──────────────┬───────────────────────┘                        │
│                           ▼                                                │
│              CruxMarket  (LMSR, tCTC collateral)                           │
│                           │                                                │
│                           ▼                                                │
│              CruxScore   (soulbound Brier / streak / XP)                   │
└────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
   crux-worker  ·  crux-ai  ·  crux-indexer   →   Next.js frontend
```

**Trust boundary, stated precisely:** in the proof lane, the only trust assumption is the Attestcoin
attestor quorum — the same assumption Creditcoin itself makes. There is no admin key, no reporter, no
dispute window. In the AI lane, trust is an AI agent bounded by an economic dispute game. The UI
labels every market with its lane so users always know which guarantee they hold.

---

## 9. Contract specifications

Solidity `^0.8.23` (matching the reference contracts), Foundry, OpenZeppelin.

### 9.1 `CruxAttestedResolver.sol is USCBase`

The core contribution. A market's resolution rule is **data**, not code:

```solidity
enum Extract    { TOPIC, DATA_WORD }
enum Comparator { GT, GTE, LT, LTE, EQ, EXISTS }

struct AttestSpec {
    uint64     chainKey;      // 3 = Ethereum mainnet, 1 = Sepolia
    address    emitter;       // log MUST originate here
    bytes32    topic0;        // event signature
    Extract    extractMode;   // read from an indexed topic, or a 32-byte data word
    uint8      extractIndex;  // topic index 1..3, or word offset in data
    Comparator cmp;
    int256     threshold;
    uint64     fromBlock;     // observation window, source-chain heights
    uint64     toBlock;
}
```

`_processAndEmitEvent` performs, in order:

1. `getTransactionType` + `isValidTransactionType`
2. **`require(receipt.receiptStatus == 1)`** — C3, non-negotiable
3. `getLogsByEventSignature(receipt, spec.topic0)`
4. `require(log.address_ == spec.emitter)` — a matching topic from the wrong contract is an attack
5. `require(blockHeight >= spec.fromBlock && blockHeight <= spec.toBlock)`
6. extract operand per `extractMode` / `extractIndex`
7. apply `cmp` against `threshold` → on match, settle **YES**
8. pay the resolution bounty to `msg.sender` (D6)

Replay protection is inherited: `processedQueries[queryId]`, `queryId = keccak256(chainKey ‖ blockHeight ‖ txIndex)`.

**Settling NO** — `settleNo(marketId)`, callable by anyone once `getLatestAttestedHeightAndHash(chainKey).height > spec.toBlock`.
No proof needed: if the window is fully attested and no valid YES proof ever arrived, the event did not
occur. Absence is established by attested time (D7).

### 9.2 `CruxMarket.sol`

Single contract holding many binary markets (cheaper than per-market deploys).

- LMSR over `{YES, NO}` using PRBMath `UD60x18` for `exp`/`ln`.
- `buy(marketId, outcome, shares, maxCost)` / `sell(marketId, outcome, shares, minProceeds)` — both slippage-guarded.
- Fee split: liquidity subsidy recovery / creator share / **resolution bounty pool** / protocol.
- `claim(marketId)` after settlement; winning shares redeem 1:1 in tCTC.
- Trading halts at `tradingCloseBlock` (Creditcoin height), set safely before `spec.toBlock` so nobody
  can trade on an outcome already visible on Ethereum but not yet attested. **This gap is the single
  most important economic safety parameter in the system** — see R3.

### 9.3 `CruxAIResolver.sol`

- `propose(marketId, outcome, bytes32 evidenceHash)` — requires a bond.
- Dispute window measured in Creditcoin blocks (~30 min = 120 blocks).
- `dispute(marketId)` with a larger counter-bond → escalates to committee vote.
- `finalize(marketId)` after an unchallenged window; proposer reclaims bond plus fee.
- Losing side's bond is slashed to the winner. Evidence text lives off-chain (IPFS/HTTP), hash on-chain.
- **Only ever attached to markets flagged `Lane.AI`.** Proof-lane markets have no path into this contract.

### 9.4 `CruxScore.sol`

Soulbound (ERC-5192-style). Per user: resolved-market count, **Brier score**
`(1/N)·Σ(pᵢ − oᵢ)²`, current and best streak, season XP. Written by `CruxMarket` on claim. Read by
leaderboards.

### 9.5 `CruxBeacon.sol` — Sepolia

```solidity
event Snapshot(
    bytes32 indexed specId,
    address indexed target,
    bytes4  selector,
    bytes   result,
    uint256 blockNumber
);

function snapshot(bytes32 specId, address target, bytes calldata data) external;
```

`staticcall`s `target`, emits the raw return bytes. Anyone may call it. The emitted event is then
attestable, so any `view`-readable Sepolia state becomes a resolvable market (D8).

---

## 10. Off-chain services

All TypeScript. None of them are trusted — every one is a convenience wrapper over permissionless calls.

### `crux-worker`
Watches markets approaching `toBlock`. For each: scan the source chain for matching logs →
`waitUntilHeightAttested` → `getProof` (~1s) → submit `execute(...)`. Idempotent; on-chain replay
protection makes duplicate submissions harmless. Persists in-flight state to survive restarts and
catches up on missed blocks after downtime. Also calls `settleNo` once windows lapse.

**Anyone can run one.** If ours dies, the bounty ensures someone else resolves. That is the point of D6.

### `crux-ai`
Claude-based resolver for `Lane.AI` markets. Gathers evidence via web search, emits a structured
verdict with citations, pins the evidence, posts `propose()` with a bond. Deliberately conservative:
abstains rather than guesses, because a wrong call costs it real money.

### `crux-indexer`
There is no subgraph on Creditcoin (C7). A small `viem` `watchEvent` indexer writes markets, trades,
resolutions and leaderboards into Postgres and serves the frontend a REST/tRPC API.

---

## 11. Frontend

Next.js + wagmi/viem + Tailwind. Mobile-first.

- **Swipe feed** — one market per card; swipe right YES, left NO; preset stake chips; live LMSR odds bar.
- **Proof Drop** — the resolution moment. Animates the Merkle path, then stamps
  `PROVEN · ETHEREUM MAINNET · BLOCK 25,733,720` with a link to Etherscan and to the Creditcoin
  verification tx. **Client-side verification is free** (C6: `verifySingle` is a staticcall), so the
  browser can independently re-verify the proof and show a green check that trusts nobody, not even
  our backend.
- **Lane badges** — every market is visibly `PROOF` or `AI`. Never let a user confuse the guarantees.
- **Profile** — Brier score, streak, season XP, soulbound badge.
- **Create** — compose an `AttestSpec` from the template gallery; the hard parts (topic0, aggregator
  address, block windows) are resolved for the user at creation time.

---

## 12. Prerequisites — blocking, do first

Ordered by risk. Items 1–3 gate everything.

| # | Item | Why it blocks | Status |
|---|---|---|---|
| 1 | **tCTC from Discord faucet** — join `discord.gg/creditcoin`, `#token-faucet`, `/faucet address:0x…` | Cannot deploy anything without gas. **Rate limits are undocumented** — if it drips slowly, all deployment work stalls. Request early and often. | ☐ |
| 2 | **Ethereum mainnet RPC with archive `eth_getLogs`** (Alchemy/Infura paid tier) | **VERIFIED blocker (C8):** public RPCs reject archive log queries. The worker cannot find resolving events without this. | ☐ |
| 3 | **Sepolia RPC + Sepolia ETH** | Needed to deploy `CruxBeacon` and fire test events. | ☐ |
| 4 | Reproduce `hello-bridge` end-to-end from the examples repo | Proves the whole toolchain works on our machine before we build on it. | ☐ |
| 5 | Confirm Foundry version | Repo pins v1.2.3; we have 1.7.1. Pin per-project if it misbehaves. | ☐ |
| 6 | Verify `EvmV1Decoder` import path from `@gluwa/usc-contracts@0.1.2` | Everything in the proof lane depends on it. Source-distributed for forge — needs a remapping. | ☐ |
| 7 | Contract verification on Blockscout testnet | Judges will want to read the contracts. | ☐ |
| 8 | Ask in `#buidl-ctc-qna`: testnet reset schedule; faucet limits; whether mainnet attestation (chainKey 3) is guaranteed up through Sept 6 | R1 depends entirely on the answer. | ☐ |
| 9 | Team eligibility + submission fields (names, emails, countries, bios) | Required at submission; trivial but easy to leave to the last night. | ☐ |

Already confirmed present: Node v24.18.0, forge 1.7.1, yarn, git. Docker is **not** available but is
not needed (attestor-only).

---

## 13. Timeline

Today **2026-08-11**. Submissions open **08-13**. Deadline **09-06 23:59 ET**. ~26 days.

### Phase 0 — Aug 11–13 · Foundations
Prerequisites §12 items 1–6. Scaffold monorepo (`contracts/`, `worker/`, `ai/`, `indexer/`, `web/`).
Reproduce `hello-bridge`. **Exit criterion: we have proven the toolchain locally, not just read about it.**

### Phase 1 — Aug 14–20 · Proof lane
`CruxAttestedResolver` + `AttestSpec` + `CruxMarket` (LMSR). Foundry tests with fixture proofs captured
from the live prover API. Deploy to CC3 testnet. `CruxBeacon` to Sepolia.
**Exit criterion: a Sepolia-sourced market resolves itself end-to-end, no human in the loop.**

### Phase 2 — Aug 21–27 · Mainnet + automation
Chainlink mainnet market template. `crux-worker` with restart-safety and bounty claiming. `settleNo`.
`crux-indexer`. Batch resolution sharing one continuity proof (C5).
**Exit criterion: a real ETH-price market resolves from Ethereum mainnet data.**

### Phase 3 — Aug 28–Sep 1 · AI lane + gamification
`CruxAIResolver` with bonds and disputes. `crux-ai` agent. `CruxScore` Brier/streak/XP.
**Exit criterion: an AI-resolved market is successfully disputed and overturned in a test.**

### Phase 4 — Sep 2–4 · Frontend
Swipe feed, Proof Drop with client-side verification, lane badges, leaderboard, profile, market creation.
**Exit criterion: the demo runs on a phone.**

### Phase 5 — Sep 5–6 · Submission
Demo video, deck, README, **Attestcoin Integration Summary**, contract verification, final testnet
redeploy, dry-run the whole demo twice.
**Exit criterion: submitted ≥12h before deadline.**

> Deliberate slack: Phase 4 is short because Phases 1–2 carry the technical risk. If they slip, the
> frontend compresses; if they don't, we spend the surplus on polish.

---

## 14. Risk register

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| **R1** | Mainnet attestation (chainKey 3) stops or lags badly before judging | **Critical** | Verified live at 38-block lag today, but it is testnet infrastructure. Ask in `#buidl-ctc-qna`. Keep a Sepolia-only demo path working at all times so no single failure kills the submission. Worker monitors lag and alerts. |
| **R2** | Faucet rate limits starve deployment | High | Request on day 0, accumulate a buffer across multiple addresses, keep deploys lean. Note `verifySingle` is a staticcall — most development needs no gas at all. |
| **R3** | Trading window vs. attestation gap lets someone trade on a known outcome | **High** | Close trading well before `spec.toBlock`, sized generously against the observed ~7.6 min lag. This is an economic invariant, not a UI nicety — document it and test it explicitly. |
| **R4** | Forgetting `receiptStatus == 1` (C3) | **Critical** | A reverted tx could resolve a market. Enforced in `USCBase` subclass, covered by a dedicated adversarial test that submits a proof of a reverted transaction and asserts revert. |
| **R5** | Testnet reset wipes deployments | Medium | Idempotent deploy scripts, addresses in config, ability to redeploy in one command. Ask about the schedule. |
| **R6** | Chainlink upgrades the aggregator mid-hackathon | Medium | Resolve `proxy.aggregator()` at market creation and pin it into the spec (§3.9). Never hardcode. |
| **R7** | LMSR fixed-point math bugs / overflow | Medium | PRBMath rather than hand-rolled. Fuzz `buy`/`sell` round-trips and invariant-test that `Σ prices == 1`. |
| **R8** | Scope creep across two resolution lanes | Medium | Proof lane is the thesis and ships first. AI lane is Phase 3 and is **cuttable** if Phases 1–2 slip. |
| **R9** | Docs are unreliable (proven: wrong about reference code, conflicting prover URLs) | Low | Verify against the live network — as done throughout §3. Trust the chain over the docs. |
| **R10** | Public Ethereum RPC rate limits (cost me a 25-min false alarm) | Low | Paid RPC key (prereq 2). Exponential backoff in the worker. |

---

## 15. Submission checklist

Mapped directly to the hackathon's stated requirements.

| Requirement | How CRUX satisfies it |
|---|---|
| Working Attestcoin integration **running in the project** | `CruxAttestedResolver` calls precompile `0x0FD2` on every proof-lane settlement. Not optional, not mocked — the market cannot resolve without it. |
| Technical documentation of the integration | This README + `/docs/attestcoin-integration.md` covering `AttestSpec`, the proof flow, and the trust boundary. |
| **Depth of utilization** (core scoring criterion) | Precompile verification; `EvmV1Decoder` receipt/log extraction; `USCBase` replay protection; `getLatestAttestedHeightAndHash` driving NO-settlement; batch proofs sharing a continuity proof; gas-aware prompt resolution; **both** chainKey 1 and 3. |
| Deployed on a testnet | CC3 testnet (102031) + Sepolia for `CruxBeacon`. |
| Attestcoin as a **core feature** | Resolution *is* Attestcoin. Remove it and there is no product. |
| Original work created during the hackathon | Yes. Only dependencies are `@gluwa/*`, OpenZeppelin, PRBMath. |
| GitHub repo with README | This. |
| Deck / whitepaper PDF | Phase 5. |
| Demo video | Phase 5 — the Proof Drop is the centrepiece. |
| Project sector | DeFi (primary), AI (secondary). |

---

## 16. Open questions

1. **Is chainKey 3 (mainnet) attestation guaranteed to stay up through Sept 6?** R1 hinges on this. Ask in `#buidl-ctc-qna`.
2. **Faucet rate limits and per-request amount?** Undocumented. Determines deployment cadence.
3. **Testnet reset schedule?** Undocumented. Determines whether we need one-command redeploy.
4. **Which prover hostname is canonical** — `prover.` or `proof-gen-api.`? Both live today; docs conflict. Pick one, keep the other as automatic fallback.
5. **Exact attestor quorum threshold?** Not public. We need it to state our trust assumption precisely in the docs.
6. **Does `verifyBatch` require all proofs to share one continuity proof?** Determines how much batching actually saves. Test empirically in Phase 2.
7. **Committee composition for AI disputes** — multisig for the hackathon, or token vote? Multisig is honest and simpler; document it as a known centralization in the AI lane only.

---

## 17. Reference appendix

### Networks

| | Creditcoin CC3 Testnet | Creditcoin Mainnet |
|---|---|---|
| EVM chain ID | `102031` | `102030` |
| RPC HTTPS | `https://rpc.cc3-testnet.creditcoin.network` | `https://mainnet3.creditcoin.network` |
| RPC WSS | `wss://rpc.cc3-testnet.creditcoin.network` | `wss://mainnet3.creditcoin.network` |
| Explorer (EVM) | `https://creditcoin-testnet.blockscout.com/` | `https://creditcoin.blockscout.com/` |
| Explorer (Substrate) | `https://creditcoin3-testnet.subscan.io/` | `https://creditcoin.subscan.io/` |
| Block time | ~15s | ~15s |
| Base gas price | 0.5 gwei *(verified)* | 0.5 gwei |
| Block gas limit | 75,000,000 | 75,000,000 |

### Attestcoin addresses

| Contract | Testnet | Mainnet |
|---|---|---|
| BlockProver precompile | `0x0000000000000000000000000000000000000FD2` | same |
| ChainInfo precompile | `0x0000000000000000000000000000000000000fd3` | same |
| Decoder | `0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f` | `0x9D094C9f22B10FCf842c2fC6A0981630A4F94B5C` |
| SubstrateTransfer precompile | `0x0000000000000000000000000000000000000Fd1` | same |

### Source chains (as seen from CC3 **testnet**)

| chainKey | Chain | chainId | Attestation genesis | Checkpoint interval |
|---|---|---|---|---|
| `3` | Ethereum Mainnet | 1 | 0 | every 10 blocks *(verified)* |
| `1` | Ethereum Sepolia | 11155111 | 0 | every 10 blocks *(verified)* |

### Proof Builder API (testnet)

```
Base: https://prover.cc3-testnet.creditcoin.network
      https://proof-gen-api.cc3-testnet.creditcoin.network   (both live)

GET /api/v1/attested-height/{chainKey}
GET /api/v1/proof-by-tx/{chainKey}/{transactionHash}
GET /api/v1/proof-batch-by-tx
```

### Packages

```
@gluwa/usc-sdk        0.18.0   TypeScript, peer-dep ethers v6
@gluwa/usc-contracts  0.1.2    Solidity source for Foundry (EvmV1Decoder)
```

### Limits

```
MAX_ENCODED_SIZE   449,280 bytes    (verified in SDK)
batch              10 proofs / 1000-block range   (docs)
gas                CTC ≈ 2.3e-5 + 2.9e-7 × continuity_hash_count   (docs)
                   10–100× penalty for proofs older than ~24h
```

### Links

- Docs — https://docs.creditcoin.org/attestcoin-protocol.md
- SDK — https://docs.creditcoin.org/attestcoin-protocol/dapp-builder-infrastructure/attestcoin-sdk-usc-sdk.md
- Examples — https://github.com/gluwa/usc-testnet-bridge-examples
- Core — https://github.com/gluwa/creditcoin3
- Faucet — https://discord.gg/creditcoin → `#token-faucet`
- Q&A — Discord `#buidl-ctc-qna` · team@creditcoin.org

---

*Research and verification performed 2026-08-11 against live Creditcoin CC3 testnet, the Attestcoin
proof builder service, and Ethereum mainnet. Every claim labelled VERIFIED was executed, not read.*
