'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LatLon, ScorePointResponse, SpatialGrid } from '@rideguard/shared';
import { useConditions } from '@/context/ConditionsContext';
import { useT } from '@/i18n/LocaleContext';
import { fill } from '@/i18n/fill';
import { useDebounce } from '@/hooks/useDebounce';
import { useMovedLocation } from '@/hooks/useMovedLocation';
import { api } from '@/lib/api';
import { fetchWeather, type WeatherNow } from '@/lib/weather';
import { getFix, DHAKA_CENTER } from '@/lib/geo';
import { fetchNearbyRoads, buildRiskRoads, distMeters, type RiskRoad } from '@/lib/roadrisk';
import { useMe } from '@/context/LocationContext';
import { reverseGeocodeDetailed, shortLabel } from '@/lib/geocode';
import { roadConditionFromWeather } from '@/lib/deriveContext';

/** Refresh the place name / road type / limit after this much movement. */
const GEOCODE_EVERY_M = 40;
/** Weather changes over kilometres, and over minutes. */
const WEATHER_EVERY_M = 1_000;
const WEATHER_EVERY_MS = 10 * 60_000;
/** Re-fetch the road network once the rider leaves most of the 600 m disc. */
const ROADS_EVERY_M = 200;
/** While following, move the reading only after real movement, not GPS jitter. */
const FOLLOW_EVERY_M = 15;

/**
 * Everything the Now screen needs to produce a reading: where the rider is
 * (followed live until they pick another place),
 * what the phone measures there, the debounced score, and the road overlay.
 *
 * No reading is requested until the location is known (a GPS fix, a search,
 * or a pin the rider placed): scoring Dhaka's centre for a rider whose
 * location failed would show a confident verdict for a place they are not.
 */
export function useNowScore() {
  const { features, setConditions, setCountry } = useConditions();
  const t = useT();
  const [loc, setLocState] = useState<LatLon>(DHAKA_CENTER);
  const [hasLocation, setHasLocation] = useState(false);
  const [locName, setLocName] = useState('');
  const [weather, setWeather] = useState<WeatherNow | null>(null);
  const [result, setResult] = useState<ScorePointResponse | null>(null);
  const [error, setError] = useState(false);
  // In flight is not the same claim as "the last request failed".
  const [scoring, setScoring] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locNote, setLocNote] = useState<string | null>(null);
  const [regions, setRegions] = useState<SpatialGrid[]>([]);
  const [rawRoads, setRawRoads] = useState<LatLon[][]>([]);
  const [riskRoads, setRiskRoads] = useState<RiskRoad[]>([]);
  const { me, status } = useMe();
  /** The reading follows the rider until they pick another place. */
  const [followMe, setFollowMe] = useState(true);
  const hasLocationRef = useRef(false);
  hasLocationRef.current = hasLocation;

  /** A place the rider chose (search, tap, drag): stop following. */
  const setLoc = useCallback((l: LatLon) => {
    setLocState({ lat: l.lat, lon: l.lon });
    setHasLocation(true);
    setFollowMe(false);
  }, []);
  /** A live fix during a ride: keeps following. */
  const trackLoc = useCallback((l: LatLon) => {
    setLocState({ lat: l.lat, lon: l.lon });
    setHasLocation(true);
  }, []);
  const stopFollowing = useCallback(() => setFollowMe(false), []);

  // Follow the live position (after real movement, not jitter).
  useEffect(() => {
    if (!followMe || !me) return;
    setLocState((cur) => (!hasLocationRef.current || distMeters(cur, me) >= FOLLOW_EVERY_M
      ? { lat: me.lat, lon: me.lon } : cur));
    setHasLocation(true);
  }, [me, followMe]);

  // Say when the position is rough, or when location is refused.
  useEffect(() => {
    if (status === 'denied' || status === 'unavailable') setLocNote(t('now.locFailed'));
    else if (followMe && me && me.accuracyM > 2000) setLocNote(fill(t('now.locApprox'), { km: Math.round(me.accuracyM / 1000) }));
  }, [status, followMe, me?.accuracyM, t]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { api.hotspots().then((r) => setRegions(r.regions ?? [])).catch(() => {}); }, []);

  // Weather: when the rider has moved a kilometre, and every ten minutes.
  const weatherLoc = useMovedLocation(loc, hasLocation, WEATHER_EVERY_M);
  const [weatherTick, setWeatherTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setWeatherTick((n) => n + 1), WEATHER_EVERY_MS);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (!weatherLoc) return;
    let active = true;
    fetchWeather(weatherLoc.lat, weatherLoc.lon).then((w) => {
      if (!active) return;
      setWeather(w);
      setConditions({
        Weather: w.condition, Road_condition: roadConditionFromWeather(w.condition), Is_Dark: w.isDark,
      });
    }).catch(() => {});
    return () => { active = false; };
  }, [weatherLoc, weatherTick, setConditions]);

  // Place name, road type and speed limit: every few tens of metres.
  const geoLoc = useMovedLocation(loc, hasLocation, GEOCODE_EVERY_M);
  useEffect(() => {
    if (!geoLoc) return;
    let active = true;
    reverseGeocodeDetailed(geoLoc).then((r) => {
      if (!active) return;
      setLocName(shortLabel(r.name));
      setConditions({ Road_Type: r.roadType, Speed_Limit: r.speedLimit, Area: r.area });
      if (r.country) setCountry(r.country);
    });
    return () => { active = false; };
  }, [geoLoc, setConditions, setCountry]);

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
        // A failed re-score must not leave the PREVIOUS reading looking current.
        setResult(null);
        setError(true);
      })
      .finally(() => { if (active) setScoring(false); });
    return () => { active = false; };
  }, [debScore]);

  const roadsLoc = useMovedLocation(loc, true, ROADS_EVERY_M);
  useEffect(() => {
    if (!roadsLoc) return;
    let active = true;
    fetchNearbyRoads(roadsLoc, 600).then((rs) => { if (active) setRawRoads(rs); }).catch(() => {});
    return () => { active = false; };
  }, [roadsLoc]);

  useEffect(() => {
    if (!rawRoads.length) { setRiskRoads([]); return; }
    const s = result?.behaviourScore ?? 0.2; // colour roads even before the first score
    setRiskRoads(buildRiskRoads(rawRoads, regions, s));
  }, [rawRoads, regions, result]);

  const useMyLocation = useCallback(async () => {
    setFollowMe(true); setLocNote(null);
    if (me) { setLocState({ lat: me.lat, lon: me.lon }); setHasLocation(true); return; }
    setLocating(true);
    try {
      const fix = await getFix();
      trackLoc({ lat: fix.lat, lon: fix.lon });
      setLocNote(fix.accuracy > 2000
        ? fill(t('now.locApprox'), { km: Math.round(fix.accuracy / 1000) })
        : null);
    } catch {
      setLocNote(t('now.locFailed'));
    } finally { setLocating(false); }
  }, [me, trackLoc, t]);

  return {
    loc, setLoc, trackLoc, hasLocation, locName, setLocName, weather, result, error, scoring,
    locating: locating || (status === 'locating' && !hasLocation),
    locNote, setLocNote, useMyLocation, riskRoads, followMe, stopFollowing,
  };
}

export type NowScore = ReturnType<typeof useNowScore>;
