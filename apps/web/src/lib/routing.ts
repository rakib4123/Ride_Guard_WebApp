import type { LatLon } from '@rideguard/shared';

/**
 * Road routing via the public OSRM demo server (no API key). Returns the route
 * geometry as an ordered list of points; the API then samples it every 75 m and
 * scores each sample. Falls back to a straight line if OSRM is unavailable.
 * This is the OpenStreetMap equivalent of the Google Directions polyline.
 */
const OSRM = 'https://router.project-osrm.org/route/v1/driving';

export interface RoutePath {
  points: LatLon[];
  distanceKm: number;
  /** True when OSRM failed and we fell back to a straight line. */
  fallback: boolean;
}

export async function fetchRoute(a: LatLon, b: LatLon): Promise<RoutePath> {
  const url =
    `${OSRM}/${a.lon},${a.lat};${b.lon},${b.lat}` +
    `?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('osrm error');
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) throw new Error('no route');
    const coords: [number, number][] = route.geometry.coordinates;
    return {
      points: coords.map(([lon, lat]) => ({ lat, lon })),
      distanceKm: (route.distance ?? 0) / 1000,
      fallback: false,
    };
  } catch {
    return { points: [a, b], distanceKm: 0, fallback: true };
  }
}
