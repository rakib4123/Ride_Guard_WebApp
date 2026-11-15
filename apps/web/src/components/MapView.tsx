'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo, useState } from 'react';
import {
  Circle, CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip,
  useMap, useMapEvents,
} from 'react-leaflet';
import type { Hotspot, LatLon, RouteSegment } from '@rideguard/shared';
import { riskColor } from '@/lib/format';
import { RISK_TOKENS } from '@/lib/riskTokens';
import { distMeters } from '@/lib/roadrisk';
import { prefersReducedMotion } from '@/lib/motion';
import { FollowMe, UserMarker, type MarkerFix } from '@/components/map/UserMarker';

// Since 29 Sep 2026 CARTO serves an "API KEY REQUIRED" image instead of map
// tiles unless the URL carries ?key=. The key is free for non-commercial use
// (carto.com/basemaps/apikey); it ships to the browser, so restrict it to this
// site's domain in the CARTO dashboard.
const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_KEY;
// "Voyager": a colourful street map with clear road hierarchy, easier to read
// at a glance than the pale light_all style.
const TILE_URL =
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png' +
  (CARTO_KEY ? `?key=${encodeURIComponent(CARTO_KEY)}` : '');
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** Teardrop pin as an inline SVG divIcon (avoids bundler image-path issues). */
function pin(color: string, label?: string) {
  return L.divIcon({
    className: 'rg-pin',
    html: `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0C7 0 1 6 1 14c0 9 14 26 14 26s14-17 14-26C29 6 23 0 15 0z"
        fill="${color}" stroke="#FFFFFF" stroke-width="2"/>
      <circle cx="15" cy="14" r="5" fill="#FFFFFF"/>
      ${label ? `<text x="15" y="17.5" text-anchor="middle" font-size="8" fill="${color}" font-family="monospace">${label}</text>` : ''}
    </svg>`,
    iconSize: [30, 40],
    iconAnchor: [15, 38],
  });
}

