'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  DEFAULT_PROFILE,
  DEFAULT_TOGGLES,
  type FeatureVector,
  type RiderProfile,
  type TripToggles,
  type TripContext,
} from '@rideguard/shared';

interface ProfileState {
  profile: RiderProfile;
  toggles: TripToggles;
  context: TripContext;
  setProfile: (p: Partial<RiderProfile>) => void;
  setToggles: (t: Partial<TripToggles>) => void;
  setContext: (c: Partial<TripContext>) => void;
  features: FeatureVector;
}

const Ctx = createContext<ProfileState | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<RiderProfile>(DEFAULT_PROFILE);
  const [toggles, setTogglesState] = useState<TripToggles>(DEFAULT_TOGGLES);
  const [context, setContextState] = useState<TripContext>({
    Weather: 'Clear',
    Time_of_Day: 'Morning',
  });

  const setProfile = useCallback(
    (p: Partial<RiderProfile>) => setProfileState((cur) => ({ ...cur, ...p })),
    [],
  );
  const setToggles = useCallback(
    (t: Partial<TripToggles>) => setTogglesState((cur) => ({ ...cur, ...t })),
    [],
  );
  const setContext = useCallback(
    (c: Partial<TripContext>) => setContextState((cur) => ({ ...cur, ...c })),
    [],
  );

  const features = useMemo<FeatureVector>(
    () => ({ ...profile, ...toggles, ...context }),
    [profile, toggles, context],
  );

  const value = useMemo<ProfileState>(
    () => ({ profile, toggles, context, setProfile, setToggles, setContext, features }),
    [profile, toggles, context, setProfile, setToggles, setContext, features],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfile(): ProfileState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useProfile must be used within ProfileProvider');
  return v;
}
