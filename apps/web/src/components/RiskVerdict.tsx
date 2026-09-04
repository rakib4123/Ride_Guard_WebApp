'use client';

import { RISK_TOKENS } from '@/lib/riskTokens';
import { useLocale } from '@/i18n/LocaleContext';
import { en, type MessageKey } from '@/i18n/messages/en';
import { bn } from '@/i18n/messages/bn';
import type { Verdict } from '@/lib/verdict';

type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, { pad: string; icon: string; title: string; sub: string }> = {
  sm: { pad: 'px-3 py-2', icon: 'text-lg', title: 'text-sm', sub: 'text-[10px]' },
  md: { pad: 'px-3 py-2.5', icon: 'text-xl', title: 'text-base', sub: 'text-[11px]' },
  lg: { pad: 'px-4 py-3', icon: 'text-2xl', title: 'text-xl', sub: 'text-xs' },
};

/**
 * The single source of truth for how a risk reading looks. Now, Route and Map
 * all render this, so the three screens cannot drift apart.
 *
 * Meaning is carried four ways — icon, Bengali word, English word, colour — so
 * that no single channel is load-bearing. Colour deficiency affects roughly 1
 * in 12 men, and a handlebar-mounted phone in daylight washes colour out.
 */
export function RiskVerdict({ verdict, size = 'md' }: { verdict: Verdict; size?: Size }) {
  const { locale, t } = useLocale();
  const token = RISK_TOKENS[verdict.level];
  const s = SIZES[size];

  // The four `risk.*.title` keys exist for every RiskLevel, so this is safe.
  const titleKey = `risk.${verdict.level}.title` as MessageKey;
  // Always show both scripts: the rider's own language leads, the other follows.
  const primary = (locale === 'bn' ? bn : en)[titleKey];
  const secondary = (locale === 'bn' ? en : bn)[titleKey];

  return (
    <div
      className={`flex items-center gap-3 rounded-xl2 ${s.pad}`}
      style={{ background: token.surface, color: token.onSurface }}
      role="status"
      aria-live="polite"
    >
      <span className={`${s.icon} flex-none leading-none`} aria-hidden="true">
        {token.icon}
      </span>

      <div className="min-w-0 flex-1">
        <div className={`${s.title} font-bold leading-tight`}>{primary}</div>
        <div className={`${s.sub} font-semibold opacity-90`}>{secondary}</div>
        {verdict.isPlaceholder && (
          <div className="mt-1 text-xs font-semibold" style={{ color: token.onSurface }}>
            {t('label.sample')}
          </div>
        )}
      </div>

      {verdict.score !== null && (
        <div className="flex-none text-right leading-none opacity-90">
          <div className="font-mono text-base font-bold tabular">{verdict.score}</div>
          <div className="text-[9px]">/100</div>
        </div>
      )}
    </div>
  );
}
