'use client';

import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import type { LatLon } from '@rideguard/shared';
import { easeOutCubic, lerp, lerpLatLon, nearestAngle, prefersReducedMotion } from '@/lib/motion';

export interface MarkerFix extends LatLon {
  accuracyM: number;
  headingDeg: number | null;
}

/** A fix older than this greys the dot: the position may be out of date. */
const STALE_MS = 30_000;
const GLIDE_MS = 900;

let uid = 0;

function iconHtml(variant: 'dot' | 'arrow', id: string): string {
  if (variant === 'arrow') {
    return `<div class="rg-me rg-me--arrow"><div class="rg-me-turn">
      <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
        <path d="M24 5 L39 40 L24 32 L9 40 Z" fill="#2563EB" stroke="#FFFFFF" stroke-width="3.5" stroke-linejoin="round"/>
      </svg></div></div>`;
  }
  return `<div class="rg-me">
    <div class="rg-me-turn rg-me-cone"><svg viewBox="0 0 96 96" width="96" height="96" aria-hidden="true">
      <defs><radialGradient id="${id}" cx="50%" cy="50%" r="50%">
        <stop offset="0.15" stop-color="#2563EB" stop-opacity="0.42"/><stop offset="1" stop-color="#2563EB" stop-opacity="0"/>
      </radialGradient></defs>
      <path d="M48 48 L27 6 A46 46 0 0 1 69 6 Z" fill="url(#${id})"/></svg></div>
    <div class="rg-me-pulse"></div><div class="rg-me-dot"></div></div>`;
}

/**
 * The rider's own position: a blue dot with a pulse, an accuracy circle and a
 * heading beam — or, while riding, a navigation arrow. Between GPS fixes it
 * glides instead of jumping, and the beam turns the short way round.
 * Imperative Leaflet under the hood, so animation frames never re-render React.
 */
export function UserMarker({ fix, variant = 'dot' }: { fix: MarkerFix | null; variant?: 'dot' | 'arrow' }) {
  const map = useMap();
  const marker = useRef<L.Marker | null>(null);
  const circle = useRef<L.Circle | null>(null);
  const shown = useRef<{ pos: LatLon; acc: number; heading: number } | null>(null);
  const frame = useRef<number | null>(null);
  const lastFixAt = useRef(0);

  // Create once per map.
  useEffect(() => {
    const id = `rg-cone-${++uid}`;
    const size = variant === 'arrow' ? 48 : 96;
    marker.current = L.marker([0, 0], {
      icon: L.divIcon({ className: 'rg-me-icon', html: iconHtml(variant, id), iconSize: [size, size], iconAnchor: [size / 2, size / 2] }),
      interactive: false, keyboard: false, zIndexOffset: 1000,
    });
    if (variant === 'dot') {
      circle.current = L.circle([0, 0], {
        radius: 1, interactive: false, stroke: true, weight: 1, color: '#2563EB', opacity: 0.25,
        fillColor: '#2563EB', fillOpacity: 0.1,
      });
    }
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      marker.current?.remove(); circle.current?.remove();
      marker.current = null; circle.current = null; shown.current = null;
    };
  }, [map, variant]);

  // Follow each new fix.
  useEffect(() => {
    const m = marker.current;
    if (!m) return;
    if (!fix) { m.remove(); circle.current?.remove(); shown.current = null; return; }
    if (!map.hasLayer(m)) { m.addTo(map); circle.current?.addTo(map); }

    const el = m.getElement();
    const root = el?.querySelector('.rg-me') as HTMLElement | null;
    const turn = el?.querySelector('.rg-me-turn') as HTMLElement | null;
    root?.classList.toggle('has-heading', fix.headingDeg != null);
    root?.classList.remove('stale');

    const target = { lat: fix.lat, lon: fix.lon };
    const from = shown.current;
    const heading = fix.headingDeg != null
      ? (from ? nearestAngle(from.heading, fix.headingDeg) : fix.headingDeg)
      : (from?.heading ?? 0);
    if (turn) turn.style.transform = `rotate(${heading}deg)`;

    const place = (p: LatLon, acc: number) => {
      m.setLatLng([p.lat, p.lon]);
      circle.current?.setLatLng([p.lat, p.lon]).setRadius(acc);
    };
    if (frame.current) cancelAnimationFrame(frame.current);
    if (!from || prefersReducedMotion()) {
      place(target, fix.accuracyM);
      shown.current = { pos: target, acc: fix.accuracyM, heading };
    } else {
      // Glide over roughly the gap between fixes, so motion looks continuous.
      const now = performance.now();
      const dur = Math.min(GLIDE_MS * 1.5, Math.max(300, now - lastFixAt.current || GLIDE_MS));
      const start = now;
      const tick = (t: number) => {
        const k = easeOutCubic((t - start) / dur);
        const p = lerpLatLon(from.pos, target, k);
        const acc = lerp(from.acc, fix.accuracyM, k);
        place(p, acc);
        shown.current = { pos: p, acc, heading };
        if (k < 1) frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    }
    lastFixAt.current = performance.now();

    const staleTimer = window.setTimeout(() => root?.classList.add('stale'), STALE_MS);
    return () => window.clearTimeout(staleTimer);
  }, [fix, map]);

  return null;
}

/**
 * Keep the map on the rider while `follow` is on; the first drag turns it off
 * (like any map app), and the recenter button turns it back on.
 */
export function FollowMe({ target, follow, onUserPan, zoom }: {
  target: LatLon | null;
  follow: boolean;
  onUserPan?: () => void;
  /** Zoom to use when following starts. */
  zoom?: number;
}) {
  const map = useMap();
  const wasFollowing = useRef(false);

  useEffect(() => {
    if (!onUserPan) return;
    const off = () => onUserPan();
    map.on('dragstart', off);
    return () => { map.off('dragstart', off); };
  }, [map, onUserPan]);

  useEffect(() => {
    if (!follow || !target) { wasFollowing.current = follow; return; }
    const reduce = prefersReducedMotion();
    if (!wasFollowing.current) {
      map.flyTo([target.lat, target.lon], Math.max(map.getZoom(), zoom ?? 16), { animate: !reduce, duration: 0.8 });
    } else {
      map.panTo([target.lat, target.lon], { animate: !reduce, duration: 0.9, easeLinearity: 0.4 });
    }
    wasFollowing.current = true;
  }, [map, follow, target?.lat, target?.lon, zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
