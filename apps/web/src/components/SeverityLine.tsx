'use client';

import type { SeverityEstimate } from '@rideguard/shared';
import { useT } from '@/i18n/LocaleContext';
import { fill } from '@/i18n/fill';
import { fmt } from '@/lib/fmt';

/**
 * "If a crash happened here now: N% chance of death or serious injury."
 * Says where the number comes from, and says so plainly when it has not been
 * checked for the country the rider is in.
 */
export function SeverityLine({ severity, country }: { severity: SeverityEstimate; country: string | null }) {
  const t = useT();
  const checked = country != null && severity.validatedIn.includes(country);
  return (
    <div className="text-sm text-text">
      <p className="font-semibold">{fill(t('now.detail.severity'), { pct: fmt.pct(severity.ksi) })}</p>
      <p className="text-xs text-muted">{t(checked ? 'now.detail.severityChecked' : 'now.detail.severityElsewhere')}</p>
    </div>
  );
}
