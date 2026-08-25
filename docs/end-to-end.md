# The end-to-end demo

Phase 1's exit criterion: **a Sepolia-sourced market resolves itself, with no
human in the loop.** Four commands, then the market settles on a proof.

All contract commands run from `contracts/`. Every broadcast on CC3 needs
`--gas-estimate-multiplier 300` (see docs/deployment.md, D1).

### 0 · Deploy the beacon (once)

```bash
forge script script/DeployBeacon.s.sol --account crux-deployer \
  --rpc-url sepolia --broadcast --gas-estimate-multiplier 300
```

### 1 · Open a market on Creditcoin

```bash
forge script script/CreateMarket.s.sol --account crux-deployer \
  --rpc-url cc3_testnet --broadcast --gas-estimate-multiplier 300
```

Computes the observation window from the *current attested Sepolia height*, so
the R3 safety margin is measured in source-chain blocks rather than guessed.

### 2 · Wait for trading to close, then make the event happen

```bash
forge script script/FireSnapshot.s.sol --account crux-deployer \
  --rpc-url sepolia --broadcast --gas-estimate-multiplier 300
```

Note the transaction hash it prints.

### 3 · Wait for attestation, then take the proof

```bash
cd .. && node --experimental-strip-types scripts/prove-tx.ts 1 <txHash>
```

Polls until the block is attested (~8 min), fetches the Merkle + continuity
proof, verifies it against the precompile, and writes the fixture.

### 4 · Settle

```bash
cd contracts && forge script script/ResolveMarket.s.sol --account crux-deployer \
  --rpc-url cc3_testnet --broadcast --gas-estimate-multiplier 300
```

The resolver verifies the proof on the precompile, decodes the transaction,
checks the receipt succeeded, matches the log against the market's `AttestSpec`,
and settles. Nobody reported anything.

---

## Timing, honestly

A full cycle is roughly **45–60 minutes**, and that is inherent rather than
sloppy:

| Stage | Duration | Why |
|---|---|---|
| trading open | ~5 min | our choice |
| trading close → window opens | ~30 min | `LAG_BUFFER_BLOCKS = 150` (R3) |
| event → attested | ~8 min | checkpoints every 10 blocks, ~38-45 behind head |
| proof + settle | ~1 s + ~250 ms | measured |

The 30-minute buffer is the R3 correction, not padding. A market's outcome is
fixed by the *first* matching event anywhere in its window, so trading must be
closed before the window opens — and the attestation lag means the on-chain
clock is itself ~8 minutes stale. 150 blocks gives ~3× margin over the worst
lag we have measured.

`LAG_BUFFER_BLOCKS` is a **minimum**, so real markets can run far longer
windows. For a live demo, the honest framing is D9: don't hide the latency,
make the resolution the spectacle. The game loop runs on Creditcoin's 15s
blocks and feels instant; the truth loop runs at Ethereum's pace and feels
weighty.
