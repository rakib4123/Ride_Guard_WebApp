'use client';

import { createContext, useContext, useMemo, useState } from 'react';
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

  const value = useMemo<ProfileState>(
    () => ({
      profile,
      toggles,
      context,
      setProfile: (p) => setProfileState((cur) => ({ ...cur, ...p })),
      setToggles: (t) => setTogglesState((cur) => ({ ...cur, ...t })),
      setContext: (c) => setContextState((cur) => ({ ...cur, ...c })),
      features: { ...profile, ...toggles, ...context },
    }),
    [profile, toggles, context],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfile(): ProfileState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useProfile must be used within ProfileProvider');
  return v;
}
