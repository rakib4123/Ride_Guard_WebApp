import type {
  ScorePointResponse,
  ScoreRouteResponse,
  FeatureVector,
  LatLon,
  Hotspot,
  CreateTripInput,
  TripLog,
} from '@rideguard/shared';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  scorePoint: (features: FeatureVector, location: LatLon) =>
    post<ScorePointResponse>('/score', { features, location }),
  scoreRoute: (features: FeatureVector, path: LatLon[]) =>
    post<ScoreRouteResponse>('/score/route', { features, path }),
  hotspots: () => get<{ source: string; hotspots: Hotspot[] }>('/hotspots'),
  saveTrip: (trip: CreateTripInput) => post<TripLog>('/trips', trip),
};
