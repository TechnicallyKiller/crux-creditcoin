import { Guilloche, IntaglioBar, Microtext, Perforation, VerificationMark } from './Engraving';
import { serial, commas } from '../lib/format';
import { CHAIN_NAMES } from '../lib/chain';
import { stageOf, type Market } from '../lib/markets';

const STAGE_LABEL: Record<string, { text: string; colour: string; progress: number }> = {
  watching:  { text: 'UNPROVEN · WINDOW OPEN', colour: 'var(--vellum-ink)', progress: 0 },
  attesting: { text: 'EVENT SIGHTED · ATTESTING', colour: 'var(--bronze-ink)', progress: 0.62 },
  proving:   { text: 'WINDOW CLOSED · AWAITING PROOF', colour: 'var(--bronze-ink)', progress: 0.84 },
  proven:    { text: '✦ PROVEN', colour: 'var(--lime-text)', progress: 1 },
  void:      { text: 'VOID · SETTLED NO', colour: 'var(--vellum-mute)', progress: 0 },
};

/**
 * One market as a bearer instrument.
 *
 * A position in a prediction market IS a certificate — a claim that pays out if
 * a stated condition proves true — so the object and the metaphor are the same
 * thing rather than a costume.
 */
export function Certificate({ market, onOpen, compact = false }: {
  market: Market; onOpen?: () => void; compact?: boolean;
}) {
  const stage = stageOf(market);
  const badge = STAGE_LABEL[stage];
  const isVoid = stage === 'void';
  const proven = stage === 'proven';

  return (
    <div
      onClick={onOpen}
      style={{
        background: isVoid ? 'var(--vellum-sunk)' : 'var(--vellum)',
        border: proven ? '1.5px solid var(--lime-deep)' : '1px solid var(--vellum-ink)',
        position: 'relative', overflow: 'hidden', height: '100%',
        display: 'flex', flexDirection: 'column',
        cursor: onOpen ? 'pointer' : 'default',
        opacity: isVoid ? 0.88 : 1,
      }}
    >
      <div className="plate-edge" style={proven ? { backgroundImage: 'repeating-linear-gradient(90deg, var(--lime-deep) 0 0.6px, transparent 0.6px 2.4px)' } : undefined} />
      <Guilloche seed={`CRUX-${String(market.id).padStart(6, '0')}`} size={420} style={{ left: -20, top: 60 }} />

      {isVoid && (
        <div className="perforation" style={{
          position: 'absolute', left: -60, right: -60, top: 186,
          transform: 'rotate(-13deg)', opacity: 0.85,
        }} />
      )}

      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', padding: compact ? 18 : '20px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ font: '500 9px/1 var(--mono)', letterSpacing: 1.4, color: 'var(--vellum-ink)' }}>
              {serial(market.id)}
            </div>
            <div className="legend" style={{ color: 'var(--vellum-mute)', marginTop: 6 }}>
              SERIES 2026 · BEARER
            </div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            border: `1px solid ${proven ? 'var(--lime-deep)' : 'var(--vellum-ink)'}`,
            background: proven ? 'var(--indigo-abyss)' : 'transparent',
            padding: '5px 8px',
          }}>
            <VerificationMark progress={badge.progress} proven={proven} size={14} strokeWidth={1.2} />
            <span style={{
              font: '600 8px/1 var(--sans)', letterSpacing: 1.4,
              color: proven ? 'var(--lime)' : badge.colour,
            }}>{badge.text}</span>
          </div>
        </div>

        <div className="proposition" style={{
          fontSize: compact ? 21 : 30, lineHeight: 1.13, color: 'var(--vellum-ink)',
          marginTop: compact ? 12 : 24, opacity: isVoid ? 0.82 : 1,
        }}>
          {market.question}
        </div>

        <div style={{ font: '400 9px/1.7 var(--mono)', color: 'var(--vellum-body)', marginTop: 14 }}>
          {CHAIN_NAMES[market.chainKey] ?? `CHAINKEY ${market.chainKey}`}
          {market.spec && <><br />EMITTER {market.spec.emitter.slice(0, 6)}…{market.spec.emitter.slice(-4)}</>}
        </div>

        {!compact && (
          <>
            <Perforation style={{ margin: '20px -20px 0' }} />
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div className="legend" style={{ color: 'var(--vellum-mute)' }}>IMPLIED PROBABILITY</div>
                <div style={{ font: '400 9px/1 var(--mono)', color: 'var(--vellum-mute)' }}>
                  LMSR · b={(Number(market.b) / 1e18).toFixed(0)}
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <IntaglioBar yes={market.priceYes} />
              </div>
            </div>

            {market.spec && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', marginTop: 20,
                borderTop: '1px solid var(--vellum-ink)', paddingTop: 12,
              }}>
                <div>
                  <div className="legend" style={{ color: 'var(--vellum-mute)' }}>OBSERVATION WINDOW</div>
                  <div style={{ font: '400 10px/1.4 var(--mono)', color: 'var(--vellum-ink)', marginTop: 5 }}>
                    {commas(market.spec.fromBlock)} – {commas(market.spec.toBlock)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="legend" style={{ color: 'var(--vellum-mute)' }}>ATTESTED</div>
                  <div style={{ font: '400 10px/1.4 var(--mono)', color: 'var(--vellum-ink)', marginTop: 5 }}>
                    {commas(market.attested)}
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop: 'auto', paddingBottom: 10 }}>
              <Microtext
                colour="var(--vellum-ink)"
                style={{ opacity: 0.5 }}
                parts={market.spec
                  ? [`TOPIC0·${market.spec.topic0.slice(0, 10)}…`, `SERIAL·CRUX-${String(market.id).padStart(6, '0')}`]
                  : [`SERIAL·CRUX-${String(market.id).padStart(6, '0')}`]}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
