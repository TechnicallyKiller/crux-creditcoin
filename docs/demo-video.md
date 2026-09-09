# Demo video — storyboard

Target **2:30–3:00**. Judges watch dozens; the first fifteen seconds decide whether they watch the
rest.

Works with or without voiceover: every beat has an on-screen caption that carries the point alone.
If you record narration, the captions become subtitles. If you don't, they carry it.

---

## The one problem to solve first

A real settlement cycle takes **~3.5 hours**: 30 min trading, 30 min buffer, 2 h observation window,
~8 min attestation. You cannot film that in real time, and you must not fake it.

**Do this instead.** Film the resolution of a market that has *already settled*, and say so. The
proof is real, the transaction hashes are real, the settlement block is real — the only thing
compressed is your waiting. Then use the **Proof Drop state scrubber** to walk the four states on
camera in fifteen seconds.

Never cut in a way that implies the cycle is instant. The latency is the honest price of having no
oracle, and a judge who catches a fake will discount everything else.

---

## Beat sheet

### 0:00–0:15 — The problem, stated as a fact about competitors

**Screen:** the swipe feed, one certificate, thumb dragging it slightly.

> Every prediction market dies at the same place. Polymarket needs UMA's bonded voters and a
> two-hour challenge window. Kalshi needs a CFTC-registered clearinghouse. All of them, in the end,
> trust somebody to report the truth.

**Caption:** `EVERY PREDICTION MARKET TRUSTS A REPORTER`

Don't explain CRUX yet. Name the problem so precisely that the solution lands on its own.

### 0:15–0:30 — The claim

**Screen:** swipe right, the YES stamp rotates in, the position confirms.

> CRUX doesn't have one. This market settles on a cryptographic proof that the event happened on
> Ethereum — verified by a Creditcoin precompile, inside one block.

**Caption:** `NO ORACLE · NO COMMITTEE · NO ADMIN KEY`

### 0:30–1:00 — The rule is data, not code

**Screen:** market detail, scroll to the resolution rule, expand the raw spec.

> A market's resolution rule is data. Which chain, which contract, which event, which field, which
> comparison, which block window. Ten fields.
>
> No contract was deployed for this market. One audited resolver reads the spec and demands a proof
> that matches it — which is why this is an engine, not one integration.

**Caption:** `TEN FIELDS · NO CODE DEPLOYED`

This is the beat that separates you from the field. Let it breathe.

### 1:00–1:30 — Real mainnet, not a mock

**Screen:** the spec's aggregator address, then cut to Etherscan showing that same Chainlink
contract.

> This is Chainlink's live ETH/USD feed on Ethereum **mainnet** — not a Sepolia mock. Creditcoin's
> testnet attests Ethereum mainnet, so the market is testnet and the fact is real.

**Caption:** `ETHEREUM MAINNET · CHAINLINK ETH/USD`

Cutting to Etherscan matters. It proves the address on your screen is a real contract, not a label
you typed.

### 1:30–2:05 — The Proof Drop

**Screen:** the four states via the scrubber. Slow down on each.

> Watching — the window is open and Ethereum hasn't said anything yet.
>
> Attesting — it happened, but Creditcoin hasn't attested the block. That's *pending*, not unknown.
> No oracle-based market can show you this state, because none of them have a proof in flight.
>
> Proving — the Merkle path from the transaction to the receipts root, then the continuity chain to
> a committed attestation.
>
> Proven.

**Caption on the seal:** `✦ PROVEN · ETHEREUM MAINNET · BLOCK 25,895,136`

Hold on the seal for a full two seconds. It's the money shot.

### 2:05–2:35 — Don't trust us, check it

**Screen:** the verify panel. **Paste a transaction hash you have not used elsewhere in the video.**
Click. Watch both calls tick green.

> You don't have to believe any of this. Verification is a free staticcall, so your browser can ask
> the precompile directly. Paste any Ethereum transaction — this one is not one we prepared — and
> Creditcoin proves it. Neither endpoint here is ours, and you can swap the RPC for your own node.

**Caption:** `VERIFIED IN YOUR BROWSER · OUR SERVERS INVOLVED: 0`

**This is the strongest thirty seconds in the video.** Nobody else in the field can offer it, because
most haven't noticed verification is free. Do not cut this for time — cut something else.

### 2:35–2:50 — The other half

**Screen:** the settled-NO certificate, with its cancellation perforation and VOID stamp.

> A market can also settle NO — not by a proof, but by its window becoming fully attested with
> nothing matching in it. Absence, established by time.

**Caption:** `ABSENCE, ESTABLISHED BY TIME`

### 2:50–3:00 — Close

**Screen:** the app, then a still with addresses.

> Prediction markets are the first thing built on this. The same engine settles anything on a proven
> foreign-chain fact.

**Caption:**
```
CRUX · Creditcoin CC3 testnet
github.com/TechnicallyKiller/crux-creditcoin
```

---

## Rules

**Do**

- Record at 1440×900 or larger. Phone frames read fine inside a desktop capture; the reverse doesn't.
- Show real addresses and real hashes, unredacted. They're the evidence.
- Let the seal land. Dead air on the right frame is confidence.
- Use a hash in the verify demo that appears nowhere else in the video.

**Don't**

- Don't imply the cycle is instant. Say a market has already settled when it has.
- Don't show a wallet connect flow. It's a slow, familiar beat that teaches nothing.
- Don't narrate the UI ("here I click on…"). Narrate the *claim*; the screen shows the click.
- Don't show the terminal. The RPC noise makes a healthy chain look broken.
- Don't show `.bots.json`, `.env`, or the keystore prompt.

## Before you record

- [ ] Bots have traded, so odds are not 50/50 and open interest is non-zero
- [ ] At least one market is settled, so the Proof Drop has a real seal
- [ ] The hosted URL is live, in case a judge follows it mid-video
- [ ] A spare mainnet tx hash on the clipboard for the verify beat
- [ ] Browser zoom at 100%, no extensions bar, no bookmarks bar, clean profile
