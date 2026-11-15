'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LatLon } from '@rideguard/shared';
import { distMeters } from '@/lib/roadrisk';

/** A GPS fix as the ride sees it. */
export interface RideFix extends LatLon {
  /** Degrees from north, or null when the phone does not know (stationary). */
  headingDeg: number | null;
  accuracyM: number;
}

/**
 * Live ride sensing. While active it tracks GPS position + speed and flags
 * "phone use while moving" — the screen being touched while the bike moves
 * faster than ~10 km/h. A browser can't see whether you physically hold the
 * phone, so interaction-while-moving is the honest, achievable signal.
 */
export function useRide() {
  const [riding, setRiding] = useState(false);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [phoneUse, setPhoneUse] = useState(false);
  const [fix, setFix] = useState<RideFix | null>(null);
  const [distanceKm, setDistanceKm] = useState(0);
  const [startedAt, setStartedAt] = useState(0);

  const watchId = useRef<number | null>(null);
  const lastInteract = useRef(0);
  const lastPos = useRef<{ lat: number; lon: number; t: number } | null>(null);
  const speedRef = useRef(0);
  const distM = useRef(0);
  const distAnchor = useRef<LatLon | null>(null);
  /** Accurate positions over the last minute, for "how far did I move". */
  const recent = useRef<{ t: number; p: LatLon }[]>([]);

  useEffect(() => {
    const mark = () => { lastInteract.current = Date.now(); };
    const evts = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    evts.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    return () => evts.forEach((e) => window.removeEventListener(e, mark));
  }, []);

  useEffect(() => {
    if (!riding) { setPhoneUse(false); return; }
    const id = window.setInterval(() => {
      const moving = speedRef.current > 10;
      const touched = Date.now() - lastInteract.current < 3000;
      setPhoneUse(moving && touched);
    }, 1500);
    return () => window.clearInterval(id);
  }, [riding]);

  /** Metres moved over the last minute (path length through accurate fixes). */
  const movedLastMinuteM = useCallback((): number => {
    const pts = recent.current;
    let m = 0;
    for (let i = 1; i < pts.length; i++) m += distMeters(pts[i - 1].p, pts[i].p);
    return m;
  }, []);

  const start = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    lastInteract.current = 0;
    distM.current = 0;
    distAnchor.current = null;
    recent.current = [];
    setDistanceKm(0);
    setStartedAt(Date.now());
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const { latitude: lat, longitude: lon, speed, accuracy, heading } = p.coords;
        const now = Date.now();
        let kmh = speed != null && !Number.isNaN(speed) ? speed * 3.6 : 0;
        if ((speed == null || Number.isNaN(speed)) && lastPos.current) {
          const d = distMeters(lastPos.current, { lat, lon });
          const dt = (now - lastPos.current.t) / 1000;
          if (dt > 0) kmh = (d / dt) * 3.6;
        }
        // Distance: only accurate fixes count, and the anchor moves only once
        // the rider has gone 10 m from it, so GPS jitter while stopped adds
        // nothing but slow riding still accumulates.
        if (accuracy <= 50) {
          if (!distAnchor.current) distAnchor.current = { lat, lon };
          const d = distMeters(distAnchor.current, { lat, lon });
          if (d >= 10) {
            distM.current += d;
            distAnchor.current = { lat, lon };
            setDistanceKm(distM.current / 1000);
          }
          recent.current.push({ t: now, p: { lat, lon } });
          while (recent.current.length && now - recent.current[0].t > 60_000) recent.current.shift();
        }
        lastPos.current = { lat, lon, t: now };
        kmh = Math.max(0, Math.min(160, kmh));
        speedRef.current = kmh;
        setSpeedKmh(Math.round(kmh));
        setFix({
          lat, lon, accuracyM: accuracy,
          headingDeg: heading != null && !Number.isNaN(heading) && kmh > 3 ? heading : null,
        });
      },
      () => { /* keep last known */ },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );
    setRiding(true);
  }, []);

  const stop = useCallback(() => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setRiding(false); setSpeedKmh(0); setPhoneUse(false);
    lastPos.current = null; speedRef.current = 0; recent.current = [];
  }, []);

  useEffect(() => () => { if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current); }, []);

  return { riding, speedKmh, phoneUse, fix, distanceKm, startedAt, movedLastMinuteM, start, stop };
}
