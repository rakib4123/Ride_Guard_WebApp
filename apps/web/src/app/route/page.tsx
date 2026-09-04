'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import type { LatLon, ScoreRouteResponse } from '@rideguard/shared';
import { useProfile } from '@/context/ProfileContext';
import { useDebounce } from '@/hooks/useDebounce';
import { api } from '@/lib/api';
import { fetchRoute } from '@/lib/routing';
import { getFix } from '@/lib/geo';
import { AdvisoryBadge } from '@/components/AdvisoryBadge';
import { TopFactors } from '@/components/TopFactors';
import { LocationSearch } from '@/components/LocationSearch';
import { MapScreen } from '@/components/MapScreen';

const RoutePickerMap = dynamic(
  () => import('@/components/MapView').then((m) => m.RoutePickerMap),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-sm text-muted">Loading map…</div> },
);

const DEFAULT_ORIGIN: LatLon = { lat: 23.8759, lon: 90.3795 };
const DEFAULT_DEST: LatLon = { lat: 23.733, lon: 90.4172 };

export default function RoutePage() {
  const { features } = useProfile();
  const [origin, setOrigin] = useState<LatLon>(DEFAULT_ORIGIN);
  const [dest, setDest] = useState<LatLon>(DEFAULT_DEST);
  const [clickTarget, setClickTarget] = useState<'origin' | 'dest'>('dest');
  const [route, setRoute] = useState<ScoreRouteResponse | null>(null);
  const [distanceKm, setDistanceKm] = useState(0);
  const [fallback, setFallback] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dOrigin = useDebounce(origin, 500);
  const dDest = useDebounce(dest, 500);

  // Start the route from the rider's real location when the screen opens.
  useEffect(() => {
    getFix().then((f) => setOrigin({ lat: f.lat, lon: f.lon })).catch(() => {});
  }, []);

  // Routing and scoring are split: OSRM is a rate-limited public endpoint, so
  // it is only re-queried when the endpoints actually move — not every time the
  // shared `features` object gets a new identity.
  const [path, setPath] = useState<LatLon[] | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    fetchRoute(dOrigin, dDest)
      .then((r) => {
        if (!active) return;
        setFallback(r.fallback);
        setDistanceKm(r.distanceKm);
        setPath(r.points);
      })
      .catch(() => { if (active) { setError('Could not fetch the route.'); setLoading(false); } });
    return () => { active = false; };
  }, [dOrigin, dDest]);

  // Re-score when the path or the feature *values* change (not their identity).
  const featuresKey = JSON.stringify(features);
  useEffect(() => {
    if (!path) return;
    let active = true;
    setLoading(true);
    api.scoreRoute(features, path)
      .then((r) => { if (active) { setRoute(r); setError(null); } })
      .catch(() => { if (active) setError('Could not reach the scoring API.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, featuresKey]);

  const stats = useMemo(
    () => (route ? [
      { label: 'Mean', value: route.meanRisk },
      { label: 'P90', value: route.p90Risk },
      { label: 'Max', value: route.maxRisk },
    ] : []),
    [route],
  );

  return (
    <MapScreen
      map={
        <RoutePickerMap
          origin={origin} dest={dest}
          onOriginChange={setOrigin} onDestChange={setDest}
          clickTarget={clickTarget}
          segments={route?.segments ?? []}
          riskiestSegId={route?.riskiestSegId ?? 0}
          zoomControl={false}
        />
      }
      top={
        <div className="space-y-1.5 rounded-2xl border border-line bg-white/95 p-2 shadow-soft backdrop-blur">
          <LocationSearch placeholder="Start — search a place…" onSelect={(l) => setOrigin(l)} />
          <LocationSearch placeholder="Destination — search a place…" onSelect={(l) => setDest(l)} />
          <div className="flex items-center gap-2 px-1 text-xs text-muted">
            <span>Map tap sets:</span>
            {(['origin', 'dest'] as const).map((t) => (
              <button key={t} onClick={() => setClickTarget(t)} className="rounded-full px-3 py-1"
                style={{
                  background: clickTarget === t ? 'rgba(37,99,235,0.10)' : '#FFFFFF',
                  color: clickTarget === t ? '#2563EB' : '#64748B',
                  border: '1px solid #E2E8F0',
                }}>
                {t === 'origin' ? 'Start (A)' : 'End (B)'}
              </button>
            ))}
          </div>
        </div>
      }
      sheet={
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-medium text-text">
              {loading ? 'Routing…' : distanceKm ? `${distanceKm.toFixed(1)} km route` : 'Plan a route'}
              {fallback && <span className="text-muted"> · straight line</span>}
            </p>
            {route && <AdvisoryBadge level={route.routeLevel} />}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {(stats.length ? stats : [{ label: 'Mean', value: 0 }, { label: 'P90', value: 0 }, { label: 'Max', value: 0 }]).map((s) => (
              <div key={s.label} className="rounded-lg bg-panel2 py-2">
                <div className="font-mono tabular text-base text-text">{route ? Math.round(s.value * 100) : '—'}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted">{s.label} risk</div>
              </div>
            ))}
          </div>
          {error && <p className="mt-2 text-xs text-risk-high">{error}</p>}
        </>
      }
      sheetMore={
        route ? (
          <>
            <p className="text-sm text-muted">
              {route.segments.length} sampled points · riskiest at point #{route.riskiestSegId}.
            </p>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-text">Why this score</h3>
              <TopFactors factors={route.topFactors} />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">Set a start and destination to see the route risk breakdown.</p>
        )
      }
    />
  );
}
