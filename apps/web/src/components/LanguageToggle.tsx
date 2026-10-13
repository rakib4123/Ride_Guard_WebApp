'use client';

import { useLocale, type Locale } from '@/i18n/LocaleContext';

const OPTIONS: { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'bn', label: 'বাংলা' },
];

export function LanguageToggle() {
  const { locale, setLocale } = useLocale();
  return (
    <div className="flex gap-2" role="group" aria-label="Language">
      {OPTIONS.map((o) => {
        const active = locale === o.value;
        return (
          <button
            key={o.value}
            onClick={() => setLocale(o.value)}
            aria-pressed={active}
            // min-h-11 keeps the 44px touch target from the spec.
            className={`min-h-11 flex-1 rounded-xl px-4 text-sm font-semibold transition ${
              active
                ? 'bg-signal text-white shadow-soft'
                : 'border border-line bg-panel2 text-text'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Compact one-tap switch for map screens' top bar (shows the OTHER language). */
export function LanguageChip() {
  const { locale, setLocale } = useLocale();
  const next: Locale = locale === 'bn' ? 'en' : 'bn';
  return (
    <button
      onClick={() => setLocale(next)}
      aria-label={next === 'bn' ? 'বাংলায় দেখুন' : 'Switch to English'}
      lang={next}
      className="pointer-events-auto flex h-11 min-w-11 flex-none items-center justify-center rounded-full border border-line bg-white px-3 text-sm font-semibold text-text shadow-soft"
    >
      {next === 'bn' ? 'বাং' : 'EN'}
    </button>
  );
}
