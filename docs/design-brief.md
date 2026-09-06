# CRUX — design prompt

Paste everything below the line into Claude, with the `design` skill, to produce
the canvas. It is written to be used as-is.

---

## The prompt

I need a visual design system and screen designs for **CRUX**, a prediction
market on Creditcoin where markets about Ethereum settle themselves by
cryptographic proof. Build it as a multi-artboard design canvas.

### What the product actually does

Every prediction market in existence dies at the same place: the oracle.
Polymarket needs UMA's optimistic oracle — bonds, disputes, a two-hour challenge
window, token-holders voting. Kalshi needs a CFTC-registered clearinghouse and a
review committee. Every one of them ultimately trusts a reporter, a committee, a
regulator, or a bonded game.

CRUX markets settle themselves. When a market asks a question whose answer is an
Ethereum event — "will ETH trade above $1,903 before block 25,895,445?" — the
resolution is a **cryptographic proof that the event occurred**, verified inside
a single Creditcoin block by a native precompile. No committee. No admin key. No
dispute window, because you cannot dispute mathematics.

This is live and working, not aspirational. Real numbers from the deployed
system, which you should use verbatim in the designs rather than inventing
placeholder data:

```
Market          Will ETH trade above $1,903 before block 25,895,445?
Source          Ethereum mainnet, Chainlink ETH/USD
Aggregator      0x7d4E742018fb52E48b08BE73d041C18B21de6Fb5
Event           AnswerUpdated · topic0 0x0559884f…fc5f
Resolving tx    0xbc38ccea67d7c028f9d4275e11f377443d44d4fc0480261c6d4e19c5f2d07777
Source block    25,895,136  (Ethereum mainnet)
Observed price  $2,407.57
Proof           8 merkle siblings · 5 continuity roots · 5,824 bytes
Generation      914 ms
Verification    536 ms — TRUE, on precompile 0x…0FD2
Settled on      Creditcoin CC3, block 5,441,970
Contracts       CruxMarket 0x34a712c4206a826d3E44be50FFcc33bE1Fa3dA3C
                CruxAttestedResolver 0x3a2153c98B967578F764c5Df340dc7c5E99B8757
```

### The one idea the design must express

**Proof, not opinion.**

Every other prediction market asks you to trust that somebody reported the truth
honestly. CRUX shows you the mathematics and invites you to check it yourself.
The interface should feel less like a betting app and more like **an instrument
of record** — something that produces evidence, the way a lab instrument or a
clearing house ledger does.

The single most important design decision follows from this, and I want it to be
the backbone of the system:

> **Typographic provenance. Every fact on screen visibly carries its origin.**

A number that was proven by a cryptographic proof must not look like a number we
merely computed, and neither may look like a number a human asserted. Design
three distinct visual registers for these and apply them ruthlessly:

1. **Proven** — established by a verified Attestcoin proof of an Ethereum event.
   The strongest register. Monospace, ink-dark, with a mark that means
   *verified*. These are the only facts in the product nobody can dispute.
2. **Derived** — computed by our contracts from proven inputs (market prices,
   payouts, scores). Trustworthy but downstream.
3. **Asserted** — supplied by a human or an AI resolver, bonded and challengeable.
   Visibly weaker. Never allowed to borrow the visual language of proof.

No competitor can copy this, because no competitor has proofs. It turns the
thesis into a design system rather than a tagline.

### What everything else looks like — and what to avoid

This is a hackathon with 47 submissions and they will nearly all look the same:
near-black canvas, violet-to-blue gradients, glassmorphic cards, neon glow,
Inter everywhere, a chart nobody reads. Prediction markets in particular
(Polymarket, its clones) look like **casinos**: dark, saturated, urgent,
green-up-red-down, built to make you act fast.

Do not do any of that. Specifically avoid:

- dark-mode-by-default, neon accents, purple/blue gradients, glow effects
- glassmorphism, heavy blur, floating translucent cards
- casino urgency: flashing odds, countdown pressure, confetti
- generic crypto iconography — no blockchains-as-cubes, no chain links
- decorative charts that carry no information

