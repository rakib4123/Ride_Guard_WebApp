import type { AdvisoryLevel } from '@rideguard/shared';

/**
 * The advisory levels plus Unknown. Unknown is not decoration: when the
 * scoring API is unreachable the app must say so rather than fall back to a
 * reassuring "Low" (spec 3.2).
 */
export type RiskLevel = AdvisoryLevel | 'Unknown';

export interface RiskToken {
  /** Background of the verdict band. */
  surface: string;
  /** Foreground ON that surface. Read it — never assume white. */
  onSurface: string;
  /** Carries the meaning when colour cannot: colour-blindness, sunlight. */
  icon: string;
}

/**
 * Every pair below is measured at >= 4.5:1. Amber is the one asymmetry and it
 * is forced: no amber light enough to read as amber can carry white text
 * (#E08600 on white is 2.77:1), so Medium takes ink instead at 6.76:1.
 */
export const RISK_TOKENS: Record<RiskLevel, RiskToken> = {
  Low: { surface: '#0B7A43', onSurface: '#FFFFFF', icon: '✓' },
  Medium: { surface: '#E08600', onSurface: '#0B1220', icon: '⚠' },
  High: { surface: '#D92D20', onSurface: '#FFFFFF', icon: '⛔' },
  Unknown: { surface: '#5B6675', onSurface: '#FFFFFF', icon: '–' },
};
