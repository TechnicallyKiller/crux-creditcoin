# CRUX

**Attestation-settled prediction markets on Creditcoin.**

> Built on Creditcoin. Settled by Ethereum reality.

Every prediction market dies at the oracle. Polymarket needs UMA's optimistic oracle — bonds,
disputes, a two-hour challenge window, human token-holders voting. Kalshi needs a CFTC-registered
clearinghouse and a review committee. Every one of them ultimately trusts a reporter, a committee,
a regulator, or a bonded game.

CRUX markets settle themselves. Resolution is a **cryptographic proof that an event occurred on
Ethereum**, verified inside a single Creditcoin block by the Attestcoin Protocol precompile. No
committee, no admin key, no trusted reporter, no dispute window — you cannot dispute mathematics.

*BUIDL CTC 2026 Fall · Attestcoin Protocol · Tracks: DeFi (primary), AI (secondary)*

---

## Status

**Phase 0 of 5 complete — the protocol integration is proven end-to-end; the product is not built yet.**

This repository is deliberately honest about that line. Here is exactly where it stands:

| | |
|---|---|
| ✅ Attestcoin proof pipeline verified live on Ethereum **mainnet** and Sepolia | working, reproducible |
| ✅ `EvmV1Decoder` decoding real attested mainnet transactions | working, tested |
| ✅ `USCBase` inheritance path compiling | working |
| ✅ Test harness (7 tests, all green) | working |
| ⬜ `CruxAttestedResolver`, `CruxMarket` (LMSR), `CruxBeacon` | Phase 1–2 |
| ⬜ Worker, indexer, AI resolver, frontend | Phase 2–4 |
| ⬜ Anything deployed on-chain | blocked on testnet faucet |

Nothing is deployed yet. Every claim marked verified below was **executed against the live
network**, not read from documentation — timings and receipts included.

---

## The idea

The hardest unsolved problem in prediction markets is the oracle. Attestcoin makes that machinery
unnecessary for any question whose answer is an Ethereum event: resolution stops being a governance
problem and becomes a proof.

That is not a bolt-on integration — **it is the product**. Remove Attestcoin and there is no CRUX.

### Two lanes, one hard boundary

| Lane | Question | Resolution | Trust assumption |
|---|---|---|---|
| **`proof`** | "Did *this* happen on Ethereum?" | Attestcoin Merkle + continuity proof, verified by the precompile | The Attestcoin attestor quorum — the same assumption Creditcoin itself makes. Nothing else. |
| **`ai`** | Off-chain events (sports, politics, "did X ship by Y?") | AI resolver posts an outcome + bond; anyone may challenge with a counter-bond | An AI agent bounded by an economic dispute game. |

An AI oracle is centralized, so applying it everywhere would undercut the entire thesis. Confining
it to questions provably outside cryptography's reach — and bonding it — contains the damage. The
UI labels every market with its lane, so a user always knows which guarantee they hold.

### Two clocks

The game loop runs at Creditcoin's 15s blocks and feels instant. The truth loop runs at Ethereum's
pace — attestation lands ~8 minutes behind head — and feels weighty. Rather than disguise that
latency, resolution is the spectacle: a **Proof Drop** animating the Merkle path, then stamping
`PROVEN · ETHEREUM MAINNET · BLOCK 25,821,980`. No competitor can render that screen, because none
of them actually prove anything.

---

## How the Attestcoin integration works

Creditcoin's precompile at `0x…0FD2` synchronously verifies two proofs inside a single block:

| Proof | Proves |
|---|---|
| **Merkle proof** | this transaction is included in that block |
| **Continuity proof** | that block is part of the finalized chain, linked to a committed attestation |

Once verified, `EvmV1Decoder` turns *"prove a transaction happened"* into *"read the data inside
it"* — recovering receipt status, logs, topics and data. A prediction market is exactly this, plus
a comparator, plus a payout.

A market's resolution rule is therefore **data, not code**:

