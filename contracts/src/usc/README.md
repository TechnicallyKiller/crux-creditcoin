# Vendored Attestcoin contracts

Copied verbatim from [`gluwa/usc-testnet-bridge-examples`](https://github.com/gluwa/usc-testnet-bridge-examples)
(`contracts/sol/`) — **not** from `@gluwa/usc-contracts`, and the difference matters.

The npm package `@gluwa/usc-contracts@0.1.2` ships a deliberately "lean" copy of
`INativeQueryVerifier` exposing only:

    function verify(...) external view returns (bool);   // reverts on failure

`USCBase` needs two members that copy does **not** have:

    function verifyAndEmit(...) external returns (bool);  // non-view, emits
    function calculateTxIndex(MerkleProof) external view returns (uint64);

Hence the vendoring. Keep `VerifierInterface.sol` byte-identical with upstream —
struct layouts are consensus-critical against the precompile.

Note `_computeQueryId` calls `calculateTxIndex` on the precompile, so even
computing a queryId touches native code that has no EVM bytecode. Forked tests
must mock `0x…0FD2`; see `test/Precompile.t.sol`.
