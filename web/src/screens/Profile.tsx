import { useAccount } from 'wagmi';
import { Guilloche, Microtext, Perforation } from '../components/Engraving';
import { ConnectPrompt } from '../components/Connect';
import { usePortfolio } from '../lib/positions';
import { hatch } from '../lib/engraving';
import type { Market } from '../lib/markets';

/**
 * Certificate of standing.
 *
 * Every number here is DERIVED — computed from the holder's real resolved
 * positions — not proven. `CruxScore` is not deployed, so there is no on-chain
 * reputation to read, and the screen says so rather than implying otherwise.
 * Under the provenance system derived facts get vellum ink and engraved
 * hatching; the lime, the seal and the completed rosette stay reserved for
 * things a proof established.
 */
export function Profile({ markets }: { markets: Market[] }) {
  const { address } = useAccount();
  const { calibration, loading } = usePortfolio(address, markets);

  if (!address) {
    return <ConnectPrompt
      title="No standing recorded."
      body="Standing is calibration over markets you have resolved. Connect to see yours — or browse the register, which is public."
    />;
  }

  // null means scored-but-empty; undefined means not loaded yet. Collapse
  // both to null so the screen has one 'nothing to show' branch.
  const brier: number | null = calibration?.brier ?? null;

  return (
    <div className="scroll">
      <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--indigo-rule)' }}>
        <span className="legend" style={{ color: 'var(--indigo-soft)', letterSpacing: 2.6 }}>CERTIFICATE OF STANDING</span>
        <span style={{ font: '400 9px/1 var(--mono)', color: 'var(--indigo-mute)' }}>DERIVED · NOT PROVEN</span>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ background: 'var(--vellum)', border: '1px solid var(--vellum-ink)', position: 'relative', overflow: 'hidden' }}>
          <div className="plate-edge" />
          <Guilloche seed={address} size={330} opacity={0.09} style={{ right: -95, top: -30 }} />

          <div style={{ padding: '22px 20px 20px', position: 'relative' }}>
            <div style={{ textAlign: 'center', borderBottom: '1px solid var(--vellum-ink)', paddingBottom: 14 }}>
              <div className="legend" style={{ color: 'var(--vellum-mute)', letterSpacing: 3.4 }}>CRUX · REGISTER OF CALIBRATION</div>
              <div style={{ font: '400 15px/1.3 var(--mono)', color: 'var(--vellum-ink)', marginTop: 12 }}>
                {address.slice(0, 10)}…{address.slice(-8)}
              </div>
              <div className="legend" style={{ color: 'var(--vellum-mute)', marginTop: 8 }}>SERIES 2026 · BEARER</div>
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div className="legend" style={{ color: 'var(--vellum-mute)', letterSpacing: 2.8 }}>CALIBRATION · BRIER SCORE</div>
                <div style={{ font: '400 8px/1 var(--mono)', color: 'var(--vellum-mute)' }}>LOWER IS BETTER</div>
              </div>

              {loading ? (
                <div style={{ font: '400 11px/1 var(--mono)', color: 'var(--vellum-mute)', marginTop: 16 }}>READING YOUR RESOLVED MARKETS…</div>
              ) : brier === null ? (
                <div style={{ marginTop: 12 }}>
                  <div className="proposition" style={{ fontSize: 22, color: 'var(--vellum-ink)' }}>
                    Not yet scored.
                  </div>
                  <div style={{ font: '400 11px/1.55 var(--sans)', color: 'var(--vellum-body)', marginTop: 10 }}>
                    Calibration needs resolved markets. Take a position, let it settle by proof, and a score appears here — computed from what you claimed against what the chain proved.
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: 10 }}>
                    <div style={{ font: '500 46px/1 var(--mono)', color: 'var(--vellum-ink)' }}>{brier.toFixed(3)}</div>
                    <div style={{ font: '400 10px/1.5 var(--sans)', color: 'var(--vellum-body)', paddingBottom: 5 }}>
                      over {calibration!.resolved}<br />resolved market{calibration!.resolved === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div style={{ position: 'relative', height: 22, marginTop: 14, border: '1px solid var(--vellum-ink)' }}>
                    <div style={{ position: 'absolute', inset: 0, backgroundImage: hatch(0.2), opacity: 0.35 }} />
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: `${Math.min(100, (brier / 0.25) * 100).toFixed(1)}%`, backgroundImage: hatch(0.85),
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', font: '400 8px/1.4 var(--mono)', color: 'var(--vellum-mute)', marginTop: 7 }}>
                    <span>0.000<br />PERFECT</span>
                    <span style={{ textAlign: 'right' }}>0.250<br />A COIN FLIP</span>
                  </div>
                </>
              )}

              <div style={{ font: '400 11px/1.55 var(--sans)', color: 'var(--vellum-body)', marginTop: 14, borderTop: '1px solid var(--vellum-ink)', paddingTop: 12 }}>
                Brier measures whether your confidence is honest, not whether you were lucky. Say 80% and be right 80% of the time and you score well. Say 99% and be wrong once and it costs you dearly.
              </div>
            </div>

            {calibration && calibration.resolved > 0 && (
              <div style={{ marginTop: 20 }}>
                <div className="legend" style={{ color: 'var(--vellum-mute)', letterSpacing: 2.8 }}>WHEN YOU SAID… IT HAPPENED…</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 12 }}>
                  {calibration.buckets.map((b) => (
                    <div key={b.lo} style={{ display: 'flex', alignItems: 'center', gap: 9, opacity: b.n ? 1 : 0.3 }}>
                      <span style={{ font: '400 8.5px/1 var(--mono)', color: 'var(--vellum-body)', width: 46 }}>
                        {Math.round(b.lo * 100)}–{Math.round(b.hi * 100)}%
                      </span>
                      <div style={{ flex: 1, height: 11, position: 'relative' }}>
                        <div style={{ position: 'absolute', inset: 0, backgroundImage: hatch(b.claimed), width: `${b.claimed * 100}%` }} />
                        {b.n > 0 && <div style={{ position: 'absolute', left: `${b.actual * 100}%`, top: -3, bottom: -3, width: 1.5, background: 'var(--vellum-ink)' }} />}
                      </div>
                      <span style={{ font: '400 8.5px/1 var(--mono)', color: 'var(--vellum-ink)', width: 34, textAlign: 'right' }}>
                        {b.n ? `${Math.round(b.actual * 100)}%` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ font: '400 9px/1.5 var(--mono)', color: 'var(--vellum-mute)', marginTop: 10 }}>
                  HATCHING = WHAT YOU CLAIMED · RULE = WHAT HAPPENED
                </div>
              </div>
            )}

            <Perforation style={{ margin: '20px -20px' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
              {[
                ['MARKETS RESOLVED', calibration?.resolved ?? 0],
                ['CURRENT STREAK', calibration?.streak ?? 0],
                ['BEST STREAK', calibration?.bestStreak ?? 0],
                ['SCORED BY', 'PROOF'],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <div className="legend" style={{ color: 'var(--vellum-mute)', letterSpacing: 2.4 }}>{k}</div>
                  <div style={{ font: '500 22px/1 var(--mono)', color: 'var(--vellum-ink)', marginTop: 6 }}>{v}</div>
                </div>
              ))}
            </div>

            <Microtext colour="var(--vellum-ink)" style={{ opacity: 0.5, marginTop: 20 }} parts={['BEARER', address, 'SERIES 2026']} />
          </div>
        </div>

        <div style={{ marginTop: 14, border: '1px solid var(--indigo-rule)', padding: 16 }}>
          <div className="legend" style={{ color: 'var(--indigo-mute)', letterSpacing: 2.6 }}>WHY THIS SCORE MEANS SOMETHING</div>
          <div style={{ font: '400 11px/1.6 var(--sans)', color: 'var(--indigo-soft)', marginTop: 9 }}>
            Every market behind it was decided by a cryptographic proof — no oracle voted, no committee reviewed, no admin key intervened. The score is therefore untainted by oracle manipulation, which is a claim no other prediction market can make about its own leaderboard.
          </div>
          <div style={{ font: '400 9px/1.6 var(--mono)', color: 'var(--indigo-mute)', marginTop: 10, borderTop: '1px solid var(--indigo-rule)', paddingTop: 10 }}>
            DERIVED CLIENT-SIDE FROM Traded LOGS + SETTLED OUTCOMES.<br />
            NOT AN ON-CHAIN SCORE — CruxScore IS NOT DEPLOYED.
          </div>
        </div>
      </div>
    </div>
  );
}
