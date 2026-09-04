import type { AdvisoryLevel } from '@rideguard/shared';
import { RISK_TOKENS } from '@/lib/riskTokens';

export const riskColor: Record<AdvisoryLevel, string> = {
  Low: RISK_TOKENS.Low.surface,
  Medium: RISK_TOKENS.Medium.surface,
  High: RISK_TOKENS.High.surface,
};

export function levelFor(R: number): AdvisoryLevel {
  if (R < 0.33) return 'Low';
  if (R < 0.6) return 'Medium';
  return 'High';
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const dayOfWeek = (d = new Date()) =>
  d.toLocaleDateString('en-US', { weekday: 'long' });
