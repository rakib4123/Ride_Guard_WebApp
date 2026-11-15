import type { LatLon } from '@rideguard/shared';

/** Ease-out cubic: fast start, gentle landing (map motion, sheet snaps). */
export const easeOutCubic = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const lerpLatLon = (a: LatLon, b: LatLon, t: number): LatLon => ({
  lat: lerp(a.lat, b.lat, t),
  lon: lerp(a.lon, b.lon, t),
});

/**
 * The heading to animate towards, unwrapped so the cone turns the short way:
 * from 350 deg to 10 deg it goes to 370 (20 deg clockwise), not back 340 deg.
 */
export function nearestAngle(current: number, target: number): number {
  const delta = ((((target - current) % 360) + 540) % 360) - 180;
  return current + delta;
}

/**
 * Where a dragged bottom sheet should settle. A quick flick wins over
 * position; otherwise it settles to whichever side of halfway it was let go.
 * `progress` is 0 (closed) .. 1 (open); `velocity` is in progress units per
 * second, positive towards open.
 */
export function settleSheet(progress: number, velocity: number): boolean {
  if (velocity > 1.2) return true;
  if (velocity < -1.2) return false;
  return progress >= 0.5;
}

/** The user has asked the OS to cut down on motion. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}
