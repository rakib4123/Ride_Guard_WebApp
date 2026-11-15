'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { distMeters } from '@/lib/roadrisk';

/** Where the rider is right now, for the "you are here" dot. */
export interface Me {
  lat: number;
  lon: number;
  accuracyM: number;
  /** Degrees from north while moving, else the last known heading, else null. */
  headingDeg: number | null;
  speedKmh: number;
  t: number;
}

export type LocationStatus = 'locating' | 'ok' | 'denied' | 'unavailable';

interface LocationState {
  me: Me | null;
  status: LocationStatus;
}

const Ctx = createContext<LocationState>({ me: null, status: 'locating' });

/**
 * One continuous GPS watch for the whole app, paused while the page is hidden
 * (no battery spent in the background). Heading comes from the GPS when moving;
 * when the phone gives none, it is worked out from the last few metres moved.
 */
export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [status, setStatus] = useState<LocationStatus>('locating');
  const lastMoved = useRef<{ lat: number; lon: number } | null>(null);
  const lastHeading = useRef<number | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setStatus('unavailable'); return; }
    let id: number | null = null;

    const start = () => {
      if (id != null) return;
      id = navigator.geolocation.watchPosition(
        (p) => {
          const { latitude: lat, longitude: lon, accuracy, heading, speed } = p.coords;
          const kmh = speed != null && !Number.isNaN(speed) ? Math.max(0, speed * 3.6) : 0;
          let h: number | null = heading != null && !Number.isNaN(heading) && kmh > 3 ? heading : null;
          if (h == null && lastMoved.current && accuracy <= 30) {
            const d = distMeters(lastMoved.current, { lat, lon });
            if (d >= 8) h = bearing(lastMoved.current, { lat, lon });
          }
          if (!lastMoved.current || distMeters(lastMoved.current, { lat, lon }) >= 8) lastMoved.current = { lat, lon };
          if (h != null) lastHeading.current = h;
          setMe({ lat, lon, accuracyM: accuracy, headingDeg: lastHeading.current, speedKmh: kmh, t: Date.now() });
          setStatus('ok');
        },
        (err) => setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
      );
    };
    const stop = () => { if (id != null) navigator.geolocation.clearWatch(id); id = null; };
    const onVis = () => (document.visibilityState === 'visible' ? start() : stop());

    start();
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); stop(); };
  }, []);

  const value = useMemo(() => ({ me, status }), [me, status]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useMe = () => useContext(Ctx);

/** Initial bearing from a to b, degrees from north. */
function bearing(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = Math.PI / 180;
  const y = Math.sin((b.lon - a.lon) * r) * Math.cos(b.lat * r);
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lon - a.lon) * r);
  return ((Math.atan2(y, x) / r) + 360) % 360;
}
