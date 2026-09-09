import { useRef, useState } from 'react';
import { Certificate } from '../components/Certificate';
import { Microtext } from '../components/Engraving';
import { ADDRESSES } from '../lib/chain';
import type { Market } from '../lib/markets';

const STAKES = [5, 25, 100];
const COMMIT_PX = 78;

/**
 * The swipe feed.
 *
 * The drag is driven by mutating the card's transform through a ref rather than
 * by React state. Re-rendering the certificate — guilloche SVG and all — on
 * every pointermove drops frames badly, and a swipe that stutters makes the
 * whole product feel cheap. State is committed once, on release.
 */
export function Feed({ markets, onOpen }: { markets: Market[]; onOpen: (m: Market) => void }) {
  const [index, setIndex] = useState(0);
  const [stake, setStake] = useState(25);
  const [confirmed, setConfirmed] = useState<null | { side: 'YES' | 'NO'; market: Market }>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const yesRef = useRef<HTMLDivElement>(null);
  const noRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const dragging = useRef(false);
  const dx = useRef(0);

  const market = markets[index];

  const paint = (x: number) => {
    if (cardRef.current) {
      cardRef.current.style.transform = `translateX(${x}px) rotate(${(x * 0.035).toFixed(2)}deg)`;
    }
    if (yesRef.current) yesRef.current.style.opacity = String(Math.max(0, Math.min(1, x / 70)));
    if (noRef.current) noRef.current.style.opacity = String(Math.max(0, Math.min(1, -x / 70)));
  };

  const onDown = (e: React.PointerEvent) => {
    if (!market) return;
    dragging.current = true;
    startX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (cardRef.current) cardRef.current.style.transition = 'none';
  };

  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dx.current = e.clientX - startX.current;
    paint(dx.current);
  };

  const onUp = () => {
    if (!dragging.current || !market) return;
    dragging.current = false;
    const x = dx.current;
    dx.current = 0;

    if (cardRef.current) cardRef.current.style.transition = 'transform .28s cubic-bezier(.2,.9,.2,1)';

    if (Math.abs(x) > COMMIT_PX) {
      const side = x > 0 ? 'YES' : 'NO';
      paint(x > 0 ? 700 : -700);
      setConfirmed({ side, market });
      setTimeout(() => {
        setConfirmed(null);
        setIndex((i) => (i + 1) % Math.max(1, markets.length));
        if (cardRef.current) cardRef.current.style.transition = 'none';
        paint(0);
      }, 1900);
    } else {
      paint(0);
    }
  };

  if (!market) {
    return (
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 30, textAlign: 'center' }}>
        <div>
          <div className="legend" style={{ color: 'var(--indigo-mute)' }}>NO INSTRUMENTS ISSUED</div>
          <div className="proposition" style={{ fontSize: 24, marginTop: 14, color: 'var(--vellum)' }}>
            The plate is blank.
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* minHeight is a floor, not a preference: if this ever lands in a
          container that is not a bounded flex column, flex:1 resolves to zero
          and the card disappears rather than merely shrinking. */}
      <div style={{ flex: 1, position: 'relative', margin: '0 14px', minHeight: 520 }}>
        {/* the stack beneath — two more plates waiting */}
        <div style={{ position: 'absolute', left: 10, right: 10, top: 8, bottom: 14, border: '1px solid var(--indigo-rule)', background: 'var(--indigo-ink)' }} />
        <div style={{ position: 'absolute', left: 5, right: 5, top: 4, bottom: 14, border: '1px solid var(--indigo-rule)', background: 'var(--indigo-raised)' }} />

        {/* what shows underneath while dragging: the ledger plate about to be struck */}
        <div style={{
          position: 'absolute', inset: 0, bottom: 14, background: 'var(--indigo-raised)',
          border: '1px solid var(--bronze)', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', padding: '0 24px',
        }}>
          <div className="legend" style={{ color: 'var(--bronze)', letterSpacing: 3 }}>
            LEDGER PLATE · STRUCK ON RELEASE
          </div>
          <div style={{ font: '400 12px/2 var(--mono)', color: 'var(--indigo-soft)', marginTop: 14 }}>
            STAKE&nbsp;&nbsp;&nbsp;&nbsp;{stake.toFixed(2)} tCTC<br />
            PRICE&nbsp;&nbsp;&nbsp;&nbsp;{market.priceYes.toFixed(3)} YES<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{(1 - market.priceYes).toFixed(3)} NO
          </div>
          <div style={{
            font: '400 9px/1.7 var(--mono)', color: 'var(--indigo-mute)', marginTop: 16,
            borderTop: '1px solid var(--indigo-rule)', paddingTop: 12,
          }}>
            CREDITCOIN CC3 · 15s BLOCKS<br />SETTLES ONLY ON PROOF
          </div>
        </div>

        <div
          ref={cardRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{
            position: 'absolute', inset: 0, bottom: 14, touchAction: 'pan-y',
            cursor: 'grab', boxShadow: '0 18px 40px rgba(0,0,0,.45)', willChange: 'transform',
          }}
        >
          <Certificate market={market} onOpen={() => Math.abs(dx.current) < 4 && onOpen(market)} />
          <div ref={yesRef} style={{
            position: 'absolute', left: 22, top: 190, opacity: 0, pointerEvents: 'none',
            border: '2px solid var(--vellum-ink)', padding: '8px 16px', transform: 'rotate(-11deg)',
            background: 'rgba(237,239,227,.86)',
          }}>
            <div style={{ font: '700 30px/1 var(--sans)', letterSpacing: 5, color: 'var(--vellum-ink)' }}>YES</div>
            <div style={{ font: '400 8px/1 var(--mono)', letterSpacing: 1.4, color: 'var(--vellum-ink)', marginTop: 4 }}>
              {stake} tCTC · {market.priceYes.toFixed(2)}
            </div>
          </div>
          <div ref={noRef} style={{
            position: 'absolute', right: 22, top: 190, opacity: 0, pointerEvents: 'none',
            border: '2px solid var(--vellum-ink)', padding: '8px 16px', transform: 'rotate(9deg)',
            background: 'rgba(237,239,227,.86)',
          }}>
            <div style={{
              font: '700 30px/1 var(--sans)', letterSpacing: 5, color: 'var(--vellum-ink)',
              textDecoration: 'line-through', textDecorationThickness: 2,
            }}>NO</div>
            <div style={{ font: '400 8px/1 var(--mono)', letterSpacing: 1.4, color: 'var(--vellum-ink)', marginTop: 4 }}>
              {stake} tCTC · {(1 - market.priceYes).toFixed(2)}
            </div>
          </div>
        </div>

        {confirmed && (
          <div className="fade-in" style={{
            position: 'absolute', inset: 0, bottom: 14, background: 'rgba(11,15,38,.94)',
            border: '1px solid var(--bronze)', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16,
          }}>
            <div className="legend" style={{ color: 'var(--bronze)', letterSpacing: 3.4 }}>
              POSITION WRITTEN · AWAITING PROOF
            </div>
            <div style={{
              border: '1.5px solid var(--bronze)', padding: '14px 26px',
              font: '700 34px/1 var(--sans)', letterSpacing: 6, color: 'var(--bronze)',
            }}>{confirmed.side}</div>
            <div style={{ font: '400 10px/1.8 var(--mono)', color: 'var(--indigo-soft)', textAlign: 'center' }}>
              {stake.toFixed(2)} tCTC · CRUX-{String(confirmed.market.id).padStart(6, '0')}<br />
              DEMO — NOT BROADCAST
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '0 16px 6px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <div className="legend" style={{ color: 'var(--indigo-mute)', letterSpacing: 2.4 }}>STAKE</div>
        <div style={{ display: 'flex', gap: 6, flex: 1 }}>
          {STAKES.map((s) => (
            <button key={s} onClick={() => setStake(s)} style={{
              flex: 1, padding: '9px 0', textAlign: 'center',
              border: `1px solid ${stake === s ? 'var(--bronze)' : 'var(--indigo-rule)'}`,
              font: '400 11px/1 var(--mono)',
              color: stake === s ? 'var(--bronze)' : 'var(--indigo-soft)',
            }}>{s}</button>
          ))}
          <div style={{
            flex: 1, border: '1px solid var(--indigo-rule)', padding: '9px 0', textAlign: 'center',
            font: '400 11px/1 var(--mono)', color: 'var(--indigo-soft)',
          }}>tCTC</div>
        </div>
      </div>
      <div style={{
        padding: '8px 16px 10px', display: 'flex', justifyContent: 'space-between',
        font: '400 9px/1 var(--mono)', color: 'var(--indigo-mute)',
      }}>
        <span>← NO</span><span>↑ SKIP</span><span>TAP FOR DETAIL</span><span>YES →</span>
      </div>
      <Microtext style={{ padding: '0 16px 8px' }} parts={['CRUXMARKET', ADDRESSES.market, 'CRUXATTESTEDRESOLVER', ADDRESSES.resolver]} />
    </>
  );
}
