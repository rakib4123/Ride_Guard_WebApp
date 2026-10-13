import { describe, it, expect } from 'vitest';
import { parseOsrmRoutes } from '@/lib/routing';

const route = (n: number) => ({
  geometry: { coordinates: [[90.4, 23.7], [90.41, 23.71 + n * 0.001]] },
  distance: 5000 + n * 1000, duration: 900 + n * 60,
});

describe('parseOsrmRoutes', () => {
  it('keeps at most three routes, as lat/lon, km and minutes', () => {
    const r = parseOsrmRoutes({ routes: [route(0), route(1), route(2), route(3)] });
    expect(r).toHaveLength(3);
    expect(r[0].points[0]).toEqual({ lat: 23.7, lon: 90.4 });
    expect(r[1].distanceKm).toBe(6);
    expect(r[1].durationMin).toBe(16);
    expect(r.every((x) => !x.fallback)).toBe(true);
  });

  it('drops routes without usable geometry', () => {
    expect(parseOsrmRoutes({ routes: [{ geometry: { coordinates: [[90.4, 23.7]] } }, route(0)] })).toHaveLength(1);
  });

  it('copes with a missing or malformed body', () => {
    expect(parseOsrmRoutes(null)).toEqual([]);
    expect(parseOsrmRoutes({})).toEqual([]);
  });
});
