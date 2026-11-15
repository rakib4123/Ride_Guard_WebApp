'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * The rider's D2D choices. Both are opt-in: sharing a position with other
 * riders, and asking the browser to scan Bluetooth, each need consent.
 */
export interface CrowdSettings {
  /** Share my (anonymous, in-memory) position with nearby RideGuard riders. */
  share: boolean;
  /** Scan Bluetooth for other phones nearby (where the browser supports it). */
  scan: boolean;
}

const KEY = 'rideguard.crowd';
const EVENT = 'rideguard:crowd-settings';
const DEFAULTS: CrowdSettings = { share: false, scan: false };

function read(): CrowdSettings {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? 'null');
    return v && typeof v === 'object' ? { ...DEFAULTS, ...v } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

/** Shared between Profile (where they are set) and Now (where they are used). */
export function useCrowdSettings(): [CrowdSettings, (s: CrowdSettings) => void] {
  const [settings, setState] = useState<CrowdSettings>(DEFAULTS);
  useEffect(() => {
    setState(read());
    const sync = () => setState(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  const set = useCallback((s: CrowdSettings) => {
    setState(s);
    try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* session only */ }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [settings, set];
}
