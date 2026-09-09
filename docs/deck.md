# CRUX — deck

12 slides. Written to be pasted into Gamma, Pitch or Slides — one slide per `---`.

Speaker notes are in italics. Keep the slides sparse; the notes carry detail.

---

## 1 · Title

# CRUX
### Settlement by cryptographic proof

Creditcoin CC3 testnet · Attestcoin Protocol
BUIDL CTC 2026 Fall

*Visual: the seal, lime on indigo. Nothing else.*

---

## 2 · The problem

# Every prediction market dies at the oracle.

**Polymarket** — UMA's optimistic oracle. Bonds, disputes, a two-hour challenge window,
token-holders voting.

**Kalshi** — a CFTC-registered clearinghouse and a review committee.

**Azuro** — a data provider plus DAO arbitration.

> Every one of them ultimately trusts a reporter, a committee, a regulator, or a bonded game.

*Name real systems. "Oracles are a problem" is a slogan; this is a fact a judge can check.*

---

## 3 · The idea

# The answer is a proof, not a report.

When a market asks something whose answer is an **Ethereum event**, resolution stops being a
governance problem and becomes arithmetic.

Attestcoin proves the event happened. A Creditcoin precompile verifies it **inside one block**.

**No committee. No admin key. No dispute window.**
You cannot dispute mathematics.

---

## 4 · The mechanism

# Two proofs, one block.

| | |
|---|---|
| **Merkle proof** | this transaction is in that block |
| **Continuity proof** | that block is on the finalised chain, linked to a committed attestation |

`EvmV1Decoder` then turns *"prove it happened"* into *"read what it said"* — receipt status, logs,
topics, data.

`914 ms` to generate · `536 ms` to verify · measured, not quoted

---

## 5 · What makes it an engine

# The rule is data, not code.

```
chain      1 (ethereum mainnet)
address    0x7d4E7420…de6Fb5   Chainlink ETH/USD
topic0     0x0559884f…fc5f     AnswerUpdated
field      topics[1]  int256
predicate  GT 190300000000
fromBlock  25894845
toBlock    25895445
```

**Ten fields. No contract is deployed for a new market.**

One audited resolver interprets any spec — so prediction markets are the *first application*, not
the whole of it.

*This is the slide that separates us. Everyone else in the field proves one hardcoded event type.*

---

## 6 · Both directions

# YES is proven. NO is established.

**YES** — a single proof that the event occurred.

**NO** — the observation window becomes fully attested with nothing matching in it.
Absence, established by time.

Absence cannot be proven, so it is inferred from attested time rather than asserted by anyone. Most
designs miss this half entirely.

---

## 7 · Not a mock

# Creditcoin testnet attests Ethereum **mainnet**.

The rules require testnet deployment, which normally makes every demo synthetic.

Here it doesn't: markets resolve against **real Chainlink prices, real events**, while the dApp sits
on testnet exactly as required.

`ETH/USD · block 25,895,136 · $2,407.57 · PROVEN`

---

## 8 · Don't trust us

# Verification is a free staticcall.

So your browser can ask the precompile directly — no wallet, no gas, no server of ours in the path.

The app takes **any transaction hash as input**. Paste one we have never seen and watch Creditcoin
prove it. Swap the RPC for your own node.

**Our servers involved: 0**

*Demo this live if there is any chance to. It lands harder than any slide.*

---

## 9 · What we found

# Four things the documentation doesn't say.

**Inclusion is not success.** We proved a real mainnet transaction that *reverted* and the
precompile returned `TRUE`. Without a receipt-status guard, an attacker resolves any market with a
transaction they know will fail.

**Proofs expire.** A continuity proof must chain to the *current* attestation. Same transaction:
5 roots four days old → rejected; 65 roots regenerated → `TRUE`.

**Absence settlement is front-runnable.** A NO holder is rationally motivated to close a market the
instant its window is attested, winning one the chain can prove they lost.

**One event must settle many markets.** `USCBase` keys replay protection on the transaction alone —
so one Chainlink update would permanently strand every market but the first.

*Each is pinned by a test. This slide is why a technical judge takes the rest seriously.*

---

## 10 · Depth of integration

# Remove Attestcoin and there is no product.

- `verifyAndEmit` on the block-prover precompile — every settlement
- `EvmV1Decoder` — receipt status, log matching, field extraction
- `USCBase` — verify-then-dispatch, replay protection widened to per-market
- `get_latest_attestation_height_and_hash` — drives NO-settlement and the trading gate
- **both** `chainKey 3` (mainnet) and `chainKey 1` (Sepolia)
- `CruxBeacon` — converts `view`-readable state into attestable events

*The stated scoring criterion is depth of protocol utilisation. This is that slide.*

---

## 11 · Live

# Deployed, tested, trading.

```
CruxMarket            0xA558efC57e25b3bF45927CeeC7543E0831ceCbdC
CruxAttestedResolver  0xa2CD2dCd2cce9402029bbaf9cAe5054f15D42E89
CruxScore             0xFFB272EfF1fF82C05a74015e5e6c49900405d81E
CruxBeacon (Sepolia)  0x0F1bf92EE0C79F7Ca5C1e30E9412aD5BFF45c7C8
```

**59 tests** · markets settled end-to-end from real mainnet data · no admin key anywhere on the
settlement path

github.com/TechnicallyKiller/crux-creditcoin

---

## 12 · Where it goes

# Markets are the demo. The engine is the product.

The same primitive settles **anything** on a proven foreign-chain fact — escrow that releases on a
verified mainnet event, conditional payments, insurance, liquidation triggers.

`CruxBeacon` widens it further: any `view`-readable contract state becomes attestable.

> The rule is data. One resolver. No oracle, anywhere.

---

## Notes for building it

**Visual system** — follow `docs/design-brief.md`. Indigo ground `#0B0F26`, vellum `#EDEFE3`,
lime `#C8FF3D` **only** where something was proven. Bodoni Moda for headings, JetBrains Mono for
every address and hash.

**Do not** use stock crypto imagery, gradients, or hexagons. If the deck looks like the app, it
reads as one considered artefact rather than three tools' output.

**Slide 9 is the one to protect if you cut for time.** Slides 2, 5, 8 and 9 carry the whole
argument; the rest are scaffolding.
