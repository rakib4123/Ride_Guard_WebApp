'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Hotspot, LatLon, ScorePointResponse, TripToggles } from '@rideguard/shared';
import { useProfile } from '@/context/ProfileContext';
import { useTripLog } from '@/hooks/useTripLog';
import { useAuth } from '@/context/AuthContext';
import { saveTripToAccount } from '@/lib/trips';
import { useDebounce } from '@/hooks/useDebounce';
import { useRide } from '@/hooks/useRide';
import { useAlerts } from '@/hooks/useAlerts';
import { api } from '@/lib/api';
import { fetchWeather, timeOfDay, type WeatherNow } from '@/lib/weather';
import { getFix, DHAKA_CENTER } from '@/lib/geo';
import { fetchNearbyRoads, buildRiskRoads, distMeters, type RiskRoad } from '@/lib/roadrisk';
import { reverseGeocodeDetailed, shortLabel } from '@/lib/geocode';
import { roadConditionFromWeather, trafficFromTime, speedLimitFromRoadType } from '@/lib/deriveContext';
import { buildTrip } from '@/lib/buildTrip';
import { buildVerdict } from '@/lib/verdict';
import { TopFactors } from '@/components/TopFactors';
import { LocationSearch } from '@/components/LocationSearch';
import { TripTogglesPanel } from '@/components/TripTogglesPanel';
import { AlertBanner } from '@/components/AlertBanner';
import { RiskVerdict } from '@/components/RiskVerdict';
import { Lamp } from '@/components/Field';

const PointPickerMap = dynamic(
  () => import('@/components/MapView').then((m) => m.PointPickerMap),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-sm text-muted">Loading map…</div> },
);

const pctOf = (x: number) => `${Math.round(x * 100)}%`;

