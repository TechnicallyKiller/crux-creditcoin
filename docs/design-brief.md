# CRUX — design prompt

Paste everything below the line into Claude, with the `design` skill.

---

## The prompt

Design **CRUX**, a mobile-first prediction market app on Creditcoin where
markets about Ethereum settle themselves by cryptographic proof.

**This is a full consumer app — not a landing page, not a one-pager.** I want a
complete screen flow an engineer could build from: a swipeable market feed,
trading, portfolio, reputation, leaderboards, market creation, and the
resolution moment. Multi-artboard canvas, phone-sized, with real interaction
states.

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

Deployed and working. Use these real values rather than placeholders:

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

---

# THE ART DIRECTION — read this part twice

## Security engraving

The visual language is **banknotes, share certificates, passports, bearer bonds,
tickets** — guilloche rosettes, intaglio line-work, microtext, lathe borders,
serial numbers, wax seals, perforations, UV security ink.

This is not decoration. Engraving is the **historical design language of
authenticity**: patterns a forger cannot reproduce, printed so you can verify a
document by looking at it. That is *exactly* what a cryptographic proof is —
CRUX just does it with mathematics instead of an intaglio press.

It also fits the product literally. A position in a prediction market is a
**bearer instrument**: a claim that pays out if a stated condition proves true.
Certificates are the correct object. Each market is one.

### The motifs, specifically

Use these as a real system, not as texture sprinkled on top:

**Guilloche rosettes** — the spirograph curves on banknotes. Two roles:
- as a low-opacity security tint behind card content, unique per market (seed the
  pattern from the market's spec hash, so every market's rosette is genuinely
  its own);
- as the **verification mark**: a rosette that draws itself to completion as a
  proof verifies. Incomplete rosette = unproven. This is the app's signature
  gesture and should appear everywhere verification does.

**Intaglio hatching** — fine parallel line-work that builds tone through density
rather than fill. Use for the YES/NO odds bars: they should look *engraved*, not
like flat progress bars. Denser hatching = higher probability.

**Microtext** — hairline text that reads as a plain rule at normal size and
resolves into characters when zoomed. Use it for dividers, and make it *say
something real*: the contract address, the topic0 hash, the market's serial,
repeated. A detail that rewards inspection is thematically perfect for a product
about verification.

**Serial numbers** — every market carries one (`N° CRUX-000004`), every proof
carries one, every position carries one. Monospace, small caps, always present.

**Lathe borders and rules** — engine-turned frame edges on cards and stamps.

**Wax seal / embossed stamp** — reserved exclusively for `PROVEN`. Nothing else
in the app is ever allowed to use the seal form.

**Perforations** — tear-off edges where a card separates into sections
(question / your position / resolution), like a ticket stub.

### Palette

```
GROUND — the desk the instruments sit on
  indigo-abyss   #0B0F26   deepest, page ground
  indigo-ink     #151A3D   primary surface
  indigo-raised  #1E2450   elevated panel
  indigo-rule    #2C3468   hairlines, engraved lines

VELLUM — the certificates themselves
  vellum         #EDEFE3   security paper (cool, NOT cream — avoid warm/beige)
  vellum-sunk    #DFE2D2
  vellum-ink     #101425   text on vellum

PROVEN — UV security ink
  lime           #C8FF3D
  lime-deep      #93C412

ASSERTED — rubber stamp
  vermillion     #D6304A
  vermillion-soft #3A1520

PENDING — bronze plate
  bronze         #C8A24A

SUPPORT
  cyan-thread    #4DD8E0   guilloche linework accent, sparingly
  crit           #FF5C5C   reverted / rejected
```

**The lime is UV security ink and that metaphor is load-bearing.** On a banknote,
UV ink is invisible until you put it under the right light — it only reveals
itself when you *check*. Lime appears in this app only where something has been
cryptographically verified. It must never be used as a general accent, never for
buttons, never because a screen needs a pop of colour. If you're reaching for
lime and nothing was proven, you're wrong.

