'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Hotspot, LatLon, ScorePointResponse } from '@rideguard/shared';
import { useProfile } from '@/context/ProfileContext';
import { useT } from '@/i18n/LocaleContext';
import { fill } from '@/i18n/fill';
import { useDebounce } from '@/hooks/useDebounce';
import { api } from '@/lib/api';
import { fetchWeather, timeOfDay, type WeatherNow } from '@/lib/weather';
import { getFix, DHAKA_CENTER } from '@/lib/geo';
import { fetchNearbyRoads, buildRiskRoads, distMeters, type RiskRoad } from '@/lib/roadrisk';
import { reverseGeocodeDetailed, shortLabel } from '@/lib/geocode';
import { roadConditionFromWeather, trafficFromTime, speedLimitFromRoadType } from '@/lib/deriveContext';

/**
 * Everything the Now screen needs to produce a reading: where the rider is,
 * the weather there, the debounced score, and the road overlay.
 *
 * No reading is requested until the location is known (a GPS fix, a search,
 * or a pin the rider placed). Scoring Dhaka's centre for a rider whose
 * location failed would show a confident verdict for a place they are not.
 */
export function useNowScore() {
  const { features, setToggles, setContext } = useProfile();
  const t = useT();
  const [loc, setLocState] = useState<LatLon>(DHAKA_CENTER);
  const [hasLocation, setHasLocation] = useState(false);
  const [locName, setLocName] = useState('');
  const [weather, setWeather] = useState<WeatherNow | null>(null);
  const [result, setResult] = useState<ScorePointResponse | null>(null);
  const [error, setError] = useState(false);
  // True while a score request is in flight: "waiting" must not look the same
  // as "the last request failed", though both leave `result` null.
  const [scoring, setScoring] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locNote, setLocNote] = useState<string | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [rawRoads, setRawRoads] = useState<LatLon[][]>([]);
  const [riskRoads, setRiskRoads] = useState<RiskRoad[]>([]);
  const roadsCenter = useRef<LatLon | null>(null);

  /** A location the rider chose (search, tap, drag) or a GPS fix. */
  const setLoc = useCallback((l: LatLon) => {
    setLocState(l);
    setHasLocation(true);
  }, []);

  useEffect(() => {
    const tod = timeOfDay();
    setContext({ Time_of_Day: tod });
    setToggles({ Traffic_Density: trafficFromTime(tod) });
  }, [setContext, setToggles]);

  useEffect(() => { api.hotspots().then((r) => setHotspots(r.hotspots)).catch(() => {}); }, []);

  useEffect(() => {
    if (!hasLocation) return;
    let active = true;
    fetchWeather(loc.lat, loc.lon).then((w) => {
      if (!active) return;
      setWeather(w);
      setContext({ Weather: w.condition });
      setToggles({ Road_condition: roadConditionFromWeather(w.condition) });
    }).catch(() => {});
    return () => { active = false; };
  }, [loc, hasLocation, setContext, setToggles]);

  const scoreInput = useMemo(() => ({ features, loc, hasLocation }), [features, loc, hasLocation]);
  const debScore = useDebounce(scoreInput, 500);
  useEffect(() => {
    if (!debScore.hasLocation) return;
    let active = true;
    setError(false);
    setScoring(true);
    api.scorePoint(debScore.features, debScore.loc)
      .then((r) => { if (active) setResult(r); })
      .catch(() => {
        if (!active) return;
        // A failed re-score must not leave the PREVIOUS location's verdict on
        // screen looking current.
        setResult(null);
        setError(true);
      })
      .finally(() => { if (active) setScoring(false); });
    return () => { active = false; };
  }, [debScore]);

  const debouncedLoc = useDebounce(loc, 1200);
  useEffect(() => {
    if (!hasLocation) return;
    let active = true;
    reverseGeocodeDetailed(debouncedLoc).then((r) => {
      if (!active) return;
      setLocName(shortLabel(r.name));
      setToggles({ Road_Type: r.roadType, Speed_Limit: speedLimitFromRoadType(r.roadType) });
    });
    return () => { active = false; };
  }, [debouncedLoc, hasLocation, setToggles]);

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

  const useMyLocation = useCallback(async () => {
    setLocating(true); setLocNote(null);
    try {
      const fix = await getFix();
      setLoc({ lat: fix.lat, lon: fix.lon });
      setLocNote(fix.accuracy > 2000
        ? fill(t('now.locApprox'), { km: Math.round(fix.accuracy / 1000) })
        : null);
    } catch {
      setLocNote(t('now.locFailed'));
    } finally { setLocating(false); }
  }, [setLoc, t]);

  // Centre on the rider's real location as soon as the screen opens.
  const autoLocated = useRef(false);
  useEffect(() => {
    if (autoLocated.current) return;
    autoLocated.current = true;
    void useMyLocation();
  }, [useMyLocation]);

  return {
    loc, setLoc, hasLocation, locName, setLocName, weather, result, error, scoring,
    locating, locNote, setLocNote, useMyLocation, riskRoads,
  };
}

export type NowScore = ReturnType<typeof useNowScore>;
