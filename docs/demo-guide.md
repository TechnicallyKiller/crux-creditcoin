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

## The run — 2:45

Framed for the audience that is actually watching: the Creditcoin team. Lead with their problem,
not ours.

### 1 · Creditcoin's own problem (0:00–0:20)

Open on the app, desktop. Don't touch anything.

> "Creditcoin exists to bring credit on-chain. But a lender on Creditcoin can't see what a borrower
> did on Ethereum — and that's the whole problem. This season, more than twenty teams built some
> version of a cross-chain credit passport. Every one of them had to write their own contract to
> verify one specific event."

*This is the strongest possible opening for these judges. You're describing their ecosystem back to
them, accurately, and you counted.*

### 2 · The layer they were all rebuilding (0:20–0:45)

> "They were all rebuilding the same layer underneath. CRUX is that layer.
>
> A contract states its resolution rule as **data** — which chain, which contract, which event,
> which field, which comparison, which window. CRUX settles it against a cryptographic proof that
> the event actually happened on Ethereum, verified by Creditcoin's own precompile, inside one
> block."

### 3 · The rule is data (0:45–1:20)

Click a market → **Market detail** → scroll to **Resolution rule** → expand the raw spec.

> "Ten fields. No contract was deployed for this market.
>
> Change the emitter and the topic and this same resolver proves a loan repayment instead of a
> price. A credit passport is this spec with a different payout. That's why it's a protocol and not
> an app."

**Linger here.** This is the beat that turns "nice prediction market" into "infrastructure the
ecosystem needs."

### 4 · Real mainnet, not a mock (1:20–1:40)

Point at the aggregator in the spec. Second tab: Etherscan on
`0x7d4E742018fb52E48b08BE73d041C18B21de6Fb5`.

> "That's Chainlink's live ETH/USD feed on Ethereum mainnet — not a Sepolia mock. Creditcoin testnet
> attests mainnet, so the deployment satisfies the rules and the fact is still real."

### 5 · The Proof Drop (1:40–2:10)

Open a settled YES market (1 or 3). Walk the scrubber: WATCHING → ATTESTING → PROVING → PROVEN.

> "Watching — the window is open, Ethereum hasn't said anything.
>
> Attesting — it happened, but Creditcoin hasn't attested the block yet. That's *pending*, not
> unknown. No oracle-based system can show you this state, because none of them have a proof in
> flight.
>
> Proving — the Merkle path to the receipts root, then the continuity chain to a committed
> attestation.
>
> Proven. Eighty-one continuity roots, verified by the precompile. No committee voted."

**Hold two seconds on the seal.**

### 6 · Don't trust us (2:10–2:35) — DO NOT CUT

Right panel → paste the clipboard hash → **PROVE IT**. Both calls tick green.

> "You don't have to believe any of this. Verification on Creditcoin is a free staticcall, so your
> browser asks the precompile directly. This transaction isn't one we prepared. Neither endpoint is
> ours — point it at your own node."

Point at **OUR SERVERS INVOLVED: 0**.

### 7 · Both directions (2:35–2:50)

Open a settled NO market (2 or 4) — void certificate, cancellation perforation.

> "And it settles the other way too. Not by a proof — by the window becoming fully attested with
> nothing matching in it. Absence, established by time."

### 8 · Close on the ecosystem (2:50–3:00)

> "Settlement rules become data; settlement becomes a proof instead of a report. Prediction markets
> are what we built on it first — cross-chain credit, escrow and parametric payouts are the same
> primitive with a different payout."

End on the app with the contract addresses visible.

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

1. Upload anywhere with a public link — **Loom is safest** (no login to watch, public by default).
   YouTube unlisted, Vimeo or Drive also fine. **Drive must be set to "Anyone with the link"** —
   a judge hitting a permission wall scores that field zero.
2. Deck from `docs/deck.md` → export PDF → URL
3. Fill the team fields — **only you can do these**
4. Copy `docs/submission.md` into the form
5. Submit **early**. Do not let this land at 23:58.
