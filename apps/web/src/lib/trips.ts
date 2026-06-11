import { supabase } from '@/lib/supabase';
import type { FeatureVector, LatLon, ScorePointResponse } from '@rideguard/shared';

export interface SavedTrip {
  id: string;
  created_at: string;
  risk: number | null;
  advisory: string | null;
  lat: number | null;
  lon: number | null;
  data: { features?: FeatureVector; locName?: string } | null;
}

/** Save the current score as a trip in the signed-in user's history. */
export async function saveTripToAccount(args: {
  result: ScorePointResponse;
  loc: LatLon;
  features: FeatureVector;
  locName?: string;
}): Promise<void> {
  if (!supabase) throw new Error('Auth is not configured.');
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error('Not signed in.');
  const { error } = await supabase.from('trips').insert({
    user_id: uid,
    risk: args.result.R,
    advisory: args.result.advisoryLevel,
    lat: args.loc.lat,
    lon: args.loc.lon,
    data: { features: args.features, locName: args.locName },
  });
  if (error) throw error;
}

/** List the signed-in user's saved trips (most recent first). */
export async function listTrips(): Promise<SavedTrip[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as SavedTrip[];
}

/** Delete one of the user's trips. */
export async function deleteTrip(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('trips').delete().eq('id', id);
  if (error) throw error;
}
