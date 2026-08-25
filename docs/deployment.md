# Deploying CRUX

## Live addresses — Creditcoin CC3 testnet (102031)

| Contract | Address |
|---|---|
| `CruxMarket` | `0x9872b13257E958c2F7E4DcCc3F96b3C70c8e050c` |
| `CruxAttestedResolver` | `0xD7EeD2a64762A7038d64886882161bA1b1EfC074` |
| `EvmV1Decoder` (linked library) | `0x6e94c85Bf6b80394a4c051d03EC93Eefc854423F` |

Deployed at block 5,369,274 by `0x364edc06…5609`.

## Commands

```bash
cd contracts

# CC3: market + resolver. The multiplier is not optional — see below.
forge script script/Deploy.s.sol --account crux-deployer \
  --rpc-url cc3_testnet --broadcast --gas-estimate-multiplier 300

# Sepolia: the beacon
forge script script/DeployBeacon.s.sol --account crux-deployer \
  --rpc-url sepolia --broadcast --gas-estimate-multiplier 300
```

Addresses are written to `deployments/*.json`, so nothing downstream needs
hand-copied constants — and after a testnet reset (R5) that file is the only
thing that changes, and it rewrites itself.

---

## Deployment findings

### D1 — Foundry under-estimates gas on CC3 by ~2.4×, and fails silently

The first deployment lost its final transaction this way. `setResolver` was
broadcast with a 64,621 gas limit and consumed exactly 64,621 — the signature of
out-of-gas rather than a revert, which is easy to misread as a contract bug. The
chain's own `eth_estimateGas` for the identical call returns **154,675**.

Both contracts had deployed fine; only the wiring call died, leaving a market
with no resolver — deployed but inert.

**Always pass `--gas-estimate-multiplier 300` on CC3.** For one-off calls, pass
an explicit `--gas-limit`. Do not trust a clean simulation to imply a clean
broadcast on this chain.

Related symptom, same root: the deploy log fills with

```
ERROR alloy_provider::blocks: failed to fetch block err=deserialization error: missing field `mixHash`
```

Creditcoin is Frontier-based and its headers carry no `mixHash`, so Foundry's
provider cannot deserialise them and never sees the receipts. It is noise rather
than failure — the transactions land — but it means the progress display stalls
at `0/4 receipts` and the tool's own view of what happened is unreliable. This
is the same family of problem as needing `evm_version = "london"` for forked
tests (docs/phase-0.md, F6). **Verify deployments against the chain, not against
Foundry's output.**

### D2 — Forge's transaction labels are shifted when a deployment partially fails

The failing run reported `Contract: CruxAttestedResolver` on the failed
transaction and `Function: setResolver` on a successful one. Both were wrong.
Reading receipts directly showed the failed transaction had `to =` the market
and no `contractAddress`, i.e. it was the `setResolver` **call**, while the
resolver had in fact deployed successfully.

Diagnose from `eth_getTransactionReceipt`, ordered by nonce — not from the
console summary.

### D3 — The `libraries` config silently does not apply

`foundry.toml` normalises a `libraries` entry to an absolute path, while the
compilation unit keys the source relatively. The two never match, so the pin is
ignored and forge deploys its own copy of `EvmV1Decoder` — no warning, just a
surplus contract in the broadcast.

We now let it do exactly that, deliberately. It routes through the CREATE2
deterministic deployer, so every redeploy reuses the same library address, which
is the idempotence R5 wants. Cost is ~0.004 tCTC, once.

The consequence worth knowing: CRUX does **not** use Attestcoin's published
decoder at `0x731c345d…F9f`. It uses its own instance compiled from the same
`@gluwa/usc-contracts@0.1.2` source.
