'use client';

import dynamic from 'next/dynamic';
import type { LatLon } from '@rideguard/shared';
import { useLocale } from '@/i18n/LocaleContext';
import { fill } from '@/i18n/fill';
import { en, type MessageKey } from '@/i18n/messages/en';
import { bn } from '@/i18n/messages/bn';
import { RISK_TOKENS } from '@/lib/riskTokens';
import type { Verdict } from '@/lib/verdict';
import type { RiskRoad } from '@/lib/roadrisk';
import type { Crowd } from '@/hooks/useCrowd';
import type { RideFix } from '@/hooks/useRide';
import { useMe } from '@/context/LocationContext';
import { inUnit, type SpeedUnit } from '@/lib/units';
import { MapCredit } from '@/components/map/MapCredit';

const BackdropMap = dynamic(() => import('@/components/MapView').then((m) => m.BackdropMap), { ssr: false });

/**
 * Riding view, navigation style. The map follows the rider with a heading
 * arrow; the verdict sits on top and its colour frames the whole screen, so it
 * reads in peripheral vision; speed dominates because it is the one thing the
 * rider controls. Nothing to tap but Stop, and the map itself is inert: a
 * moving rider should not be using it. Alerts still arrive by sound, voice and
 * vibration — this visual layer is a bonus, never the only channel.
 */
export function RideMode({
  verdict, speedKmh, speedLimit, unit, center, fix, riskRoads, crowd, measuring, onStop,
}: {
  verdict: Verdict;
  speedKmh: number;
  speedLimit: number;
  /** Display unit for speed and limit (the values themselves are km/h). */
  unit: SpeedUnit;
  center: LatLon;
  /** The ride's own GPS fix (fallback when the live location feed has none). */
  fix: RideFix | null;
  riskRoads: RiskRoad[];
  /** People/vehicles around the rider (D2D). */
  crowd: Crowd;
  /** Whether any crowd channel is switched on. */
  measuring: boolean;
  onStop: () => void;
}) {
  const { locale, t } = useLocale();
  const { me } = useMe();
  const token = RISK_TOKENS[verdict.level];
  const titleKey = `risk.${verdict.level}.title` as MessageKey;
  const primary = (locale === 'bn' ? bn : en)[titleKey];
  const secondary = (locale === 'bn' ? en : bn)[titleKey];
  const over = speedKmh > speedLimit + 2;
  const unitLabel = t(unit === 'mph' ? 'ride.speedUnitMph' : 'ride.speedUnit');
  const arrow = me
    ? { lat: me.lat, lon: me.lon, accuracyM: me.accuracyM, headingDeg: me.headingDeg ?? fix?.headingDeg ?? null }
    : fix ? { lat: fix.lat, lon: fix.lon, accuracyM: fix.accuracyM, headingDeg: fix.headingDeg } : null;

  return (
    <div className="fixed inset-0 z-[1500] overflow-hidden bg-canvas">
      <div className="absolute inset-0" aria-hidden="true">
        <BackdropMap center={center} riskRoads={riskRoads} me={arrow} />
      </div>

      {/* The verdict colour frames the screen: readable without looking at it. */}
      <div className="pointer-events-none absolute inset-0 transition-[box-shadow] duration-500"
        style={{ boxShadow: `inset 0 0 0 10px ${token.surface}, inset 0 0 60px 10px ${token.surface}55` }} aria-hidden="true" />

      {/* Top: the verdict */}
      <div className="absolute inset-x-0 top-0 px-4" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <div className="mx-auto flex max-w-md items-stretch gap-2">
        <div className="rg-fade-up flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-4 py-3 shadow-lift transition-colors duration-500"
          style={{ background: token.surface, color: token.onSurface }} role="status" aria-live="polite">
          <span className="text-3xl leading-none" aria-hidden="true">{token.icon}</span>
          <div className="min-w-0">
            <p className="text-xl font-bold leading-tight" lang={locale}>{primary}</p>
            <p className="text-sm font-semibold opacity-90" lang={locale === 'bn' ? 'en' : 'bn'}>{secondary}</p>
            {verdict.isPlaceholder && <p className="text-xs font-semibold">{t('label.sample')}</p>}
          </div>
        </div>
        {/* Always on screen, whatever the phone's height: end the ride from the top too. */}
        <button onClick={onStop} aria-label={t('label.endRide')}
          className="flex w-16 flex-none flex-col items-center justify-center gap-0.5 rounded-2xl bg-white text-text shadow-lift active:scale-95">
          <span className="text-xl leading-none" aria-hidden="true">✕</span>
          <span className="text-[10px] font-semibold leading-tight">{t('label.endRide')}</span>
        </button>
        </div>
      </div>

      {/* Bottom: speed, limit sign, crowd, Stop */}
      <div className="absolute inset-x-0 bottom-0 px-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto max-w-md">
          <div className="mb-3 flex items-end gap-3">
            <div className={`flex min-w-[7.5rem] flex-col items-center rounded-3xl px-4 py-2 shadow-lift transition-colors duration-300 ${
              over ? 'rg-alarm bg-risk-high text-white' : 'bg-white text-text'}`}
              aria-label={`${inUnit(speedKmh, unit)} ${unitLabel}`}>
              <span className="font-mono text-6xl font-bold leading-none tabular">{inUnit(speedKmh, unit)}</span>
              <span className="text-sm font-semibold">{unitLabel}</span>
            </div>
            {/* A round speed-limit sign: white disc, red ring, the number. */}
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-[7px] border-risk-high bg-white shadow-lift"
              aria-label={fill(t('ride.limit'), { limit: inUnit(speedLimit, unit) })}>
              <span className="font-mono text-2xl font-bold tabular text-text">{inUnit(speedLimit, unit)}</span>
            </div>
            {measuring && crowd.vehiclesAround != null && (
              <div className="ml-auto rounded-full bg-white px-3 py-2 text-sm font-semibold text-text shadow-lift"
                aria-label={fill(t('crowd.vehicles'), { n: crowd.vehiclesAround })}>
                <span aria-hidden="true">👥 </span>{fill(t('ride.crowd'), { n: crowd.vehiclesAround })}
              </div>
            )}
          </div>

          <button onClick={onStop}
            className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-text text-lg font-bold text-white shadow-lift active:scale-[0.99]">
            <span aria-hidden="true">■</span> {t('label.stopRide')}
          </button>
          <MapCredit className="mt-1 text-center" />
        </div>
      </div>
    </div>
  );
}