export default function NowPage() {
  const { features, setToggles, setContext } = useProfile();
  const { user } = useAuth();
  const [loc, setLoc] = useState<LatLon>(DHAKA_CENTER);
  const [locName, setLocName] = useState('Locating…');
  const [weather, setWeather] = useState<WeatherNow | null>(null);
  const [result, setResult] = useState<ScorePointResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locNote, setLocNote] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [rawRoads, setRawRoads] = useState<LatLon[][]>([]);
  const [riskRoads, setRiskRoads] = useState<RiskRoad[]>([]);
  const roadsCenter = useRef<LatLon | null>(null);

  const [consent, setConsent] = useState({ logging: false, raw_gps: false });
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [acctNote, setAcctNote] = useState<string | null>(null);
  const [acctSaving, setAcctSaving] = useState(false);
  const startTime = useRef(new Date().toISOString());
  const prevLevel = useRef<string>('Low');
  // The rider's own phone-use answer, restored when a ride ends.
  const preRidePhone = useRef<TripToggles['Talk_While_Riding']>('Never');
  const { save, downloadAll, trips, saving } = useTripLog();

  const ride = useRide();
  const alerts = useAlerts();
  // `alerts` is a fresh object whenever the banner appears or clears; the
  // callbacks inside it are stable. Depend on those, or every alert would
  // re-run the effects below and trigger a redundant re-score.
  const { fire: fireAlert } = alerts;

  useEffect(() => {
    const t = timeOfDay();
    setContext({ Time_of_Day: t });
    setToggles({ Traffic_Density: trafficFromTime(t) });
  }, [setContext, setToggles]);

  // Road-risk overlay: load hotspots once, fetch nearby roads when the rider
  // moves > ~200 m, and recolour whenever the behaviour score changes.
  useEffect(() => { api.hotspots().then((r) => setHotspots(r.hotspots)).catch(() => {}); }, []);

  useEffect(() => {
    let active = true;
    fetchWeather(loc.lat, loc.lon).then((w) => {
      if (!active) return;
      setWeather(w);
      setContext({ Weather: w.condition });
      setToggles({ Road_condition: roadConditionFromWeather(w.condition) });
    }).catch(() => {});
    return () => { active = false; };
  }, [loc, setContext, setToggles]);

  const scoreInput = useMemo(() => ({ features, loc }), [features, loc]);
  const debScore = useDebounce(scoreInput, 500);
  useEffect(() => {
    let active = true;
    setError(null);
    api.scorePoint(debScore.features, debScore.loc)
      .then((r) => active && setResult(r))
      .catch(() => active && setError('Could not reach the scoring service.'));
    return () => { active = false; };
  }, [debScore]);

  const debouncedLoc = useDebounce(loc, 1200);
  useEffect(() => {
    let active = true;
    reverseGeocodeDetailed(debouncedLoc).then((r) => {
      if (!active) return;
      setLocName(shortLabel(r.name));
      setToggles({ Road_Type: r.roadType, Speed_Limit: speedLimitFromRoadType(r.roadType) });
    });
    return () => { active = false; };
  }, [debouncedLoc, setToggles]);

  useEffect(() => {
    const c = roadsCenter.current;
    if (c && distMeters(c, debouncedLoc) < 200) return;
    roadsCenter.current = debouncedLoc;
    let active = true;
    fetchNearbyRoads(debouncedLoc, 600).then((rs) => { if (active) setRawRoads(rs); }).catch(() => {});
    return () => { active = false; };
  }, [debouncedLoc]);

  useEffect(() => {
    if (!rawRoads.length) { setRiskRoads([]); return; }
    const s = result?.behaviourScore ?? 0.45; // colour roads even before the first score
    setRiskRoads(buildRiskRoads(rawRoads, hotspots, s));
  }, [rawRoads, hotspots, result]);

  // ---- live ride wiring ----
  useEffect(() => { if (ride.riding && ride.fix) setLoc(ride.fix); }, [ride.riding, ride.fix]);
  useEffect(() => { if (ride.riding) setToggles({ Bike_Speed: ride.speedKmh }); }, [ride.riding, ride.speedKmh, setToggles]);
  useEffect(() => {
    if (!ride.riding) return; // off-ride, the rider's own setting stands
    setToggles({ Talk_While_Riding: ride.phoneUse ? 'Regularly' : preRidePhone.current });
    if (ride.phoneUse) fireAlert('phone', 'Eyes on the road. Put the phone away.', 'high');
  }, [ride.riding, ride.phoneUse, setToggles, fireAlert]);
  useEffect(() => {
    if (ride.riding && ride.speedKmh > features.Speed_Limit + 2) {
      fireAlert('speed', `Slow down. The limit here is ${features.Speed_Limit}.`, 'med');
    }
  }, [ride.riding, ride.speedKmh, features.Speed_Limit, fireAlert]);
  useEffect(() => {
    // No result means no transition to announce — do not treat silence as 'Low'.
    if (!result) return;
    const level = result.advisoryLevel;
    if (ride.riding && level === 'High' && prevLevel.current !== 'High') {
      fireAlert('area', 'High-risk area. Ride extra carefully.', 'high');
    }
    prevLevel.current = level;
  }, [result, ride.riding, fireAlert]);

  const startRide = () => {
    preRidePhone.current = features.Talk_While_Riding; // restore this on stop
    alerts.arm();
    ride.start();
  };
  const stopRide = () => {
    ride.stop();
    setToggles({ Talk_While_Riding: preRidePhone.current });
  };

  const useMyLocation = useCallback(async () => {
    setLocating(true); setLocNote(null);
    try {
      const fix = await getFix();
      setLoc({ lat: fix.lat, lon: fix.lon });
      setLocNote(fix.accuracy > 2000
        ? `Approximate (within ~${Math.round(fix.accuracy / 1000)} km). Drag the pin to your exact spot.`
        : null);
    } catch {
      setLocNote('Couldn’t get your location. Search or drag the pin instead.');
    } finally { setLocating(false); }
  }, []);

  // Center on the rider's real location as soon as the screen opens.
  const autoLocated = useRef(false);
  useEffect(() => {
    if (autoLocated.current) return;
    autoLocated.current = true;
    void useMyLocation();
  }, [useMyLocation]);

  const onSave = useCallback(async () => {
    if (!result || !weather) return;
    await save(buildTrip({
      riderId: user?.id ?? 'anonymous', features, origin: loc, destination: loc,
      point: result, weather, consent, startTime: startTime.current,
    }));
    setSavedNote('Saved. Thanks for helping validate the model.');
    setTimeout(() => setSavedNote(null), 3000);
  }, [result, weather, features, loc, consent, save, user]);

  const saveToAccount = useCallback(async () => {
    if (!result) return;
    setAcctSaving(true); setAcctNote(null);
    try {
      await saveTripToAccount({ result, loc, features, locName });
      setAcctNote('Saved to your trips.');
      setTimeout(() => setAcctNote(null), 3000);
    } catch (e) {
      setAcctNote(e instanceof Error ? e.message : 'Could not save.');
    } finally { setAcctSaving(false); }
  }, [result, loc, features, locName]);

  const verdict = buildVerdict(result, features);
  const initials = (user?.email ?? 'R').slice(0, 2).toUpperCase();

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-canvas">
      <div className="absolute inset-0">
        <PointPickerMap
          value={loc}
          onChange={(l) => { if (!ride.riding) { setLoc(l); setLocNote(null); } }}
          level={verdict.level === 'Unknown' ? undefined : verdict.level}
          riskRoads={riskRoads}
          zoomControl={false}
        />
      </div>

      {/* Top: search + account */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1200] px-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <div className="pointer-events-auto flex-1 rounded-2xl border border-line bg-white/95 px-2 py-1 shadow-soft backdrop-blur">
            <LocationSearch onSelect={(l, label) => { setLoc(l); setLocName(shortLabel(label)); setLocNote(null); }} />
          </div>
          <Link href="/profile" aria-label="Account"
            className="pointer-events-auto flex h-11 w-11 flex-none items-center justify-center rounded-full border border-line bg-signal/10 text-sm font-semibold text-signal shadow-soft">
            {initials}
          </Link>
        </div>
        <div className="pointer-events-auto mx-auto mt-2 max-w-2xl">
          <AlertBanner alert={alerts.banner} onClose={alerts.dismiss} />
        </div>
      </div>

      {/* Locate FAB */}
      {!ride.riding && (
        <button onClick={useMyLocation} disabled={locating} aria-label="Use my location"
          className="absolute right-3 z-[1200] flex h-12 w-12 items-center justify-center rounded-full border border-line bg-white text-signal shadow-soft disabled:opacity-60"
          style={{ bottom: 'calc(50% - 1rem)' }}>
          <PinIcon />
        </button>
      )}

      {/* Bottom sheet */}
      <div className="absolute inset-x-0 bottom-0 z-[1200]">
        <div className="mx-auto max-w-2xl rounded-t-3xl border-t border-line bg-white px-4 pt-2"
          style={{ boxShadow: '0 -10px 30px rgba(15,23,42,0.10)', paddingBottom: 'calc(3.75rem + env(safe-area-inset-bottom))' }}>
          <button onClick={() => setExpanded((o) => !o)} aria-label={expanded ? 'Collapse' : 'Expand'}
            className="mx-auto mb-2 block">
            <span className="mx-auto block h-1 w-10 rounded-full bg-line" />
          </button>

          {/* Peek: verdict band + location */}
          <RiskVerdict verdict={verdict} size="lg" />
          <p className="mt-2 truncate text-sm font-medium text-text">{locName}</p>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Metric label="Your riding" value={result ? pctOf(result.behaviourScore) : '—'} />
            <Metric label="This area" value={result ? pctOf(result.spatialPrior) : '—'} />
            <Metric label="Combined" value={result ? pctOf(result.R) : '—'} highlight />
          </div>

          {/* Start / stop ride + alert channels */}
          <div className="mt-3 flex items-center gap-2">
            {ride.riding ? (
              <button onClick={stopRide}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line py-3 text-sm font-semibold text-text">
                Stop ride · {ride.speedKmh} km/h
              </button>
            ) : (
              <button onClick={startRide}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-signal py-3 text-sm font-semibold text-white shadow-soft">
                <PlayIcon /> Start ride
              </button>
            )}
            <div className="flex flex-none items-center gap-1">
              <ChannelToggle label="Sound" on={alerts.channels.sound} onClick={() => alerts.setChannels((c) => ({ ...c, sound: !c.sound }))} />
              <ChannelToggle label="Voice" on={alerts.channels.voice} onClick={() => alerts.setChannels((c) => ({ ...c, voice: !c.voice }))} />
              <ChannelToggle label="Buzz" on={alerts.channels.vibrate} onClick={() => alerts.setChannels((c) => ({ ...c, vibrate: !c.vibrate }))} />
            </div>
          </div>
          {error && <p className="mt-2 text-xs text-risk-high">{error}</p>}
          {locNote && <p className="mt-2 rounded-lg bg-signal/5 px-3 py-2 text-xs text-signal">{locNote}</p>}

          {/* Expanded detail */}
          {expanded && (
            <div className="mt-3 max-h-[42vh] space-y-4 overflow-y-auto border-t border-line pt-3">
              <div className="grid grid-cols-4 gap-2 text-center">
                <Chip label="Speed" value={`${ride.riding ? ride.speedKmh : features.Bike_Speed}`} />
                <Chip label="Road" value={features.Road_Type} />
                <Chip label="Weather" value={weather ? features.Weather : '…'} />
                <Chip label="Traffic" value={`${features.Traffic_Density}/8`} />
              </div>
              <p className="text-xs text-muted">
                Speed, location, weather, road type, surface, traffic and time fill in automatically
                (limit {features.Speed_Limit} km/h here).
              </p>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-text">What&apos;s driving your score</h3>
                <TopFactors factors={result?.topFactors ?? []} />
              </div>

              <div className="border-t border-line pt-3">
                <h3 className="mb-1 text-sm font-semibold text-text">Trip conditions</h3>
                <p className="mb-3 text-xs text-muted">
                  Helmet, alcohol, smoking and phone use are the factors the model weighs most
                  heavily, and no sensor can read them — set them honestly for a real reading.
                  {ride.riding && ' Phone use is sensed automatically while you ride.'}
                </p>
                <TripTogglesPanel />
              </div>

              <div className="border-t border-line pt-3">
                <h3 className="mb-2 text-sm font-semibold text-text">Log this trip</h3>
                <div className="grid grid-cols-1 gap-2">
                  <Lamp label="I'm OK with logging this trip" on={consent.logging}
                    onToggle={() => setConsent((c) => ({ ...c, logging: !c.logging }))} />
                  <Lamp label="Include my GPS trail" on={consent.raw_gps}
                    onToggle={() => setConsent((c) => ({ ...c, raw_gps: !c.raw_gps }))} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button disabled={!consent.logging || !result || saving} onClick={onSave}
                    className="rounded-xl bg-signal px-4 py-2.5 text-sm font-semibold text-white shadow-soft disabled:opacity-40">
                    {saving ? 'Saving…' : 'Save trip'}
                  </button>
                  {user && (
                    <button disabled={!result || acctSaving} onClick={saveToAccount}
                      className="rounded-xl border border-signal/40 bg-signal/5 px-4 py-2.5 text-sm font-semibold text-signal disabled:opacity-40">
                      {acctSaving ? 'Saving…' : 'Save to my trips'}
                    </button>
                  )}
                  <button disabled={trips.length === 0} onClick={downloadAll}
                    className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-text disabled:opacity-40">
                    Download ({trips.length})
                  </button>
                </div>
                {savedNote && <p className="mt-2 text-xs text-risk-low">{savedNote}</p>}
                {acctNote && <p className="mt-2 text-xs text-muted">{acctNote}</p>}
                <Link href="/profile" className="mt-3 inline-block text-xs font-medium text-signal">Edit rider profile →</Link>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl py-2 ${highlight ? 'bg-signal/10' : 'bg-panel2'}`}>
      <div className={`font-mono tabular text-base ${highlight ? 'text-signal' : 'text-text'}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}
function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-panel2 py-1.5">
      <div className="truncate px-1 text-sm font-medium text-text">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}
function ChannelToggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={label} title={label}
      className="rounded-full px-2 py-1.5 text-[11px] font-medium"
      style={{ background: on ? 'rgba(37,99,235,0.10)' : 'transparent', color: on ? '#2563EB' : '#94A3B8', border: '1px solid #E2E8F0' }}>
      {label[0]}
    </button>
  );
}
function PlayIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>;
}
function PinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}
