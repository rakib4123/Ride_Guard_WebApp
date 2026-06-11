'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LatLon } from '@rideguard/shared';

const R = 6_371_000;
function haversine(a: LatLon, b: LatLon): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Live ride sensing. While active it tracks GPS position + speed and flags
 * "phone use while moving" — i.e. the screen is being touched while the bike is
 * moving faster than ~10 km/h. A browser can't see the throttle or whether you
 * physically hold a phone, so this interaction-while-moving signal is the
 * honest, achievable proxy.
 */
export function useRide() {
  const [riding, setRiding] = useState(false);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [phoneUse, setPhoneUse] = useState(false);
  const [fix, setFix] = useState<LatLon | null>(null);

  const watchId = useRef<number | null>(null);
  const lastInteract = useRef(0);
  const lastPos = useRef<{ lat: number; lon: number; t: number } | null>(null);
  const speedRef = useRef(0);

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
      const recent = Date.now() - lastInteract.current < 3000;
      setPhoneUse(moving && recent);
    }, 1500);
    return () => window.clearInterval(id);
  }, [riding]);

  const start = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    lastInteract.current = 0;
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const { latitude: lat, longitude: lon, speed } = p.coords;
        const now = Date.now();
        let kmh = speed != null && !Number.isNaN(speed) ? speed * 3.6 : 0;
        if ((speed == null || Number.isNaN(speed)) && lastPos.current) {
          const d = haversine(lastPos.current, { lat, lon });
          const dt = (now - lastPos.current.t) / 1000;
          if (dt > 0) kmh = (d / dt) * 3.6;
        }
        lastPos.current = { lat, lon, t: now };
        kmh = Math.max(0, Math.min(160, kmh));
        speedRef.current = kmh;
        setSpeedKmh(Math.round(kmh));
        setFix({ lat, lon });
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
    lastPos.current = null; speedRef.current = 0;
  }, []);

  useEffect(() => () => { if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current); }, []);

  return { riding, speedKmh, phoneUse, fix, start, stop };
}
