/**
 * The engraving primitives.
 *
 * Ported verbatim from the design canvas so the app renders the same curves the
 * design was approved on. The guilloche maths is not decorative: a rosette is
 * seeded from a market's spec hash, so every market carries a security pattern
 * that is genuinely its own and cannot be transplanted onto another market —
 * the same property banknote engraving has always been for.
 */

/** FNV-1a. Stable across runs, which matters: a market's rosette must never change. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * One epitrochoid-ish ring: radius modulated by cos(k·t) as t sweeps.
 * Layering rings of different k and phase is what produces guilloche.
 */
export function ring(
  cx: number, cy: number, R: number, A: number,
  k: number, turns: number, phase: number, steps: number,
): string {
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = phase + (turns * 2 * Math.PI * i) / steps;
    const r = R + A * Math.cos(k * t);
    d += (i ? 'L' : 'M') + (cx + r * Math.cos(t)).toFixed(2) + ' ' + (cy + r * Math.sin(t)).toFixed(2);
    if (i < steps) d += ' ';
  }
  return d;
}

/** Four nested rings whose frequencies and phase come from the seed. */
export function rosette(seed: string, cx = 100, cy = 100, R = 96): string {
  const h = hash(seed);
  const k1 = 5 + (h % 8);
  const k2 = 3 + ((h >> 4) % 10);
  const k3 = 7 + ((h >> 9) % 6);
  const ph = ((h % 100) / 100) * Math.PI;
  return [
    ring(cx, cy, R, R * 0.14, k1, 1, ph, 260),
    ring(cx, cy, R * 0.78, R * 0.18, k2, 1, ph + 0.5, 260),
    ring(cx, cy, R * 0.52, R * 0.22, k3, 1, ph + 1.1, 240),
    ring(cx, cy, R * 0.26, R * 0.09, k1, 1, ph + 0.2, 180),
  ].join(' ');
}

/**
 * The verification mark — one dense spiral drawn as a single path, revealed by
 * animating stroke-dashoffset from 1 to 0. Incomplete means unproven, which is
 * the app's signature gesture.
 */
export const MARK_PATH = ring(50, 50, 38, 10, 5.5, 8, 0, 900);

/**
 * Intaglio hatching. Tone comes from line DENSITY, never from fill — that is
 * what makes an odds bar read as engraved rather than as a progress bar.
 * A higher probability packs the lines tighter.
 */
export function hatch(probability: number, ink = '#101425'): string {
  const gap = 1.2 + (1 - Math.max(0, Math.min(1, probability))) * 8;
  return `repeating-linear-gradient(90deg, ${ink} 0 0.7px, transparent 0.7px ${gap.toFixed(2)}px)`;
}

/** Deterministic pseudo-series, used for price history when the chain has none. */
export function series(seed: string, n: number, lo: number, hi: number): number[] {
  let h = hash(seed);
  const out: number[] = [];
  let v = (lo + hi) / 2;
  for (let i = 0; i < n; i++) {
    h = Math.imul(h ^ (h >>> 13), 2246822519);
    h >>>= 0;
    v += ((h % 1000) / 1000 - 0.46) * (hi - lo) * 0.16;
    v = Math.max(lo, Math.min(hi, v));
    out.push(v);
  }
  return out;
}

/** Repeats a real string until it fills a rule. Microtext must say something true. */
export function microtext(...parts: string[]): string {
  const unit = parts.join('·') + '·';
  return unit.repeat(Math.ceil(400 / unit.length));
}

export const shortHash = (h: string, head = 8, tail = 4) =>
  h.length <= head + tail + 2 ? h : `${h.slice(0, head + 2)}…${h.slice(-tail)}`;
