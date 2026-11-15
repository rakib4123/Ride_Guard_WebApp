'use client';

import { useEffect, useState } from 'react';
import type { LatLon } from '@rideguard/shared';
import { distMeters } from '@/lib/roadrisk';

/**
 * A location that only changes once the input has moved `minM` metres from
 * the last value it emitted (the first value passes straight through).
 *
 * Use this instead of a time debounce for anything that must keep up during a
 * ride. A debounce waits for the input to go quiet; GPS updates about once a
 * second while moving, so a 1.2 s debounce never fired and the road type,
 * speed limit and place name stayed frozen at the start of the ride.
 */
export function useMovedLocation(loc: LatLon, active: boolean, minM: number): LatLon | null {
  const [out, setOut] = useState<LatLon | null>(null);
  useEffect(() => {
    if (!active) return;
    setOut((prev) => (!prev || distMeters(prev, loc) >= minM ? loc : prev));
  }, [loc, active, minM]);
  return out;
}
