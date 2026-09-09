# crux-web

The CRUX app. Vite + React + viem, custom CSS — no component library and no
Tailwind, because the design is bespoke engraving and a utility framework would
fight it rather than help.

```bash
npm run dev -w @crux/web      # http://localhost:5173
npm run build -w @crux/web    # static output in web/dist
```

## Reads come straight from the chain

There is no backend in the read path. Every number about a market is read from
`CruxMarket` and `CruxAttestedResolver`, so the app cannot display a value the
chain disagrees with. The indexer exists for history and leaderboards, never for
truth.

RPC goes to Blockscout's proxy first and the official CC3 endpoint second: the
official one degraded to ~15.7s per call while the proxy answers in under a
second (docs/deployment.md). A UI that waits 15 seconds for a price looks broken
even when the chain is perfectly healthy.

## The engraving is a system, not decoration

`src/lib/engraving.ts` holds the primitives, ported from the design canvas so the
app draws the same curves the design was approved on.

- **Guilloche** — seeded from the market's serial, so every instrument carries a
  security pattern that is genuinely its own and cannot be transplanted onto
  another market. That is what banknote engraving has always been for.
- **The verification mark** — one dense spiral revealed by animating
  `stroke-dashoffset` from 1 to 0. Incomplete means unproven. It is bronze while
  pending and turns lime only once the precompile has actually returned true.
- **Intaglio hatching** — odds bars carry tone through line *density*, never
  fill, so they read as engraved rather than as progress bars.
- **Microtext** — hairline rules that spell real contract addresses and topic
  hashes. They resolve into readable characters when zoomed.
- **The seal** — reserved exclusively for PROVEN. Nothing else may use it.

**Lime is ultraviolet security ink.** On a banknote UV ink is invisible until you
check under the right light; here lime appears only where a cryptographic proof
has verified. It is never a button, never a highlight. If lime appears and
nothing was proven, that is a bug.

## One implementation note that matters

The swipe drag mutates the card's `transform` through a ref and only commits to
React state on release. Re-rendering a certificate — guilloche SVG included — on
every `pointermove` drops frames badly, and a swipe that stutters makes the whole
product feel cheap.
