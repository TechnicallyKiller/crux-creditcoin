# Brief for the mentoring Q&A page

Two lengths. Post the short one unless the page rewards detail — then post the long one.

---

## SHORT — post this

**CRUX — settlement by cryptographic proof**

Every prediction market dies at the same place: the oracle. Polymarket needs UMA's bonded voters
and a two-hour challenge window. Kalshi needs a CFTC-registered clearinghouse. All of them
ultimately trust a reporter, a committee, or a bonded game.

CRUX doesn't have one. A market states its resolution rule as **data** — which chain, which
contract, which event, which field, which comparison, which block window — and settles against a
**proof that the event actually occurred on Ethereum**, verified by Creditcoin's precompile inside
a single block. No committee, no admin key, no dispute window.

The rule being data rather than code is the part that matters: **no contract is deployed for a new
market.** One audited resolver interprets any spec, so prediction markets are the first application
of a general settlement engine rather than the whole of it.

Live on CC3 testnet, resolving **real Ethereum mainnet** Chainlink prices — not Sepolia mocks.
Creditcoin testnet attests mainnet, which is why the demo isn't synthetic.

```
CruxMarket   0xA558efC57e25b3bF45927CeeC7543E0831ceCbdC
Resolver     0xa2CD2dCd2cce9402029bbaf9cAe5054f15D42E89
59 tests · a market has settled itself end-to-end, no human in the loop
```

**You can check the whole claim yourself.** Verification is a free staticcall, so the app fetches a
proof from the public prover and asks the precompile directly, from your browser, against endpoints
we don't operate. Paste any mainnet transaction hash we've never seen and watch Creditcoin prove
it.

github.com/TechnicallyKiller/crux-creditcoin

**A question I'd genuinely like a view on:** the proof lane can only resolve questions whose answer
is an Ethereum event. That's a real constraint — the highest-volume prediction markets (sports,
politics) aren't on-chain at all. My answer is to treat markets as one application of a general
engine, where the same primitive settles escrow, conditional payments or insurance on proven
foreign-chain facts. Is that the right framing for the Creditcoin ecosystem, or is there a
higher-value first application I'm walking past?

---

## LONG — if the page rewards detail

**CRUX — settlement by cryptographic proof**

**The problem.** Every prediction market dies at the oracle. Polymarket needs UMA's optimistic
oracle — bonds, disputes, a two-hour challenge window, token-holders voting. Kalshi needs a
CFTC-registered clearinghouse and a review committee. Azuro needs a data provider plus DAO
arbitration. Every one of them ultimately trusts a reporter, a committee, a regulator, or a bonded
game.

**What CRUX does.** A market's resolution rule is stated as **data**:

```
chain      1 (ethereum mainnet)
address    0x7d4E742018fb52E48b08BE73d041C18B21de6Fb5   Chainlink ETH/USD
topic0     0x0559884f…fc5f                              AnswerUpdated
field      topics[1]  int256
predicate  GT 190300000000
fromBlock  25894845
toBlock    25895445
```

Ten fields. Attestcoin proves the transaction happened on Ethereum; `EvmV1Decoder` reads what it
said; the resolver checks the spec and settles. Verified by a native precompile inside one
Creditcoin block. **No contract is deployed for a new market** — one audited resolver interprets
any spec.

YES is provable by a single proof. NO is established by the observation window becoming fully
attested with nothing matching in it — absence proven by time rather than asserted by anyone.

**Why it's an engine, not a market.** The same primitive settles anything on a proven foreign-chain
fact. `CruxBeacon` extends it further: Attestcoin can prove transactions and logs but never storage
slots, so the beacon `staticcall`s any contract and emits what it read — making any `view`-readable
EVM state attestable. Prediction markets are the demo because the oracle problem makes the value
obvious in ten seconds.

**Where it is.** Deployed on CC3 testnet, 59 tests green, full app (swipe feed, trading, portfolio,
soulbound calibration scoring, market issuance). A market has settled itself end-to-end from a real
mainnet Chainlink update, with no human anywhere in the loop.

**Four things we found that the docs don't say**, all pinned by tests:

1. **Inclusion is not success.** The precompile proves a transaction was *included*, not that it
   *succeeded*. We proved a real mainnet transaction that **reverted** and got `TRUE` back. Without
   a `receiptStatus == 1` guard, an attacker resolves any market with a transaction they know will
   fail.
2. **Proofs expire.** A continuity proof must chain to the *current* attestation, so a stale proof
   is invalid, not merely costlier. Same transaction: 5 continuity roots four days ago → rejected;
   65 roots regenerated → `TRUE`.
3. **Absence settlement is front-runnable.** Settling NO can't require a proof, since absence isn't
   provable — but a NO holder is rationally motivated to close the market the instant the window is
   attested and win one the chain can prove they lost. Needs a grace period.
4. **One event must settle many markets.** `USCBase` keys replay protection on the transaction
   alone, but one Chainlink update legitimately resolves "ETH above $2,000?", "above $2,400?" and
   "above $2,500?" at once. Under that scheme the first consumes the transaction and the rest become
   permanently unresolvable.

**Verify any of it yourself.** Verification is a free staticcall, so the app fetches a proof from
the public prover and calls the precompile from your browser, against endpoints we don't operate —
and the transaction hash is an input, so you can paste one we've never seen.

github.com/TechnicallyKiller/crux-creditcoin

**Question for mentors.** The proof lane can only resolve questions whose answer is an Ethereum
event, and the highest-volume prediction markets — sports, politics — aren't on-chain. My answer is
to treat markets as one application of a general settlement engine. Is that the right framing for
this ecosystem, or is there a higher-value first application for "any contract settling on a proven
foreign-chain fact" that I'm walking past?
