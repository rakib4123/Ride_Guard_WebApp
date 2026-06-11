import type { LatLon, RoadType } from '@rideguard/shared';

/**
 * Forward + reverse geocoding via OpenStreetMap Nominatim (no API key). Reverse
 * lookups also classify the road type from OSM's `highway` tag, so the app can
 * fill Road_Type automatically instead of asking the rider. Biased to Dhaka.
 * Nominatim's public endpoint allows ~1 request/second and asks for attribution
 * — fine for development; self-host or use a paid provider for production.
 */
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const DHAKA_VIEWBOX = '90.30,23.95,90.55,23.65'; // left,top,right,bottom

export interface GeoResult {
  label: string;
  lat: number;
  lon: number;
}

export interface ReverseResult {
  name: string;
  roadType: RoadType;
}

export async function searchPlaces(query: string): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url =
    `${NOMINATIM}/search?format=jsonv2&q=${encodeURIComponent(q)}` +
    `&countrycodes=bd&viewbox=${DHAKA_VIEWBOX}&bounded=0&limit=6&accept-language=en`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
  return data.map((d) => ({ label: d.display_name, lat: Number(d.lat), lon: Number(d.lon) }));
}

/** Map an OSM `highway` tag to the model's three road types. */
function classifyHighway(tag?: string): RoadType {
  if (!tag) return 'City Road';
  const t = tag.toLowerCase();
  if (['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link'].includes(t)) return 'Highway';
  if (['residential', 'living_street', 'unclassified', 'service', 'track', 'road', 'path', 'lane'].includes(t)) return 'Village Road';
  return 'City Road'; // secondary, tertiary, and anything else
}

/** Reverse geocode a point into a place name + detected road type (one call). */
export async function reverseGeocodeDetailed(loc: LatLon): Promise<ReverseResult> {
  const url =
    `${NOMINATIM}/reverse?format=jsonv2&lat=${loc.lat}&lon=${loc.lon}` +
    `&accept-language=en&zoom=17&addressdetails=1`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return { name: coordLabel(loc), roadType: 'City Road' };
    const d = (await res.json()) as {
      display_name?: string; category?: string; type?: string; addresstype?: string;
    };
    const tag = d.category === 'highway' || d.addresstype === 'road' ? d.type : undefined;
    return { name: d.display_name ?? coordLabel(loc), roadType: classifyHighway(tag) };
  } catch {
    return { name: coordLabel(loc), roadType: 'City Road' };
  }
}

/** Name-only reverse geocode (used where road type isn't needed). */
export async function reverseGeocode(loc: LatLon): Promise<string> {
  return (await reverseGeocodeDetailed(loc)).name;
}

export const coordLabel = (loc: LatLon) => `${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`;
export const shortLabel = (label: string) => label.split(',').slice(0, 2).join(',').trim();
