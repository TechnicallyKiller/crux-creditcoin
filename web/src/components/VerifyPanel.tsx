import { useState } from 'react';
import { reverify, PUBLIC_RPCS, PROVER, type VerifyResult, type Step } from '../lib/verify';
import { VerificationMark, Seal } from './Engraving';
import { CHAIN_NAMES } from '../lib/chain';
import { commas } from '../lib/format';

/** A real Chainlink ETH/USD update, kept as a starting point people can run. */
const SAMPLE = {
  chainKey: 3,
  tx: '0xbc38ccea67d7c028f9d4275e11f377443d44d4fc0480261c6d4e19c5f2d07777',
};

/**
 * Prove an Ethereum transaction from the viewer's own browser.
 *
 * Two calls, neither of them to a server we operate: fetch the proof from the
 * public Attestcoin prover, then eth_call the precompile on a public Creditcoin
 * RPC. Verification is a free staticcall, so this costs nothing and needs no
 * wallet — which is what lets a sceptic check the claim instead of taking it.
 *
 * The transaction hash is an input on purpose. Anyone can paste a hash we have
 * never seen and watch Creditcoin prove it, which is a far stronger thing to
 * offer than replaying a result we chose.
 */
export function VerifyPanel({
  chainKey: fixedChain, txHash: fixedTx, compact = false,
}: { chainKey?: number; txHash?: string; compact?: boolean }) {
  const [chainKey, setChainKey] = useState(fixedChain ?? SAMPLE.chainKey);
  const [tx, setTx] = useState(fixedTx ?? SAMPLE.tx);
  const [step, setStep] = useState<Step>('idle');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rpc, setRpc] = useState(PUBLIC_RPCS[0]);

  const run = async () => {
    setErr(null);
    setResult(null);
    try {
      setResult(await reverify(chainKey, tx.trim(), setStep, rpc));
    } catch (e) {
      setStep('failed');
      setErr((e as Error).message ?? String(e));
    }
  };

  const busy = step === 'fetching' || step === 'verifying';
  const proven = result?.ok === true;

  return (
    <div style={{
      border: `1px solid ${proven ? 'var(--lime)' : 'var(--indigo-rule)'}`,
      background: 'var(--indigo-ink)', padding: compact ? 16 : 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div className="legend" style={{ color: proven ? 'var(--lime)' : 'var(--indigo-mute)', letterSpacing: 2.8 }}>
          VERIFY IN YOUR OWN BROWSER
        </div>
        <div style={{ font: '400 8px/1 var(--mono)', color: 'var(--indigo-mute)' }}>FREE · NO WALLET</div>
      </div>

      <div style={{ font: '400 11px/1.6 var(--sans)', color: 'var(--indigo-soft)', marginTop: 10 }}>
        Paste any transaction from a chain Creditcoin attests. Your browser fetches the proof
        from the public prover and asks the precompile directly — nothing here touches a server of ours.
      </div>

      {!fixedTx && (
        <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
          {[3, 1].map((k) => (
            <button key={k} onClick={() => setChainKey(k)} style={{
              padding: '7px 10px', font: '500 8px/1 var(--sans)', letterSpacing: 1.6,
              border: `1px solid ${chainKey === k ? 'var(--vellum)' : 'var(--indigo-rule)'}`,
              color: chainKey === k ? 'var(--vellum)' : 'var(--indigo-mute)',
            }}>{CHAIN_NAMES[k]}</button>
          ))}
        </div>
      )}

      {!fixedTx && (
        <input
          value={tx}
          onChange={(e) => setTx(e.target.value)}
          spellCheck={false}
          placeholder="0x…"
          style={{
            width: '100%', marginTop: 8, padding: '11px 12px', background: 'var(--indigo-abyss)',
            border: '1px solid var(--indigo-rule)', color: 'var(--vellum)',
            font: '400 10px/1.4 var(--mono)', outline: 'none',
          }}
        />
      )}

      <button
        onClick={run}
        disabled={busy || !tx.trim()}
        style={{
          width: '100%', marginTop: 10, padding: '14px 0', textAlign: 'center',
          border: `1px solid ${proven ? 'var(--lime)' : 'var(--vellum)'}`,
          background: proven ? 'var(--lime)' : busy ? 'transparent' : 'var(--vellum)',
          color: proven ? 'var(--indigo-abyss)' : busy ? 'var(--indigo-soft)' : 'var(--vellum-ink)',
          font: '600 11px/1 var(--sans)', letterSpacing: 2.6, opacity: busy ? 0.7 : 1,
        }}
      >
        {step === 'fetching' ? 'FETCHING PROOF…'
          : step === 'verifying' ? 'ASKING THE PRECOMPILE…'
          : proven ? '✦ PROVEN — RUN AGAIN' : 'PROVE IT'}
      </button>

      {/* the two calls, shown as they happen */}
      <div style={{ marginTop: 14, font: '400 9px/1.9 var(--mono)', color: 'var(--indigo-soft)' }}>
        {[
          { on: step !== 'idle', label: `GET ${new URL(PROVER).host}`, done: !!result, ms: result?.fetchMs },
          { on: step === 'verifying' || !!result, label: `eth_call ${new URL(rpc).host}`, done: !!result, ms: result?.verifyMs },
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', opacity: s.on ? 1 : 0.35 }}>
            <span>
              <span style={{ color: s.done ? (proven ? 'var(--lime)' : 'var(--bronze)') : 'var(--indigo-mute)' }}>
                {s.done ? '✓' : s.on ? '·' : ' '}
              </span>{' '}{s.label}
            </span>
            <span>{s.ms !== undefined ? `${s.ms} ms` : ''}</span>
          </div>
        ))}
      </div>

      {result && (
        <div className="fade-in" style={{
          marginTop: 14, borderTop: `1px solid ${proven ? 'var(--lime-deep)' : 'var(--indigo-rule)'}`, paddingTop: 14,
        }}>
          {proven ? (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <Seal size={compact ? 96 : 118} striking ms={result.verifyMs} />
              <div style={{ flex: 1, font: '400 9px/1.9 var(--mono)', color: 'var(--indigo-soft)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--indigo-mute)' }}>SOURCE BLOCK</span>
                  <span>{commas(result.proof!.headerNumber)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--indigo-mute)' }}>PROOF</span>
                  <span>{result.siblings} SIBLINGS · {result.roots} ROOTS</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--indigo-mute)' }}>CALLDATA</span>
                  <span>{commas(result.bytes)} B</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--indigo-mute)' }}>OUR SERVERS INVOLVED</span>
                  <span style={{ color: 'var(--lime)' }}>0</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <VerificationMark progress={0.2} size={30} strokeWidth={1} />
              <div>
                <div style={{ font: '600 11px/1.4 var(--sans)', letterSpacing: 1.4, color: 'var(--crit)' }}>
                  NOT PROVEN
                </div>
                <div style={{ font: '400 9.5px/1.6 var(--mono)', color: 'var(--indigo-soft)', marginTop: 6 }}>
                  {result.detail}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {err && (
        <div style={{ marginTop: 12, font: '400 9.5px/1.6 var(--mono)', color: 'var(--crit)' }}>{err}</div>
      )}

      {/* substitute the endpoint — the point is that you do not have to trust ours */}
      <div style={{ marginTop: 14, borderTop: '1px solid var(--indigo-rule)', paddingTop: 10 }}>
        <div className="legend" style={{ color: 'var(--indigo-mute)', letterSpacing: 2.2 }}>ENDPOINT — SWAP IT</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
          {PUBLIC_RPCS.map((r) => (
            <button key={r} onClick={() => setRpc(r)} style={{
              textAlign: 'left', font: '400 8.5px/1.5 var(--mono)',
              color: rpc === r ? 'var(--vellum)' : 'var(--indigo-mute)',
            }}>
              {rpc === r ? '●' : '○'} {new URL(r).host}
            </button>
          ))}
        </div>
        <div style={{ font: '400 8.5px/1.5 var(--mono)', color: 'var(--indigo-mute)', marginTop: 8 }}>
          NEITHER IS OPERATED BY US. POINT IT AT YOUR OWN NODE.
        </div>
      </div>
    </div>
  );
}
