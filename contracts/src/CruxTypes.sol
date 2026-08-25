// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @notice Which guarantee a market carries. Surfaced in the UI so a user
///         always knows what they are trusting.
enum Lane {
    PROOF, // resolved by Attestcoin cryptographic proof. No dispute window.
    AI     // resolved by a bonded AI proposer with a challenge window.
}

/// @notice Where in a log the comparison operand lives.
enum Extract {
    TOPIC,     // an indexed topic, topics[extractIndex], index 1..3
    DATA_WORD  // a 32-byte word at data[extractIndex * 32 ...]
}

enum Comparator {
    GT,
    GTE,
    LT,
    LTE,
    EQ,
    EXISTS // the log merely occurring is the outcome; threshold ignored
}

/**
 * @notice A market's resolution rule, expressed as data rather than code.
 *
 * This is the core of CRUX: one audited resolver interprets any spec, so new
 * market types need no new contracts and no new deployment. A spec says
 * "watch for THIS event, from THIS contract, in THIS block window, pull THIS
 * field out, compare it THIS way".
 *
 * The window is a source-chain block range, and the predicate is EXISTS-shaped:
 * YES is provable by a single matching proof, and NO is established by the mere
 * passage of attested time once `toBlock` is behind the attested height. That
 * asymmetry is what makes resolution cheap in both directions.
 */
struct AttestSpec {
    uint64 chainKey;      // 3 = Ethereum mainnet, 1 = Sepolia
    address emitter;      // the log MUST originate here; see note below
    bytes32 topic0;       // event signature hash
    Extract extractMode;
    uint8 extractIndex;   // topic index 1..3, or word offset into data
    Comparator cmp;
    int256 threshold;
    uint64 fromBlock;     // observation window, inclusive, source-chain heights
    uint64 toBlock;       // inclusive
}

/**
 * @dev A note on `emitter`, because it is the subtle one.
 *
 * `topic0` alone is NOT a sufficient match. Event signatures are global and
 * unowned: anyone can deploy a contract that emits `AnswerUpdated` with any
 * values they like, get it included on mainnet, and hand the resolver a
 * perfectly valid proof of a perfectly real transaction. The proof would
 * verify, because the transaction genuinely happened.
 *
 * Pinning the emitting address is what makes the claim mean anything. Without
 * it, "prove a Chainlink price update" degrades to "prove SOMEBODY emitted a
 * number", which is not a market, it is a suggestion box.
 */
