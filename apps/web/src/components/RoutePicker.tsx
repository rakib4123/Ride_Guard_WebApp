'use client';

import type { AdvisoryLevel } from '@rideguard/shared';
import { useT } from '@/i18n/LocaleContext';
import { fill } from '@/i18n/fill';
import { RISK_TOKENS } from '@/lib/riskTokens';
import type { RankedRoute } from '@/lib/routeRanking';

export interface RouteOption extends RankedRoute {
  level: AdvisoryLevel;
}

/**
 * Ranked route alternatives (spec 5.1): "Safer route — 6 min longer, avoids
 * a crash blackspot." Hidden entirely when there is only one route.
 */
export function RoutePicker({ options, selected, onSelect }: {
  options: RouteOption[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  const t = useT();
  if (options.length < 2) return null;
  return (
    <div className="mt-3">
      <h3 className="mb-1.5 text-xs font-semibold text-muted">{t('route.options')}</h3>
      <ul className="space-y-1.5" role="radiogroup" aria-label={t('route.options')}>
        {options.map((o) => {
          const token = RISK_TOKENS[o.level];
          const active = o.index === selected;
          // The fastest route has nothing to compare its time against.
          const time = o.extraMin >= 1 ? fill(t('route.longer'), { min: o.extraMin })
            : o.label === 'route.fastest' ? null : t('route.sameTime');
          const detail = [time, o.avoidsBlackspot ? t('route.avoidsBlackspot') : null].filter(Boolean).join(', ');
          return (
            <li key={o.index}>
              <button role="radio" aria-checked={active} onClick={() => onSelect(o.index)}
                className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${
                  active ? 'border-signal bg-signal/5' : 'border-line bg-white'}`}>
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-sm"
                  style={{ background: token.surface, color: token.onSurface }} aria-hidden="true">
                  {token.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-text">
                    {o.label === 'route.option' ? fill(t('route.option'), { n: o.n }) : t(o.label)}
                  </span>
                  <span className="block truncate text-xs text-muted">{detail}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
