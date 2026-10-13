import type { LatLon } from '@rideguard/shared';

/**
 * Road routing via the public OSRM demo server (no API key). Asks for
 * alternatives so the Route screen can rank up to three routes by risk
 * (spec 5.1). Falls back to a straight line if OSRM is unavailable.
 * OSRM's public server only has a car profile, so durations are car estimates.
 */
const OSRM = 'https://router.project-osrm.org/route/v1/driving';
const MAX_ROUTES = 3;

export interface RoutePath {
  points: LatLon[];
  distanceKm: number;
  durationMin: number;
  /** True when OSRM failed and we fell back to a straight line. */
  fallback: boolean;
}

/** Up to three routes from a to b; a single straight line if routing fails. */
export async function fetchRoutes(a: LatLon, b: LatLon): Promise<RoutePath[]> {
  const url =
    `${OSRM}/${a.lon},${a.lat};${b.lon},${b.lat}` +
    `?overview=full&geometries=geojson&alternatives=true`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('osrm error');
    const routes = parseOsrmRoutes(await res.json());
    if (!routes.length) throw new Error('no route');
    return routes;
  } catch {
    return [{ points: [a, b], distanceKm: 0, durationMin: 0, fallback: true }];
  }
}

/** OSRM response -> routes, keeping at most three. */
export function parseOsrmRoutes(data: unknown): RoutePath[] {
  const routes = (data as { routes?: unknown[] })?.routes ?? [];
  return routes.slice(0, MAX_ROUTES).flatMap((r) => {
    const route = r as { geometry?: { coordinates?: [number, number][] }; distance?: number; duration?: number };
    const coords = route.geometry?.coordinates;
    if (!coords || coords.length < 2) return [];
    return [{
      points: coords.map(([lon, lat]) => ({ lat, lon })),
      distanceKm: (route.distance ?? 0) / 1000,
      durationMin: (route.duration ?? 0) / 60,
      fallback: false,
    }];
  });
}
