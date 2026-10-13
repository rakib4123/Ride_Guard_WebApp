'use client';

import Link from 'next/link';
import { useT } from '@/i18n/LocaleContext';

/** Always-present honest note (Handoff Section 11). Quiet, never dismissable. */
export function PlaceholderBanner() {
  const t = useT();
  return (
    <div className="border-b border-line bg-signal/[0.06] px-4 py-2 text-center text-xs text-signal">
      {t('banner.advisory')}{' '}
      <Link href="/about" className="underline underline-offset-2">{t('banner.why')}</Link>
    </div>
  );
}
