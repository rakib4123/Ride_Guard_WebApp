'use client';

import { useRef, useState } from 'react';
import type { AdvisoryLevel } from '@rideguard/shared';
import { useLocale } from '@/i18n/LocaleContext';
import { fill } from '@/i18n/fill';
import { en, type MessageKey } from '@/i18n/messages/en';
import { RISK_TOKENS } from '@/lib/riskTokens';
import { fmt } from '@/lib/fmt';
import type { SavedTrip } from '@/lib/trips';

const ACTION_W = 96; // px revealed by a swipe

/**
 * One saved ride (spec 7.1): verdict colour stripe, place names, time, the
 * reason it scored that way, and the score. Swipe left to reveal Delete —
 * there is no permanent Delete button beside every row. The Delete button
 * stays in the tab order, and focusing it slides the card open, so keyboard
 * and screen-reader users can delete too.
 */
export function TripCard({ trip, onDelete }: { trip: SavedTrip; onDelete: () => void }) {
  const { locale, t } = useLocale();
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; base: number } | null>(null);

  const level = (['Low', 'Medium', 'High'] as const).includes(trip.advisory as AdvisoryLevel)
    ? (trip.advisory as AdvisoryLevel) : 'Unknown';
  const token = RISK_TOKENS[level];
  const d = trip.data;
  const end = d?.locName || (trip.lat != null && trip.lon != null
    ? `${trip.lat.toFixed(3)}, ${trip.lon.toFixed(3)}` : t('trips.unknownPlace'));
  const place = d?.startName && d.startName !== end ? `${d.startName} → ${end}` : end;
  const reasonKey = d?.reasons?.find((k): k is MessageKey => k in en);
  const km = d?.distanceKm ?? 0;

  const settle = (x: number) => setDx(x < -ACTION_W / 2 ? -ACTION_W : 0);

  return (
    <li className="relative overflow-hidden rounded-xl border border-line bg-risk-high">
      <button onClick={onDelete} onFocus={() => setDx(-ACTION_W)} onBlur={() => setDx(0)}
        className="absolute inset-y-0 right-0 flex items-center justify-center text-sm font-semibold text-white"
        style={{ width: ACTION_W }}>
        {t('common.delete')}
      </button>
      <div
        className="relative flex items-stretch bg-white"
        style={{ transform: `translateX(${dx}px)`, transition: start.current ? 'none' : 'transform .2s ease', touchAction: 'pan-y' }}
        onPointerDown={(e) => {
          start.current = { x: e.clientX, y: e.clientY, base: dx };
          e.currentTarget.setPointerCapture(e.pointerId); // keep tracking past the card edge
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          if (Math.abs(e.clientY - s.y) > Math.abs(e.clientX - s.x)) return; // a scroll, not a swipe
          setDx(Math.max(-ACTION_W, Math.min(0, s.base + e.clientX - s.x)));
        }}
        onPointerUp={() => { start.current = null; settle(dx); }}
        onPointerCancel={() => { start.current = null; settle(dx); }}
      >
        <span className="w-1.5 flex-none" style={{ background: token.surface }} aria-hidden="true" />
        <div className="min-w-0 flex-1 px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-semibold text-text">{place}</p>
            <span className="flex-none font-mono tabular text-sm text-text">
              {trip.risk != null ? fmt.pct(trip.risk) : '—'}
            </span>
          </div>
          <p className="truncate text-xs text-muted">
            <span aria-hidden="true">{token.icon} </span>
            {fmt.dateTime(new Date(trip.created_at), locale)}
            {km > 0 && ` · ${fill(t('trips.km'), { km: fmt.km(km) })}`}
            {reasonKey && ` · ${t(reasonKey)}`}
          </p>
        </div>
      </div>
    </li>
  );
}
