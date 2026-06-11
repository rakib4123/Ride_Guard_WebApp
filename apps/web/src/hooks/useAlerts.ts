'use client';

import { useCallback, useRef, useState } from 'react';

export type AlertLevel = 'med' | 'high';
export interface AlertItem { id: string; message: string; level: AlertLevel; }
export interface Channels { sound: boolean; voice: boolean; vibrate: boolean; }

/**
 * Rider alerts across four channels. `arm()` must run from a user gesture
 * (the Start-ride tap) so the browser allows audio + speech.
 */
export function useAlerts() {
  const [banner, setBanner] = useState<AlertItem | null>(null);
  const [channels, setChannels] = useState<Channels>({ sound: true, voice: true, vibrate: true });
  const chRef = useRef(channels); chRef.current = channels;
  const last = useRef<Record<string, number>>({});
  const audio = useRef<AudioContext | null>(null);
  const timer = useRef<number | null>(null);

  const arm = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctx && !audio.current) audio.current = new Ctx();
      void audio.current?.resume();
      if (window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis.speak(u);
      }
    } catch { /* ignore */ }
  }, []);

  const beep = (level: AlertLevel) => {
    const ctx = audio.current; if (!ctx) return;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine'; o.frequency.value = level === 'high' ? 880 : 620;
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.start(t); o.stop(t + 0.37);
  };

  const fire = useCallback((id: string, message: string, level: AlertLevel) => {
    const now = Date.now();
    if (now - (last.current[id] || 0) < 9000) return; // de-dupe per type
    last.current[id] = now;
    setBanner({ id, message, level });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setBanner((b) => (b && b.id === id ? null : b)), 5000);
    const ch = chRef.current;
    if (ch.vibrate && 'vibrate' in navigator) navigator.vibrate(level === 'high' ? [200, 80, 200] : [160]);
    if (ch.sound) beep(level);
    if (ch.voice && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(message); u.rate = 1.05; window.speechSynthesis.speak(u);
    }
  }, []);

  const dismiss = useCallback(() => setBanner(null), []);
  return { banner, channels, setChannels, fire, arm, dismiss };
}
