'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from '@/i18n/LocaleContext';
import { AlertBanner } from '@/components/AlertBanner';

export type AlertLevel = 'med' | 'high';
export interface AlertItem { id: string; message: string; level: AlertLevel; }
export interface Channels { sound: boolean; voice: boolean; vibrate: boolean; }

const STORAGE_KEY = 'rideguard.alertChannels';
const DEFAULT_CHANNELS: Channels = { sound: true, voice: true, vibrate: true };

interface AlertsState {
  channels: Channels;
  setChannels: (c: Channels) => void;
  /** Unlock audio + speech. Must run from a user gesture (a tap). */
  arm: () => void;
  fire: (id: string, message: string, level: AlertLevel) => void;
}

const Ctx = createContext<AlertsState | null>(null);

/**
 * Rider alerts across three channels plus an on-screen banner. App-wide so the
 * channel switches can live on Profile (with a "Test alert") while the Now
 * screen fires them during a ride. The banner is rendered here, once.
 */
export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const { locale } = useLocale();
  const [banner, setBanner] = useState<AlertItem | null>(null);
  const [channels, setChannelsState] = useState<Channels>(DEFAULT_CHANNELS);
  const chRef = useRef(channels); chRef.current = channels;
  const localeRef = useRef(locale); localeRef.current = locale;
  const last = useRef<Record<string, number>>({});
  const audio = useRef<AudioContext | null>(null);
  const timer = useRef<number | null>(null);

  // Read the stored choice after mount (no localStorage during SSR).
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
      if (saved && typeof saved === 'object') setChannelsState({ ...DEFAULT_CHANNELS, ...saved });
    } catch { /* blocked storage — defaults stand */ }
  }, []);

  const setChannels = useCallback((c: Channels) => {
    setChannelsState(c);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); } catch { /* session only */ }
  }, []);

  const arm = useCallback(() => {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC && !audio.current) audio.current = new AC();
      void audio.current?.resume();
      if (window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis.speak(u);
      }
    } catch { /* ignore */ }
  }, []);

  const fire = useCallback((id: string, message: string, level: AlertLevel) => {
    const now = Date.now();
    if (now - (last.current[id] || 0) < 9000) return; // de-dupe per type
    last.current[id] = now;
    setBanner({ id, message, level });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setBanner((b) => (b && b.id === id ? null : b)), 5000);
    const ch = chRef.current;
    if (ch.vibrate && 'vibrate' in navigator) navigator.vibrate(level === 'high' ? [200, 80, 200] : [160]);
    if (ch.sound) beep(audio.current, level);
    if (ch.voice && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(message);
      u.lang = localeRef.current === 'bn' ? 'bn-BD' : 'en-US';
      u.rate = 1.05;
      window.speechSynthesis.speak(u);
    }
  }, []);

  const value = useMemo<AlertsState>(
    () => ({ channels, setChannels, arm, fire }),
    [channels, setChannels, arm, fire],
  );
  return (
    <Ctx.Provider value={value}>
      {children}
      <AlertBanner alert={banner} onClose={() => setBanner(null)} />
    </Ctx.Provider>
  );
}

export function useAlerts(): AlertsState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAlerts must be used within AlertsProvider');
  return v;
}

function beep(ctx: AudioContext | null, level: AlertLevel) {
  if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = 'sine'; o.frequency.value = level === 'high' ? 880 : 620;
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  o.start(t); o.stop(t + 0.37);
}
