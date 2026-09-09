import { useRef, useState } from 'react';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { parseEther } from 'viem';
import { Certificate } from '../components/Certificate';
import { Microtext, VerificationMark } from '../components/Engraving';
import { ADDRESSES, marketAbi } from '../lib/chain';
import { stageOf, type Market } from '../lib/markets';

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
  const [confirmed, setConfirmed] = useState<null | {
    side: 'YES' | 'NO'; market: Market; state: 'signing' | 'pending' | 'done' | 'failed';
    hash?: `0x${string}`; error?: string; shares?: number;
  }>(null);

  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  /**
   * Place the bet the swipe just described.
   *
   * The stake is in tCTC but the contract buys SHARES, so the share count is
   * derived from the live price. The quote is then taken for real and sent as
   * value: LMSR moves the price on every trade, and CruxMarket refunds the
   * difference between msg.value and the true cost, so headroom is free while
   * being short by one wei is a revert.
   */
  const place = async (market: Market, side: 'YES' | 'NO') => {
    if (!address || !publicClient) {
      setConfirmed({ side, market, state: 'failed', error: 'Connect a wallet to take a position.' });
      return;
    }
    setConfirmed({ side, market, state: 'signing' });
    try {
      const yes = side === 'YES';
      const price = yes ? market.priceYes : 1 - market.priceYes;
      const shares = parseEther(String(Math.max(1, stake / Math.max(0.02, price))));

      const cost = await publicClient.readContract({
        address: ADDRESSES.market as `0x${string}`, abi: marketAbi,
        functionName: 'quoteBuy', args: [BigInt(market.id), yes, shares],
      });
      const headroom = (cost * 150n) / 100n;

      const hash = await writeContractAsync({
        address: ADDRESSES.market as `0x${string}`, abi: marketAbi, functionName: 'buy',
        args: [BigInt(market.id), yes, shares, headroom], value: headroom,
      });
      setConfirmed({ side, market, state: 'pending', hash, shares: Number(shares) / 1e18 });

      await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 });
      setConfirmed({ side, market, state: 'done', hash, shares: Number(shares) / 1e18 });
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      setConfirmed({
        side, market, state: 'failed',
        error: /User rejected|denied/i.test(msg) ? 'Signature rejected.' : msg.split('\n')[0].slice(0, 140),
      });
    }
  };

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
      const side: 'YES' | 'NO' = x > 0 ? 'YES' : 'NO';
      // A market whose trading has closed cannot be bought; say so rather than
      // letting the wallet surface a raw revert.
      if (stageOf(market) !== 'watching') {
        paint(0);
        setConfirmed({ side, market, state: 'failed', error: 'Trading has closed on this market.' });
        return;
      }
      paint(x > 0 ? 700 : -700);
      void place(market, side);
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

        {confirmed && (() => {
          const failed = confirmed.state === 'failed';
          const done = confirmed.state === 'done';
          const colour = failed ? 'var(--crit)' : done ? 'var(--lime)' : 'var(--bronze)';
          const heading = {
            signing: 'AWAITING SIGNATURE',
            pending: 'WRITING TO THE LEDGER',
            done: 'POSITION WRITTEN · AWAITING PROOF',
            failed: 'NOT WRITTEN',
          }[confirmed.state];

          return (
            <div className="fade-in" style={{
              position: 'absolute', inset: 0, bottom: 14, background: 'rgba(11,15,38,.94)',
              border: `1px solid ${colour}`, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 16, padding: 22,
            }}>
              <div className="legend" style={{ color: colour, letterSpacing: 3.4, textAlign: 'center' }}>
                {heading}
              </div>

              {failed ? (
                <div style={{ font: '400 11px/1.7 var(--mono)', color: 'var(--indigo-soft)', textAlign: 'center', maxWidth: 300 }}>
                  {confirmed.error}
                </div>
              ) : (
                <div style={{
                  border: `1.5px solid ${colour}`, padding: '14px 26px',
                  font: '700 34px/1 var(--sans)', letterSpacing: 6, color: colour,
                }}>{confirmed.side}</div>
              )}

              {!failed && (
                <div style={{ font: '400 10px/1.8 var(--mono)', color: 'var(--indigo-soft)', textAlign: 'center' }}>
                  {confirmed.shares ? `${confirmed.shares.toFixed(2)} SHARES · ` : ''}
                  CRUX-{String(confirmed.market.id).padStart(6, '0')}<br />
                  {confirmed.hash
                    ? <a href={`https://creditcoin-testnet.blockscout.com/tx/${confirmed.hash}`} target="_blank" rel="noreferrer">
                        {confirmed.hash.slice(0, 12)}…{confirmed.hash.slice(-6)} ↗
                      </a>
                    : 'CONFIRM IN YOUR WALLET'}
                </div>
              )}

              {done && <VerificationMark progress={0} size={34} strokeWidth={1} />}

              <button
                onClick={() => {
                  setConfirmed(null);
                  if (done) setIndex((i) => (i + 1) % Math.max(1, markets.length));
                  if (cardRef.current) cardRef.current.style.transition = 'none';
                  paint(0);
                }}
                style={{
                  border: `1px solid ${colour}`, padding: '11px 22px',
                  font: '600 9px/1 var(--sans)', letterSpacing: 2.4, color: colour,
                }}
              >{done ? 'NEXT MARKET' : failed ? 'BACK' : 'DISMISS'}</button>
            </div>
          );
        })()}
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
