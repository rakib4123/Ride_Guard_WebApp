'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import type { Hotspot, LatLon, ScorePointResponse } from '@rideguard/shared';
import { useProfile } from '@/context/ProfileContext';
import { useT } from '@/i18n/LocaleContext';
import { fill } from '@/i18n/fill';
import { api } from '@/lib/api';
import { DHAKA_CENTER, getFix } from '@/lib/geo';
import { reverseGeocode, shortLabel } from '@/lib/geocode';
import { fmt } from '@/lib/fmt';
import { RISK_TOKENS } from '@/lib/riskTokens';
import { buildVerdict, mapCause } from '@/lib/verdict';
import { useDebounce } from '@/hooks/useDebounce';
import { RiskVerdict } from '@/components/RiskVerdict';
import { LocationSearch } from '@/components/LocationSearch';
import { MapScreen } from '@/components/MapScreen';

const PointPickerMap = dynamic(
  () => import('@/components/MapView').then((m) => m.PointPickerMap),
  { ssr: false, loading: () => <div className="h-full bg-canvas" /> },
);

export default function MapPage() {
  const { features } = useProfile();
  const t = useT();
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [source, setSource] = useState('');
  const [loc, setLoc] = useState<LatLon>(DHAKA_CENTER);
  const [locName, setLocName] = useState('');
  const [result, setResult] = useState<ScorePointResponse | null>(null);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.hotspots().then((r) => { setHotspots(r.hotspots); setSource(r.source); }).catch(() => {});
  }, []);

  // Center on the rider's real location when the screen opens. Unlike Now,
  // a Dhaka-centre fallback is fine here: this screen explores places, and
  // the place being scored is always the one under the pin.
  useEffect(() => {
    getFix().then((f) => setLoc({ lat: f.lat, lon: f.lon })).catch(() => {});
  }, []);

  const scoreInput = useMemo(() => ({ features, loc }), [features, loc]);
  const debScore = useDebounce(scoreInput, 500);
  useEffect(() => {
    let active = true;
    setScoring(true); setError(false);
    api.scorePoint(debScore.features, debScore.loc)
      .then((r) => { if (active) setResult(r); })
      .catch(() => { if (active) { setResult(null); setError(true); } })
      .finally(() => { if (active) setScoring(false); });
    return () => { active = false; };
  }, [debScore]);

  const dLoc = useDebounce(loc, 1200);
  useEffect(() => {
    let active = true;
    reverseGeocode(dLoc).then((n) => active && setLocName(shortLabel(n)));
    return () => { active = false; };
  }, [dLoc]);

  const verdict = buildVerdict(result, features);
  const cause = result ? mapCause(result) : null;

  return (
    <MapScreen
      map={<PointPickerMap value={loc} onChange={setLoc} level={result?.advisoryLevel} hotspots={hotspots} zoomControl={false} />}
      top={
        <div className="rounded-2xl border border-line bg-white/95 px-2 py-1 shadow-soft backdrop-blur">
          <LocationSearch placeholder={t('map.search')} onSelect={(l) => setLoc(l)} />
        </div>
      }
      sheet={
        <>
          <RiskVerdict verdict={verdict} size="md" pending={scoring && !result} />
          <p className="mt-2 truncate text-sm font-medium text-text">{locName}</p>
          {error && <p className="text-sm text-muted">{t('label.unknownHelp')}</p>}
          {cause && <p className="mt-1 text-sm text-text">{t(cause[0])} {t(cause[1])}</p>}
          <p className="mt-2 flex items-center gap-2 text-xs text-muted">
            <Bloom /> {t('map.note')}
          </p>
        </>
      }
      sheetMore={
        <>
          {result && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label={t('now.detail.riding')} value={fmt.pct(result.behaviourScore)} />
              <Stat label={t('now.detail.area')} value={fmt.pct(result.spatialPrior)} />
              <Stat label={t('now.detail.combined')} value={fmt.pct(result.R)} />
            </div>
          )}
          <div className="flex items-center gap-3 text-sm text-text">
            <span>{t('map.legend.less')}</span>
            <span className="h-3 flex-1 rounded-full"
              style={{ background: `linear-gradient(90deg, ${RISK_TOKENS.High.surface}14, ${RISK_TOKENS.High.surface}66)` }} />
            <span>{t('map.legend.more')}</span>
          </div>
          <p className="text-xs text-muted">
            {source === 'pipeline'
              ? fill(t('map.source'), { n: hotspots.length })
              : t('map.sourcePlaceholder')}
          </p>
          <p className="text-xs text-muted">{t('map.tapHint')}</p>
        </>
      }
    />
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-panel2 py-2">
      <div className="font-mono tabular text-base text-text">{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}

/** Legend swatch matching the soft hotspot blooms on the map. */
function Bloom() {
  return (
    <span className="h-4 w-4 flex-none rounded-full" aria-hidden="true"
      style={{ background: `radial-gradient(circle, ${RISK_TOKENS.High.surface}88, ${RISK_TOKENS.High.surface}00 70%)` }} />
  );
}