Vermillion is the rubber stamp: human or AI assertion, bonded, challengeable.
Bronze is the plate waiting to be struck: pending attestation.

Ground is deep indigo; content sits on vellum certificate cards. Think the
interior of a passport, or a share certificate on a dark desk — **not**
crypto-dark, not neon-on-black.

### Typography

- **Market questions**: a high-contrast display serif with engraved character —
  a Didone or a transitional with sharp hairlines. These are propositions, the
  voice of the product. Set them large and let them carry the card.
- **Chrome and UI**: a neutral grotesk, quiet.
- **Every on-chain fact**: monospace — addresses, hashes, block heights, proof
  sizes, timings, serials. The monospace does semantic work: it is the typeface
  of checkable things.
- **Legends and labels**: small caps with wide tracking, as on certificates
  (`OBSERVATION WINDOW`, `BEARER`, `SERIES 2026`).

### Typographic provenance — the rule that governs everything

Every fact on screen visibly carries its origin. Three registers, no exceptions:

1. **Proven** — verified by an Attestcoin proof. Lime, completed rosette, seal,
   monospace. The only facts nobody can dispute.
2. **Derived** — computed by our contracts from proven inputs (prices, payouts,
   scores). Vellum-ink, engraved hatching, no seal.
3. **Asserted** — a human or AI resolver said so, bonded and challengeable.
   Vermillion, rubber-stamp treatment, deliberately less refined than engraving.

No competitor can copy this, because no competitor has proofs.

### What to avoid

47 teams are submitting and nearly all will produce the same thing: near-black
canvas, violet-to-blue gradients, glassmorphism, neon glow, Inter, a chart nobody
reads. Prediction markets specifically look like **casinos** — saturated, urgent,
green-up red-down.

Also avoid the other cliché: warm cream paper, muted teal, editorial serif,
generous whitespace. That is the AI-startup/Substack house style and it is
everywhere.

Never: glassmorphism, blur, glow, gradients-as-decoration, confetti, countdown
pressure, blockchains-drawn-as-cubes, chain-link icons, skeuomorphic 3D coins.

The engraving must feel **crisp and modern**, not a Victorian pastiche. Think a
contemporary passport or a well-designed festival ticket, not a saloon poster.

---

## The two clocks

The app runs on two rhythms and the design must hold them apart:

| | runs on | cadence | should feel |
|---|---|---|---|
| **Game loop** | Creditcoin | 15s blocks | instant, tactile — swipe, stake, odds move under your thumb |
| **Truth loop** | Attestcoin → Ethereum | ~8–40 min | weighty, ceremonial — the seal is struck |

A fast consumer app with one slow, heavy, beautiful moment at the end. The
swiping is a game; the settling is a verdict. Latency in the truth loop is the
price of having no oracle — show it honestly, make the waiting legible.

## Screens

### 1 · Swipe feed — home, and where 90% of time is spent

One market per card, full-bleed vellum certificate on indigo ground. **Swipe
right = YES, left = NO**, up to skip. Preset stake chips (5 / 25 / 100 tCTC): a
bet is one gesture plus one tap.

Each card carries, without clutter: serial number, question in display serif,
intaglio odds bar, lane badge (proof / ai), source chain, and time until trading
closes. Its guilloche security tint is unique to that market.

Design all four swipe states: resting, mid-drag with YES/NO intent revealing,
released, confirmed. The card should feel like a physical instrument being
flicked. Consider what shows *underneath* a card as it's dragged.

### 2 · Market detail

The question, odds, price history, your position, trade panel.

Critically: **the resolution rule as human-readable text.**

> Settles YES if Chainlink's ETH/USD aggregator at `0x7d4E…6fb5` emits
> `AnswerUpdated` with a price above **$1,903** in Ethereum blocks
> **25,894,845 – 25,895,445**.

Show the raw spec as inspectable data beneath it — set as engraved fine print,
which is exactly what it is. That the rule is *data rather than code* is the
technical heart of the project.

### 3 · Trade sheet

Buy/sell YES or NO. Amount, share count, average price, slippage guard, fees,
resulting odds. Honest about LMSR: your trade moves the price, and the hatching
should visibly redistribute before you commit.