/** Glide to a new centre (a searched or tapped place) instead of jumping. */
function Recenter({ center, zoom, enabled = true }: { center: [number, number]; zoom?: number; enabled?: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled) return;
    const c = map.getCenter();
    const far = map.distance(c, center) > 3_000;
    if (prefersReducedMotion()) map.setView(center, zoom ?? map.getZoom());
    else if (far) map.flyTo(center, zoom ?? Math.max(map.getZoom(), 15), { duration: 0.9 });
    else map.panTo(center, { animate: true, duration: 0.6 });
  }, [center[0], center[1], zoom, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function ClickToSet({ onSet }: { onSet: (loc: LatLon) => void }) {
  useMapEvents({
    click(e) {
      onSet({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
  });
  return null;
}

/**
 * Hotspots as soft blooms, not hard-edged circles (spec 6). The crash
 * coordinates are geocoded place-name centroids, so a crisp disc would claim a
 * precision the data does not have. Three stacked translucent rings fade out
 * from the centre; strength is the hotspot's crash-count rank.
 */
/** Blooms drawn: the busiest cells. Three circles each, so keep phones fast. */
const MAX_BLOOMS = 200;

function HotspotBlooms({ hotspots }: { hotspots: Hotspot[] }) {
  const ranked = useMemo(() => {
    const top = [...hotspots].sort((a, b) => b.count - a.count).slice(0, MAX_BLOOMS);
    const counts = top.map((h) => h.count).sort((a, b) => a - b);
    const rank = (c: number) => (counts.length > 1 ? counts.indexOf(c) / (counts.length - 1) : 1);
    return top.map((h) => ({ h, strength: rank(h.count) }));
  }, [hotspots]);
  const color = RISK_TOKENS.High.surface;
  return (
    <>
      {ranked.map(({ h, strength }, i) => {
        // Squared so the many small clusters stay faint and only the genuinely
        // crash-heavy places read as hot; 253 equal blooms tint the whole city.
        const s2 = strength * strength;
        const r = 150 + s2 * 350;
        return [1, 0.6, 0.3].map((f) => (
          <Circle key={`h-${i}-${f}`} center={[h.lat, h.lon]} radius={r * f} interactive={false}
            pathOptions={{ stroke: false, fillColor: color, fillOpacity: 0.015 + s2 * 0.09 }} />
        ));
      })}
    </>
  );
}

function RiskRoadsLayer({ roads }: { roads: { points: [number, number][]; color: string }[] }) {
  return (
    <>
      {roads.map((r, i) => (
        <Polyline key={`rr-${i}`} positions={r.points}
          pathOptions={{ color: r.color, weight: 5, opacity: 0.75, lineCap: 'round', lineJoin: 'round' }} />
      ))}
    </>
  );
}

/**
 * Interactive single-point picker: drag the pin or click the map to choose a
 * location; the pin is tinted by the live advisory level. Optional hotspot
 * blooms and risk-coloured roads underneath.
 */
export function PointPickerMap({
  value, onChange, level, hotspots = [], riskRoads = [], zoomControl = true,
  me = null, follow = false, onUserPan, showPin = true,
}: {
  value: LatLon;
  onChange: (loc: LatLon) => void;
  level?: 'Low' | 'Medium' | 'High';
  hotspots?: Hotspot[];
  riskRoads?: { points: [number, number][]; color: string }[];
  zoomControl?: boolean;
  /** The rider's live position (blue dot). */
  me?: MarkerFix | null;
  /** Keep the map on `me`; the first drag calls onUserPan. */
  follow?: boolean;
  onUserPan?: () => void;
  /** Show the pin for `value` (off while the reading is simply "where I am"). */
  showPin?: boolean;
}) {
  const color = level ? riskColor[level] : '#2563EB';
  const [k] = useState(() => `pt-${Math.random().toString(36).slice(2)}`);
  return (
    <MapContainer key={k} center={[value.lat, value.lon]} zoom={15} className="h-full w-full" scrollWheelZoom
      zoomControl={zoomControl} attributionControl={false} zoomAnimation fadeAnimation markerZoomAnimation>
      <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
      <HotspotBlooms hotspots={hotspots} />
      <RiskRoadsLayer roads={riskRoads} />
      <ClickToSet onSet={onChange} />
      <Recenter center={[value.lat, value.lon]} enabled={!follow} />
      <FollowMe target={me} follow={follow} onUserPan={onUserPan} />
      <UserMarker fix={me} />
      {showPin && <Marker
        position={[value.lat, value.lon]}
        draggable
        icon={pin(color)}
        eventHandlers={{
          dragend: (e) => {
            const p = e.target.getLatLng();
            onChange({ lat: p.lat, lon: p.lng });
          },
        }}
      />}
    </MapContainer>
  );
}

/**
 * Non-interactive map that follows the rider, for ride mode's dimmed
 * background. Nothing on it can be tapped: the rider should not be using it.
 */
export function BackdropMap({ center, riskRoads = [], me = null }: {
  center: LatLon;
  riskRoads?: { points: [number, number][]; color: string }[];
  /** The rider, drawn as a navigation arrow the map follows. */
  me?: MarkerFix | null;
}) {
  const [k] = useState(() => `bd-${Math.random().toString(36).slice(2)}`);
  return (
    <MapContainer key={k} center={[center.lat, center.lon]} zoom={17} className="h-full w-full"
      zoomControl={false} dragging={false} scrollWheelZoom={false} doubleClickZoom={false}
      touchZoom={false} keyboard={false} boxZoom={false} attributionControl={false}>
      <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
      <RiskRoadsLayer roads={riskRoads} />
      {me ? <FollowMe target={me} follow zoom={17} /> : <Recenter center={[center.lat, center.lon]} />}
      <UserMarker fix={me} variant="arrow" />
    </MapContainer>
  );
}

/**
 * Interactive route picker: draggable A/B pins, a tap moves whichever pin is
 * nearer (spec 5: no A/B mode switch, a reliable source of wrong-pin errors),
 * the selected route coloured by per-segment risk, and the other alternatives
 * drawn faintly — tap one to select it.
 */
export function RoutePickerMap({
  origin, dest, onOriginChange, onDestChange, segments = [], riskiestSegId = 0,
  riskiestLabel, alternatives = [], onSelectAlternative, zoomControl = true, me = null,
}: {
  origin: LatLon;
  dest: LatLon;
  onOriginChange: (loc: LatLon) => void;
  onDestChange: (loc: LatLon) => void;
  segments?: RouteSegment[];
  riskiestSegId?: number;
  riskiestLabel?: string;
  /** Unselected routes, by index into the route list. */
  alternatives?: { index: number; points: LatLon[] }[];
  onSelectAlternative?: (index: number) => void;
  zoomControl?: boolean;
  me?: MarkerFix | null;
}) {
  const mid: [number, number] = segments.length
    ? [segments[Math.floor(segments.length / 2)].lat, segments[Math.floor(segments.length / 2)].lon]
    : [(origin.lat + dest.lat) / 2, (origin.lon + dest.lon) / 2];
  const [k] = useState(() => `rt-${Math.random().toString(36).slice(2)}`);
  const moveNearest = (p: LatLon) =>
    (distMeters(p, origin) <= distMeters(p, dest) ? onOriginChange : onDestChange)(p);
  const riskiest = segments.find((s) => s.segId === riskiestSegId);

  return (
    <MapContainer key={k} center={mid} zoom={12} className="h-full w-full" scrollWheelZoom
      zoomControl={zoomControl} attributionControl={false}>
      <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
      <ClickToSet onSet={moveNearest} />
      <Recenter center={mid} />
      <UserMarker fix={me} />

      {alternatives.map((a) => (
        <Polyline key={`alt-${a.index}`} positions={a.points.map((p) => [p.lat, p.lon] as [number, number])}
          pathOptions={{ color: '#5B6675', weight: 5, opacity: 0.35 }}
          eventHandlers={{ click: () => onSelectAlternative?.(a.index) }} />
      ))}

      {segments.length > 1
        ? segments.slice(0, -1).map((s, i) => (
            <Polyline key={i}
              positions={[[s.lat, s.lon], [segments[i + 1].lat, segments[i + 1].lon]]}
              pathOptions={{ color: riskColor[s.level], weight: 6, opacity: 0.9 }} />
          ))
        : (
          <Polyline positions={[[origin.lat, origin.lon], [dest.lat, dest.lon]]}
            pathOptions={{ color: '#93A0B4', weight: 3, dashArray: '6 8', opacity: 0.6 }} />
        )}

      {riskiest && segments.length > 1 && (
        <CircleMarker center={[riskiest.lat, riskiest.lon]} radius={9}
          pathOptions={{ color: RISK_TOKENS.High.surface, fillColor: RISK_TOKENS.High.surface, fillOpacity: 0.3, weight: 2 }}>
          {riskiestLabel && <Tooltip>{riskiestLabel}</Tooltip>}
        </CircleMarker>
      )}

      <Marker position={[origin.lat, origin.lon]} draggable icon={pin(RISK_TOKENS.Low.surface, 'A')}
        eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); onOriginChange({ lat: p.lat, lon: p.lng }); } }} />
      <Marker position={[dest.lat, dest.lon]} draggable icon={pin(RISK_TOKENS.High.surface, 'B')}
        eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); onDestChange({ lat: p.lat, lon: p.lng }); } }} />
    </MapContainer>
  );
}
