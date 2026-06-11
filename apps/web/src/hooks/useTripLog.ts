'use client';

import { useCallback, useState } from 'react';
import type { CreateTripInput, TripLog } from '@rideguard/shared';
import { api } from '@/lib/api';

/**
 * Holds trips collected this session and exposes save (to the API) and
 * download-as-JSON. The downloadable file is what feeds prospective validation
 * (Handoff Section 10) when there is no database yet.
 */
export function useTripLog() {
  const [trips, setTrips] = useState<(TripLog | CreateTripInput)[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(async (input: CreateTripInput) => {
    setSaving(true);
    setError(null);
    try {
      const saved = await api.saveTrip(input);
      setTrips((t) => [saved, ...t]);
      return saved;
    } catch (e) {
      // Keep the record locally even if the API is down, so nothing is lost.
      setTrips((t) => [input, ...t]);
      setError(e instanceof Error ? e.message : 'save failed');
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const downloadAll = useCallback(() => {
    const blob = new Blob([JSON.stringify(trips, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rideguard-trips-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [trips]);

  return { trips, save, downloadAll, saving, error };
}
