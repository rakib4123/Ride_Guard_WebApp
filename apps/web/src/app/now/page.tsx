'use client';

import { useEffect, useRef, useState } from 'react';
import type { TripToggles } from '@rideguard/shared';
import { useProfile } from '@/context/ProfileContext';
import { useAlerts } from '@/context/AlertsContext';
import { useT } from '@/i18n/LocaleContext';
import { fill } from '@/i18n/fill';
import { useRide } from '@/hooks/useRide';
import { useNowScore } from '@/hooks/useNowScore';
import { buildVerdict } from '@/lib/verdict';
import { NowParked, type LastRide } from '@/components/NowParked';
import { RideMode } from '@/components/RideMode';

/**
 * Now: chooses between the parked view and the full-screen ride takeover, and
 * wires the live ride (GPS speed, phone-use sensing, alerts) into the score.
 */
export default function NowPage() {
  const { features, setToggles } = useProfile();
  const now = useNowScore();
  const ride = useRide();
  const { arm, fire } = useAlerts();
  const t = useT();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [lastRide, setLastRide] = useState<LastRide | null>(null);
  const rideStart = useRef<Omit<LastRide, 'distanceKm'> | null>(null);
  const prevLevel = useRef<string | null>(null);
  // The rider's own phone-use answer, restored when a ride ends.
  const preRidePhone = useRef<TripToggles['Talk_While_Riding']>('Never');

  const { setLoc, result } = now;
  useEffect(() => { if (ride.riding && ride.fix) setLoc(ride.fix); }, [ride.riding, ride.fix, setLoc]);
  useEffect(() => { if (ride.riding) setToggles({ Bike_Speed: ride.speedKmh }); }, [ride.riding, ride.speedKmh, setToggles]);
  useEffect(() => {
    if (!ride.riding) return; // off-ride, the rider's own setting stands
    setToggles({ Talk_While_Riding: ride.phoneUse ? 'Regularly' : preRidePhone.current });
    if (ride.phoneUse) fire('phone', t('alert.phone'), 'high');
  }, [ride.riding, ride.phoneUse, setToggles, fire, t]);
  useEffect(() => {
    if (ride.riding && ride.speedKmh > features.Speed_Limit + 2) {
      fire('speed', fill(t('alert.speed'), { limit: features.Speed_Limit }), 'med');
    }
  }, [ride.riding, ride.speedKmh, features.Speed_Limit, fire, t]);
  useEffect(() => {
    // No result means no transition to announce — silence is not 'Low'.
    if (!result) return;
    const level = result.advisoryLevel;
    if (ride.riding && level === 'High' && prevLevel.current !== 'High') {
      fire('area', t('alert.area'), 'high');
    }
    prevLevel.current = level;
  }, [result, ride.riding, fire, t]);

  const startRide = () => {
    preRidePhone.current = features.Talk_While_Riding;
    rideStart.current = {
      startTime: new Date().toISOString(), startLoc: now.loc, startName: now.locName,
    };
    arm(); // the Start tap is the user gesture browsers require for audio
    ride.start();
  };
  const stopRide = () => {
    ride.stop();
    setToggles({ Talk_While_Riding: preRidePhone.current });
    if (rideStart.current) setLastRide({ ...rideStart.current, distanceKm: ride.distanceKm });
    setDetailsOpen(true); // the Save button lives in the drawer
  };

  const verdict = buildVerdict(result, features);

  if (ride.riding) {
    return (
      <RideMode verdict={verdict} speedKmh={ride.speedKmh} speedLimit={features.Speed_Limit}
        center={now.loc} riskRoads={now.riskRoads} onStop={stopRide} />
    );
  }
  return (
    <NowParked now={now} verdict={verdict} features={features} onStartRide={startRide}
      lastRide={lastRide} onRideSaved={() => setLastRide(null)}
      detailsOpen={detailsOpen} setDetailsOpen={setDetailsOpen} />
  );
}
