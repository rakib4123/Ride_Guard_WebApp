'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

/**
 * Map-first screen scaffold: a full-screen map with floating top controls, an
 * account button, and a collapsible bottom sheet that ends in the nav bar.
 * Shared by the Map and Route screens (the Now screen has its own richer layout).
 */
export function MapScreen({ map, top, sheet, sheetMore }: {
  map: React.ReactNode;
  top: React.ReactNode;
  sheet: React.ReactNode;
  sheetMore?: React.ReactNode;
}) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const initials = (user?.email ?? 'R').slice(0, 2).toUpperCase();

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-canvas">
      <div className="absolute inset-0">{map}</div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1200] px-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div className="mx-auto flex max-w-2xl items-start gap-2">
          <div className="pointer-events-auto min-w-0 flex-1">{top}</div>
          <Link href="/profile" aria-label="Account"
            className="pointer-events-auto flex h-11 w-11 flex-none items-center justify-center rounded-full border border-line bg-signal/10 text-sm font-semibold text-signal shadow-soft">
            {initials}
          </Link>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-[1200]">
        <div className="mx-auto max-w-2xl rounded-t-3xl border-t border-line bg-white px-4 pt-2"
          style={{ boxShadow: '0 -10px 30px rgba(15,23,42,0.10)', paddingBottom: 'calc(3.75rem + env(safe-area-inset-bottom))' }}>
          {sheetMore && (
            <button onClick={() => setExpanded((o) => !o)} aria-label={expanded ? 'Collapse' : 'Expand'} className="mx-auto mb-2 block">
              <span className="mx-auto block h-1 w-10 rounded-full bg-line" />
            </button>
          )}
          {sheet}
          {sheetMore && expanded && (
            <div className="mt-3 max-h-[42vh] space-y-4 overflow-y-auto border-t border-line pt-3">{sheetMore}</div>
          )}
        </div>
      </div>
    </div>
  );
}
