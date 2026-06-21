'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';
import {
  Circle, CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip,
  useMap, useMapEvents,
} from 'react-leaflet';
import type { Hotspot, LatLon, RouteSegment } from '@rideguard/shared';
import { riskColor } from '@/lib/format';

const DHAKA: [number, number] = [23.7806, 90.407];
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
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

function Recenter({ center, zoom }: { center: [number, number]; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom ?? map.getZoom());
  }, [center[0], center[1], zoom]); // eslint-disable-line react-hooks/exhaustive-deps
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

function HotspotLayer({ hotspots }: { hotspots: Hotspot[] }) {
  const color = (d: number) => (d < 0.4 ? '#16A34A' : d < 0.7 ? '#F59E0B' : '#EF4444');
  return (
    <>
      {hotspots.map((h, i) => (
        <Circle key={`h-${i}`} center={[h.lat, h.lon]}
          radius={200 + h.normDensity * 600}
          pathOptions={{ color: color(h.normDensity), fillColor: color(h.normDensity),
            fillOpacity: 0.1 + h.normDensity * 0.3, weight: 0 }} />
      ))}
    </>
  );
}

/** Pure hotspot display (used as a base layer elsewhere). */
export function HotspotMap({ hotspots }: { hotspots: Hotspot[] }) {
  const [k] = useState(() => `hs-${Math.random().toString(36).slice(2)}`);
  return (
    <MapContainer key={k} center={DHAKA} zoom={12} className="h-full w-full" scrollWheelZoom>
      <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
      <HotspotLayer hotspots={hotspots} />
    </MapContainer>
  );
}

/**
 * Interactive single-point picker: drag the pin or click the map to choose a
 * location; the pin is tinted by the live advisory level. Optional hotspot
 * heat layer underneath.
 */
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

export function PointPickerMap({
  value, onChange, level, hotspots = [], riskRoads = [], zoomControl = true,
}: {
  value: LatLon;
  onChange: (loc: LatLon) => void;
  level?: 'Low' | 'Medium' | 'High';
  hotspots?: Hotspot[];
  riskRoads?: { points: [number, number][]; color: string }[];
  zoomControl?: boolean;
}) {
  const color = level ? riskColor[level] : '#2563EB';
  const [k] = useState(() => `pt-${Math.random().toString(36).slice(2)}`);
  return (
    <MapContainer key={k} center={[value.lat, value.lon]} zoom={14} className="h-full w-full" scrollWheelZoom zoomControl={zoomControl}>
      <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
      <HotspotLayer hotspots={hotspots} />
      <RiskRoadsLayer roads={riskRoads} />
      <ClickToSet onSet={onChange} />
      <Recenter center={[value.lat, value.lon]} />
      <Marker
        position={[value.lat, value.lon]}
        draggable
        icon={pin(color)}
        eventHandlers={{
          dragend: (e) => {
            const p = e.target.getLatLng();
            onChange({ lat: p.lat, lon: p.lng });
          },
        }}
      />
    </MapContainer>
  );
}

/**
 * Interactive route picker: draggable A/B pins, click-to-move the active
 * endpoint, and the road route coloured by per-segment risk.
 */
export function RoutePickerMap({
  origin, dest, onOriginChange, onDestChange, clickTarget, segments = [], riskiestSegId = 0, zoomControl = true,
}: {
  origin: LatLon;
  dest: LatLon;
  onOriginChange: (loc: LatLon) => void;
  onDestChange: (loc: LatLon) => void;
  clickTarget: 'origin' | 'dest';
  segments?: RouteSegment[];
  riskiestSegId?: number;
  zoomControl?: boolean;
}) {
  const mid: [number, number] = segments.length
    ? [segments[Math.floor(segments.length / 2)].lat, segments[Math.floor(segments.length / 2)].lon]
    : [(origin.lat + dest.lat) / 2, (origin.lon + dest.lon) / 2];
  const [k] = useState(() => `rt-${Math.random().toString(36).slice(2)}`);

  return (
    <MapContainer key={k} center={mid} zoom={12} className="h-full w-full" scrollWheelZoom zoomControl={zoomControl}>
      <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
      <ClickToSet onSet={clickTarget === 'origin' ? onOriginChange : onDestChange} />
      <Recenter center={mid} />

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

      {segments[riskiestSegId] && segments.length > 1 && (
        <CircleMarker center={[segments[riskiestSegId].lat, segments[riskiestSegId].lon]} radius={9}
          pathOptions={{ color: '#E5484D', fillColor: '#E5484D', fillOpacity: 0.3, weight: 2 }}>
          <Tooltip>Riskiest point</Tooltip>
        </CircleMarker>
      )}

      <Marker position={[origin.lat, origin.lon]} draggable icon={pin('#2FBF71', 'A')}
        eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); onOriginChange({ lat: p.lat, lon: p.lng }); } }} />
      <Marker position={[dest.lat, dest.lon]} draggable icon={pin('#E5484D', 'B')}
        eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); onDestChange({ lat: p.lat, lon: p.lng }); } }} />
    </MapContainer>
  );
}
