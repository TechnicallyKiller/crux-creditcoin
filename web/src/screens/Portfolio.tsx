import { useAccount, useWriteContract } from 'wagmi';
import { Guilloche, Microtext, Perforation, VerificationMark } from '../components/Engraving';
import { ADDRESSES, marketAbi } from '../lib/chain';
import { usePortfolio, type Position } from '../lib/positions';
import { tctc, serial } from '../lib/format';
import { stageOf, type Market } from '../lib/markets';
import { ConnectPrompt } from '../components/Connect';

/** Positions are certificates the bearer holds. */
export function Portfolio({ markets, onOpen }: { markets: Market[]; onOpen: (m: Market) => void }) {
  const { address } = useAccount();
  const { positions, loading } = usePortfolio(address, markets);
  const { writeContract, isPending } = useWriteContract();

  if (!address) {
    return <ConnectPrompt
      title="Nothing is held in your name yet."
      body="Connect to see the instruments you hold. Browsing needs no wallet — every market, spec and proof on this network is public."
    />;
  }

  const open = positions.filter((p) => !p.settled);
  const claimable = positions.filter((p) => p.settled && p.claimable > 0n);
  const spent = positions.filter((p) => p.settled && p.claimable === 0n);
  const total = claimable.reduce((s, p) => s + p.claimable, 0n);

  return (
    <div className="scroll">
      <div style={{ padding: '16px 16px 0' }}>
        <div className="legend" style={{ color: 'var(--indigo-mute)', letterSpacing: 2.8 }}>
          BEARER · {address.slice(0, 6)}…{address.slice(-4)}
        </div>
        <div style={{ font: '500 34px/1 var(--mono)', color: 'var(--vellum)', marginTop: 10 }}>
          {tctc(total)}
        </div>
        <div style={{ font: '400 9px/1 var(--mono)', color: 'var(--indigo-soft)', marginTop: 6 }}>
          tCTC · CLAIMABLE NOW
        </div>
        <div style={{ display: 'flex', marginTop: 20, borderBottom: '1px solid var(--indigo-rule)' }}>
          {[['OPEN', open.length], ['CLAIMABLE', claimable.length], ['SPENT', spent.length]].map(([l, n]) => (
            <div key={String(l)} style={{
              padding: '11px 14px', font: '600 9px/1 var(--sans)', letterSpacing: 2,
              color: 'var(--vellum)',
            }}>{l} {n as number}</div>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ padding: 40, textAlign: 'center' }} className="legend">
          <span style={{ color: 'var(--indigo-mute)' }}>READING YOUR HOLDINGS</span>
        </div>
      )}

      {!loading && positions.length === 0 && (
        <div style={{ padding: 16 }}>
          <div style={{ border: '1px dashed var(--indigo-rule)', padding: '30px 24px', textAlign: 'center' }}>
            <div style={{ display: 'grid', placeItems: 'center' }}>
              <VerificationMark progress={0} size={92} rings />
            </div>
            <div className="legend" style={{ color: 'var(--indigo-mute)', letterSpacing: 3, marginTop: 14 }}>
              NO INSTRUMENTS HELD
            </div>
            <div className="proposition" style={{ fontSize: 24, color: 'var(--vellum)', marginTop: 14 }}>
              An empty plate. Nothing has been struck in your name yet.
            </div>
            <div style={{ font: '400 12px/1.55 var(--sans)', color: 'var(--indigo-soft)', marginTop: 12 }}>
              Positions appear here as certificates — unsettled, then settled, then cancelled once claimed.
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {positions.map((p) => (
          <PositionCard
            key={p.marketId} p={p}
            onOpen={() => p.market && onOpen(p.market)}
            onClaim={() => writeContract({
              address: ADDRESSES.market as `0x${string}`,
              abi: marketAbi, functionName: 'claim', args: [BigInt(p.marketId)],
            })}
            claiming={isPending}
          />
        ))}
      </div>
    </div>
  );
}

function PositionCard({ p, onOpen, onClaim, claiming }: {
  p: Position; onOpen: () => void; onClaim: () => void; claiming: boolean;
}) {
  const won = p.settled && p.claimable > 0n;
  const spent = p.settled && p.claimable === 0n;
  const stage = p.market ? stageOf(p.market) : 'watching';
  const shares = p.side === 'NO' ? p.noShares : p.yesShares;

  return (
    <div style={{
      background: spent ? 'var(--vellum-sunk)' : 'var(--vellum)',
      border: won ? '1.5px solid var(--lime-deep)' : `1px solid ${spent ? 'var(--vellum-mute)' : 'var(--vellum-ink)'}`,
      position: 'relative', overflow: 'hidden', opacity: spent ? 0.86 : 1,
    }}>
      <div className="plate-edge" style={won ? { backgroundImage: 'repeating-linear-gradient(90deg, var(--lime-deep) 0 0.6px, transparent 0.6px 2.4px)' } : undefined} />
      <Guilloche seed={`POS-${p.marketId}`} size={200} opacity={0.08} style={{ right: -50, bottom: -60 }} />
      {spent && <div className="perforation" style={{ position: 'absolute', left: -40, right: -40, top: 66, transform: 'rotate(-7deg)', opacity: 0.5 }} />}

      <div style={{ padding: '17px 18px 16px', position: 'relative' }} onClick={onOpen}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ font: '500 9px/1 var(--mono)', letterSpacing: 1.2, color: 'var(--vellum-ink)' }}>
            {serial(p.marketId, 'POS')}
          </div>
          {won ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--indigo-abyss)', padding: '4px 7px' }}>
              <VerificationMark progress={1} proven size={12} strokeWidth={1.4} />
              <span style={{ font: '600 7px/1 var(--sans)', letterSpacing: 1.2, color: 'var(--lime)' }}>
                ✦ PROVEN · YOU WON
              </span>
            </div>
          ) : spent ? (
            <div style={{ border: '1.5px solid var(--vellum-mute)', padding: '3px 7px', transform: 'rotate(-3deg)' }}>
              <span style={{ font: '700 7px/1 var(--sans)', letterSpacing: 1.4, color: 'var(--vellum-mute)' }}>
                SETTLED · NOT YOURS
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--bronze)', padding: '3px 6px' }}>
              <VerificationMark progress={stage === 'attesting' ? 0.62 : 0.2} size={11} strokeWidth={1.4} />
              <span style={{ font: '600 7px/1 var(--sans)', letterSpacing: 1.2, color: 'var(--bronze-ink)' }}>
                UNSETTLED · {stage.toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <div className="proposition" style={{ fontSize: 20, lineHeight: 1.2, color: 'var(--vellum-ink)', marginTop: 12 }}>
          {p.market?.question ?? `Market ${p.marketId}`}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ border: '1.5px solid var(--vellum-ink)', padding: '3px 9px' }}>
              <span style={{
                font: '700 13px/1 var(--sans)', letterSpacing: 2, color: 'var(--vellum-ink)',
                textDecoration: p.side === 'NO' ? 'line-through' : undefined,
              }}>{p.side}</span>
            </div>
            <div style={{ font: '400 9.5px/1.6 var(--mono)', color: 'var(--vellum-body)' }}>
              {tctc(shares)} SHARES<br />@ {p.avgPrice.toFixed(3)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="legend" style={{ color: 'var(--vellum-mute)', letterSpacing: 2 }}>
              {won ? 'REDEEMS 1:1' : 'MARK'}
            </div>
            <div style={{ font: '500 15px/1 var(--mono)', color: 'var(--vellum-ink)', marginTop: 6 }}>
              {won ? tctc(p.claimable) : (Number(shares) / 1e18 * p.avgPrice).toFixed(2)} tCTC
            </div>
          </div>
        </div>

        {won && (
          <>
            <Perforation style={{ margin: '16px -18px 14px' }} />
            <button
              onClick={(e) => { e.stopPropagation(); onClaim(); }}
              disabled={claiming}
              style={{
                width: '100%', border: '1px solid var(--indigo-abyss)', background: 'var(--indigo-abyss)',
                padding: '13px 0', font: '600 10px/1 var(--sans)', letterSpacing: 2.6, color: 'var(--lime)',
              }}
            >{claiming ? 'CLAIMING…' : `CLAIM ${tctc(p.claimable)} tCTC`}</button>
          </>
        )}

        <Microtext colour="var(--vellum-ink)" style={{ opacity: 0.5, marginTop: 14 }}
          parts={[`BEARER·POS-${String(p.marketId).padStart(6, '0')}`, ADDRESSES.market]} />
      </div>
    </div>
  );
}
