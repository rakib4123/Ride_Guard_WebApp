import type { Area, LatLon, RoadType } from '@rideguard/shared';

/**
 * Forward + reverse geocoding via OpenStreetMap Nominatim (no API key), worldwide.
 * Reverse lookups also classify the road (type, default limit, town or
 * countryside) so the app fills those inputs itself instead of asking the rider.
 * Nominatim's public endpoint allows ~1 request/second and asks for attribution
 * — fine for development; self-host or use a paid provider for heavy use.
 */
const NOMINATIM = 'https://nominatim.openstreetmap.org';

export interface GeoResult {
  label: string;
  lat: number;
  lon: number;
}

export interface ReverseResult {
  name: string;
  roadType: RoadType;
  /** Posted limit in km/h: OSM maxspeed where tagged, else the country's default for the road. */
  speedLimit: number;
  area: Area;
  /** ISO 3166-1 alpha-2, upper case (e.g. 'BD', 'GB', 'US'), or null if unknown. */
  country: string | null;
}

/**
 * Search places anywhere, ranked towards `near` (the map's current spot) so
 * "Station Road" finds the one in this city first.
 */
export async function searchPlaces(query: string, near?: LatLon): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const bias = near
    ? `&viewbox=${near.lon - 0.4},${near.lat + 0.3},${near.lon + 0.4},${near.lat - 0.3}&bounded=0`
    : '';
  const url = `${NOMINATIM}/search?format=jsonv2&q=${encodeURIComponent(q)}${bias}&limit=6&accept-language=en`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
  return data.map((d) => ({ label: d.display_name, lat: Number(d.lat), lon: Number(d.lon) }));
}

/** Default limits (km/h) per country for town / countryside / motorway roads. */
const LIMITS: Record<string, { urban: number; rural: number; motorway: number; urbanArterial?: number }> = {
  // Bangladesh: city streets and arterials 40; motorways/expressways 60 in town.
  BD: { urban: 40, rural: 80, motorway: 80, urbanArterial: 40 },
  // Great Britain: 30 mph built-up, 60 mph single carriageway, 70 mph motorway.
  GB: { urban: 48, rural: 97, motorway: 113 },
  // United States (typical): 25 mph town, 55 mph rural highway, 65 mph interstate.
  US: { urban: 40, rural: 89, motorway: 105 },
};
const DEFAULT_LIMITS = { urban: 50, rural: 80, motorway: 110 };

const MOTORWAY = ['motorway', 'motorway_link'];
const MAJOR = ['trunk', 'trunk_link', 'primary', 'primary_link'];
const MINOR = ['residential', 'living_street', 'unclassified', 'track', 'road', 'lane', 'service'];

/**
 * OSM `highway` tag + town/countryside + country -> the model's road type and a
 * default limit. In towns, trunk and primary roads are city arterials (Dhaka's
 * Airport Road, a British A-road through a town), and residential streets are
 * city streets — classing those "Village Road" once halved the risk there.
 */
export function classifyRoad(tag: string | undefined, area: Area, country: string | null):
  { roadType: RoadType; limit: number } {
  const t = (tag ?? '').toLowerCase();
  const L = (country && LIMITS[country]) || DEFAULT_LIMITS;
  if (MOTORWAY.includes(t)) {
    return { roadType: 'Highway', limit: area === 'Urban' && country === 'BD' ? 60 : L.motorway };
  }
  if (area === 'Urban') return { roadType: 'City Road', limit: L.urban };
  if (MAJOR.includes(t)) return { roadType: 'Highway', limit: L.rural };
  if (MINOR.includes(t)) return { roadType: 'Village Road', limit: Math.min(L.rural, country === 'GB' ? 97 : 50) };
  return { roadType: 'City Road', limit: Math.min(L.rural, 60) };
}

/** OSM maxspeed ("40", "40 km/h", "30 mph", "GB:nsl_single") -> km/h, or null. */
export function parseMaxspeed(v?: string): number | null {
  if (!v) return null;
  const named: Record<string, number> = { 'GB:nsl_single': 97, 'GB:nsl_dual': 113, 'GB:motorway': 113 };
  if (named[v.trim()]) return named[v.trim()];
  const m = v.match(/^\s*(\d+(?:\.\d+)?)\s*(mph)?/i);
  if (!m) return null;
  const n = Number(m[1]) * (m[2] ? 1.609344 : 1);
  return n >= 5 && n <= 150 ? Math.round(n) : null;
}

/** Town/city vs countryside from Nominatim's address parts. */
export function areaFromAddress(a: Record<string, string> | undefined): Area {
  if (!a) return 'Urban';
  if (a.city || a.town || a.city_district || a.suburb || a.borough || a.quarter || a.neighbourhood) return 'Urban';
  if (a.village || a.hamlet || a.isolated_dwelling || a.farm) return 'Rural';
  return 'Rural';
}

/** The model's speed-limit input range (the API refuses values outside it). */
const clampLimit = (kmh: number) => Math.max(20, Math.min(120, Math.round(kmh)));

/** Reverse geocode a point into a place name, road type, limit, area and country (one call). */
export async function reverseGeocodeDetailed(loc: LatLon): Promise<ReverseResult> {
  const url =
    `${NOMINATIM}/reverse?format=jsonv2&lat=${loc.lat}&lon=${loc.lon}` +
    `&accept-language=en&zoom=17&addressdetails=1&extratags=1`;
  const fallback = (): ReverseResult => ({
    name: coordLabel(loc), roadType: 'City Road', speedLimit: 40, area: 'Urban', country: null,
  });
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return fallback();
    const d = (await res.json()) as {
      display_name?: string; category?: string; type?: string; addresstype?: string;
      address?: Record<string, string>;
      extratags?: { maxspeed?: string } | null;
    };
    const tag = d.category === 'highway' || d.addresstype === 'road' ? d.type : undefined;
    const area = areaFromAddress(d.address);
    const country = d.address?.country_code?.toUpperCase() ?? null;
    const c = classifyRoad(tag, area, country);
    return {
      name: d.display_name ?? coordLabel(loc),
      roadType: c.roadType,
      speedLimit: clampLimit(parseMaxspeed(d.extratags?.maxspeed) ?? c.limit),
      area,
      country,
    };
  } catch {
    return fallback();
  }
}

/** Name-only reverse geocode (used where road type isn't needed). */
export async function reverseGeocode(loc: LatLon): Promise<string> {
  return (await reverseGeocodeDetailed(loc)).name;
}

export const coordLabel = (loc: LatLon) => `${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`;
export const shortLabel = (label: string) => label.split(',').slice(0, 2).join(',').trim();
