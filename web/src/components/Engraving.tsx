import { rosette, MARK_PATH, hatch, microtext } from '../lib/engraving';

/**
 * Guilloche security tint. Seeded from the market's spec hash, so no two
 * instruments carry the same engraving — the pattern cannot be transplanted.
 */
export function Guilloche({
  seed, size = 420, opacity = 0.11, stroke = 'var(--vellum-ink)', style,
}: {
  seed: string; size?: number; opacity?: number; stroke?: string; style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 200 200" width={size} height={size} aria-hidden
      style={{ position: 'absolute', opacity, pointerEvents: 'none', ...style }}
    >
      <path d={rosette(seed)} fill="none" stroke={stroke} strokeWidth={0.35} />
    </svg>
  );
}

/**
 * The verification mark. `progress` 0 → 1 draws the rosette to completion.
 *
 * An incomplete mark means unproven, and it is bronze while pending; it turns
 * lime only when the precompile has actually returned true. That colour change
 * is the single most load-bearing signal in the interface, so nothing else in
 * the app is permitted to draw a completed lime rosette.
 */
export function VerificationMark({
  progress, size = 26, proven = false, strokeWidth = 0.5, rings = false,
}: {
  progress: number; size?: number; proven?: boolean; strokeWidth?: number; rings?: boolean;
}) {
  const colour = proven ? 'var(--lime)' : 'var(--bronze)';
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      {rings && (
        <>
          <circle cx="50" cy="50" r="48" fill="none" stroke="var(--indigo-rule)" strokeWidth={0.5} />
          <circle cx="50" cy="50" r="43" fill="none" stroke="var(--indigo-rule)" strokeWidth={0.3} strokeDasharray="1 3" />
        </>
      )}
      <path
        d={MARK_PATH} fill="none" stroke={colour} strokeWidth={strokeWidth}
        pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.max(0, Math.min(1, progress))}
        style={{ transition: 'stroke-dashoffset 1.4s ease-out, stroke .6s ease-out' }}
      />
    </svg>
  );
}

/**
 * Odds bar. Tone is carried by line density, never by fill — engraved, not a
 * progress bar. A denser field means a higher implied probability.
 */
export function IntaglioBar({
  yes, height = 52, showLabels = true, ink = 'var(--vellum-ink)',
}: { yes: number; height?: number; showLabels?: boolean; ink?: string }) {
  const pct = Math.round(yes * 100);
  return (
    <div style={{ display: 'flex', height, border: `1px solid ${ink}` }}>
      <div style={{
        flex: `0 0 ${(yes * 100).toFixed(1)}%`, backgroundImage: hatch(yes, ink),
        display: 'flex', alignItems: 'flex-end', padding: '0 0 6px 8px',
      }}>
        {showLabels && (
          <span style={{
            font: '600 11px/1 var(--sans)', letterSpacing: 1.6, color: 'var(--vellum)',
            background: ink, padding: '3px 5px',
          }}>YES {pct}%</span>
        )}
      </div>
      <div style={{
        flex: 1, backgroundImage: hatch(1 - yes, ink),
        display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: '0 8px 6px 0',
      }}>
        {showLabels && (
          <span style={{ font: '600 11px/1 var(--sans)', letterSpacing: 1.6, color: ink }}>
            NO {100 - pct}%
          </span>
        )}
      </div>
    </div>
  );
}

/** A hairline that actually spells real on-chain strings. */
export function Microtext({ parts, colour = 'var(--indigo-rule)', style }: {
  parts: string[]; colour?: string; style?: React.CSSProperties;
}) {
  return <div className="microtext" style={{ color: colour, ...style }}>{microtext(...parts)}</div>;
}

export function Perforation({ style }: { style?: React.CSSProperties }) {
  return <div className="perforation" style={style} aria-hidden />;
}

/** Reserved exclusively for PROVEN. Never used for anything else. */
export function Seal({ size = 150, striking = false, ms = 536 }: {
  size?: number; striking?: boolean; ms?: number;
}) {
  return (
    <div
      className={striking ? 'seal-strike' : undefined}
      style={{
        width: size, height: size, borderRadius: '50%', border: '2px solid var(--lime)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', inset: 6, borderRadius: '50%', border: '.5px solid var(--lime-deep)' }} />
      <div style={{ position: 'absolute', inset: 11, borderRadius: '50%', border: '.5px solid var(--lime-deep)', opacity: .5 }} />
      <div style={{ textAlign: 'center', position: 'relative' }}>
        <div style={{ font: '400 10px/1 var(--sans)', letterSpacing: 2, color: 'var(--lime)' }}>✦</div>
        <div style={{ font: `600 ${size / 7}px/1 var(--sans)`, letterSpacing: 3.4, color: 'var(--lime)', marginTop: 6 }}>
          PROVEN
        </div>
        <div style={{ font: '400 7px/1.5 var(--mono)', color: 'var(--lime-deep)', marginTop: 7 }}>
          PRECOMPILE 0x…0FD2<br />TRUE · {ms} ms
        </div>
      </div>
    </div>
  );
}

/** Assertion is stamped, never engraved — deliberately cruder. */
export function RubberStamp({ label, sub, rotate = -8 }: { label: string; sub?: string; rotate?: number }) {
  return (
    <div style={{
      border: '2px solid var(--vermillion)', padding: '7px 14px',
      transform: `rotate(${rotate}deg)`, display: 'inline-block', textAlign: 'center',
    }}>
      <div style={{ font: '700 18px/1 var(--sans)', letterSpacing: 4, color: 'var(--vermillion)' }}>{label}</div>
      {sub && <div style={{ font: '400 7px/1 var(--mono)', letterSpacing: 1, color: 'var(--vermillion)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
