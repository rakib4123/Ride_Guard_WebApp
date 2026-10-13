import type { LatLon } from './scoring';

/** Ask the API for a live-traffic route (Google Routes, two-wheeler). */
export interface TrafficRouteRequest {
  origin: LatLon;
  destination: LatLon;
}

/**
 * Live-traffic route. `available: false` means the server has no Google key or
 * Google failed; the client keeps its free route and time-of-day traffic guess.
 */
export type TrafficRouteResponse =
  | {
      available: true;
      source: 'google';
      path: LatLon[];
      distanceKm: number;
      /** Travel time with current traffic. */
      durationMin: number;
      /** Travel time with no traffic. */
      freeFlowMin: number;
      /** Live traffic mapped onto the model's 1 (light) .. 8 (gridlock) scale. */
      trafficDensity: number;
    }
  | { available: false; reason: 'not-configured' | 'google-error' };
