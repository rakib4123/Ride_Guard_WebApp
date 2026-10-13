'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LatLon, ScoreRouteResponse, TrafficRouteResponse } from '@rideguard/shared';
import { useProfile } from '@/context/ProfileContext';
import { useT } from '@/i18n/LocaleContext';
import { fill } from '@/i18n/fill';
import { useDebounce } from '@/hooks/useDebounce';
import { api } from '@/lib/api';
import { fetchRoutes, type RoutePath } from '@/lib/routing';
import { rankRoutes } from '@/lib/routeRanking';
import { riskiestStretch } from '@/lib/routeStretch';
import { reverseGeocode, shortLabel } from '@/lib/geocode';
import { getFix } from '@/lib/geo';
import { fmt } from '@/lib/fmt';
import { buildRouteVerdict } from '@/lib/verdict';
import { RiskVerdict } from '@/components/RiskVerdict';
import { RoutePicker, type RouteOption } from '@/components/RoutePicker';
import { TopFactors } from '@/components/TopFactors';
import { LocationSearch } from '@/components/LocationSearch';
import { MapScreen } from '@/components/MapScreen';

const RoutePickerMap = dynamic(
  () => import('@/components/MapView').then((m) => m.RoutePickerMap),
  { ssr: false, loading: () => <div className="h-full bg-canvas" /> },
);

const DEFAULT_ORIGIN: LatLon = { lat: 23.8759, lon: 90.3795 };
const DEFAULT_DEST: LatLon = { lat: 23.733, lon: 90.4172 };

type LiveTraffic = Extract<TrafficRouteResponse, { available: true }>;

/** Ranking inputs; a route that failed to score sorts last. */
function rankInputs(routes: RoutePath[], scored: (ScoreRouteResponse | null)[]) {
  return routes.map((r, i) => ({
    durationMin: r.durationMin,
    meanRisk: scored[i]?.meanRisk ?? Infinity,
    worstPrior: scored[i]?.segments.reduce((m, s) => Math.max(m, s.spatialPrior), 0) ?? 0,
  }));
}

