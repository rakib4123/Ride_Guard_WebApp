import type { Hotspot, LatLon } from '@rideguard/shared';
import { SPATIAL_KERNEL_SIGMA_M, FUSION_LAMBDA } from '@rideguard/shared';

const R_EARTH = 6_371_000;

export function distMeters(a: LatLon, b: LatLon): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(h));
}

/** Replicates the API's spatial prior (Gaussian kernel over hotspots, sigma=300m). */
export function spatialPriorAt(p: LatLon, hotspots: Hotspot[]): number {
  if (!hotspots.length) return 0.5;
  const twoSig = 2 * SPATIAL_KERNEL_SIGMA_M * SPATIAL_KERNEL_SIGMA_M;
  let max = 0;
  for (const h of hotspots) {
    const d = distMeters(p, { lat: h.lat, lon: h.lon });
    const k = h.normDensity * Math.exp(-(d * d) / twoSig);
    if (k > max) max = k;
  }
  return Math.max(0, Math.min(1, max));
}

/** Fuse behaviour score s with spatial prior pi: R = clip(s*(1+0.30*(2*pi-1)),0,1). */
export function fuseRisk(s: number, pi: number): number {
  return Math.max(0, Math.min(1, s * (1 + FUSION_LAMBDA * (2 * pi - 1))));
}

export function riskHexFor(R: number): string {
  return R < 0.33 ? '#16A34A' : R < 0.6 ? '#F59E0B' : '#EF4444';
}

export interface RiskRoad {
  points: [number, number][];
  color: string;
}

const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/** Fetch the road network around a point from OpenStreetMap via Overpass. */
export async function fetchNearbyRoads(center: LatLon, radiusM = 600): Promise<LatLon[][]> {
  const q =
    `[out:json][timeout:25];` +
    `way(around:${radiusM},${center.lat},${center.lon})` +
    `["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|service)$"];` +
    `out geom;`;
  for (const ep of OVERPASS) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: q,
      });
      if (!res.ok) continue;
      const j = await res.json();
      const roads: LatLon[][] = [];
      for (const el of j.elements ?? []) {
        if (el.type === 'way' && Array.isArray(el.geometry)) {
          roads.push(el.geometry.map((g: { lat: number; lon: number }) => ({ lat: g.lat, lon: g.lon })));
        }
      }
      if (roads.length) return roads;
    } catch {
      /* try next mirror */
    }
  }
  return [];
}

/**
 * Colour each road by risk at each segment's midpoint, merging consecutive
 * same-colour segments into one polyline so the map stays light.
 */
export function buildRiskRoads(
  roads: LatLon[][],
  hotspots: Hotspot[],
  behaviour: number,
  cap = 800,
): RiskRoad[] {
  const out: RiskRoad[] = [];
  let count = 0;
  for (const road of roads) {
    if (road.length < 2) continue;
    let runColor = '';
    let run: [number, number][] = [];
    for (let i = 0; i < road.length - 1; i++) {
      const a = road[i];
      const b = road[i + 1];
      const mid = { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 };
      const c = riskHexFor(fuseRisk(behaviour, spatialPriorAt(mid, hotspots)));
      if (c !== runColor) {
        if (run.length >= 2) { out.push({ points: run, color: runColor }); count++; }
        runColor = c;
        run = [[a.lat, a.lon], [b.lat, b.lon]];
      } else {
        run.push([b.lat, b.lon]);
      }
    }
    if (run.length >= 2) { out.push({ points: run, color: runColor }); count++; }
    if (count >= cap) break;
  }
  return out;
}
