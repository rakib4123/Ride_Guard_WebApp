'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/i18n/LocaleContext';
import { LanguageChip } from '@/components/LanguageToggle';

/**
 * Map-first screen scaffold: a full-screen map with floating top controls,
 * language and account buttons, and a bottom sheet whose "Details" drawer
 * holds the technical breakdown. Shared by the Map and Route screens (Now has
 * its own layout).
 */
export function MapScreen({ map, top, sheet, sheetMore }: {
  map: React.ReactNode;
  top: React.ReactNode;
  sheet: React.ReactNode;
  sheetMore?: React.ReactNode;
}) {
  const { user } = useAuth();
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const initials = (user?.email ?? 'R').slice(0, 2).toUpperCase();

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-canvas">
      <div className="absolute inset-0">{map}</div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1200] px-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div className="mx-auto flex max-w-2xl items-start gap-2">
          <div className="pointer-events-auto min-w-0 flex-1">{top}</div>
          <LanguageChip />
          <Link href="/profile" aria-label={t('common.account')}
            className="pointer-events-auto flex h-11 w-11 flex-none items-center justify-center rounded-full border border-line bg-signal/10 text-sm font-semibold text-signal shadow-soft">
            {initials}
          </Link>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-[1200]">
        <div className="mx-auto max-w-2xl rounded-t-3xl border-t border-line bg-white px-4 pt-3"
          style={{ boxShadow: '0 -10px 30px rgba(15,23,42,0.10)', paddingBottom: 'calc(3.75rem + env(safe-area-inset-bottom))' }}>
          {sheet}
          {sheetMore && (
            <button onClick={() => setExpanded((o) => !o)} aria-expanded={expanded}
              className="mx-auto mt-1 flex min-h-11 items-center gap-1 px-3 text-sm font-medium text-signal">
              {t('common.details')} <span aria-hidden="true">{expanded ? '▴' : '▾'}</span>
            </button>
          )}
          {sheetMore && expanded && (
            <div className="max-h-[42vh] space-y-4 overflow-y-auto border-t border-line pt-3">{sheetMore}</div>
          )}
        </div>
      </div>
    </div>
  );
}
