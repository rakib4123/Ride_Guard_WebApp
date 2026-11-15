'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/i18n/LocaleContext';
import { LanguageChip } from '@/components/LanguageToggle';
import { BottomSheet } from '@/components/BottomSheet';
import { MapCredit } from '@/components/map/MapCredit';

/**
 * Map-first screen scaffold: a full-screen map, floating top controls
 * (search, language, account), and a draggable bottom sheet — `sheet` always
 * shows, `sheetMore` is revealed by dragging up. Shared by Map and Route
 * (Now has its own layout).
 */
export function MapScreen({ map, top, sheet, sheetMore, floating }: {
  map: React.ReactNode;
  top: React.ReactNode;
  sheet: React.ReactNode;
  sheetMore?: React.ReactNode;
  /** Round buttons riding on the sheet's top edge (locate). */
  floating?: React.ReactNode;
}) {
  const { user } = useAuth();
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const initials = (user?.email ?? 'R').slice(0, 2).toUpperCase();

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-canvas">
      <div className="absolute inset-0">{map}</div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1250] px-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div className="mx-auto flex max-w-2xl items-start gap-2">
          <div className="pointer-events-auto min-w-0 flex-1">{top}</div>
          <LanguageChip />
          <Link href="/profile" aria-label={t('common.account')}
            className="pointer-events-auto flex h-12 w-12 flex-none items-center justify-center rounded-full bg-white text-sm font-semibold text-signal shadow-lift">
            {user ? initials : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />
              </svg>
            )}
          </Link>
        </div>
      </div>

      <BottomSheet
        open={expanded}
        onOpenChange={setExpanded}
        label={t('common.details')}
        floating={floating}
        peek={
          <>
            {sheet}
            {sheetMore && (
              <button onClick={() => setExpanded((o) => !o)} aria-expanded={expanded}
                className="mx-auto mt-1 flex min-h-11 items-center gap-1 px-3 text-sm font-medium text-signal">
                {t('common.details')}
                <span aria-hidden="true" className={`inline-block transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>▾</span>
              </button>
            )}
          </>
        }
      >
        {sheetMore && (
          <>
            {sheetMore}
            <MapCredit className="pt-1" />
          </>
        )}
      </BottomSheet>
    </div>
  );
}
