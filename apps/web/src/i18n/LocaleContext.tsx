'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { en, type MessageKey } from './messages/en';
import { bn } from './messages/bn';

export type Locale = 'en' | 'bn';

const STORAGE_KEY = 'rideguard.locale';
const CATALOGUES: Record<Locale, Record<MessageKey, string>> = { en, bn };

interface LocaleState {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: MessageKey) => string;
}

const Ctx = createContext<LocaleState | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  // Read the stored choice after mount: localStorage is unavailable during SSR,
  // and reading it in useState would desync the server and client markup.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'bn') setLocaleState(saved);
    } catch {
      /* private mode or blocked storage — English stands */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* choice still applies for this session */
    }
  }, []);

  const t = useCallback((key: MessageKey) => CATALOGUES[locale][key] ?? en[key], [locale]);

  const value = useMemo<LocaleState>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocale(): LocaleState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLocale must be used within LocaleProvider');
  return v;
}

/** Convenience for components that only translate. */
export function useT(): (key: MessageKey) => string {
  return useLocale().t;
}
