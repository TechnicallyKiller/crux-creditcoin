# Submission fields

Copy-paste ready. Everything here is checkable against the chain.

---

## Project Name

CRUX

## Project Sector

DeFi (primary) · AI (secondary)

## Project Description

CRUX is a settlement engine on Creditcoin. A contract states its resolution rule as **data** —
which chain, which contract, which event, which field, which comparison, which block window — and
CRUX settles it against a cryptographic proof that the event actually occurred on Ethereum,
verified by a native precompile inside a single Creditcoin block. No oracle, no committee, no admin
key, no dispute window.

Its first application is prediction markets that settle themselves. Every prediction market in
existence dies at the same place: Polymarket needs UMA's bonded voters and a two-hour challenge
window, Kalshi needs a CFTC-registered clearinghouse, Azuro needs a data provider plus DAO
arbitration. All of them ultimately trust a reporter, a committee, or a bonded game. CRUX doesn't
have one, because the answer is a proof and you cannot dispute mathematics.

Because the rule is data rather than code, **no contract is deployed for a new market**. One
audited resolver interprets any spec, which makes prediction markets one application of a general
primitive rather than the whole of it — the same engine settles escrow, conditional payments or
insurance on any proven foreign-chain fact.

Deployed on Creditcoin CC3 testnet and resolving **real Ethereum mainnet** Chainlink prices, not
Sepolia mocks: Creditcoin testnet attests Ethereum mainnet, which is why the demo isn't synthetic.

## Attestcoin Protocol Integration Summary

Attestcoin is not integrated into CRUX; it *is* CRUX. Remove it and there is no product — the
markets have no way to know anything and cannot resolve at all.

**Every settlement path calls the protocol.**

- `CruxAttestedResolver` inherits `USCBase` and calls **`verifyAndEmit` on the block-prover
  precompile at `0x…0FD2`** on every proof-lane settlement. A market cannot settle YES without a
  verified Merkle + continuity proof.
- **`EvmV1Decoder`** decodes the attested transaction: `getTransactionType`,
  `isValidTransactionType`, `decodeReceiptFields`, and `getLogsByEventSignature` to match the log,
  then field extraction from an indexed topic or a 32-byte data word.
- **`USCBase`** provides verify-then-dispatch and replay protection, widened to per-market
  granularity (see below).
- **`get_latest_attestation_height_and_hash`** on the ChainInfo precompile drives two things: the
  trading gate, and NO-settlement — a market settles NO when its observation window is fully
  attested with no qualifying event, so absence is established by attested time rather than
  asserted by anyone.
- Both **`chainKey 3` (Ethereum mainnet)** and **`chainKey 1` (Sepolia)** are used in production
  paths, not just registered.
- **`CruxBeacon`** on Sepolia extends the protocol's reach: Attestcoin can prove transactions and
  logs but never storage slots, so the beacon `staticcall`s any contract and emits what it read,
  making any `view`-readable EVM state attestable.
- The app **re-verifies proofs client-side** via the precompile, because `verify` is a free
  staticcall — so a user trusts neither our servers nor us.

**Four protocol findings, each pinned by a test:**

1. **Inclusion is not success.** The precompile proves a transaction was *included*, not that it
   *succeeded*. We proved a real mainnet transaction that reverted (`0xc3ab8c0e…1023`) and got
   `TRUE`. Without `receiptStatus == 1`, an attacker resolves any market with a transaction they
   know will fail.
2. **Proofs expire.** A continuity proof must chain to the *current* committed attestation, so a
   stale proof is invalid rather than merely costlier. Same transaction: 5 continuity roots four
   days old → rejected; 65 roots regenerated → `TRUE`.
3. **Absence settlement is front-runnable.** Settling NO cannot require a proof, but a NO holder is
   rationally motivated to close the market the instant its window is attested and win one the
   chain can prove they lost. A grace period guarantees a proof-holder time to land it.
4. **One event must settle many markets.** `USCBase` keys replay protection on the transaction
   alone, but a single Chainlink update legitimately resolves several thresholds at once. Under
   that scheme the first resolution consumes the transaction and the rest become permanently
   unresolvable. CRUX binds the market into the key.

## GitHub Repository URL

https://github.com/TechnicallyKiller/crux-creditcoin

## Deployed contracts — Creditcoin CC3 testnet (102031)

```
CruxMarket            0xA558efC57e25b3bF45927CeeC7543E0831ceCbdC
CruxAttestedResolver  0xa2CD2dCd2cce9402029bbaf9cAe5054f15D42E89
CruxScore             0xFFB272EfF1fF82C05a74015e5e6c49900405d81E
CruxBeacon (Sepolia)  0x0F1bf92EE0C79F7Ca5C1e30E9412aD5BFF45c7C8
```

## Verify the central claim yourself

Verification on Creditcoin is a free staticcall, so nothing here has to be taken on trust:

```bash
node --experimental-strip-types scripts/prove-tx.ts 3 <any-ethereum-mainnet-tx-hash>
```

The app does the same from the browser, with the transaction hash as an input.

---

## Still to fill in

- [ ] Project logo URL
- [ ] Demo video URL
- [ ] Deck / whitepaper PDF URL
- [ ] Hosted app URL
- [ ] Team: name, email, bio, role, country of residence, country of citizenship
