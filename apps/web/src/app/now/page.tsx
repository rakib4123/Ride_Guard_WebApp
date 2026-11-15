'use client';

import { useEffect, useRef, useState } from 'react';
import { BLACKSPOT_PRIOR, type TripCrowd } from '@rideguard/shared';
import { useConditions } from '@/context/ConditionsContext';
import { useAlerts } from '@/context/AlertsContext';
import { useT } from '@/i18n/LocaleContext';
import { fill } from '@/i18n/fill';
import { useRide } from '@/hooks/useRide';
import { useNowScore } from '@/hooks/useNowScore';
import { useCrowd } from '@/hooks/useCrowd';
import { useCrowdSettings } from '@/lib/crowdSettings';
import { buildVerdict } from '@/lib/verdict';
import { inUnit, speedUnitFor } from '@/lib/units';
import { NowParked, type LastRide } from '@/components/NowParked';
import { RideMode } from '@/components/RideMode';

/**
 * Now: chooses between the parked view and the full-screen ride takeover, and
 * wires the live ride (GPS speed, touch-on-the-move, crowd, alerts) into the
 * measured conditions the model scores.
 */
export default function NowPage() {
  const { features, setConditions, setCrowd, country } = useConditions();
  const unit = speedUnitFor(country);
  const now = useNowScore();
  const ride = useRide();
  const [crowdSettings] = useCrowdSettings();
  const { crowd, startBle } = useCrowd({
    riding: ride.riding, fix: ride.fix, speedKmh: ride.speedKmh, startedAt: ride.startedAt,
    movedLastMinuteM: ride.movedLastMinuteM, settings: crowdSettings,
  });
  const { arm, fire } = useAlerts();
  const t = useT();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [lastRide, setLastRide] = useState<LastRide | null>(null);
  const rideStart = useRef<Omit<LastRide, 'distanceKm' | 'crowd'> | null>(null);
  const wasInBlackspot = useRef(false);
  /** The busiest crowd seen on this ride, for the trip record. */
  const peakCrowd = useRef<TripCrowd | null>(null);

  const { trackLoc, result } = now;
  useEffect(() => { if (ride.riding && ride.fix) trackLoc(ride.fix); }, [ride.riding, ride.fix, trackLoc]);
  useEffect(() => { if (ride.riding) setConditions({ Bike_Speed: ride.speedKmh }); }, [ride.riding, ride.speedKmh, setConditions]);
  useEffect(() => {
    if (!ride.riding) return;
    setConditions({ Talk_While_Riding: ride.phoneUse ? 'Regularly' : 'Never' });
    if (ride.phoneUse) fire('phone', t('alert.phone'), 'high');
  }, [ride.riding, ride.phoneUse, setConditions, fire, t]);
  useEffect(() => {
    if (ride.riding && ride.speedKmh > features.Speed_Limit + 2) {
      fire('speed', fill(t('alert.speed'), {
        limit: inUnit(features.Speed_Limit, unit), unit: t(unit === 'mph' ? 'ride.speedUnitMph' : 'ride.speedUnit'),
      }), 'med');
    }
  }, [ride.riding, ride.speedKmh, features.Speed_Limit, unit, fire, t]);

  // "High-risk area" is about the place: announce entering a crash blackspot,
  // not any High reading (a High caused by speed or phone use has its own alert).
  useEffect(() => {
    if (!result) return;
    const inBlackspot = result.spatialPrior >= BLACKSPOT_PRIOR;
    if (ride.riding && inBlackspot && !wasInBlackspot.current) fire('area', t('alert.area'), 'high');
    wasInBlackspot.current = inBlackspot;
  }, [result, ride.riding, fire, t]);

  // The measured crowd raises the traffic estimate while riding.
  useEffect(() => {
    setCrowd(ride.riding ? crowd.vehiclesAround : null);
    if (!ride.riding) return;
    const c: TripCrowd = {
      riders_nearby: crowd.presence?.ridersNearby ?? null,
      vehicles_nearby: crowd.presence?.groupsNearby ?? null,
      ble_devices: crowd.ble?.devices ?? null,
      ble_groups: crowd.ble?.groups ?? null,
    };
    const size = (x: TripCrowd | null) => Math.max(x?.vehicles_nearby ?? 0, x?.ble_groups ?? 0);
    if (!peakCrowd.current || size(c) > size(peakCrowd.current)) peakCrowd.current = c;
  }, [ride.riding, crowd.vehiclesAround, crowd.presence, crowd.ble, setCrowd]);

  const startRide = () => {
    rideStart.current = { startTime: new Date().toISOString(), startLoc: now.loc, startName: now.locName };
    peakCrowd.current = null;
    arm();            // the Start tap is the user gesture browsers require for audio...
    void startBle();  // ...and for the Bluetooth permission prompt
    ride.start();
  };
  const stopRide = () => {
    ride.stop();
    setConditions({ Bike_Speed: 0, Talk_While_Riding: 'Never' });
    setCrowd(null);
    if (rideStart.current) {
      setLastRide({ ...rideStart.current, distanceKm: ride.distanceKm, crowd: peakCrowd.current });
    }
    setDetailsOpen(true); // the Save button lives in the drawer
  };

  const verdict = buildVerdict(result, features);

  if (ride.riding) {
    return (
      <RideMode verdict={verdict} speedKmh={ride.speedKmh} speedLimit={features.Speed_Limit} unit={unit}
        center={now.loc} fix={ride.fix} riskRoads={now.riskRoads} crowd={crowd} measuring={crowdSettings.share || crowd.bleActive}
        onStop={stopRide} />
    );
  }
  return (
    <NowParked now={now} verdict={verdict} features={features} onStartRide={startRide}
      lastRide={lastRide} onRideSaved={() => setLastRide(null)}
      detailsOpen={detailsOpen} setDetailsOpen={setDetailsOpen} />
  );
}
