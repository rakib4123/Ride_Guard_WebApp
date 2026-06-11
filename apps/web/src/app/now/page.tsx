'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LatLon, ScorePointResponse } from '@rideguard/shared';
import { useProfile } from '@/context/ProfileContext';
import { useTripLog } from '@/hooks/useTripLog';
import { useDebounce } from '@/hooks/useDebounce';
import { useRide } from '@/hooks/useRide';
import { useAlerts } from '@/hooks/useAlerts';
import { api } from '@/lib/api';
import { fetchWeather, timeOfDay, type WeatherNow } from '@/lib/weather';
import { getFix, DHAKA_CENTER } from '@/lib/geo';
import { reverseGeocodeDetailed, shortLabel } from '@/lib/geocode';
import { roadConditionFromWeather, trafficFromTime, speedLimitFromRoadType } from '@/lib/deriveContext';
import { buildTrip } from '@/lib/buildTrip';
import { RiskGauge } from '@/components/RiskGauge';
import { TopFactors } from '@/components/TopFactors';
import { ProfilePanel } from '@/components/ProfilePanel';
import { LocationSearch } from '@/components/LocationSearch';
import { AlertBanner } from '@/components/AlertBanner';
import { Card } from '@/components/Card';
import { Lamp } from '@/components/Field';

const PointPickerMap = dynamic(
  () => import('@/components/MapView').then((m) => m.PointPickerMap),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-sm text-muted">Loading map…</div> },
);

const pctOf = (x: number) => `${Math.round(x * 100)}%`;

