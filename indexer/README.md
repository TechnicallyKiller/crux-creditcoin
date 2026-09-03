# crux-indexer

Event indexer and read API. Creditcoin has no subgraph (C7), so the frontend
cannot ask for "every trade on market 3" or a leaderboard — an RPC gives you
current state and a log range, nothing else. This fills exactly that gap.

```bash
node --experimental-strip-types indexer/src/index.ts          # sync + serve on :8787
node --experimental-strip-types indexer/src/index.ts --once   # sync and print stats
```

Routes: `/markets`, `/markets/:id` (with trades), `/activity`, `/stats`.

Storage is `node:sqlite` — built into Node 24, so the indexer adds no
dependency and no service to run.

## It is a read cache, never an authority

Every number it serves is derived from on-chain events and can be recomputed by
anyone from the chain alone. If it disagrees with the chain, the chain is right.
Deleting the database and resyncing is always safe — which is the property that
matters, since a testnet reset (R5) should cost nothing but a resync.

## Two things worth knowing

**One `getLogs` per page, decoded locally.** The obvious version calls
`queryFilter` once per event type: seven round-trips per page, which over a
50k-block backfill is hundreds of calls and minutes of wall time. Fetching the
address range once and dispatching on `topic0` makes it one, and the same
backfill finishes in seconds.

**Every writer upserts.** `SpecRegistered` is emitted by the resolver in the
*same transaction* as `MarketCreated` and carries a **lower** log index, so it
is processed first. An `UPDATE` there finds no row, silently does nothing, and
leaves `emitter`/`topic0` null forever — which is exactly what happened on the
first run. Log ordering within a transaction is an implementation detail of the
contracts, not a contract with the indexer, so nothing here depends on it.
