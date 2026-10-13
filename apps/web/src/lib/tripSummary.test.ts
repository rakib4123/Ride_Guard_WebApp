import { describe, it, expect } from 'vitest';
import { monthSummary } from '@/lib/tripSummary';
import type { SavedTrip } from '@/lib/trips';

const trip = (created_at: string, advisory: string | null, distanceKm?: number): SavedTrip => ({
  id: created_at, created_at, risk: 0.4, advisory, lat: null, lon: null,
  data: distanceKm === undefined ? null : { distanceKm },
});

describe('monthSummary', () => {
  const now = new Date(2026, 9, 13); // 13 Oct 2026 (months are 0-based)

  it('counts only this calendar month', () => {
    const s = monthSummary([
      trip(new Date(2026, 9, 1).toISOString(), 'Low', 4),
      trip(new Date(2026, 9, 12).toISOString(), 'High', 2.5),
      trip(new Date(2026, 8, 30).toISOString(), 'High', 9),
      trip(new Date(2025, 9, 5).toISOString(), 'Medium', 9),
    ], now);
    expect(s.rides).toBe(2);
    expect(s.km).toBeCloseTo(6.5);
    expect(s.counts).toEqual({ Low: 1, Medium: 0, High: 1 });
  });

  it('treats a missing distance as zero and an unknown level as uncounted', () => {
    const s = monthSummary([trip(new Date(2026, 9, 2).toISOString(), null)], now);
    expect(s).toEqual({ rides: 1, km: 0, counts: { Low: 0, Medium: 0, High: 0 } });
  });
});
