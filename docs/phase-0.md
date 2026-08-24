# Phase 0 — Foundations

**Run 2026-08-24 against live CC3 testnet, the Attestcoin proof builder, and Ethereum mainnet.**

Exit criterion from plan §12: *"the toolchain is proven locally, not just read about."* Met.
Everything below was executed. Reproduce with the commands in each section.

---

## Status of prerequisites (§11)

| # | Prereq | Status |
|---|--------|--------|
| 1 | tCTC from Discord faucet | **BLOCKED — needs you.** Nothing is deployed yet. |
| 2 | Ethereum mainnet archive RPC | **BLOCKED — needs you.** Not yet required; see below. |
| 3 | Sepolia RPC + Sepolia ETH | **BLOCKED — needs you.** Gates `CruxBeacon` deploy. |
| 4 | Reproduce `hello-bridge` end-to-end | **DONE** — exceeded; proved both chains directly. |
| 5 | Confirm Foundry version | **DONE** — 1.7.1 works; no pin needed. |
| 6 | Verify `EvmV1Decoder` import path | **DONE** — compiles, links, runs on real txs. |
| 7 | Blockscout contract verification | Deferred to first deploy (needs prereq 1). |
| 8 | Ask in `#buidl-ctc-qna` | **Still open — needs you.** See §15. |
| 9 | Team eligibility / submission fields | **Still open — needs you.** |

Prereqs 4–6 were completed **without any funds**, because `verify` is a staticcall (C6).
That property is worth more than the plan credits it for: it means prereq 1 blocks
*deployment* only, not development.

---

## Verified this run

```
Creditcoin CC3      chainId 102031, block 5,363,329, gas 0.5 gwei
chainKey 3 Ethereum attested 25,821,950 vs head 25,821,995 -> lag 45 blocks (~9.0 min)
chainKey 1 Sepolia  attested 11,554,030 vs head 11,554,068 -> lag 38 blocks (~7.6 min)
checkpoint interval every 10 source blocks, both chains
proof generation    ~700-730 ms      verification ~235-255 ms
mainnet proof       TRUE ✓ PROVEN    sepolia proof TRUE ✓ PROVEN
```

**R1 is materially de-risked.** The plan measured chainKey 3 on 2026-08-11 at attested
height 25,733,640. Thirteen days later it is at 25,821,9xx and still within normal lag.
Mainnet attestation has run continuously across the whole gap. It is still testnet
infrastructure and still worth asking about in `#buidl-ctc-qna`, but it is no longer a
single-observation claim.

Reproduce: `node --experimental-strip-types scripts/check-liveness.ts`

---

## Findings that change the plan

### F1 — C3 is real, and now proven rather than assumed

The plan calls `receiptStatus == 1` "the highest-severity foot-gun in the stack" (C3/R4).
It is correct, and this is no longer theoretical:

```
tx     0xc3ab8c0e12e7aec6c8b28a91f358c662c189584ff0236434b0ac3c49f0aa1023
block  25,821,980 (Ethereum mainnet)
status 0x0  <- REVERTED on mainnet
verify on 0x…0FD2 -> TRUE ✓ PROVEN — 240 ms
```

The protocol cheerfully proves a **failed** transaction. Without the guard, an attacker
resolves any market by sending a transaction they know will revert. Captured as
`fixtures/mainnet-reverted.json` and pinned by `test_C3_revertedTransactionIsRejected`.

### F2 — Forked Foundry tests can never execute the precompile

Plan §12 Phase 1 says "Foundry tests using fixture proofs captured from the live prover
API." That does not work as written.

`eth_getCode` at `0x…0FD2` returns `0x`. The precompile is **native runtime code**, not
EVM bytecode, so `vm.createSelectFork` has nothing to pull into the local EVM. (The
`EvmV1Decoder` library *is* ordinary bytecode at `0x731c…F9f` and forks fine — which is
why decoding works and verification does not.)

Testing is therefore three-tier, now established in `contracts/test/Precompile.t.sol`:

1. **Forked** — real decoder over real attested transactions. Covers decode/extract,
   which is where C3 lives.
2. **Mocked** — `vm.mockCall` on `0x…0FD2`. Covers CRUX's own logic: spec matching,
   settlement, replay protection.
