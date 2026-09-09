export const commas = (n: number | bigint) => n.toLocaleString('en-US');

export const tctc = (wei: bigint, dp = 2) =>
  (Number(wei) / 1e18).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });

export const usd8 = (raw: bigint) =>
  '$' + (Number(raw) / 1e8).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const pct = (p: number) => `${Math.round(p * 100)}%`;

export const serial = (n: number | bigint, prefix = 'CRUX') =>
  `N° ${prefix}-${String(n).padStart(6, '0')}`;

export function countdown(seconds: number): string {
  if (seconds <= 0) return 'CLOSED';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}
