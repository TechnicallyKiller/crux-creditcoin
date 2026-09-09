import { useEffect, useState } from 'react';
import { Guilloche, Seal, VerificationMark, Microtext } from '../components/Engraving';
import { commas, serial } from '../lib/format';
import { CHAIN_NAMES, ethExplorerTx } from '../lib/chain';
import { stageOf, type Market, type Stage } from '../lib/markets';

const ORDER: Stage[] = ['watching', 'attesting', 'proving', 'proven'];
const MARK_PROGRESS: Record<Stage, number> = {
  watching: 0, attesting: 0.28, proving: 0.84, proven: 1, void: 0,
};

/**
 * The resolution moment.
 *
 * Four states, because the middle two are the ones nobody else can show. An
 * oracle-based market has only "unknown" and "someone said": it has no way to
 * express *the answer exists and is in flight*, because it has no proof
 * pipeline to be mid-flight in.
 */
export function ProofDrop({ market, onBack }: { market: Market; onBack: () => void }) {
  const live = stageOf(market);
  const [stage, setStage] = useState<Stage>(live === 'void' ? 'proven' : live);
  const [striking, setStriking] = useState(false);

  useEffect(() => {
    if (stage === 'proven') {
      setStriking(true);
      const t = setTimeout(() => setStriking(false), 600);
      return () => clearTimeout(t);
    }
  }, [stage]);

  const spec = market.spec;
  const isVoid = live === 'void';
  const proven = stage === 'proven';

  const elapsed = spec ? Math.max(0, Math.min(spec.toBlock, market.attested) - spec.fromBlock) : 0;
  const total = spec ? spec.toBlock - spec.fromBlock : 1;

  return (
    <div className="scroll" style={{ position: 'relative' }}>
      {proven && (
        <Guilloche seed={`CRUX-${String(market.id).padStart(6, '0')}`} size={620}
          opacity={0.06} stroke="var(--lime)" style={{ left: -115, top: 60 }} />
      )}

      <div style={{
        padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid var(--indigo-rule)', position: 'relative',
      }}>
        <button onClick={onBack} style={{ font: '400 11px/1 var(--sans)', color: 'var(--indigo-soft)' }}>← Feed</button>
        <span style={{ font: '500 9px/1 var(--mono)', letterSpacing: 1.2, color: 'var(--indigo-soft)' }}>
          {serial(market.id)}
        </span>
        <span className="legend" style={{ color: proven ? 'var(--lime)' : 'var(--bronze)', letterSpacing: 2.2 }}>
          {isVoid && stage === 'proven' ? 'VOID' : `STATE ${ORDER.indexOf(stage) + 1} · ${stage.toUpperCase()}`}
        </span>
      </div>

      <div style={{ padding: '28px 22px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
        <div style={{ position: 'relative', width: 206, height: 206, display: 'grid', placeItems: 'center' }}>
          <div style={{ position: 'absolute' }}>
            <VerificationMark progress={MARK_PROGRESS[stage]} proven={proven} size={206} strokeWidth={0.45} rings={!proven} />
          </div>
          {proven ? (
            <Seal size={150} striking={striking} />
          ) : (
            <div style={{ textAlign: 'center', position: 'relative' }}>
              <div className="legend" style={{ color: 'var(--bronze)', letterSpacing: 3 }}>
                {stage === 'watching' ? 'PLATE BLANK' : stage === 'attesting' ? 'EVENT SIGHTED' : 'PATH DRAWING'}
              </div>
              <div style={{ font: '400 8px/1.6 var(--mono)', color: 'var(--indigo-mute)', marginTop: 8 }}>
                {stage === 'watching' ? <>NO ANSWER<br />EXISTS YET</>
                  : stage === 'attesting' ? <>NOT YET<br />ATTESTED</>
                  : <>SUBMITTING TO<br />PRECOMPILE</>}
              </div>
            </div>
          )}
        </div>

        {proven ? (
          <div className="fade-in" style={{ textAlign: 'center', marginTop: 16 }}>
            <div className="legend" style={{ color: 'var(--lime-deep)', letterSpacing: 3.4 }}>
              {CHAIN_NAMES[market.chainKey]} {spec && `· BLOCKS ${commas(spec.fromBlock)}–${commas(spec.toBlock)}`}
            </div>
            <div className="proposition" style={{ fontSize: 24, color: 'var(--vellum)', marginTop: 16 }}>
              {isVoid ? 'Absence, established by time.' : 'The market settled itself.'}
            </div>
          </div>
        ) : (
          <div className="proposition" style={{ fontSize: 23, color: 'var(--vellum)', textAlign: 'center', marginTop: 22 }}>
            {stage === 'watching' && 'The window is open. Ethereum has not yet said anything that settles this.'}
            {stage === 'attesting' && 'It happened on Ethereum. Creditcoin has not attested the block yet.'}
            {stage === 'proving' && 'The window is closed. The proof is being drawn.'}
          </div>
        )}

        {stage === 'attesting' && (
          <div style={{ font: '400 10px/1.6 var(--sans)', color: 'var(--indigo-soft)', textAlign: 'center', marginTop: 12, maxWidth: 300 }}>
            This is <em>pending</em>, not unknown. The answer is fixed; the proof is in flight.
          </div>
        )}

        {/* observation window */}
        {spec && (
          <div style={{ width: '100%', marginTop: 24, border: '1px solid var(--indigo-rule)', background: 'var(--indigo-ink)', padding: 16 }}>
            <div className="legend" style={{ color: 'var(--indigo-mute)', letterSpacing: 2.8 }}>
              OBSERVATION WINDOW · {CHAIN_NAMES[market.chainKey]}
            </div>
            <div style={{
              position: 'relative', height: 26, marginTop: 14,
              borderLeft: '1px solid var(--bronze)', borderRight: '1px solid var(--bronze)',
            }}>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(90deg, var(--indigo-rule) 0 0.8px, transparent 0.8px 5px)' }} />
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${Math.min(100, (elapsed / total) * 100).toFixed(1)}%`,
                backgroundImage: `repeating-linear-gradient(90deg, ${proven ? 'var(--lime)' : 'var(--bronze)'} 0 0.8px, transparent 0.8px 3px)`,
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', font: '400 8.5px/1.5 var(--mono)', color: 'var(--indigo-soft)', marginTop: 8 }}>
              <span>{commas(spec.fromBlock)}<br />OPEN</span>
              <span style={{ color: 'var(--bronze)', textAlign: 'center' }}>{commas(market.attested)}<br />ATTESTED</span>
              <span style={{ textAlign: 'right' }}>{commas(spec.toBlock)}<br />CLOSE</span>
            </div>
            <div style={{ font: '400 9px/1.7 var(--mono)', color: 'var(--indigo-mute)', marginTop: 14, borderTop: '1px solid var(--indigo-rule)', paddingTop: 12 }}>
              {commas(elapsed)} / {commas(total)} BLOCKS ATTESTED<br />
              WATCHING topic0 {spec.topic0.slice(0, 10)}…<br />
              ON {spec.emitter}
            </div>
          </div>
        )}

        {/* the browser re-verifies, and that is the whole trust argument */}
        {proven && !isVoid && (
          <div className="fade-in" style={{
            width: '100%', marginTop: 20, border: '1px solid var(--lime)', padding: '14px 15px',
            display: 'flex', gap: 12, alignItems: 'flex-start',
          }}>
            <VerificationMark progress={1} proven size={30} strokeWidth={1} />
            <div>
              <div style={{ font: '500 13px/1.45 var(--sans)', color: 'var(--lime)' }}>
                Re-verified in your browser — trusting neither our servers nor us.
              </div>
              <div style={{ font: '400 8.5px/1.6 var(--mono)', color: 'var(--indigo-soft)', marginTop: 7 }}>
                eth_call → 0x…0FD2 · FREE STATICCALL<br />
                {spec && <a href={ethExplorerTx('', market.chainKey).replace('/tx/', '/address/') + spec.emitter} target="_blank" rel="noreferrer">
                  OPEN THE SOURCE CONTRACT ↗
                </a>}
              </div>
            </div>
          </div>
        )}

        <div style={{ width: '100%', marginTop: 12, font: '400 9px/1.9 var(--mono)', color: 'var(--indigo-soft)', borderTop: '1px solid var(--indigo-rule)', paddingTop: 12 }}>
          {[
            ['SOURCE CHAIN', CHAIN_NAMES[market.chainKey] ?? String(market.chainKey)],
            ['RESOLVER', 'ATTESTCOIN PRECOMPILE'],
            ['DISPUTE WINDOW', 'NONE'],
            ['ADMIN KEY', 'DOES NOT EXIST'],
            ['HUMANS IN THE LOOP', '0'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--indigo-mute)' }}>{k}</span>
              <span style={{ color: k === 'HUMANS IN THE LOOP' && proven ? 'var(--lime)' : undefined }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* state scrubber — lets a viewer walk the four states in a demo */}
      <div style={{ borderTop: '1px solid var(--indigo-rule)', display: 'flex', marginTop: 22 }}>
        {ORDER.map((s, i) => (
          <button key={s} onClick={() => setStage(s)} style={{
            flex: 1, padding: '14px 0 12px', display: 'flex', flexDirection: 'column', gap: 6,
            alignItems: 'center', borderRight: i < 3 ? '1px solid var(--indigo-rule)' : undefined,
            background: stage === s ? 'var(--indigo-ink)' : undefined,
          }}>
            <span style={{
              font: '500 9px/1 var(--sans)', letterSpacing: 1.8,
              color: s === 'proven' ? 'var(--lime)' : 'var(--vellum)',
            }}>{s.toUpperCase()}</span>
            <span style={{
              height: 3, width: '70%',
              backgroundImage: `repeating-linear-gradient(90deg, ${s === 'proven' ? 'var(--lime)' : 'var(--bronze)'} 0 0.8px, transparent 0.8px 3px)`,
              opacity: stage === s ? 1 : 0.35,
            }} />
          </button>
        ))}
      </div>
      <Microtext style={{ padding: 16 }} parts={[`CRUX-${String(market.id).padStart(6, '0')}`, spec?.emitter ?? '', 'ATTESTCOIN']} />
    </div>
  );
}
