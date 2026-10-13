import { Injectable, Logger } from '@nestjs/common';
import type { LatLon, TrafficRouteResponse } from '@rideguard/shared';

const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

/**
 * Only the fields the app uses. Google bills Routes by the fields requested,
 * so asking for less keeps each call in the cheapest tier that has traffic.
 */
const FIELD_MASK =
  'routes.duration,routes.staticDuration,routes.distanceMeters,routes.polyline.encodedPolyline';

/**
 * Live traffic from the Google Routes API, called only when the rider asks for
 * it. The key stays on the server (GOOGLE_MAPS_SERVER_KEY); without it every
 * call answers "not-configured" and the app keeps its free route and its
 * time-of-day traffic guess. Results are not cached: Google's Routes policies
 * restrict caching, so requests are kept down by calling on demand instead.
 */
@Injectable()
export class TrafficService {
  private readonly logger = new Logger(TrafficService.name);
  private readonly key = process.env.GOOGLE_MAPS_SERVER_KEY;
  /** Identical requests already on their way to Google share one call. */
  private readonly inFlight = new Map<string, Promise<TrafficRouteResponse>>();

  get configured(): boolean {
    return Boolean(this.key);
  }

  route(origin: LatLon, destination: LatLon): Promise<TrafficRouteResponse> {
    if (!this.key) {
      return Promise.resolve({ available: false, reason: 'not-configured' });
    }
    // ~10 m precision: taps on the same spot count as the same request.
    const k = [origin.lat, origin.lon, destination.lat, destination.lon]
      .map((v) => v.toFixed(4))
      .join(',');
    const pending = this.inFlight.get(k);
    if (pending) return pending;

    const p = this.fetchRoute(origin, destination).finally(() => this.inFlight.delete(k));
    this.inFlight.set(k, p);
    return p;
  }

  private async fetchRoute(origin: LatLon, destination: LatLon): Promise<TrafficRouteResponse> {
    try {
      const res = await fetch(ROUTES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.key as string,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lon } } },
          destination: {
            location: { latLng: { latitude: destination.lat, longitude: destination.lon } },
          },
          travelMode: 'TWO_WHEELER',
          routingPreference: 'TRAFFIC_AWARE',
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`Routes API ${res.status}: ${(await res.text()).slice(0, 200)}`);

      const data = (await res.json()) as {
        routes?: {
          duration?: string;
          staticDuration?: string;
          distanceMeters?: number;
          polyline?: { encodedPolyline?: string };
        }[];
      };
      const r = data.routes?.[0];
      const encoded = r?.polyline?.encodedPolyline;
      if (!r || !encoded) throw new Error('Routes API returned no route');

      const durationS = seconds(r.duration);
      const freeFlowS = seconds(r.staticDuration) || durationS;
      return {
        available: true,
        source: 'google',
        path: decodePolyline(encoded),
        distanceKm: (r.distanceMeters ?? 0) / 1000,
        durationMin: durationS / 60,
        freeFlowMin: freeFlowS / 60,
        trafficDensity: trafficDensityFromDelay(durationS, freeFlowS),
      };
    } catch (err) {
      this.logger.warn(`Live traffic unavailable: ${String(err)}`);
      return { available: false, reason: 'google-error' };
    }
  }
}

/** Google durations are strings like "1234s". */
function seconds(d?: string): number {
  const n = parseFloat(d ?? '');
  return Number.isFinite(n) ? n : 0;
}

/**
 * Map live delay onto the model's 1..8 traffic scale. Heuristic, not learned:
 * free-flowing traffic (no extra time) is 1, and twice the free-flow time or
 * worse is 8, linear in between.
 */
export function trafficDensityFromDelay(durationS: number, freeFlowS: number): number {
  if (!(freeFlowS > 0)) return 1;
  const ratio = durationS / freeFlowS;
  return Math.max(1, Math.min(8, Math.round(1 + 7 * (ratio - 1))));
}

/** Decode a Google encoded polyline (precision 5) into points. */
export function decodePolyline(encoded: string): LatLon[] {
  const out: LatLon[] = [];
  let i = 0;
  let lat = 0;
  let lon = 0;
  const next = (): number => {
    let shift = 0;
    let result = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < encoded.length) {
    lat += next();
    lon += next();
    out.push({ lat: lat / 1e5, lon: lon / 1e5 });
  }
  return out;
}
