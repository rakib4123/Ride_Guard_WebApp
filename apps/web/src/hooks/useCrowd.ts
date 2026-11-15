'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PRESENCE, type PresenceResponse } from '@rideguard/shared';
import { api } from '@/lib/api';
import { estimateBleCrowd, type BleCrowd, type BleSample } from '@/lib/bleCrowd';
import { bleScanSupported, startBleScan } from '@/lib/bleScan';
import type { CrowdSettings } from '@/lib/crowdSettings';
import type { RideFix } from '@/hooks/useRide';

/** A new random session id this often, so a ride cannot be followed end to end. */
const ROTATE_MS = 10 * 60_000;
const BLE_EVERY_MS = 3_000;

export interface Crowd {
  presence: PresenceResponse | null;
  ble: BleCrowd | null;
  bleSupported: boolean;
  bleActive: boolean;
  /**
   * Vehicles/groups around the rider, or null when nothing is measuring. The
   * two channels overlap (a RideGuard rider also shows up over Bluetooth), so
   * they are combined with max, not added.
   */
  vehiclesAround: number | null;
}

/**
 * D2D crowd sensing during a ride: RideGuard riders via the presence API, and
 * other phones via Bluetooth where the browser can scan. Both group phones
 * into vehicles first, so a full bus counts once.
 */
export function useCrowd(opts: {
  riding: boolean;
  fix: RideFix | null;
  speedKmh: number;
  startedAt: number;
  movedLastMinuteM: () => number;
  settings: CrowdSettings;
}) {
  const { riding, fix, speedKmh, startedAt, movedLastMinuteM, settings } = opts;
  const [presence, setPresence] = useState<PresenceResponse | null>(null);
  const [ble, setBle] = useState<BleCrowd | null>(null);
  const [bleActive, setBleActive] = useState(false);
  const samples = useRef<BleSample[]>([]);
  const stopScan = useRef<(() => void) | null>(null);
  const session = useRef<{ id: string; since: number } | null>(null);
  const latest = useRef({ fix, speedKmh });
  latest.current = { fix, speedKmh };

  // Presence: post every few seconds while riding and sharing.
  useEffect(() => {
    if (!riding || !settings.share) { setPresence(null); return; }
    let active = true;
    const post = () => {
      const { fix: f, speedKmh: v } = latest.current;
      if (!f) return;
      const now = Date.now();
      if (!session.current || now - session.current.since > ROTATE_MS) {
        session.current = { id: crypto.randomUUID(), since: now };
      }
      api.presence({
        sessionId: session.current.id, lat: f.lat, lon: f.lon,
        speedKmh: v, headingDeg: f.headingDeg, accuracyM: f.accuracyM,
      }).then((r) => { if (active) setPresence(r); }).catch(() => { /* keep the last answer */ });
    };
    post();
    const id = window.setInterval(post, PRESENCE.intervalMs);
    return () => { active = false; window.clearInterval(id); session.current = null; };
  }, [riding, settings.share]);

  /** Start the Bluetooth scan. Call from the Start-ride tap (a user gesture). */
  const startBle = useCallback(async () => {
    if (!settings.scan || !bleScanSupported() || stopScan.current) return;
    samples.current = [];
    try {
      stopScan.current = await startBleScan((s) => {
        samples.current.push(s);
        if (samples.current.length > 20_000) samples.current.splice(0, 5_000);
      });
      setBleActive(true);
    } catch {
      setBleActive(false); // permission refused or unsupported
    }
  }, [settings.scan]);

  const stopBle = useCallback(() => {
    stopScan.current?.();
    stopScan.current = null;
    samples.current = [];
    setBleActive(false);
    setBle(null);
  }, []);

  // Re-estimate the Bluetooth crowd every few seconds.
  useEffect(() => {
    if (!riding || !bleActive) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      samples.current = samples.current.filter((s) => now - s.t <= 60_000);
      setBle(estimateBleCrowd(samples.current, { now, rideStart: startedAt, movedLastMinuteM: movedLastMinuteM() }));
    }, BLE_EVERY_MS);
    return () => window.clearInterval(id);
  }, [riding, bleActive, startedAt, movedLastMinuteM]);

  useEffect(() => { if (!riding) stopBle(); }, [riding, stopBle]);
  useEffect(() => () => stopScan.current?.(), []);

  const counts = [presence?.groupsNearby, ble?.groups].filter((n): n is number => typeof n === 'number');
  const crowd: Crowd = {
    presence, ble, bleActive,
    bleSupported: bleScanSupported(),
    vehiclesAround: counts.length ? Math.max(...counts) : null,
  };
  return { crowd, startBle, stopBle };
}
