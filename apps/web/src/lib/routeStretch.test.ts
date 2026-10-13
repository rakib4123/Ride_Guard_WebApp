import { describe, it, expect } from 'vitest';
import type { AdvisoryLevel, RouteSegment } from '@rideguard/shared';
import { riskiestStretch } from '@/lib/routeStretch';

/** Points ~111 m apart heading north, with the given levels. */
const line = (levels: AdvisoryLevel[]): RouteSegment[] =>
  levels.map((level, i) => ({ segId: i, lat: 23.7 + i * 0.001, lon: 90.4, R: 0.5, level, spatialPrior: 0.5 }));

describe('riskiestStretch', () => {
  it('extends over neighbours that share the riskiest level', () => {
    const s = riskiestStretch(line(['Low', 'High', 'High', 'High', 'Low']), 2);
    expect(s).not.toBeNull();
    expect(s!.lengthKm).toBeCloseTo(0.222, 2); // two ~111 m gaps
    expect(s!.center.lat).toBeCloseTo(23.702, 6);
    expect(s!.center.lon).toBe(90.4);
  });

  it('caps the stretch at 1 km either side', () => {
    const s = riskiestStretch(line(Array(41).fill('High')), 20);
    // 8 gaps of ~111 m fit under 1 km per side; a 9th would pass it.
    expect(s!.lengthKm).toBeCloseTo(2 * 8 * 0.1112, 2);
  });

  it('is a single point when no neighbour shares the level', () => {
    expect(riskiestStretch(line(['Low', 'High', 'Low']), 1)!.lengthKm).toBe(0);
  });

  it('returns null for an unknown segment id', () => {
    expect(riskiestStretch(line(['High']), 7)).toBeNull();
  });
});
