'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import type { FeatureVector, LatLon } from '@rideguard/shared';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/i18n/LocaleContext';
import { fill } from '@/i18n/fill';
import type { MessageKey } from '@/i18n/messages/en';
import { api } from '@/lib/api';
import { buildTrip } from '@/lib/buildTrip';
import { saveTripToAccount } from '@/lib/trips';
import { shortLabel } from '@/lib/geocode';
import { fmt } from '@/lib/fmt';
import type { Verdict } from '@/lib/verdict';
import type { NowScore } from '@/hooks/useNowScore';
import { RiskVerdict } from '@/components/RiskVerdict';
import { LocationSearch } from '@/components/LocationSearch';
import { LanguageChip } from '@/components/LanguageToggle';
import { TopFactors } from '@/components/TopFactors';
import { TripTogglesPanel } from '@/components/TripTogglesPanel';
import { Lamp } from '@/components/Field';

const PointPickerMap = dynamic(
  () => import('@/components/MapView').then((m) => m.PointPickerMap),
  { ssr: false, loading: () => <MapLoading /> },
);

function MapLoading() {
  const t = useT();
  return <div className="flex h-full items-center justify-center text-sm text-muted">{t('common.loadingMap')}</div>;
}

/** A finished ride waiting to be saved. */
export interface LastRide {
  startTime: string;
  startLoc: LatLon;
  startName: string;
  distanceKm: number;
}

/**
 * Now, parked (spec 4.1): one verdict, its reasons, one dominant action.
 * Everything technical sits one tap away in "Why this reading?".
 */
