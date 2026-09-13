# Demo guide — record this today

**App:** https://crux-tyax.onrender.com (static, does not sleep)
**Repo:** https://github.com/TechnicallyKiller/crux-creditcoin

All four markets are **settled** — two YES by proof, two NO by attested time. You have real seals to
film. Nothing needs to be set up first.

---

## Before you hit record

- [ ] Chrome, clean profile, **no bookmarks bar, no extensions bar**
- [ ] Zoom 100%, window ≥ 1440 wide
- [ ] Wallet connected with tCTC, on Creditcoin CC3
- [ ] This on the clipboard for the verify beat — a mainnet transaction that appears nowhere else:
      `0xf14041eafaafa8c2c81a0335a564da3a239274f06dda0d85ebfa6624f102d0fa`
- [ ] **No terminal on screen at any point.** The RPC noise makes a healthy chain look broken.

---

## The run — 2:30

### 1 · The problem (0:00–0:15)

Open on the app, desktop. Don't touch anything.

> "Every prediction market dies in the same place. Polymarket needs UMA's bonded voters and a
> two-hour challenge window. Kalshi needs a registered clearinghouse. In the end, all of them trust
> somebody to report the truth."

### 2 · The claim (0:15–0:30)

Drag a certificate slightly, let it spring back.

> "CRUX doesn't have one. These markets settle on a cryptographic proof that the event happened on
> Ethereum — verified by a Creditcoin precompile, inside a single block."

### 3 · The rule is data (0:30–1:05)

Click a market → **Market detail**. Scroll to **Resolution rule**. Expand the raw spec.

> "A market's resolution rule is data. Which chain, which contract, which event, which field, which
> comparison, which block window. Ten fields.
>
> No contract was deployed for this market. One audited resolver reads the spec and demands a proof
> that matches it. That's why this is an engine, not one integration."

**Linger on the ten-field block.** This is the slide that separates you from 46 other submissions.

### 4 · It's real mainnet (1:05–1:25)

Point at the aggregator address in the spec. Open a second tab on Etherscan for
`0x7d4E742018fb52E48b08BE73d041C18B21de6Fb5`.

> "That's Chainlink's live ETH/USD feed on Ethereum mainnet — not a Sepolia mock. Creditcoin's
> testnet attests mainnet, so the market is testnet and the fact is real."

Cutting to Etherscan matters: it proves the address is a real contract, not a label you typed.

### 5 · The Proof Drop (1:25–2:00)

Open a **settled YES market** (1 or 3). Walk the scrubber: WATCHING → ATTESTING → PROVING → PROVEN.

> "Watching — the window is open, Ethereum hasn't said anything yet.
>
> Attesting — it happened, but Creditcoin hasn't attested the block. That's *pending*, not unknown.
> No oracle-based market can show you this state, because none of them have a proof in flight.
>
> Proving — the Merkle path to the receipts root, then the continuity chain to a committed
> attestation.
>
> Proven. Eighty-one continuity roots, verified by the precompile."

**Hold two full seconds on the seal.** That's the shot.

### 6 · Don't trust us (2:00–2:30) — DO NOT CUT THIS

Right-hand panel → paste the clipboard hash → **PROVE IT**. Both calls tick green.

> "You don't have to believe any of this. Verification is a free staticcall, so your browser asks
> the precompile directly. This transaction isn't one we prepared. Neither endpoint is ours — and
> you can point it at your own node."

Point at **OUR SERVERS INVOLVED: 0**.

**This is the strongest thirty seconds you have.** Nobody else in the field can offer it. If you're
over time, cut beat 4, never this.

### 7 · The other half (2:30–2:45)

Open a **settled NO market** (2 or 4) — void certificate, cancellation perforation.

> "A market can also settle NO. Not by a proof — by its window becoming fully attested with nothing
> matching in it. Absence, established by time."

### 8 · Close (2:45–3:00)

> "Prediction markets are the first thing built on this. The same engine settles anything on a
> proven foreign-chain fact."

End on the app with the addresses visible in the sidebar.

---

## Rules

**Never imply the cycle is instant.** If asked, a full cycle is ~3.5 hours; these markets settled
earlier today and you're showing the result. The latency is the honest price of having no oracle,
and a judge who catches a fake cut discounts everything else.

**Don't narrate the UI** ("now I click here"). Narrate the claim; the screen shows the click.

**Don't film wallet connection.** Slow, familiar, teaches nothing.

---

## If something breaks mid-record

| | |
|---|---|
| Feed empty | hard-refresh; reads take a few seconds on first paint |
| Wallet won't connect | keep going — everything in the script except the swipe is read-only |
| Verify panel fails | switch the endpoint with the radio button and re-run; that failover *is* the point |
| Site slow | it's static and doesn't sleep — it's the CC3 RPC, retry |

---

## After recording

1. Upload unlisted to YouTube → URL into the submission
2. Deck from `docs/deck.md` → export PDF → URL
3. Fill the team fields — **only you can do these**
4. Copy `docs/submission.md` into the form
5. Submit **early**. Do not let this land at 23:58.