export default function NowPage() {
  const { features, setToggles, setContext } = useProfile();
  const [loc, setLoc] = useState<LatLon>(DHAKA_CENTER);
  const [locName, setLocName] = useState('Central Dhaka');
  const [weather, setWeather] = useState<WeatherNow | null>(null);
  const [result, setResult] = useState<ScorePointResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locNote, setLocNote] = useState<string | null>(null);

  const [consent, setConsent] = useState({ logging: false, raw_gps: false });
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const startTime = useRef(new Date().toISOString());
  const prevLevel = useRef<string>('Low');
  const { save, downloadAll, trips, saving } = useTripLog();

  const ride = useRide();
  const alerts = useAlerts();

  // Time of day + traffic estimate on mount.
  useEffect(() => {
    const t = timeOfDay();
    setContext({ Time_of_Day: t });
    setToggles({ Traffic_Density: trafficFromTime(t) });
  }, [setContext, setToggles]);

  // Weather follows location; road condition is derived from it automatically.
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

  // Live score (debounced so rapid auto-updates coalesce into one request).
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

  // Reverse-geocode the place name + detect road type (debounced, one call).
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

  // ---- live ride wiring ----
  useEffect(() => { if (ride.riding && ride.fix) setLoc(ride.fix); }, [ride.riding, ride.fix]);
  useEffect(() => { if (ride.riding) setToggles({ Bike_Speed: ride.speedKmh }); }, [ride.riding, ride.speedKmh, setToggles]);
  useEffect(() => {
    setToggles({ Talk_While_Riding: ride.phoneUse ? 'Regularly' : 'Never' });
    if (ride.phoneUse) alerts.fire('phone', 'Eyes on the road. Put the phone away.', 'high');
  }, [ride.phoneUse, setToggles, alerts]);

  // Over-speed alert.
  useEffect(() => {
    if (ride.riding && ride.speedKmh > features.Speed_Limit + 2) {
      alerts.fire('speed', `Slow down. The limit here is ${features.Speed_Limit}.`, 'med');
    }
  }, [ride.riding, ride.speedKmh, features.Speed_Limit, alerts]);

  // Entering a high-risk area.
  useEffect(() => {
    const level = result?.advisoryLevel ?? 'Low';
    if (ride.riding && level === 'High' && prevLevel.current !== 'High') {
      alerts.fire('area', 'High-risk area. Ride extra carefully.', 'high');
    }
    prevLevel.current = level;
  }, [result, ride.riding, alerts]);

  const startRide = () => { alerts.arm(); ride.start(); };
  const stopRide = () => { ride.stop(); setToggles({ Talk_While_Riding: 'Never' }); };

  const useMyLocation = useCallback(async () => {
    setLocating(true); setLocNote(null);
    try {
      const fix = await getFix();
      setLoc({ lat: fix.lat, lon: fix.lon });
      setLocNote(fix.accuracy > 2000
        ? `Approximate (within ~${Math.round(fix.accuracy / 1000)} km). On a computer this is rough — drag the pin to your exact spot.`
        : null);
    } catch {
      setLocNote('Couldn’t get your location. Search or drag the pin instead.');
    } finally { setLocating(false); }
  }, []);

  const onSave = useCallback(async () => {
    if (!result || !weather) return;
    await save(buildTrip({
      riderId: 'demo-rider', features, origin: loc, destination: loc,
      point: result, weather, consent, startTime: startTime.current,
    }));
    setSavedNote('Saved. Thanks for helping validate the model.');
    setTimeout(() => setSavedNote(null), 3000);
  }, [result, weather, features, loc, consent, save]);

  return (
    <>
      <AlertBanner alert={alerts.banner} onClose={alerts.dismiss} />

      <Card>
        {result ? <RiskGauge value={result.R} placeholder={result.isPlaceholder} /> : (
          <div className="flex h-44 items-center justify-center text-sm text-muted">{error ?? 'Calculating your risk…'}</div>
        )}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Metric label="Your riding" value={result ? pctOf(result.behaviourScore) : '—'} />
          <Metric label="This area" value={result ? pctOf(result.spatialPrior) : '—'} />
          <Metric label="Combined" value={result ? pctOf(result.R) : '—'} highlight />
        </div>
      </Card>

      <Card
        title="Live ride"
        action={
          <div className="flex items-center gap-1.5">
            <ChannelToggle label="Sound" on={alerts.channels.sound} onClick={() => alerts.setChannels((c) => ({ ...c, sound: !c.sound }))} />
            <ChannelToggle label="Voice" on={alerts.channels.voice} onClick={() => alerts.setChannels((c) => ({ ...c, voice: !c.voice }))} />
            <ChannelToggle label="Buzz" on={alerts.channels.vibrate} onClick={() => alerts.setChannels((c) => ({ ...c, vibrate: !c.vibrate }))} />
          </div>
        }
      >
        {ride.riding ? (
          <div className="mb-3 flex items-end justify-between">
            <div>
              <div className="font-mono tabular text-4xl text-text">{ride.speedKmh}<span className="ml-1 text-base text-muted">km/h</span></div>
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 text-risk-low"><Dot color="#16A34A" /> tracking live</span>
                {ride.phoneUse && <span className="flex items-center gap-1 font-semibold text-risk-high"><Dot color="#EF4444" /> phone in use</span>}
              </div>
            </div>
            <button onClick={stopRide} className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-text">Stop</button>
          </div>
        ) : (
          <button onClick={startRide}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-signal py-3 text-sm font-semibold text-ink shadow-soft">
            Start ride
          </button>
        )}
        <div className="grid grid-cols-4 gap-2 text-center">
          <Chip label="Speed" value={`${ride.riding ? ride.speedKmh : features.Bike_Speed}`} />
          <Chip label="Road" value={features.Road_Type} />
          <Chip label="Weather" value={weather ? features.Weather : '…'} />
          <Chip label="Traffic" value={`${features.Traffic_Density}/8`} />
        </div>
        <p className="mt-3 text-xs text-muted">
          Speed, location, weather, road type, surface, traffic and time fill in automatically
          (limit {features.Speed_Limit} km/h here). Phone use, over-speeding and high-risk areas
          trigger alerts while you ride.
        </p>
      </Card>

      <Card title="Where are you?">
        <div className="space-y-2.5">
          <LocationSearch onSelect={(l, label) => { setLoc(l); setLocName(shortLabel(label)); setLocNote(null); }} />
          {!ride.riding && (
            <button onClick={useMyLocation} disabled={locating}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-panel2 py-2.5 text-sm font-medium text-text hover:border-signal/50 disabled:opacity-50">
              <PinIcon /> {locating ? 'Locating…' : 'Use my location'}
            </button>
          )}
          <div className="h-56 overflow-hidden rounded-xl2 border border-line">
            <PointPickerMap value={loc} onChange={(l) => { if (!ride.riding) { setLoc(l); setLocNote(null); } }} level={result?.advisoryLevel} />
          </div>
          <p className="text-sm text-muted">
            <span className="font-medium text-text">{locName}</span>
            {ride.riding ? ' — following your GPS.' : ' — drag the pin, tap the map, or search.'}
          </p>
          {locNote && <p className="rounded-lg bg-signal/5 px-3 py-2 text-xs text-signal">{locNote}</p>}
        </div>
      </Card>

      <Card title="What's driving your score"><TopFactors factors={result?.topFactors ?? []} /></Card>

      <Card title="Rider profile"
        action={<button onClick={() => setProfileOpen((o) => !o)} className="text-xs font-medium text-signal">{profileOpen ? 'Hide' : 'Edit'}</button>}>
        {profileOpen ? <ProfilePanel /> : (
          <p className="text-sm text-muted">Age {features.Biker_Age}, {features.Riding_Experience} yrs riding. Tap Edit to change.</p>
        )}
      </Card>

      <Card title="Log this trip">
        <p className="mb-3 text-sm text-muted">Logging real trips helps validate the model. Your rider id is hashed before it's stored.</p>
        <div className="grid grid-cols-1 gap-2">
          <Lamp label="I'm OK with logging this trip" on={consent.logging}
            onToggle={() => setConsent((c) => ({ ...c, logging: !c.logging }))} />
          <Lamp label="Include my GPS trail" on={consent.raw_gps}
            onToggle={() => setConsent((c) => ({ ...c, raw_gps: !c.raw_gps }))} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button disabled={!consent.logging || !result || saving} onClick={onSave}
            className="rounded-xl bg-signal px-4 py-2.5 text-sm font-semibold text-ink shadow-soft disabled:opacity-40">
            {saving ? 'Saving…' : 'Save trip'}
          </button>
          <button disabled={trips.length === 0} onClick={downloadAll}
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-text disabled:opacity-40">
            Download log ({trips.length})
          </button>
        </div>
        {savedNote && <p className="mt-2 text-xs text-risk-low">{savedNote}</p>}
      </Card>
    </>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border py-2.5 ${highlight ? 'border-signal/30 bg-signal/5' : 'border-line bg-panel2'}`}>
      <div className={`font-mono tabular text-lg ${highlight ? 'text-signal' : 'text-text'}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}
function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel2 py-1.5">
      <div className="truncate px-1 text-sm font-medium text-text">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}
function ChannelToggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-full px-2 py-1 text-[11px] font-medium"
      style={{ background: on ? 'rgba(37,99,235,0.08)' : 'transparent', color: on ? '#2563EB' : '#94A3B8', border: '1px solid #E2E8F0' }}>
      {label}
    </button>
  );
}
function Dot({ color }: { color: string }) { return <span className="h-2 w-2 rounded-full" style={{ background: color }} />; }
function PinIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10z" /><circle cx="12" cy="11" r="2" />
    </svg>
  );
}
