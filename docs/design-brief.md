# CRUX — design prompt

Paste everything below the line into Claude, with the `design` skill.

---

## The prompt

Design **CRUX**, a mobile-first prediction market app on Creditcoin where
markets about Ethereum settle themselves by cryptographic proof.

**This is a full consumer app, not a landing page and not a one-pager.** I want
a complete screen flow you could hand to an engineer and build: a swipeable
market feed, trading, portfolio, reputation, leaderboards, market creation, and
the resolution moment. Design it as a multi-artboard canvas with every screen
below, phone-sized, with real interaction states — not a marketing site with a
hero section.

### What the product does

Every prediction market dies at the same place: the oracle. Polymarket needs
UMA's optimistic oracle — bonds, disputes, a two-hour challenge window,
token-holders voting. Kalshi needs a CFTC-registered clearinghouse and a review
committee. All of them ultimately trust a reporter, a committee, or a bonded
game.

CRUX markets settle themselves. When a market asks something whose answer is an
Ethereum event — "will ETH trade above $1,903 before block 25,895,445?" — the
resolution is a **cryptographic proof that the event occurred**, verified inside
a single Creditcoin block by a native precompile. No committee, no admin key, no
dispute window, because you cannot dispute mathematics.

This is deployed and working. Use these real values in the designs rather than
inventing placeholders:

```
Market          Will ETH trade above $1,903 before block 25,895,445?
Source          Ethereum mainnet · Chainlink ETH/USD
Aggregator      0x7d4E742018fb52E48b08BE73d041C18B21de6Fb5
Event           AnswerUpdated · topic0 0x0559884f…fc5f
Resolving tx    0xbc38ccea67d7c028f9d4275e11f377443d44d4fc0480261c6d4e19c5f2d07777
Source block    25,895,136  (Ethereum mainnet)
Observed price  $2,407.57
Proof           8 merkle siblings · 5 continuity roots · 5,824 bytes
Generation      914 ms      Verification 536 ms — TRUE on precompile 0x…0FD2
Settled on      Creditcoin CC3 block 5,441,970
Collateral      tCTC (native)
Contracts       CruxMarket 0x34a712c4206a826d3E44be50FFcc33bE1Fa3dA3C
                CruxAttestedResolver 0x3a2153c98B967578F764c5Df340dc7c5E99B8757
```

### The central design tension — resolve it, don't dodge it

The app has **two clocks**, and the whole feel of the product comes from holding
them apart:

| | runs on | cadence | should feel |
|---|---|---|---|
| **Game loop** | Creditcoin | 15s blocks | instant, tactile, playful — swipe, stake, odds move under your thumb |
| **Truth loop** | Attestcoin → Ethereum | ~8–40 min | weighty, earned, ceremonial — the proof lands and the market closes itself |

So: a **fast consumer app** with **one slow, heavy, beautiful moment** at the
end. Not a solemn document, and not a casino either. The swiping should feel
like a game; the settling should feel like a verdict.

Latency in the truth loop is not a flaw to disguise — it is the price of having
no oracle. Show it honestly and make the waiting legible and even enjoyable.

### The idea that makes the identity ours

**Typographic provenance: every fact on screen visibly carries its origin.**

Three registers, applied everywhere, no exceptions:

1. **Proven** — established by a verified Attestcoin proof of an Ethereum event.
   The strongest register: monospace, ink-dark, a verified mark. The only facts
   in the product nobody can dispute.
2. **Derived** — computed by our contracts from proven inputs: prices, payouts,
   scores. Trustworthy, but downstream.
3. **Asserted** — supplied by a human or an AI resolver, bonded and
   challengeable. Visibly weaker. Never allowed to borrow the look of proof.

No competitor can copy this, because no competitor has proofs. It turns the
thesis into a design system instead of a tagline.

### Visual direction

Start from this palette — it already exists in the project's written materials,
so reusing it makes app, README and deck read as one artefact. Refine it, don't
be caged by it:

```
paper      #FAF8F3    warm off-white ground
surface    #FFFDF8    raised card
sunk       #F1EDE3    inset / code wells
ink        #14211E    headings, proven facts
body       #2E3D39    running text
muted      #6B7B76    secondary
rule       #DED9CD    hairlines

teal       #0B6E5F    THE CRYPTOGRAPHIC LANE — proof, verification, certainty
teal-ink   #065044
teal-soft  #E4F0EC
clay       #A64B26    THE JUDGMENT LANE — AI resolution, bonds, disputes
clay-soft  #F8E8DF
amber      #866415    pending attestation, waiting
crit       #98292B    rejected, failed, reverted
```

**Teal and clay are never decorative.** Teal means *proven*. Clay means
*asserted and challengeable*. A user must tell, from colour at arm's length,
which guarantee they hold. Using teal because it looks nice is a bug.

Typography: a serif for market questions — they are propositions, the product's
voice, and should not read like UI labels. Clean sans for chrome. **Monospace for
every on-chain fact** — addresses, hashes, block heights, proof sizes, timings.
The monospace is doing semantic work: it is the typeface of checkable things.

Light-first, then a real dark variant — a considered night version, not an
inverted palette.

### What to avoid

47 teams are submitting to this hackathon and nearly all will produce the same
thing: near-black canvas, violet-to-blue gradients, glassmorphic cards, neon
glow, Inter, a chart nobody reads. Prediction markets specifically (Polymarket
and its clones) look like **casinos** — dark, saturated, urgent, green-up
red-down, engineered to make you act fast.