The contrarian move is **warmth, calm and legibility**. A document you would
trust, not a screen that wants something from you. Confidence, not urgency.

### Visual direction

Start from this palette, which already exists in the project's written materials
so reusing it makes the app, the README and the deck feel like one artefact.
Treat it as a foundation to refine, not a cage:

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
amber      #866415    waiting, pending attestation
crit       #98292B    rejected, failed, reverted
```

**Teal and clay are never decorative.** Teal means *this was proven*. Clay means
*a human or an agent asserted this and it can be challenged*. A user must be able
to tell, from colour alone at arm's length, which guarantee they are holding. If
you find yourself using teal because it looks nice, that is a bug.

Typography: a serif for headings and questions — the questions are the product's
voice and should read like propositions, not UI labels. A clean sans for
interface chrome. **Monospace for every on-chain fact** — addresses, hashes,
block heights, proof sizes, timings. The monospace is doing semantic work: it is
the typeface of things that are checkable.

Design light-first, then a true dark variant. Not an inverted palette — a
considered night version of the same instrument.

### Screens to design

**1. Market list.** Questions as propositions, in serif, large. Each card carries
its lane (proof / ai) unmissably, its source chain, live odds, and the block
window. A market whose answer already exists on Ethereum but is not yet attested
should read as *pending*, not *unknown* — that distinction is real and nobody
else can show it.

**2. Market detail.** The question, the odds, and — critically — **the resolution
rule rendered as human-readable text**: "settles YES if Chainlink's ETH/USD
aggregator at 0x7d4E…6fb5 emits AnswerUpdated with a price above $1,903 in
Ethereum blocks 25,894,845–25,895,445." Show the spec as data, because the fact
that the rule is data rather than code is the technical heart of the project.

**3. The Proof Drop — the hero.** This is the shot the whole submission rests on.
The moment a market resolves, the interface should *show the proof landing*: the
transaction on Ethereum, the Merkle path from that transaction up to a block
root, the continuity chain linking that block to an attestation Creditcoin has
committed, and then the verdict stamp:

```
✓ PROVEN
  ETHEREUM MAINNET · BLOCK 25,895,136
  $2,407.57
```

It must feel **weighty and earned**, not like a game reward. Think a seal being
pressed, a receipt printing, an assay completing — not a slot machine paying out.
Design it as a sequence of 3–4 states so it can be storyboarded and animated.

Include one detail that matters enormously: the browser **re-verifies the proof
itself**, because verification is a free staticcall. So the screen can honestly
say *verified in your browser — trusting neither our servers nor us*. Give that
line real prominence. It is the most trust-inverting sentence in the product.

**4. The NO path.** A market can also settle NO — not by proof, but by the
observation window becoming fully attested with no qualifying event in it.
Absence established by time. This deserves its own designed moment, visually
distinct from the proof stamp and quieter, because it is the other half of how
the mechanism works and most people miss it.

**5. Two clocks.** The product runs on two rhythms and the design should make
this legible rather than hide it: a fast loop on Creditcoin (15-second blocks,
trading, prices moving) and a slow loop on Ethereum (~8 minutes for attestation,
then settlement). Latency here is not a flaw to disguise — it is the cost of not
having an oracle, and showing it honestly is a strength.

### Constraints

- Mobile-first for the list and detail; the Proof Drop must also work as a large
  desktop moment because it will be screen-recorded for a demo video.
- Accessible contrast throughout. Never encode meaning in colour alone — the
  proof/ai distinction needs a text or shape cue too.
- Real data everywhere. Hashes truncate as `0xbc38ccea…7777`, never `0x123…abc`.
- No wallet-connect-first empty states. Someone who has never used crypto should
  understand what this is within five seconds of landing.

### What success looks like

A judge scrolling 47 submissions stops on this one, and the reason they stop is
that it doesn't look like a crypto app at all — it looks like a **document that
proves things**. Then they watch a market settle itself from a real Ethereum
mainnet price with no human anywhere in the loop, and the interface makes that
legible rather than magical.

Deliver: a colour and type system, then the screens above as artboards, with the
Proof Drop given the most attention.
