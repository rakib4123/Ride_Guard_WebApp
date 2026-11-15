'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_FEATURES, trafficWithCrowd, type FeatureVector, type TimeOfDay } from '@rideguard/shared';
import { timeOfDay } from '@/lib/weather';
import { trafficFromTime } from '@/lib/deriveContext';

/** The inputs sensors write directly. Time of day and traffic are derived. */
export type Measured = Omit<FeatureVector, 'Time_of_Day' | 'Traffic_Density'>;

interface ConditionsState {
  /** The model's inputs, all measured or derived by the app. */
  features: FeatureVector;
  setConditions: (c: Partial<Measured>) => void;
  /** Vehicles/groups counted around the rider (D2D), or null when not measuring. */
  crowd: number | null;
  setCrowd: (n: number | null) => void;
  /** Country of the current spot (ISO alpha-2): units and road defaults only, not a model input. */
  country: string | null;
  setCountry: (c: string | null) => void;
}

const Ctx = createContext<ConditionsState | null>(null);

const { Time_of_Day: _t, Traffic_Density: _d, ...DEFAULT_MEASURED } = DEFAULT_FEATURES;

/**
 * The live conditions the model scores. Nothing here is asked of the rider:
 * screens and sensors write into it (GPS speed, weather, road type, touch on
 * the move, crowd). App-wide, so Route and Map score with the same real time
 * and weather as Now even when opened directly.
 *
 * Traffic is the time-of-day estimate, raised (never lowered) by the crowd
 * measured around the rider.
 */
export function ConditionsProvider({ children }: { children: React.ReactNode }) {
  const [measured, setMeasured] = useState<Measured>(DEFAULT_MEASURED);
  const [tod, setTod] = useState<TimeOfDay>(DEFAULT_FEATURES.Time_of_Day);
  const [crowd, setCrowd] = useState<number | null>(null);
  const [country, setCountry] = useState<string | null>(null);

  const setConditions = useCallback(
    (c: Partial<Measured>) => setMeasured((cur) => ({ ...cur, ...c })),
    [],
  );

  // The clock, re-read every minute: a ride can run from evening into night.
  useEffect(() => {
    const tick = () => setTod(timeOfDay());
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const features = useMemo<FeatureVector>(() => ({
    ...measured,
    Time_of_Day: tod,
    Traffic_Density: trafficWithCrowd(trafficFromTime(tod), crowd),
  }), [measured, tod, crowd]);

  const value = useMemo(
    () => ({ features, setConditions, crowd, setCrowd, country, setCountry }),
    [features, setConditions, crowd, country],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConditions(): ConditionsState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useConditions must be used within ConditionsProvider');
  return v;
}
