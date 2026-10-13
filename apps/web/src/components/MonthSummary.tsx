'use client';

import { useT } from '@/i18n/LocaleContext';
import { fill } from '@/i18n/fill';
import { RISK_TOKENS } from '@/lib/riskTokens';
import { fmt } from '@/lib/fmt';
import type { MonthSummary as Summary } from '@/lib/tripSummary';

const LEVELS = ['Low', 'Medium', 'High'] as const;

/**
 * This month at a glance: rides, distance, and a stacked bar of how many read
 * clear / careful / high risk. Counts only — no trend, no streak, no coaching.
 */
export function MonthSummary({ summary }: { summary: Summary }) {
  const t = useT();
  const total = LEVELS.reduce((n, l) => n + summary.counts[l], 0);
  return (
    <div className="rounded-xl2 border border-line bg-panel p-4 shadow-card">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-text">{t('trips.month')}</h2>
        <p className="text-sm text-muted">
          {fill(t('trips.rides'), { n: summary.rides })}
          {summary.km > 0 && ` · ${fill(t('trips.km'), { km: fmt.km(summary.km) })}`}
        </p>
      </div>
      {total > 0 && (
        <>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-panel2" aria-hidden="true">
            {LEVELS.map((l) => summary.counts[l] > 0 && (
              <span key={l} style={{ width: `${(summary.counts[l] / total) * 100}%`, background: RISK_TOKENS[l].surface }} />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text">
            {LEVELS.map((l) => (
              <li key={l} className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full text-xs"
                  style={{ background: RISK_TOKENS[l].surface, color: RISK_TOKENS[l].onSurface }} aria-hidden="true">
                  {RISK_TOKENS[l].icon}
                </span>
                {t(`risk.${l}.title`)} <span className="font-mono tabular">{summary.counts[l]}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-2 text-xs text-muted">{t('trips.countsNote')}</p>
    </div>
  );
}