3. **Live** — `scripts/prove-tx.ts`, out-of-process against CC3. The only place a real
   proof is really verified. Green on both chains.

This also affects `USCBase._computeQueryId`, which calls `calculateTxIndex` on the
precompile — even computing a queryId touches native code.

### F3 — Continuity root count tracks checkpoint alignment, not freshness

The plan's C4 records "continuity roots 1 (cheapest case — fresh proof)". Freshness is
not the driver. Measured, all proofs fresh (seconds old):

| tx in block | offset from checkpoint | continuity roots |
|---|---|---|
| 25,821,960 | 0 (aligned) | **1** |
| 25,821,980 | 0 (aligned) | **1** |
| 25,821,955 | 5 | **6** |
| 11,554,025 (Sepolia) | 5 | **6** |

Roots ≈ distance to the enclosing checkpoint + 1. Since gas is
`2.3e-5 + 2.9e-7 × continuity_hash_count`, resolution cost varies ~6× on the continuity
term depending on where in the 10-block window the event happens to land — which we do
not control. Absolute cost is still small, but the bounty in D6 must be sized for the
worst case (offset 9), not the 1-root case. The staleness penalty in C4 is a *separate*
multiplier and remains unverified.

### F4 — Two different `INativeQueryVerifier` interfaces exist

- `@gluwa/usc-contracts@0.1.2` ships a "lean" copy with only
  `verify(...) external view returns (bool)`, documented to **revert on failure rather
  than return false**.
- `gluwa/usc-testnet-bridge-examples` ships `verifyAndEmit(...)` (non-view) plus
  `calculateTxIndex(...)`. **`USCBase` requires these**, so it cannot be built against
  the npm package alone.

Both are vendored under `contracts/src/usc/` with the reasoning in its README. The
revert-not-false behaviour is a real trap: never treat a plain call's return value as
the failure signal. `DecoderProbe.tryVerify` wraps it, pinned by a test.

### F5 — `EvmV1Decoder` is a linked library, not an inlined one

Its functions are `public`, so it deploys separately and links by address — which is why
plan §16 lists decoder addresses at all. Configured in `contracts/foundry.toml` under
`libraries`. Forgetting this produces confusing link errors, not obvious ones.

### F6 — Foundry must not use a post-Paris EVM version when forking CC3

`evm_version = "shanghai"` fails every forked test with
``header validation error: `prevrandao` not set`` — Creditcoin is Frontier-based and its
headers carry no `prevrandao`. Set to `london`. Costs nothing we need.

### F7 — Minor: `ReceiptFields.logs` is actually `receiptLogs`

The plan's §09 sketch uses `receipt.logs`. The real field is `receipt.receiptLogs`.

---

## What was built

```
contracts/          Foundry. forge-std, remappings, linked decoder, london EVM.
  src/usc/          Vendored USCBase + VerifierInterface (see F4).
  src/DecoderProbe.sol    decode + C3 guard + wrapped precompile call.
  src/CruxBaseProbe.sol   proves USCBase is inheritable (the Phase 1 shape).
  test/Precompile.t.sol   7 tests, all green.
scripts/
  check-liveness.ts   §3.1-3.3 as a repeatable R1 monitor.
  prove-tx.ts         proof -> precompile, end-to-end; writes fixtures.
  find-reverted.ts    finds attestable reverted txs (produced F1).
fixtures/           Real captured proofs, incl. the adversarial reverted one.
worker/ ai/ indexer/ web/ packages/shared/    scaffolded, empty.
```

`forge test` → **7 passed, 0 failed.**

---

## Handoff to Phase 1

Blocked on you, in priority order:

1. **tCTC faucet** (`discord.gg/creditcoin` → `#token-faucet`). Hard-blocks every
   deployment. Request early; limits are undocumented.
2. **Sepolia ETH + RPC.** Gates `CruxBeacon`.
3. **Mainnet archive RPC.** Not needed yet — the worker's log scanning needs it, which
   is Phase 2. Public RPCs served `eth_blockNumber`, `eth_getBlockByNumber` and
   `eth_getBlockReceipts` fine for everything above.
4. **Ask `#buidl-ctc-qna`** the §15 questions, especially testnet reset schedule.

Not blocked: `CruxAttestedResolver`, `AttestSpec`, and `CruxMarket` can all be written
and tested now under tiers 1–2 of F2.