### 4 · The Proof Drop — the hero

The shot the whole submission rests on. **Four sequenced states**, storyboarded:

1. **Watching** — window open, answer doesn't exist yet. Rosette blank, bronze.
2. **Attesting** — the event happened on Ethereum; Creditcoin hasn't attested it
   yet. Rosette begins. Genuinely *pending*, not unknown — a state no competitor
   can show, because none of them have a proof in flight.
3. **Proving** — the Merkle path drawing from transaction to block root, then the
   continuity chain to a committed attestation. The rosette completing as the
   proof resolves.
4. **Proven** — the seal strikes:

```
        ✦ PROVEN ✦
  ETHEREUM MAINNET · BLOCK 25,895,136
             $2,407.57
```

Weighty and earned — a seal pressing into wax, a die stamping a plate. Not a slot
machine paying out. The lime should arrive *here* and feel like UV light hitting
the note.

Give real prominence to one line: the browser **re-verifies the proof itself**,
because verification is a free staticcall — so it can honestly say *verified in
your browser — trusting neither our servers nor us.* The most trust-inverting
sentence in the product.

Works phone-sized and as a large desktop moment; it will be screen-recorded.

### 5 · Settled NO — the other half

A market can also settle NO — not by proof, but by its window becoming fully
attested with no qualifying event. **Absence established by time.** Design it as
a *void* / *expired* certificate treatment: cancellation perforation, the rosette
struck through rather than completed. Quieter than the seal, but designed. Most
people miss that this is how "no" works.

### 6 · Portfolio

Open positions with live mark-to-market, settled positions awaiting claim, claim
action. Winning shares redeem 1:1 in tCTC. Positions are certificates you hold —
lean into that. *Unsettled*, *settled-you-won*, and *claimed* must be
unmistakable at a glance.

### 7 · Profile and reputation

Soulbound, non-transferable. **Brier calibration score** (lower is better —
design a way to make that legible to someone who's never heard of Brier),
current and best streak, season XP, markets resolved.

Treat it as a **credential document**: a certificate of standing, engraved,
bearing the holder's serial. The claim worth designing around: because
resolution is cryptographic, this reputation is **provably untainted by oracle
manipulation** — something no other prediction market can say about its
leaderboard.

### 8 · Leaderboard

Seasonal, ranked by calibration rather than raw profit — rewarding being *right*
over being *rich*. Show season, ranking, your position.

### 9 · Create market

Compose from templates: pick a source (Chainlink price, whale transfer, DAO
proposal execution, contract state via beacon), a threshold, a block window. The
app resolves topic0, the live aggregator address and block heights for the user.
Creators earn a share of their market's fees.

Frame it as **issuing an instrument**: the certificate assembles as you fill it
in, serial assigned at the end. An ordinary person should build a
cryptographically-resolvable question without seeing a hash — but be able to
expand and see exactly what was issued.

### 10 · Onboarding / empty state

Someone who has never touched crypto understands what this is within five
seconds. **No wallet-connect wall as the first screen.** Let people browse first.

## Constraints

- Mobile-first; Proof Drop additionally needs a desktop treatment.
- Accessible contrast. Never encode meaning in colour alone — proof/ai needs a
  text or shape cue too (seal vs stamp does this work).
- Real data everywhere. Hashes truncate as `0xbc38ccea…7777`, never `0x123…abc`.
- Design waiting states as carefully as active ones. The truth loop takes
  minutes and that time is part of the product.
- Engraving detail must survive at phone scale — test that the guilloche and
  microtext still read at 390px wide rather than only in a zoomed artboard.

## What success looks like

A judge scrolling 47 submissions stops, because this one doesn't look like a
crypto app — it looks like a **mint**. Then they watch a market settle itself
from a real Ethereum mainnet price with no human anywhere in the loop, and the
interface makes that legible rather than magical.

Deliver a colour and type system, the guilloche/seal/hatching motif set, then
every screen as artboards — with the swipe feed and the Proof Drop given the
most attention.
