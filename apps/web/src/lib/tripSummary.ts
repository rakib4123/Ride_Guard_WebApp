import type { AdvisoryLevel } from '@rideguard/shared';
import type { SavedTrip } from '@/lib/trips';

export interface MonthSummary {
  rides: number;
  km: number;
  counts: Record<AdvisoryLevel, number>;
}

/**
 * This calendar month's rides (spec 7.1). Strictly descriptive: counts of what
 * the app read, nothing inferred. No trends or streaks — with no crash
 * outcomes recorded, a falling score means the app's number moved, not that
 * the rider got safer.
 */
export function monthSummary(trips: SavedTrip[], now = new Date()): MonthSummary {
  const out: MonthSummary = { rides: 0, km: 0, counts: { Low: 0, Medium: 0, High: 0 } };
  for (const t of trips) {
    const d = new Date(t.created_at);
    if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) continue;
    out.rides += 1;
    out.km += t.data?.distanceKm ?? 0;
    if (t.advisory === 'Low' || t.advisory === 'Medium' || t.advisory === 'High') {
      out.counts[t.advisory] += 1;
    }
  }
  return out;
}