export function NowParked({
  now, verdict, features, onStartRide, lastRide, onRideSaved, detailsOpen, setDetailsOpen,
}: {
  now: NowScore;
  verdict: Verdict;
  features: FeatureVector;
  onStartRide: () => void;
  lastRide: LastRide | null;
  onRideSaved: () => void;
  detailsOpen: boolean;
  setDetailsOpen: (open: boolean) => void;
}) {
  const t = useT();
  const { user } = useAuth();
  const { result } = now;
  const initials = (user?.email ?? 'R').slice(0, 2).toUpperCase();

  const help: string | null =
    now.error ? t('label.unknownHelp')
      : !now.hasLocation && !now.locating ? t('now.turnOnLocation')
        : null;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-canvas">
      <div className="absolute inset-0">
        <PointPickerMap
          value={now.loc}
          onChange={(l) => { now.setLoc(l); now.setLocNote(null); }}
          level={verdict.level === 'Unknown' ? undefined : verdict.level}
          riskRoads={now.riskRoads}
          zoomControl={false}
        />
      </div>

      {/* Top: search · language · account */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1200] px-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <div className="pointer-events-auto min-w-0 flex-1 rounded-2xl border border-line bg-white/95 px-2 py-1 shadow-soft backdrop-blur">
            <LocationSearch placeholder={t('now.search')}
              onSelect={(l, label) => { now.setLoc(l); now.setLocName(shortLabel(label)); now.setLocNote(null); }} />
          </div>
          <LanguageChip />
          <Link href="/profile" aria-label={t('common.account')}
            className="pointer-events-auto flex h-11 w-11 flex-none items-center justify-center rounded-full border border-line bg-signal/10 text-sm font-semibold text-signal shadow-soft">
            {initials}
          </Link>
        </div>
      </div>

      {/* Locate */}
      <button onClick={now.useMyLocation} disabled={now.locating} aria-label={t('now.useLocation')}
        className="absolute right-3 z-[1200] flex h-12 w-12 items-center justify-center rounded-full border border-line bg-white text-signal shadow-soft disabled:opacity-60"
        style={{ bottom: 'calc(50% - 1rem)' }}>
        <PinIcon />
      </button>

      {/* Bottom sheet */}
      <div className="absolute inset-x-0 bottom-0 z-[1200]">
        <div className="mx-auto max-w-2xl rounded-t-3xl border-t border-line bg-white px-4 pt-3"
          style={{ boxShadow: '0 -10px 30px rgba(15,23,42,0.10)', paddingBottom: 'calc(3.75rem + env(safe-area-inset-bottom))' }}>

          <RiskVerdict verdict={verdict} size="lg" pending={(now.scoring || now.locating) && !result} />
          <p className="mt-2 truncate text-sm font-medium text-text">
            {now.locName || (now.locating ? t('common.locating') : '')}
          </p>
          {help && <p className="mt-1 text-sm text-muted">{help}</p>}
          {now.locNote && <p className="mt-2 rounded-lg bg-signal/5 px-3 py-2 text-xs text-signal">{now.locNote}</p>}

          {result && (
            <div className="mt-2 space-y-1 text-sm">
              <ReasonLine label={t('label.why')}
                items={verdict.modelReasons.length ? verdict.modelReasons.map(t) : [t('now.noReasons')]} />
              {verdict.watchOuts.length > 0 && (
                <ReasonLine label={t('label.watchOut')} items={verdict.watchOuts.map(t)} muted />
              )}
            </div>
          )}

          <button onClick={onStartRide}
            className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-signal text-lg font-bold text-white shadow-soft">
            <PlayIcon /> {t('label.startRide')}
          </button>

          <button onClick={() => setDetailsOpen(!detailsOpen)} aria-expanded={detailsOpen}
            className="mx-auto mt-1 flex min-h-11 items-center gap-1 px-3 text-sm font-medium text-signal">
            {detailsOpen ? t('now.hideDetails') : t('now.whyReading')}
            <span aria-hidden="true">{detailsOpen ? '▴' : '▾'}</span>
          </button>

          {detailsOpen && (
            <div className="max-h-[42vh] space-y-4 overflow-y-auto border-t border-line pt-3">
              {result && (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <Metric label={t('now.detail.riding')} value={fmt.pct(result.behaviourScore)} />
                    <Metric label={t('now.detail.area')} value={fmt.pct(result.spatialPrior)} />
                    <Metric label={t('now.detail.combined')} value={fmt.pct(result.R)} highlight />
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-text">{t('now.detail.drivers')}</h3>
                    <TopFactors factors={result.topFactors} />
                  </div>
                  {result.conformalSet.length > 0 && (
                    <p className="text-sm text-text">
                      <span className="font-semibold">{t('now.detail.conformal')}: </span>
                      {result.conformalSet.map((c) => t(`sev.${c}` as MessageKey)).join(' · ')}
                    </p>
                  )}
                </>
              )}
              <p className="text-xs text-muted">{fill(t('now.detail.auto'), { limit: features.Speed_Limit })}</p>

              <div className="border-t border-line pt-3">
                <h3 className="mb-1 text-sm font-semibold text-text">{t('now.conditions')}</h3>
                <p className="mb-3 text-xs text-muted">{t('now.conditionsHelp')}</p>
                <TripTogglesPanel />
              </div>

              <SaveRide now={now} verdict={verdict} features={features} lastRide={lastRide} onSaved={onRideSaved} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * One "Save this ride" (spec 7.3). It always writes the rider's own trip
 * history; the research copy goes to the API only with consent, and the
 * consent switches govern only that copy.
 */
function SaveRide({ now, verdict, features, lastRide, onSaved }: {
  now: NowScore;
  verdict: Verdict;
  features: FeatureVector;
  lastRide: LastRide | null;
  onSaved: () => void;
}) {
  const t = useT();
  const { user } = useAuth();
  const [consent, setConsent] = useState({ logging: false, raw_gps: false });
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const { result } = now;

  const save = async () => {
    if (!result) return;
    setSaving(true); setNote(null);
    try {
      await saveTripToAccount({
        result, loc: now.loc, features, locName: now.locName,
        startName: lastRide?.startName, distanceKm: lastRide?.distanceKm,
        reasons: verdict.modelReasons,
      });
    } catch {
      setNote(t('now.save.failed'));
      setSaving(false);
      return;
    }
    let msg = t('now.save.done');
    if (consent.logging) {
      try {
        if (!now.weather) throw new Error('no weather');
        await api.saveTrip(buildTrip({
          riderId: user?.id ?? 'anonymous', features,
          origin: lastRide?.startLoc ?? now.loc, destination: now.loc,
          point: result, weather: now.weather, consent,
          startTime: lastRide?.startTime ?? new Date().toISOString(),
          distanceKm: lastRide?.distanceKm,
        }));
        msg = t('now.save.doneResearch');
      } catch {
        msg = t('now.save.researchFailed');
      }
    }
    setNote(msg);
    setSaving(false);
    onSaved();
  };

  return (
    <div className="space-y-2 border-t border-line pt-3">
      <button disabled={!result || saving} onClick={save}
        className="flex min-h-12 w-full items-center justify-center rounded-xl bg-signal px-4 text-sm font-semibold text-white shadow-soft disabled:opacity-40">
        {saving ? t('common.saving') : t('now.save.button')}
      </button>
      <Lamp label={t('now.save.research')} on={consent.logging}
        onToggle={() => setConsent((c) => ({ ...c, logging: !c.logging }))} />
      {consent.logging && (
        <Lamp label={t('now.save.gps')} on={consent.raw_gps}
          onToggle={() => setConsent((c) => ({ ...c, raw_gps: !c.raw_gps }))} />
      )}
      {note && <p className="text-xs text-muted" role="status">{note}</p>}
    </div>
  );
}

function ReasonLine({ label, items, muted }: { label: string; items: string[]; muted?: boolean }) {
  return (
    <p className={muted ? 'text-muted' : 'text-text'}>
      <span className="font-semibold">{label}: </span>
      {items.join(' · ')}
    </p>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl py-2 ${highlight ? 'bg-signal/10' : 'bg-panel2'}`}>
      <div className={`font-mono tabular text-base ${highlight ? 'text-signal' : 'text-text'}`}>{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}
function PlayIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>;
}
function PinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}
