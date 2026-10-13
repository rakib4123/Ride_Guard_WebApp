import { SPATIAL_KERNEL_SIGMA_M } from './constants';
import type { Hotspot, LatLon } from './scoring';

const EARTH_RADIUS_M = 6_371_000;

/** Beyond this distance from the outermost hotspot there is no crash data. */
const COVERAGE_MARGIN_M = 1_000;

/**
 * Builds the Tier-2 spatial prior pi(l) in [0,1] from the hotspot table.
 *
 * pi is a relative-risk PERCENTILE, matching the pipeline's corrected prior
 * (RideGuard_V1/src/tier2_v2.py): the share of recorded crashes that occurred
 * at places less crash-dense than l. The median crash location scores 0.5, the
 * fusion rule's neutral point, so the spatial term raises and lowers risk in
 * equal measure where riders actually ride.
 *
 * Density is a crash-count-weighted Gaussian kernel over hotspot centres. It is
 * weighted by `count`, not `normDensity`: the latter is built from the dataset's
 * Accident_Intensity field, which the project's audit found to be independent of
 * the recorded casualties.
 *
 * Outside the area the crash data covers, pi is 0.5: no data is not evidence of
 * safety, so it must not discount the rider's risk.
 */
export function makeSpatialPrior(hotspots: Hotspot[]): (p: LatLon) => number {
  if (hotspots.length === 0) return () => 0.5;

  const twoSigmaSq = 2 * SPATIAL_KERNEL_SIGMA_M * SPATIAL_KERNEL_SIGMA_M;
  const density = (p: LatLon): number => {
    let sum = 0;
    for (const h of hotspots) {
      const d = haversine(p, h);
      sum += h.count * Math.exp(-(d * d) / twoSigmaSq);
    }
    return sum;
  };

  // Reference distribution: density at each hotspot centre, weighted by the
  // crashes it holds, i.e. the density seen at recorded crash locations.
  const ref = hotspots
    .map((h) => ({ d: density(h), w: h.count }))
    .sort((a, b) => a.d - b.d);
  const total = ref.reduce((s, r) => s + r.w, 0);
  const cum: number[] = [];
  let acc = 0;
  for (const r of ref) cum.push((acc += r.w));

  const latPad = COVERAGE_MARGIN_M / 111_320;
  const lats = hotspots.map((h) => h.lat);
  const lons = hotspots.map((h) => h.lon);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const lonPad = latPad / Math.cos((midLat * Math.PI) / 180);
  const box = {
    minLat: Math.min(...lats) - latPad, maxLat: Math.max(...lats) + latPad,
    minLon: Math.min(...lons) - lonPad, maxLon: Math.max(...lons) + lonPad,
  };

  return (p: LatLon): number => {
    if (p.lat < box.minLat || p.lat > box.maxLat || p.lon < box.minLon || p.lon > box.maxLon) {
      return 0.5;
    }
    const d = density(p);
    // Weight of reference entries with density <= d (binary search).
    let lo = 0;
    let hi = ref.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ref[mid].d <= d) lo = mid + 1;
      else hi = mid;
    }
    return lo === 0 ? 0 : cum[lo - 1] / total;
  };
}

function haversine(a: LatLon, b: LatLon): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}
