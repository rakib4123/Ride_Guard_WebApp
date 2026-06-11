import type { AdvisoryLevel } from '@rideguard/shared';

export const riskColor: Record<AdvisoryLevel, string> = {
  Low: '#16A34A',
  Medium: '#F59E0B',
  High: '#EF4444',
};

export function levelFor(R: number): AdvisoryLevel {
  if (R < 0.33) return 'Low';
  if (R < 0.6) return 'Medium';
  return 'High';
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const dayOfWeek = (d = new Date()) =>
  d.toLocaleDateString('en-US', { weekday: 'long' });
