import type { LatLon, RouteSegment } from '@rideguard/shared';
import { distMeters } from '@/lib/roadrisk';

/** How far the named stretch may extend either side of the riskiest point. */
const MAX_SIDE_M = 1_000;

export interface Stretch {
  /** Where to reverse-geocode the stretch's name: its riskiest point. */
  center: LatLon;
  lengthKm: number;
}

/**
 * The riskiest stretch of a route (spec 5 and open item 2): start at the
 * riskiest sampled point and extend along the route while neighbouring points
 * share its advisory level, up to 1 km each side. A point reading becomes a
 * span a rider can recognise ("Mohakhali flyover approach, 2.1 km").
 */
export function riskiestStretch(segments: RouteSegment[], riskiestSegId: number): Stretch | null {
  const i = segments.findIndex((s) => s.segId === riskiestSegId);
  if (i < 0) return null;
  const level = segments[i].level;

  const extend = (step: 1 | -1): number => {
    let metres = 0;
    for (let j = i + step; j >= 0 && j < segments.length; j += step) {
      if (segments[j].level !== level) break;
      const d = distMeters(segments[j - step], segments[j]);
      if (metres + d > MAX_SIDE_M) break;
      metres += d;
    }
    return metres;
  };

  return {
    center: { lat: segments[i].lat, lon: segments[i].lon },
    lengthKm: (extend(-1) + extend(1)) / 1000,
  };
}
