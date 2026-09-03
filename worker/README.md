# crux-worker

Watches open markets, finds the source-chain event that decides each one, and
submits the proof. Settles NO once a window lapses unproven.

```bash
# scan and report without signing anything
node --experimental-strip-types worker/src/index.ts --dry-run --once

# run for real
WORKER_PRIVATE_KEY=0x... node --experimental-strip-types worker/src/index.ts
```

## It is a convenience, not a trust assumption

Anyone can run one. The resolver has no privileged caller, and whoever lands a
valid proof first collects the market's bounty. If this process dies, markets
still resolve — somebody else is paid to do it (D6). That is why the proof lane
has no admin key anywhere in it.

Use a **throwaway key**. The process holds it in memory and it only ever pays
gas to submit proofs.

## Design notes

**Idempotent by construction.** On-chain replay protection means a duplicate
submission is a wasted transaction, never a double settlement, so the worker can
crash and restart at any point without reconciling state.

**Verifies before spending gas.** `verifySingle` is a staticcall, so the worker
checks the precompile will accept a proof before broadcasting — turning a failed
transaction into a log line.

**Mirrors the contract's predicate.** `satisfies()` reimplements
`_extract`/`_compare` from `CruxAttestedResolver`, so gas is only spent on
proofs the contract will actually accept. If the two ever disagree the worker
wastes gas; it cannot cause a wrong settlement, because the contract re-checks.

**Only scans what is attested.** An event past the attested tip has happened but
cannot be proven yet, so scanning further would find matches it cannot use.

**Persists a scan cursor.** Archive `eth_getLogs` is the scarcest resource the
worker has (C8) — re-reading thousands of blocks after every crash is what
exhausts a rate limit.
