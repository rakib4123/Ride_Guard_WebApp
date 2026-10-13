'use client';

import dynamic from 'next/dynamic';
import type { LatLon } from '@rideguard/shared';
import { useLocale } from '@/i18n/LocaleContext';
import { fill } from '@/i18n/fill';
import { en, type MessageKey } from '@/i18n/messages/en';
import { bn } from '@/i18n/messages/bn';
import { RISK_TOKENS } from '@/lib/riskTokens';
import { fmt } from '@/lib/fmt';
import type { Verdict } from '@/lib/verdict';
import type { RiskRoad } from '@/lib/roadrisk';

const BackdropMap = dynamic(() => import('@/components/MapView').then((m) => m.BackdropMap), { ssr: false });

/**
 * Full-screen riding takeover (spec 4.2). The whole screen becomes the
 * verdict colour; speed dominates because it is the one thing the rider
 * controls. No risk number, no tab bar, nothing to tap but Stop: a figure the
 * rider cannot act on while moving is a distraction. Alerts still arrive by
 * sound, voice and vibration — this visual layer is a bonus, never the only
 * channel.
 */
export function RideMode({
  verdict, speedKmh, speedLimit, center, riskRoads, onStop,
}: {
  verdict: Verdict;
  speedKmh: number;
  speedLimit: number;
  center: LatLon;
  riskRoads: RiskRoad[];
  onStop: () => void;
}) {
  const { locale, t } = useLocale();
  const token = RISK_TOKENS[verdict.level];
  const titleKey = `risk.${verdict.level}.title` as MessageKey;
  const primary = (locale === 'bn' ? bn : en)[titleKey];
  const secondary = (locale === 'bn' ? en : bn)[titleKey];
  const over = speedKmh > speedLimit + 2;

  return (
    <div className="fixed inset-0 z-[1500] flex flex-col overflow-hidden"
      style={{ background: token.surface, color: token.onSurface }}>
      {/* Map as a faint hint only. Multiply keeps it from lightening the
          surface, so the measured text contrast still holds. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true"
        style={{ opacity: 0.28, mixBlendMode: 'multiply' }}>
        <BackdropMap center={center} riskRoads={riskRoads} />
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center px-6 text-center"
        style={{ paddingTop: 'env(safe-area-inset-top)' }} role="status" aria-live="polite">
        <span className="text-5xl leading-none" aria-hidden="true">{token.icon}</span>
        <p className="mt-3 text-3xl font-bold leading-tight" lang={locale}>{primary}</p>
        <p className="text-base font-semibold opacity-90" lang={locale === 'bn' ? 'en' : 'bn'}>{secondary}</p>

        <p className="mt-10 font-mono text-[74px] font-bold leading-none tabular" aria-label={`${fmt.speed(speedKmh)} ${t('ride.speedUnit')}`}>
          {fmt.speed(speedKmh)}
        </p>
        <p className="text-lg font-semibold">{t('ride.speedUnit')}</p>
        <p className={`mt-2 rounded-full px-3 py-1 text-base font-semibold ${over ? 'ring-2 ring-current' : 'opacity-90'}`}>
          ( {fill(t('ride.limit'), { limit: speedLimit })} )
        </p>
        {verdict.isPlaceholder && <p className="mt-4 text-sm font-semibold">{t('label.sample')}</p>}
      </div>

      <div className="relative px-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <button onClick={onStop}
          className="mx-auto flex min-h-14 w-full max-w-md items-center justify-center gap-3 rounded-2xl bg-white text-lg font-bold text-text shadow-lift">
          <span aria-hidden="true">■</span> {t('label.stopRide')}
        </button>
      </div>
    </div>
  );
}
