'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { regionAt, type FeatureVector, type Hotspot, type LatLon, type ScorePointResponse, type SpatialGrid } from '@rideguard/shared';
import { useConditions } from '@/context/ConditionsContext';
import { useT } from '@/i18n/LocaleContext';
import { fill } from '@/i18n/fill';
import { api } from '@/lib/api';
import { DHAKA_CENTER, getFix } from '@/lib/geo';
import { reverseGeocodeDetailed, shortLabel } from '@/lib/geocode';
import { fmt } from '@/lib/fmt';
import { RISK_TOKENS } from '@/lib/riskTokens';
import { buildVerdict, mapCause } from '@/lib/verdict';
import { useDebounce } from '@/hooks/useDebounce';
import { RiskVerdict } from '@/components/RiskVerdict';
import { LocationSearch } from '@/components/LocationSearch';
import { MapScreen } from '@/components/MapScreen';
import { SeverityLine } from '@/components/SeverityLine';
import { LocateIcon, MapFab } from '@/components/BottomSheet';
import { useMe } from '@/context/LocationContext';

const PointPickerMap = dynamic(
  () => import('@/components/MapView').then((m) => m.PointPickerMap),
  { ssr: false, loading: () => <div className="h-full bg-canvas" /> },
);

export default function MapPage() {
  const { features: live } = useConditions();
  const t = useT();
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [source, setSource] = useState('');
  const [regions, setRegions] = useState<SpatialGrid[]>([]);
  // Road type and limit of the place under the pin, not of the rider.
  const [road, setRoad] = useState<Pick<FeatureVector, 'Road_Type' | 'Speed_Limit' | 'Area'> | null>(null);
  const [spotCountry, setSpotCountry] = useState<string | null>(null);
  const [loc, setLoc] = useState<LatLon>(DHAKA_CENTER);
  const [locName, setLocName] = useState('');
  const [result, setResult] = useState<ScorePointResponse | null>(null);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.hotspots().then((r) => {
      setHotspots(r.hotspots); setSource(r.source);
      setRegions(r.regions ?? []);
    }).catch(() => {});
  }, []);

  // Center on the rider's real location when the screen opens. Unlike Now,
  // a Dhaka-centre fallback is fine here: this screen explores places, and
  // the place being scored is always the one under the pin.
  const { me } = useMe();
  const centredOnMe = useRef(false);
  useEffect(() => {
    // First live fix: start from where the rider is.
    if (me && !centredOnMe.current) { centredOnMe.current = true; setLoc({ lat: me.lat, lon: me.lon }); }
  }, [me]);
  useEffect(() => {
    if (me) return;
    getFix().then((f) => { if (!centredOnMe.current) { centredOnMe.current = true; setLoc({ lat: f.lat, lon: f.lon }); } }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const meFix = me ? { lat: me.lat, lon: me.lon, accuracyM: me.accuracyM, headingDeg: me.headingDeg } : null;

  // Exploring a place: score it at its own limit (riding at, not over, it).
  const features = useMemo<FeatureVector>(() => {
    const r = road ?? { Road_Type: live.Road_Type, Speed_Limit: live.Speed_Limit, Area: live.Area };
    return { ...live, ...r, Bike_Speed: r.Speed_Limit, Talk_While_Riding: 'Never' };
  }, [live, road]);
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
    reverseGeocodeDetailed(dLoc).then((r) => {
      if (!active) return;
      setLocName(shortLabel(r.name));
      setRoad({ Road_Type: r.roadType, Speed_Limit: r.speedLimit, Area: r.area });
      setSpotCountry(r.country);
    });
    return () => { active = false; };
  }, [dLoc]);

  const verdict = buildVerdict(result, features);
  // The crash data behind the pin: credited by region, absent outside them.
  const region = regionAt(regions, loc);
  const cause = result ? mapCause(result) : null;

  return (
    <MapScreen
      map={<PointPickerMap value={loc} onChange={setLoc} level={result?.advisoryLevel} hotspots={hotspots} zoomControl={false} me={meFix} />}
      floating={
        <MapFab onClick={() => me && setLoc({ lat: me.lat, lon: me.lon })} disabled={!me} label={t('now.recenter')}>
          <LocateIcon following={false} />
        </MapFab>
      }
      top={
        <LocationSearch placeholder={t('map.search')} near={loc} onSelect={(l) => setLoc(l)} />
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
          {result?.severity && <SeverityLine severity={result.severity} country={spotCountry} />}
          <div className="flex items-center gap-3 text-sm text-text">
            <span>{t('map.legend.less')}</span>
            <span className="h-3 flex-1 rounded-full"
              style={{ background: `linear-gradient(90deg, ${RISK_TOKENS.High.surface}14, ${RISK_TOKENS.High.surface}66)` }} />
            <span>{t('map.legend.more')}</span>
          </div>
          <p className="text-xs text-muted">
            {source !== 'pipeline' ? t('map.sourcePlaceholder')
              : region ? fill(t('map.source'), {
                n: region.cells.length, crashes: region.crashes ?? 0, years: region.years ?? '',
                region: region.name ?? '', credit: region.credit ?? '',
              })
                : t('map.noData')}
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
