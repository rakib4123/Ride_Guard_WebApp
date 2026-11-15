/**
 * "Who is around me" from RideGuard riders sharing their position while riding.
 *
 * The bus problem: thirty RideGuard users on one bus are thirty phones but one
 * vehicle. Counting phones would read a single bus as a crowd. So phones are
 * grouped into vehicles first: two phones are the same vehicle when, over their
 * last few fixes, they stay close together AND move at the same speed and
 * heading. One fix close together is not enough — a rider passing a bus is
 * briefly within metres of it, but does not keep matching its speed and heading.
 * Groups chain (union-find), so passengers at opposite ends of a long bus still
 * join through the ones in between.
 *
 * Limits: GPS is only good to roughly 5-15 m, so this works at the scale of a
 * vehicle and its surroundings (tens of metres), not individual seats. A
 * stationary bus and a crowd waiting at a stop look alike, so stationary phones
 * group only when very close.
 */
import type { LatLon } from './scoring';

export interface PresenceFix {
  /** ms since epoch. */
  t: number;
  lat: number;
  lon: number;
  speedKmh: number;
  /** Degrees from north, or null when the phone does not know (stationary). */
  headingDeg: number | null;
}

/** What a riding client posts every few seconds. */
export interface PresenceUpdate {
  /** Random id, rotated by the client; never the rider's account id. */
  sessionId: string;
  lat: number;
  lon: number;
  speedKmh: number;
  headingDeg: number | null;
  accuracyM: number;
}

export interface PresenceResponse {
  radiusM: number;
  /** Other RideGuard phones within the radius (not counting those with you). */
  ridersNearby: number;
  /** Those phones grouped into vehicles: a full bus counts once. */
  groupsNearby: number;
  /** Phones moving with you (a pillion rider, or you are on the same vehicle). */
  travellingWithYou: number;
}

export const PRESENCE = {
  radiusM: 30,
  /** A rider who stops posting disappears after this. */
  ttlMs: 20_000,
  /** How often a riding client posts. */
  intervalMs: 5_000,
  /** Fixes kept per phone for the same-vehicle test. */
  historyFixes: 6,
} as const;

/** Thresholds for "same vehicle". */
const MATCH_DT_MS = 4_000;
const MOVING_KMH = 5;
const MOVING_MAX_GAP_M = 15;
const STOPPED_MAX_GAP_M = 8;
const MAX_SPEED_DIFF_KMH = 6;
const MAX_HEADING_DIFF_DEG = 35;
const HEADING_MIN_KMH = 8;
const MIN_MATCHED_FIXES = 2;

export function haversineM(a: LatLon, b: LatLon): number {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

function headingDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Where fix `f` would be at time `t`, moving at its speed and heading. Phones
 * post at different moments, so comparing raw positions of two phones on one
 * bus at 40 km/h, 2 s apart, would put them 22 m apart.
 */
function projectTo(f: PresenceFix, t: number): LatLon {
  if (f.headingDeg == null || f.speedKmh < MOVING_KMH) return f;
  const d = (f.speedKmh / 3.6) * ((t - f.t) / 1000);
  const h = (f.headingDeg * Math.PI) / 180;
  return {
    lat: f.lat + (d * Math.cos(h)) / 111_320,
    lon: f.lon + (d * Math.sin(h)) / (111_320 * Math.cos((f.lat * Math.PI) / 180)),
  };
}

/** Do two fix histories (oldest first) look like one vehicle? */
export function sameVehicle(a: PresenceFix[], b: PresenceFix[]): boolean {
  if (!a.length || !b.length) return false;
  let matched = 0;
  for (const fa of a.slice(-3)) {
    let best: PresenceFix | null = null;
    for (const fb of b) {
      if (Math.abs(fb.t - fa.t) <= MATCH_DT_MS && (!best || Math.abs(fb.t - fa.t) < Math.abs(best.t - fa.t))) {
        best = fb;
      }
    }
    if (!best) continue;
    const movingA = fa.speedKmh >= MOVING_KMH;
    const movingB = best.speedKmh >= MOVING_KMH;
    if (movingA !== movingB) return false;
    const gap = haversineM(fa, projectTo(best, fa.t));
    if (!movingA) {
      if (gap > STOPPED_MAX_GAP_M) return false;
    } else {
      // Without a heading the projection is unavailable: allow the distance
      // the phone could have covered in the time between the two fixes.
      const slack = best.headingDeg == null ? (best.speedKmh / 3.6) * (Math.abs(best.t - fa.t) / 1000) : 0;
      if (gap > MOVING_MAX_GAP_M + slack) return false;
      if (Math.abs(fa.speedKmh - best.speedKmh) > MAX_SPEED_DIFF_KMH) return false;
      if (fa.headingDeg != null && best.headingDeg != null &&
          fa.speedKmh >= HEADING_MIN_KMH && best.speedKmh >= HEADING_MIN_KMH &&
          headingDiff(fa.headingDeg, best.headingDeg) > MAX_HEADING_DIFF_DEG) return false;
    }
    matched++;
  }
  return matched >= MIN_MATCHED_FIXES;
}

/** Number of vehicles among phone histories (connected components of sameVehicle). */
export function countVehicles(tracks: PresenceFix[][]): number {
  const parent = tracks.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < tracks.length; i++) {
    for (let j = i + 1; j < tracks.length; j++) {
      if (find(i) !== find(j) && sameVehicle(tracks[i], tracks[j])) parent[find(i)] = find(j);
    }
  }
  return new Set(tracks.map((_, i) => find(i))).size;
}

/**
 * Turn the measured crowd into the model's 1..8 traffic scale. It may only
 * RAISE the time-of-day estimate: most nearby people do not carry a detectable
 * phone, so a low count is not evidence of an empty road.
 */
export function trafficWithCrowd(estimate: number, vehiclesAround: number | null): number {
  if (vehiclesAround == null) return estimate;
  return Math.max(estimate, Math.min(8, 1 + vehiclesAround));
}
