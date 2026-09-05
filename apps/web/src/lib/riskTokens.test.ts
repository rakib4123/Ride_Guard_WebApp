import { describe, it, expect } from 'vitest';
import { RISK_TOKENS, type RiskLevel } from '@/lib/riskTokens';

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const LEVELS: RiskLevel[] = ['Low', 'Medium', 'High', 'Unknown'];

describe('risk tokens', () => {
  it('defines a token for every level', () => {
    for (const level of LEVELS) expect(RISK_TOKENS[level]).toBeDefined();
  });

  it.each(LEVELS)('%s meets WCAG AA for normal text', (level) => {
    const t = RISK_TOKENS[level];
    expect(contrast(t.surface, t.onSurface)).toBeGreaterThanOrEqual(4.5);
  });

  it('pairs amber with ink, not white — white on amber is only 2.77:1', () => {
    expect(RISK_TOKENS.Medium.onSurface).toBe('#0B1220');
    expect(contrast(RISK_TOKENS.Medium.surface, '#FFFFFF')).toBeLessThan(3);
  });

  it('gives every level a distinct icon so colour is never the only signal', () => {
    const icons = LEVELS.map((l) => RISK_TOKENS[l].icon);
    expect(new Set(icons).size).toBe(icons.length);
  });
});
