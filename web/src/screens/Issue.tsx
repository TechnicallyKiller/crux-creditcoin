import { useEffect, useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { parseAbi } from 'viem';
import { Guilloche, Microtext, Perforation, VerificationMark } from '../components/Engraving';
import { ConnectPrompt } from '../components/Connect';
import { ADDRESSES } from '../lib/chain';
import { TEMPLATES, compose, currentPrice, type Draft, type ComposedSpec } from '../lib/issue';
import { commas, tctc } from '../lib/format';

const createAbi = parseAbi([
  'function createMarket((uint64 chainKey, address emitter, bytes32 topic0, uint8 extractMode, uint8 extractIndex, uint8 cmp, int256 threshold, uint64 fromBlock, uint64 toBlock) spec, uint64 closeBlock, uint256 b, string question) payable returns (uint256)',
]);

const WINDOWS = [1, 2, 24, 168];

/**
 * Issue an instrument.
 *
 * The technical heart of the project shows up here: no code is deployed for a
 * new market. The form resolves the aggregator, the event signature and the
 * block window, and hands the resolver ten fields. Somebody who has never seen
 * a topic hash can issue a cryptographically-resolvable market, then expand and
 * read exactly what was issued.
 */
export function Issue({ onIssued }: { onIssued: () => void }) {
  const { address } = useAccount();
  const { writeContract, isPending, data: txHash, error } = useWriteContract();

  const [draft, setDraft] = useState<Draft>({
    template: TEMPLATES[0], direction: 'ABOVE', threshold: 0, windowHours: 2,
  });
  const [spot, setSpot] = useState<number | null>(null);
  const [spec, setSpec] = useState<ComposedSpec | null>(null);
  const [composing, setComposing] = useState(false);
  const [composeErr, setComposeErr] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  // Seed the threshold from the live price, so the first draft is a sensible
  // market rather than a zero.
  useEffect(() => {
    currentPrice(draft.template.proxy, draft.template.decimals)
      .then((p) => {
        setSpot(p);
        setDraft((d) => (d.threshold === 0 ? { ...d, threshold: Math.round(p * 0.95) } : d));
      })
      .catch(() => setSpot(null));
  }, [draft.template]);

  useEffect(() => {
    if (!draft.threshold) return;
    let alive = true;
    setComposing(true);
    setComposeErr(null);
    compose(draft)
      .then((s) => { if (alive) setSpec(s); })
      .catch((e) => { if (alive) setComposeErr((e as Error).message); })
      .finally(() => { if (alive) setComposing(false); });
    return () => { alive = false; };
  }, [draft]);

  if (!address) {
    return <ConnectPrompt
      title="Issuing needs a bearer."
      body="Anyone can issue an instrument, and the issuer earns a share of its fees. Connect to cut a plate."
    />;
  }

  const issue = () => {
    if (!spec) return;
    writeContract({
      address: ADDRESSES.market as `0x${string}`,
      abi: createAbi,
      functionName: 'createMarket',
      args: [
        {
          chainKey: spec.chainKey, emitter: spec.emitter, topic0: spec.topic0,
          extractMode: spec.extractMode, extractIndex: spec.extractIndex,
          cmp: spec.cmp, threshold: spec.threshold,
          fromBlock: spec.fromBlock, toBlock: spec.toBlock,
        },
        spec.closeBlock, spec.b, spec.question,
      ],
      value: spec.subsidy,
    });
  };

  return (
    <div className="scroll">
      <div style={{ padding: 16, borderBottom: '1px solid var(--indigo-rule)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="legend" style={{ color: 'var(--indigo-soft)', letterSpacing: 2.8 }}>ISSUE AN INSTRUMENT</span>
          <span style={{ font: '400 9px/1 var(--mono)', color: 'var(--indigo-mute)' }}>NO CODE DEPLOYED</span>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <div className="legend" style={{ color: 'var(--indigo-mute)', letterSpacing: 2.8 }}>1 · WHAT SHOULD DECIDE IT</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 11 }}>
          {TEMPLATES.map((t) => (
            <button key={t.id} onClick={() => setDraft((d) => ({ ...d, template: t }))} style={{
              border: `1px solid ${draft.template.id === t.id ? 'var(--vellum)' : 'var(--indigo-rule)'}`,
              background: draft.template.id === t.id ? 'var(--vellum)' : 'transparent',
              padding: '11px 13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ font: '500 12px/1 var(--sans)', color: draft.template.id === t.id ? 'var(--vellum-ink)' : 'var(--indigo-soft)' }}>
                {t.label}
              </span>
              <span style={{ font: '400 9px/1 var(--mono)', color: draft.template.id === t.id ? 'var(--vellum-body)' : 'var(--indigo-mute)' }}>
                {t.source}
              </span>
            </button>
          ))}
          <div style={{ font: '400 9.5px/1.6 var(--mono)', color: 'var(--indigo-mute)', marginTop: 4 }}>
            MORE TEMPLATES — LARGE TRANSFERS, DAO EXECUTION, BEACON STATE —<br />USE THE SAME RESOLVER. NOTHING NEW IS DEPLOYED FOR THEM.
          </div>
        </div>

        <div className="legend" style={{ color: 'var(--indigo-mute)', letterSpacing: 2.8, marginTop: 22 }}>2 · THE LEVEL AND THE WINDOW</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
          <div style={{ flex: 1, border: '1px solid var(--indigo-rule)', padding: '10px 12px' }}>
            <div className="legend" style={{ color: 'var(--indigo-mute)', letterSpacing: 1.8 }}>ASSET</div>
            <div style={{ font: '500 15px/1 var(--mono)', color: 'var(--vellum)', marginTop: 7 }}>{draft.template.asset}</div>
          </div>
          <button
            onClick={() => setDraft((d) => ({ ...d, direction: d.direction === 'ABOVE' ? 'BELOW' : 'ABOVE' }))}
            style={{ flex: 1, border: '1px solid var(--indigo-rule)', padding: '10px 12px', textAlign: 'left' }}
          >
            <div className="legend" style={{ color: 'var(--indigo-mute)', letterSpacing: 1.8 }}>DIRECTION ⇄</div>
            <div style={{ font: '500 15px/1 var(--mono)', color: 'var(--vellum)', marginTop: 7 }}>{draft.direction}</div>
          </button>
        </div>

        <div style={{ border: '1px solid var(--vellum)', padding: '12px 14px', marginTop: 8, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span className="legend" style={{ color: 'var(--indigo-soft)', letterSpacing: 1.8 }}>THRESHOLD</span>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span style={{ font: '500 26px/1 var(--mono)', color: 'var(--vellum)' }}>$</span>
            <input
              type="number"
              value={draft.threshold || ''}
              onChange={(e) => setDraft((d) => ({ ...d, threshold: Number(e.target.value) }))}
              style={{
                width: 120, background: 'transparent', border: 'none', outline: 'none', textAlign: 'right',
                font: '500 26px/1 var(--mono)', color: 'var(--vellum)',
              }}
            />
          </div>
        </div>
        {spot !== null && (
          <div style={{ font: '400 9px/1.6 var(--mono)', color: 'var(--indigo-mute)', marginTop: 6 }}>
            SPOT ${spot.toLocaleString(undefined, { maximumFractionDigits: 2 })} · LIVE FROM THE FEED
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {WINDOWS.map((h) => (
            <button key={h} onClick={() => setDraft((d) => ({ ...d, windowHours: h }))} style={{
              flex: 1, border: `1px solid ${draft.windowHours === h ? 'var(--bronze)' : 'var(--indigo-rule)'}`,
              padding: '10px 0', textAlign: 'center', font: '400 10px/1 var(--mono)',
              color: draft.windowHours === h ? 'var(--bronze)' : 'var(--indigo-soft)',
            }}>{h < 24 ? `${h}h` : `${h / 24}d`}</button>
          ))}
        </div>

        {/* the certificate assembling as you fill it in */}
        <div style={{ marginTop: 18, background: 'var(--vellum-sunk)', border: '1px solid var(--vellum-ink)', position: 'relative', overflow: 'hidden' }}>
          <div className="plate-edge" />
          <Guilloche seed={spec ? spec.question : 'unissued'} size={300} opacity={0.1} style={{ right: -80, bottom: -70 }} />
          <div style={{ padding: '16px 16px 15px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="legend" style={{ color: 'var(--vellum-mute)', letterSpacing: 2.6 }}>ASSEMBLING · PREVIEW</div>
              <div style={{ font: '400 8.5px/1 var(--mono)', color: 'var(--vellum-mute)', borderBottom: '1px dashed var(--vellum-mute)' }}>
                N° CRUX-0000__
              </div>
            </div>

            <div className="proposition" style={{ fontSize: 22, lineHeight: 1.18, color: 'var(--vellum-ink)', marginTop: 12 }}>
              {spec?.question ?? (composing ? 'Composing…' : 'Set a level to compose a question.')}
            </div>

            {spec && (
              <>
                <button onClick={() => setShowRaw((v) => !v)} style={{
                  font: '400 9px/1.7 var(--mono)', color: 'var(--vellum-body)', marginTop: 11,
                  borderTop: '1px solid var(--vellum-ink)', paddingTop: 10, width: '100%', textAlign: 'left',
                }}>
                  RESOLVED FOR YOU {showRaw ? '▴' : '▾'}
                </button>
                {showRaw ? (
                  <div style={{ font: '400 9px/1.85 var(--mono)', color: 'var(--vellum-body)', borderLeft: '1px solid var(--vellum-ink)', paddingLeft: 9, marginTop: 8 }}>
                    chain&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{spec.chainKey.toString()} (ethereum mainnet)<br />
                    address&nbsp;&nbsp;&nbsp;&nbsp;{spec.emitter}<br />
                    topic0&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{spec.topic0.slice(0, 18)}… {draft.template.event}<br />
                    field&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;topics[{spec.extractIndex}] int256<br />
                    decimals&nbsp;&nbsp;{draft.template.decimals}<br />
                    predicate&nbsp;{spec.cmp === 0 ? 'GT' : 'LT'} {spec.threshold.toString()}<br />
                    fromBlock&nbsp;{spec.fromBlock.toString()}<br />
                    toBlock&nbsp;&nbsp;&nbsp;{spec.toBlock.toString()}<br />
                    resolver&nbsp;&nbsp;{ADDRESSES.resolver.slice(0, 10)}…<br />
                    collateral tCTC (native)
                  </div>
                ) : (
                  <div style={{ font: '400 9px/1.7 var(--mono)', color: 'var(--vellum-body)', marginTop: 8 }}>
                    AGGREGATOR {spec.emitter.slice(0, 10)}…{spec.emitter.slice(-4)}<br />
                    WINDOW {commas(Number(spec.fromBlock))} – {commas(Number(spec.toBlock))}
                  </div>
                )}
                <div style={{ font: '400 10px/1.5 var(--sans)', color: 'var(--vellum-mute)', marginTop: 10, fontStyle: 'italic' }}>
                  You never had to know any of that. You said “{draft.template.asset.split(' / ')[0]} {draft.direction.toLowerCase()} ${draft.threshold.toLocaleString()} in the next {draft.windowHours < 24 ? `${draft.windowHours} hours` : `${draft.windowHours / 24} days`}”.
                </div>
                <Perforation style={{ margin: '14px -16px 12px' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', font: '400 9px/1.7 var(--mono)', color: 'var(--vellum-body)' }}>
                  <span style={{ color: 'var(--vellum-mute)' }}>SEED LIQUIDITY</span>
                  <span>{tctc(spec.subsidy)} tCTC</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', font: '400 9px/1.7 var(--mono)', color: 'var(--vellum-body)' }}>
                  <span style={{ color: 'var(--vellum-mute)' }}>YOUR FEE SHARE</span>
                  <span>0.50% OF VOLUME</span>
                </div>
                <Microtext colour="var(--vellum-ink)" style={{ opacity: 0.5, marginTop: 12 }}
                  parts={['UNISSUED', spec.emitter, `WINDOW ${spec.fromBlock}-${spec.toBlock}`]} />
              </>
            )}
            {composeErr && <div style={{ font: '400 9.5px/1.6 var(--mono)', color: 'var(--crit)', marginTop: 10 }}>{composeErr}</div>}
          </div>
        </div>

        <button
          onClick={issue}
          disabled={!spec || isPending}
          style={{
            width: '100%', marginTop: 14, border: '1px solid var(--vellum)',
            background: spec && !isPending ? 'var(--vellum)' : 'transparent',
            padding: '16px 0', font: '600 11px/1 var(--sans)', letterSpacing: 2.6,
            color: spec && !isPending ? 'var(--vellum-ink)' : 'var(--indigo-mute)',
          }}
        >
          {isPending ? 'CUTTING THE PLATE…' : spec ? `ISSUE · ${tctc(spec.subsidy)} tCTC` : 'COMPOSING…'}
        </button>

        {txHash && (
          <div className="fade-in" style={{ marginTop: 14, border: '1px solid var(--bronze)', padding: 15 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <VerificationMark progress={0} size={26} strokeWidth={1.2} />
              <div className="legend" style={{ color: 'var(--bronze)', letterSpacing: 2.6 }}>INSTRUMENT ISSUED · UNPROVEN</div>
            </div>
            <div style={{ font: '400 9px/1.7 var(--mono)', color: 'var(--indigo-soft)', marginTop: 10 }}>
              {txHash.slice(0, 18)}…{txHash.slice(-6)}
            </div>
            <button onClick={onIssued} style={{
              width: '100%', marginTop: 12, border: '1px solid var(--indigo-rule)', padding: '12px 0',
              font: '500 10px/1 var(--sans)', letterSpacing: 2.2, color: 'var(--indigo-soft)',
            }}>SEE IT IN THE FEED</button>
          </div>
        )}
        {error && <div style={{ marginTop: 12, font: '400 9.5px/1.6 var(--mono)', color: 'var(--crit)' }}>{error.message.slice(0, 200)}</div>}

        <div style={{ font: '400 9px/1.6 var(--mono)', color: 'var(--indigo-mute)', marginTop: 16, textAlign: 'center' }}>
          THE PLATE IS CUT. IT CANNOT BE ALTERED,<br />NOT BY YOU AND NOT BY US.
        </div>
      </div>
    </div>
  );
}
