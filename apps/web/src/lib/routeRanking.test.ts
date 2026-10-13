import { describe, it, expect } from 'vitest';
import { rankRoutes } from '@/lib/routeRanking';

describe('rankRoutes', () => {
  it('leads with the lowest-risk route and labels the fastest', () => {
    const r = rankRoutes([
      { durationMin: 20, meanRisk: 0.5, worstPrior: 0.95 }, // fastest, riskier
      { durationMin: 26, meanRisk: 0.4, worstPrior: 0.3 }, // safer
      { durationMin: 30, meanRisk: 0.45, worstPrior: 0.5 },
    ]);
    expect(r.map((x) => x.index)).toEqual([1, 2, 0]);
    expect(r[0]).toMatchObject({ label: 'route.safest', extraMin: 6, avoidsBlackspot: true });
    expect(r[1]).toMatchObject({ label: 'route.option', n: 2, extraMin: 10 });
    expect(r[2]).toMatchObject({ label: 'route.fastest', extraMin: 0, avoidsBlackspot: false });
  });

  it('breaks a risk tie by time', () => {
    const r = rankRoutes([
      { durationMin: 30, meanRisk: 0.4, worstPrior: 0 },
      { durationMin: 22, meanRisk: 0.4, worstPrior: 0 },
    ]);
    expect(r[0].index).toBe(1);
  });

  it('claims no blackspot avoidance when no route passes one', () => {
    const r = rankRoutes([
      { durationMin: 20, meanRisk: 0.5, worstPrior: 0.2 },
      { durationMin: 25, meanRisk: 0.3, worstPrior: 0.1 },
    ]);
    expect(r.every((x) => !x.avoidsBlackspot)).toBe(true);
  });

  it('does not call a lone route "safer"', () => {
    expect(rankRoutes([{ durationMin: 20, meanRisk: 0.5, worstPrior: 0 }])[0].label).toBe('route.fastest');
    expect(rankRoutes([])).toEqual([]);
  });
});