export default function RoutePage() {
  const { features } = useProfile();
  const t = useT();
  const [origin, setOrigin] = useState<LatLon>(DEFAULT_ORIGIN);
  const [dest, setDest] = useState<LatLon>(DEFAULT_DEST);
  const [routes, setRoutes] = useState<RoutePath[]>([]);
  const [scored, setScored] = useState<(ScoreRouteResponse | null)[]>([]);
  const [selected, setSelected] = useState(0);
  const [routing, setRouting] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState(false);
  const [stretchName, setStretchName] = useState<string | null>(null);

  const dOrigin = useDebounce(origin, 500);
  const dDest = useDebounce(dest, 500);

  // Start the route from the rider's real location when the screen opens.
  useEffect(() => {
    getFix().then((f) => setOrigin({ lat: f.lat, lon: f.lon })).catch(() => {});
  }, []);

  // Live traffic is paid (Google), so it is fetched only when the rider asks,
  // and only offered when the API has a Google key.
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [traffic, setTraffic] = useState<LiveTraffic | null>(null);
  const [trafficLoading, setTrafficLoading] = useState(false);
  const [trafficNote, setTrafficNote] = useState(false);
  const endpointsKey = useRef('');
  useEffect(() => {
    api.health().then((h) => setLiveAvailable(h.liveTraffic === 'google')).catch(() => {});
  }, []);

  // Routing and scoring are split: OSRM is a rate-limited public endpoint, so
  // it is only re-queried when the endpoints actually move.
  useEffect(() => {
    let active = true;
    endpointsKey.current = JSON.stringify([dOrigin, dDest]);
    setTraffic(null); setTrafficNote(false); // a live reading belongs to the old route
    setRouting(true);
    fetchRoutes(dOrigin, dDest).then((rs) => {
      if (!active) return;
      setRoutes(rs);
      setSelected(0);
    }).finally(() => { if (active) setRouting(false); });
    return () => { active = false; };
  }, [dOrigin, dDest]);

  const checkLiveTraffic = () => {
    const key = endpointsKey.current;
    setTrafficLoading(true); setTrafficNote(false);
    api.trafficRoute(dOrigin, dDest)
      .then((r) => {
        if (endpointsKey.current !== key) return; // the rider moved A or B meanwhile
        if (!r.available) { setTrafficNote(true); return; }
        setTraffic(r);
        setRoutes([{ points: r.path, distanceKm: r.distanceKm, durationMin: r.durationMin, fallback: false }]);
        setSelected(0);
      })
      .catch(() => setTrafficNote(true))
      .finally(() => setTrafficLoading(false));
  };

  // Score every alternative when the routes or the feature *values* change.
  // With live traffic, its measured level replaces the time-of-day guess.
  const featuresKey = JSON.stringify(features);
  useEffect(() => {
    if (!routes.length) return;
    let active = true;
    setScoring(true); setError(false);
    const f = traffic ? { ...features, Traffic_Density: traffic.trafficDensity } : features;
    Promise.all(routes.map((r) => api.scoreRoute(f, r.points).catch(() => null)))
      .then((rs) => {
        if (!active) return;
        setScored(rs);
        setError(rs.every((x) => x === null));
        setSelected(rankRoutes(rankInputs(routes, rs))[0]?.index ?? 0); // lead with the safest
      })
      .finally(() => { if (active) setScoring(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, featuresKey, traffic]);

  const route = scored[selected] ?? null;
  const verdict = buildRouteVerdict(route, features);
  const path = routes[selected];

  const options: RouteOption[] = useMemo(() => {
    if (routes.length < 2 || scored.length !== routes.length || scored.some((s) => !s)) return [];
    return rankRoutes(rankInputs(routes, scored)).map((r) => ({ ...r, level: scored[r.index]!.routeLevel }));
  }, [routes, scored]);

  // Name the riskiest stretch as a place, not "point #217".
  const stretch = useMemo(
    () => (route && route.segments.length > 1 ? riskiestStretch(route.segments, route.riskiestSegId) : null),
    [route],
  );
  useEffect(() => {
    setStretchName(null);
    if (!stretch) return;
    let active = true;
    reverseGeocode(stretch.center).then((n) => { if (active) setStretchName(shortLabel(n)); });
    return () => { active = false; };
  }, [stretch]);

  const busy = routing || scoring;

  return (
    <MapScreen
      map={
        <RoutePickerMap
          origin={origin} dest={dest}
          onOriginChange={setOrigin} onDestChange={setDest}
          segments={route?.segments ?? []}
          riskiestSegId={route?.riskiestSegId ?? 0}
          riskiestLabel={stretchName ?? undefined}
          alternatives={routes.map((r, index) => ({ index, points: r.points })).filter((a) => a.index !== selected && !routes[a.index].fallback)}
          onSelectAlternative={setSelected}
          zoomControl={false}
        />
      }
      top={
        <div className="space-y-1.5 rounded-2xl border border-line bg-white/95 p-2 shadow-soft backdrop-blur">
          <LocationSearch placeholder={t('route.from')} onSelect={(l) => setOrigin(l)} />
          <LocationSearch placeholder={t('route.to')} onSelect={(l) => setDest(l)} />
          <p className="px-1 text-xs text-muted">{t('route.tapHint')}</p>
        </div>
      }
      sheet={
        <>
          <RiskVerdict verdict={verdict} size="lg" pending={busy && !route} />
          <p className="mt-2 text-sm font-medium text-text">
            {routing ? t('route.routing')
              : path?.fallback ? t('route.straight')
                : path ? fill(t('route.summary'), { km: fmt.km(path.distanceKm), min: Math.round(path.durationMin) })
                  : t('route.plan')}
          </p>
          {error && <p className="mt-1 text-sm text-muted">{t('label.unknownHelp')}</p>}
          {stretch && stretchName && route && route.routeLevel !== 'Low' && (
            <p className="mt-1 text-sm text-text">
              {fill(t('route.stretch'), { place: stretchName, km: fmt.km(stretch.lengthKm) })}
            </p>
          )}
          {verdict.modelReasons.length > 0 && (
            <p className="mt-1 text-sm text-text">
              <span className="font-semibold">{t('label.why')}: </span>{verdict.modelReasons.map(t).join(' · ')}
            </p>
          )}
          {verdict.watchOuts.length > 0 && (
            <p className="text-sm text-muted">
              <span className="font-semibold">{t('label.watchOut')}: </span>{verdict.watchOuts.map(t).join(' · ')}
            </p>
          )}

          {traffic ? (
            <div className="mt-2 text-xs text-muted">
              <p className="text-sm text-text">
                {fill(t('route.trafficLine'), {
                  min: Math.round(traffic.durationMin), clear: Math.round(traffic.freeFlowMin), level: traffic.trafficDensity,
                })}
              </p>
              <p>{t('route.trafficAttribution')}</p>
            </div>
          ) : liveAvailable && (
            <button onClick={checkLiveTraffic} disabled={trafficLoading || busy || !path || path.fallback}
              className="mt-2 min-h-11 rounded-full border border-line px-4 text-sm font-medium text-signal disabled:opacity-50">
              {trafficLoading ? t('route.checkingTraffic') : t('route.liveTraffic')}
            </button>
          )}
          {trafficNote && <p className="mt-1 text-xs text-muted">{t('route.trafficUnavailable')}</p>}

          <RoutePicker options={options} selected={selected} onSelect={setSelected} />
        </>
      }
      sheetMore={
        route ? (
          <>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-text">{t('route.breakdown')}</h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                {([['route.mean', route.meanRisk], ['route.p90', route.p90Risk], ['route.max', route.maxRisk]] as const).map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-panel2 py-2">
                    <div className="font-mono tabular text-base text-text">{fmt.pct(v)}</div>
                    <div className="text-[11px] text-muted">{t(k)}</div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">{fill(t('route.points'), { n: route.segments.length })}</p>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-text">{t('now.detail.drivers')}</h3>
              <TopFactors factors={route.topFactors} />
            </div>
            {!traffic && <p className="text-xs text-muted">{t('route.carTimes')}</p>}
          </>
        ) : undefined
      }
    />
  );
}