```solidity
struct AttestSpec {
    uint64     chainKey;      // 3 = Ethereum mainnet, 1 = Sepolia
    address    emitter;       // log MUST originate here
    bytes32    topic0;        // event signature
    Extract    extractMode;   // indexed topic, or a 32-byte data word
    uint8      extractIndex;
    Comparator cmp;           // GT GTE LT LTE EQ EXISTS
    int256     threshold;
    uint64     fromBlock;     // observation window, source-chain heights
    uint64     toBlock;
}
```

`YES` becomes provable by a single proof; `NO` becomes provable by the mere passage of time — once
`toBlock` is attested and no valid proof ever arrived, absence is established. Anyone may submit a
resolving proof and collect a bounty, so there is **no privileged resolver role in the proof lane
at all**.

---

## Verified, live

Run on **2026-08-24** against Creditcoin CC3 testnet, the Attestcoin proof builder, and Ethereum
mainnet. Reproduce with the commands in [Running it](#running-it).

```
Creditcoin CC3      chainId 102031 · gas 0.5 gwei
chainKey 3 Ethereum attested 25,821,950 vs head 25,821,995 → lag 45 blocks (~9.0 min)
chainKey 1 Sepolia  attested 11,554,030 vs head 11,554,068 → lag 38 blocks (~7.6 min)
checkpoint interval every 10 source blocks, both chains
proof generation    ~700–730 ms       verification ~235–255 ms
mainnet proof       TRUE ✓ PROVEN     sepolia proof  TRUE ✓ PROVEN
```

### The fact that shapes the whole project

**Creditcoin testnet attests Ethereum *mainnet*, not only Sepolia.**

The hackathon requires deployment on a testnet, which normally makes every demo synthetic. Here it
does not: markets can be written against **real Chainlink prices, real whale transfers, real DAO
votes**, resolved by cryptographic proof, while the dApp sits on Creditcoin testnet exactly as the
rules require.

### Verification is free

`verify` is a **staticcall**. Proofs can be verified with zero funds and no wallet — so the
frontend can independently re-verify client-side, trusting neither our backend nor us. It also
means development is not blocked on a faucet.

---

## Findings

Building this surfaced several things that contradict the documentation or our own initial
research. Full detail in **[docs/phase-0.md](docs/phase-0.md)**.

### Inclusion is not success — and it is exploitable

The precompile proves a transaction was **included**, not that it **succeeded**. This is not
theoretical:

```
tx     0xc3ab8c0e12e7aec6c8b28a91f358c662c189584ff0236434b0ac3c49f0aa1023
block  25,821,980 (Ethereum mainnet)
status 0x0  ← REVERTED on mainnet
verify on 0x…0FD2 → TRUE ✓ PROVEN — 240 ms
```

The protocol cheerfully proves a **failed** transaction. Without a `receiptStatus == 1` guard, an
attacker resolves any market by sending a transaction they know will revert. It is the
highest-severity foot-gun in the stack, and it is pinned here by a test running against that exact
reverted mainnet transaction.

### Forked Foundry tests can never execute the precompile

`eth_getCode` at `0x…0FD2` returns `0x`. It is **native runtime code**, not EVM bytecode, so
`vm.createSelectFork` has nothing to pull into the local EVM. (`EvmV1Decoder` *is* ordinary
bytecode and forks fine — which is why decoding works and verification does not.) Testing is
therefore three-tier: **forked** for the real decoder, **mocked** for CRUX's own logic, **live**
out-of-process for real proofs.

### Continuity cost tracks checkpoint alignment, not freshness

All proofs seconds old:

| tx in block | offset from checkpoint | continuity roots |
|---|---|---|
| 25,821,960 | 0 (aligned) | **1** |
| 25,821,955 | 5 | **6** |

Roots ≈ distance to the enclosing checkpoint + 1. Since gas scales with root count, resolution cost
swings ~6× depending on where in the 10-block window the event lands — which we do not control. The
resolution bounty must be sized for the worst case.

### Two incompatible `INativeQueryVerifier` interfaces exist

`@gluwa/usc-contracts` ships a lean copy with only `verify` (view, **reverts on failure rather than
returning false** — never treat the return value as the failure signal). `USCBase` needs
`verifyAndEmit` and `calculateTxIndex`, which that copy omits, so it cannot be built against the
npm package alone.

---

## Running it

Requires Node ≥ 22 and [Foundry](https://getfoundry.sh). **No wallet or funds needed** for anything
below.

```bash
git clone https://github.com/TechnicallyKiller/crux-creditcoin.git
cd crux-creditcoin
npm install
cp .env.example .env        # defaults work; RPC keys only needed from Phase 2
```

**Check that Attestcoin is live and how far behind it is running:**

```bash
node --experimental-strip-types scripts/check-liveness.ts
```

**Prove a real Ethereum transaction on Creditcoin, end to end** — fetches a Merkle + continuity
proof and has the precompile verify it. `3` = Ethereum mainnet, `1` = Sepolia. Writes a fixture:

```bash
node --experimental-strip-types scripts/prove-tx.ts 3
node --experimental-strip-types scripts/prove-tx.ts 1
```

**Find an attestable transaction that reverted on mainnet** (this produced the finding above):

```bash
node --experimental-strip-types scripts/find-reverted.ts 3
```

**Run the contract tests** (forks CC3 testnet):

```bash
CC3_RPC_URL=https://rpc.cc3-testnet.creditcoin.network forge test --root contracts -vv
```

---

## Layout

```
contracts/              Foundry. Linked EvmV1Decoder, pre-Paris EVM for CC3 forks.
  src/usc/              Vendored USCBase + VerifierInterface, with rationale.
  src/DecoderProbe.sol  Decode + receipt-status guard + wrapped precompile call.
  src/CruxBaseProbe.sol Proves USCBase is inheritable — the Phase 1 shape.
  test/                 7 tests: forked decoder, mocked precompile, adversarial C3.
scripts/
  check-liveness.ts     Attestation liveness + lag monitor.
  prove-tx.ts           Proof → precompile, end-to-end. Captures fixtures.
  find-reverted.ts      Finds attestable reverted transactions.
fixtures/               Real captured proofs, including the adversarial one.
docs/plan.md            Full research record, decision register and build plan.
docs/phase-0.md         What was run, what came back, what it changed.
worker/ ai/ indexer/ web/   Scaffolded; implemented in Phase 2–4.
```

## Roadmap

| Phase | Scope | State |
|---|---|---|
| **0** | Toolchain proven end-to-end against live networks | **done** |
| **1** | `CruxAttestedResolver`, `AttestSpec`, `CruxMarket` (LMSR); deploy to CC3 | next |
| **2** | Chainlink mainnet markets, resolution worker, indexer, batch proofs | |
| **3** | AI lane with bonded disputes; Brier-score soulbound reputation | cuttable |
| **4** | Mobile-first swipe feed, Proof Drop, leaderboards | |
| **5** | Demo video, deck, submission | |

## Networks

| | CC3 Testnet |
|---|---|
| EVM chain ID | `102031` |
| RPC | `https://rpc.cc3-testnet.creditcoin.network` |
| Explorer | [creditcoin-testnet.blockscout.com](https://creditcoin-testnet.blockscout.com) |
| BlockProver precompile | `0x0000000000000000000000000000000000000FD2` |
| `EvmV1Decoder` | `0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f` |
| Proof builder | `https://prover.cc3-testnet.creditcoin.network` |

Attested source chains: **chainKey 3** — Ethereum mainnet · **chainKey 1** — Sepolia.

## Built with

[`@gluwa/usc-sdk`](https://www.npmjs.com/package/@gluwa/usc-sdk) · `@gluwa/usc-contracts` ·
Foundry · Solidity 0.8.23 · ethers v6 · TypeScript

Original work created for BUIDL CTC 2026 Fall.
See the [Attestcoin Protocol docs](https://docs.creditcoin.org/creditcoin-usc).