Avoid: dark-by-default, neon, purple/blue gradients, glassmorphism, heavy blur,
glow, confetti, countdown pressure, blockchains-drawn-as-cubes, chain-link
iconography, decorative charts carrying no information.

Warmth and confidence instead of urgency. It should feel *good* to use and
*trustworthy* to read — a well-made instrument, not a slot machine.

## Screens

### 1 · Swipe feed — the home screen and primary interaction

One market per card, full-bleed, thumb-driven. **Swipe right = YES, left = NO**,
up to skip. Preset stake chips (5 / 25 / 100 tCTC) so a bet is one gesture plus
one tap. Live LMSR odds bar that visibly moves as you and others trade — markets
are quotable from the moment they open, with no liquidity providers, so the bar
is never empty or fake.

Each card must carry, without clutter: the question in serif, the odds, the
**lane badge** (proof / ai), the source chain, and how long until trading closes.
Design the swipe states — resting, mid-drag with YES/NO intent showing, released,
confirmed. This is the screen people will spend 90% of their time on, so it
carries the app's personality.

### 2 · Market detail

Reached by tapping a card. The question, current odds, price history, your
position, and the trade panel.

Critically: **the resolution rule, rendered as human-readable text.**

> Settles YES if Chainlink's ETH/USD aggregator at `0x7d4E…6fb5` emits
> `AnswerUpdated` with a price above **$1,903** in Ethereum blocks
> **25,894,845 – 25,895,445**.

Show the underlying spec as inspectable data too. That the rule is *data rather
than code* is the technical heart of the project, and it should be visible.

### 3 · Trade sheet

Buy/sell YES or NO. Amount entry, share count, average price, slippage guard,
fee breakdown, resulting odds. It must be honest about the LMSR: your trade moves
the price, and the UI should show that before you commit.

### 4 · The Proof Drop — the hero

The moment a market resolves, and the shot the whole submission rests on. Design
it as **4 sequenced states** so it can be storyboarded and animated:

1. **Watching** — the observation window is open, the answer doesn't exist yet.
2. **Attesting** — the event happened on Ethereum; Creditcoin hasn't attested it
   yet. Genuinely *pending*, not unknown — a distinction no competitor can show.
3. **Proving** — the Merkle path drawing itself from the transaction up to the
   block root, then the continuity chain linking that block to a committed
   attestation.
4. **Proven** — the stamp:

```
✓ PROVEN
  ETHEREUM MAINNET · BLOCK 25,895,136
  $2,407.57
```

Weighty and earned — a seal pressing, a receipt printing, an assay completing.
Not a slot machine paying out.

Include one line with real prominence: the browser **re-verifies the proof
itself**, because verification is a free staticcall. So it can honestly say
*verified in your browser — trusting neither our servers nor us.* That is the
most trust-inverting sentence in the product.

Design this to work both phone-sized and as a large desktop moment, because it
will be screen-recorded for the demo video.

### 5 · Settled NO — the other half

A market can also settle NO — not by proof, but by its observation window
becoming fully attested with no qualifying event in it. **Absence established by
time.** Quieter than the proof stamp, visually distinct, but still a designed
moment. Most people miss that this is how "no" works, and showing it is a
differentiator.

### 6 · Portfolio

Open positions with live mark-to-market, settled positions awaiting claim, and a
claim action. Winning shares redeem 1:1 in tCTC. Make the difference between
*unsettled*, *settled-you-won*, and *claimed* unmistakable.

### 7 · Profile and reputation

Soulbound, non-transferable. **Brier calibration score** (lower is better —
design a way to make that legible to someone who has never heard of Brier),
current and best streak, season XP, markets resolved.

The claim worth designing around: because resolution is cryptographic, this
reputation is **provably untainted by oracle manipulation** — a statement no
other prediction market can make about its leaderboard.

### 8 · Leaderboard

Seasonal, ranked by calibration rather than raw profit — rewarding being *right*
over being *rich*. Show the season, the ranking, and your position in it.

### 9 · Create market

Compose a market from templates: pick a source (Chainlink price, whale transfer,
DAO proposal execution, contract state via beacon), a threshold, and a block
window. The app resolves topic0, the live aggregator address and block heights
for the user. Creators earn a share of their market's fees.

Design the moment where an ordinary person builds a cryptographically-resolvable
question without seeing a hash — but can expand to see exactly what was built.

### 10 · Onboarding / empty state

Someone who has never touched crypto should understand what this is within five
seconds. **No wallet-connect wall as the first screen.** Let people browse and
understand before being asked for anything.

## Constraints

- Mobile-first throughout; the Proof Drop additionally needs a desktop treatment.
- Accessible contrast. Never encode meaning in colour alone — proof/ai needs a
  text or shape cue as well.
- Real data everywhere. Hashes truncate as `0xbc38ccea…7777`, never `0x123…abc`.
- Design the waiting states as carefully as the active ones. The truth loop takes
  minutes, and that time is part of the product.

## What success looks like

A judge scrolling 47 submissions stops on this one — because it doesn't look like
a crypto app, it looks like something *made*. Then they watch a market settle
itself from a real Ethereum mainnet price with no human anywhere in the loop, and
the interface makes that legible rather than magical.

Deliver a colour and type system, then every screen above as artboards, with the
swipe feed and the Proof Drop given the most attention.
