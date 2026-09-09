# CRUX

**Settlement by cryptographic proof.**

A contract states its resolution rule as **data** — which chain, which contract, which event,
which field, which comparison, which block window — and CRUX settles it against a **proof that
the event actually occurred on Ethereum**, verified by a Creditcoin precompile inside a single
block.

No oracle. No committee. No admin key. No dispute window.

Its first application is **prediction markets that settle themselves**, because that is the
clearest demonstration: the hardest unsolved problem in prediction markets is the oracle, and
this removes it rather than bonding it.

*BUIDL CTC 2026 Fall · Attestcoin Protocol · Creditcoin CC3 testnet*

---

## Live now

| | |
|---|---|
| `CruxMarket` | [`0xA558efC5…ceCbdC`](https://creditcoin-testnet.blockscout.com/address/0xA558efC57e25b3bF45927CeeC7543E0831ceCbdC) |
| `CruxAttestedResolver` | [`0xa2CD2dCd…D42E89`](https://creditcoin-testnet.blockscout.com/address/0xa2CD2dCd2cce9402029bbaf9cAe5054f15D42E89) |
| `CruxScore` | [`0xFFB272Ef…05d81E`](https://creditcoin-testnet.blockscout.com/address/0xFFB272EfF1fF82C05a74015e5e6c49900405d81E) |
| `CruxBeacon` (Sepolia) | [`0x0F1bf92E…45c7C8`](https://sepolia.etherscan.io/address/0x0F1bf92EE0C79F7Ca5C1e30E9412aD5BFF45c7C8) |

**59 tests green.** A market has settled itself end-to-end on live networks, from a real Ethereum
mainnet Chainlink price, with no human anywhere in the loop.

---

## Verify it yourself, right now

Verification on Creditcoin is a `view` — a free staticcall. So you do not have to take any of this
on trust:

```bash
npm install
node --experimental-strip-types scripts/prove-tx.ts 3 <any-ethereum-mainnet-tx-hash>
```

That fetches a Merkle + continuity proof from the public Attestcoin prover and asks the precompile
at `0x…0FD2` whether the transaction really happened. No wallet, no gas, no account.

The app does the same thing **from your browser**, against endpoints we do not operate, with the
transaction hash as an input — so you can paste a hash we have never seen.

---

## How it works

Attestcoin gives Creditcoin two proofs about a foreign chain:

| Proof | Establishes |
|---|---|
| **Merkle** | this transaction is in that block |
| **Continuity** | that block is on the finalised chain, linked to a committed attestation |

A precompile verifies both synchronously. `EvmV1Decoder` then turns *"prove it happened"* into
*"read what it said"* — receipt status, logs, topics, data.

CRUX's contribution is that the **rule is data, not code**:

```solidity
struct AttestSpec {
    uint64     chainKey;      // 3 = Ethereum mainnet, 1 = Sepolia
    address    emitter;       // the log MUST come from here
    bytes32    topic0;        // event signature
    Extract    extractMode;   // an indexed topic, or a 32-byte data word
    uint8      extractIndex;
    Comparator cmp;           // GT GTE LT LTE EQ EXISTS
    int256     threshold;
    uint64     fromBlock;     // observation window, source-chain heights
    uint64     toBlock;
}
```

Ten fields. **No contract is deployed for a new market.** One audited resolver interprets any
spec, which is what makes this an engine rather than one hardcoded integration.

`YES` is provable by a single proof. `NO` is established by the observation window becoming fully
attested with no qualifying event in it — absence proven by time rather than by assertion.

`CruxBeacon` extends the reach further: Attestcoin can prove transactions and logs but never
storage slots, so the beacon `staticcall`s any contract and emits what it read. Any `view`-readable
EVM state becomes attestable.

---

## What we found

Building this surfaced several things the documentation gets wrong or omits. Full detail in
[`docs/phase-0.md`](docs/phase-0.md) and [`docs/deployment.md`](docs/deployment.md).

**Inclusion is not success, and it is exploitable.** The precompile proves a transaction was
*included*, not that it *succeeded*. We proved this against a real mainnet transaction that
**reverted** — `0xc3ab8c0e…1023` — and the precompile returned `TRUE`. Without a
`receiptStatus == 1` guard, an attacker resolves any market by broadcasting a transaction they
know will fail. Pinned by an adversarial test against that exact transaction.

**Proofs expire.** A continuity proof must chain to the *current* committed attestation, so a
stale proof is **invalid**, not merely more expensive. Same transaction, measured: a proof captured
four days earlier carried 5 continuity roots and was rejected; regenerated, it carried 65 and
returned `TRUE`. The docs describe staleness as a gas penalty. It is harder than that.

**`settleNo` was front-runnable.** It required only that the window be attested — it never checked
that no qualifying event occurred, because absence is not provable. But a holder of NO shares is
*rationally motivated* to call it the instant the window is attested and win a market the chain can
prove they lost. A grace period now guarantees a proof-holder time to land it.

**One event must be able to settle many markets.** `USCBase` keys replay protection on the
transaction alone, but a single Chainlink update legitimately resolves "ETH above $2,000?",
"above $2,400?" and "above $2,500?" at once. Under that scheme the first resolution consumes the
transaction and the rest become permanently unresolvable. CRUX binds the market into the key.

**`topic0` alone is not a match.** Event signatures are global and unowned — anyone can emit
`AnswerUpdated` with any value and produce a valid proof of a genuinely real transaction. Pinning
the emitter is the only thing separating *"Chainlink said $2,512"* from *"somebody said $2,512"*.

---

## Running it

Requires Node ≥ 22 and [Foundry](https://getfoundry.sh).

```bash
npm install
cp web/.env.example web/.env          # add a Reown project id for wallets (optional)

npm run dev -w @crux/web              # the app
npm run check:abi                     # precompile ABI conformance, live
npm run liveness                      # is Attestcoin actually attesting?

CC3_RPC_URL=https://rpc.cc3-testnet.creditcoin.network forge test --root contracts
```

Reads need no wallet. Every market, spec and proof on this network is public.

---

## Layout

```
contracts/          Foundry. 59 tests.
  CruxAttestedResolver.sol   verify → decode → match spec → settle
  CruxMarket.sol             LMSR markets, tCTC collateral, cost basis
  CruxScore.sol              soulbound calibration, Brier not profit
  CruxBeacon.sol             turns view-readable state into attestable events
  LMSR.sol                   max-shifted scoring rule, fuzz-tested
web/                Vite + React + viem. Security-engraving design system.
worker/             Permissionless resolution. A convenience, not a trust assumption.
indexer/            node:sqlite event index. A read cache, never an authority.
scripts/            Liveness, proof generation, ABI conformance, demo driver.
docs/               Findings, deployment log, design and logo briefs.
```

## Attestcoin integration

Not a bolt-on. Remove Attestcoin and there is no product.

- `verifyAndEmit` on the block-prover precompile, on every proof-lane settlement
- `EvmV1Decoder` for receipt status, log matching and field extraction
- `USCBase` for verify-then-dispatch, with replay protection widened to per-market
- `get_latest_attestation_height_and_hash` driving NO-settlement and the trading gate
- both `chainKey 3` (Ethereum **mainnet**) and `chainKey 1` (Sepolia)
- `CruxBeacon` converting foreign contract state into attestable events

**Creditcoin testnet attests Ethereum mainnet.** That is why the demo is not synthetic: real
Chainlink prices, real events, resolved by proof, while the dApp sits on testnet exactly as the
rules require.

---

Research and verification performed against live Creditcoin CC3 testnet, the Attestcoin proof
builder and Ethereum mainnet. Everything marked verified was executed, not read.
