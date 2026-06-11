'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_PROFILE,
  DEFAULT_TOGGLES,
  type FeatureVector,
  type RiderProfile,
  type TripToggles,
  type TripContext,
} from '@rideguard/shared';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

interface ProfileState {
  profile: RiderProfile;
  toggles: TripToggles;
  context: TripContext;
  setProfile: (p: Partial<RiderProfile>) => void;
  setToggles: (t: Partial<TripToggles>) => void;
  setContext: (c: Partial<TripContext>) => void;
  saveProfile: () => Promise<void>;
  features: FeatureVector;
}

const Ctx = createContext<ProfileState | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfileState] = useState<RiderProfile>(DEFAULT_PROFILE);
  const [toggles, setTogglesState] = useState<TripToggles>(DEFAULT_TOGGLES);
  const [context, setContextState] = useState<TripContext>({
    Weather: 'Clear',
    Time_of_Day: 'Morning',
  });

  // Stable setters (identity never changes) so effects depending on them never loop.
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

  // Load this user's saved profile when they sign in.
  useEffect(() => {
    if (!user || !supabase) return;
    let active = true;
    supabase
      .from('profiles')
      .select('data')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        const saved = data?.data as Partial<RiderProfile> | undefined;
        if (active && saved && Object.keys(saved).length) {
          setProfileState((cur) => ({ ...cur, ...saved }));
        }
      });
    return () => { active = false; };
  }, [user]);

  // Persist the current rider profile to the user's account.
  const saveProfile = useCallback(async () => {
    if (!user || !supabase) return;
    await supabase
      .from('profiles')
      .upsert({ id: user.id, data: profile, updated_at: new Date().toISOString() });
  }, [user, profile]);

  const features = useMemo<FeatureVector>(
    () => ({ ...profile, ...toggles, ...context }),
    [profile, toggles, context],
  );

  const value = useMemo<ProfileState>(
    () => ({ profile, toggles, context, setProfile, setToggles, setContext, saveProfile, features }),
    [profile, toggles, context, setProfile, setToggles, setContext, saveProfile, features],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfile(): ProfileState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useProfile must be used within ProfileProvider');
  return v;
}
