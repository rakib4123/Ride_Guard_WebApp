'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { Hotspot, LatLon, ScorePointResponse } from '@rideguard/shared';
import { useProfile } from '@/context/ProfileContext';
import { api } from '@/lib/api';
import { DHAKA_CENTER } from '@/lib/geo';
import { reverseGeocode, shortLabel } from '@/lib/geocode';
import { useDebounce } from '@/hooks/useDebounce';
import { Card } from '@/components/Card';
import { AdvisoryBadge } from '@/components/AdvisoryBadge';
import { LocationSearch } from '@/components/LocationSearch';

const PointPickerMap = dynamic(
  () => import('@/components/MapView').then((m) => m.PointPickerMap),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-sm text-muted">Loading map…</div> },
);

export default function MapPage() {
  const { features } = useProfile();
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [source, setSource] = useState('');
  const [loc, setLoc] = useState<LatLon>(DHAKA_CENTER);
  const [locName, setLocName] = useState('Central Dhaka');
  const [result, setResult] = useState<ScorePointResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.hotspots()
      .then((r) => { setHotspots(r.hotspots); setSource(r.source); })
      .catch(() => setError('Could not load hotspots from the API.'));
  }, []);

  useEffect(() => {
    let active = true;
    api.scorePoint(features, loc).then((r) => active && setResult(r)).catch(() => {});
    return () => { active = false; };
  }, [features, loc]);

  const dLoc = useDebounce(loc, 1200);
  useEffect(() => {
    let active = true;
    reverseGeocode(dLoc).then((n) => active && setLocName(shortLabel(n)));
    return () => { active = false; };
  }, [dLoc]);

  return (
    <>
      <Card title="Dhaka risk map">
        <LocationSearch placeholder="Check the risk at a place…" onSelect={(l) => setLoc(l)} />
        <div className="mt-2 h-[380px] overflow-hidden rounded-xl2 border border-line">
          {error ? (
            <div className="flex h-full items-center justify-center text-sm text-risk-high">{error}</div>
          ) : (
            <PointPickerMap value={loc} onChange={setLoc} level={result?.advisoryLevel} hotspots={hotspots} />
          )}
        </div>
      </Card>

      <Card title="At this spot" action={result && <AdvisoryBadge level={result.advisoryLevel} />}>
        <p className="mb-3 text-sm"><span className="text-text">{locName}</span></p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Fused R" value={result ? Math.round(result.R * 100).toString() : '—'} />
          <Stat label="Spatial π" value={result ? result.spatialPrior.toFixed(2) : '—'} />
          <Stat label="Behaviour s" value={result ? result.behaviourScore.toFixed(2) : '—'} />
        </div>
        <p className="mt-3 text-xs text-muted">
          The spatial layer reflects your current trip settings combined with this
          location&apos;s historical incident density.
        </p>
      </Card>

      <Card title="Legend">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <LegendDot color="#16A34A" label="Lower density" />
          <LegendDot color="#F59E0B" label="Medium" />
          <LegendDot color="#EF4444" label="Higher density" />
        </div>
        <p className="mt-3 text-xs text-muted">
          {hotspots.length} hotspot clusters · source: <span className="font-mono">{source || '…'}</span>.
          {source === 'pipeline'
            ? ' Severity-weighted DBSCAN clusters + KDE from the Dhaka crash dataset (2007–2024).'
            : ' Illustrative placeholder data.'}
        </p>
      </Card>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel2 py-2">
      <div className="font-mono tabular text-lg text-text">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-3 w-3 rounded-full" style={{ background: color }} />
      <span className="text-text">{label}</span>
    </span>
  );
}
