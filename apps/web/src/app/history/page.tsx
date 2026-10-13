'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '@/i18n/LocaleContext';
import { listTrips, deleteTrip, type SavedTrip } from '@/lib/trips';
import { monthSummary } from '@/lib/tripSummary';
import { MonthSummary } from '@/components/MonthSummary';
import { TripCard } from '@/components/TripCard';

export default function HistoryPage() {
  const t = useT();
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listTrips()
      .then((rows) => setTrips(rows))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    await deleteTrip(id);
    setTrips((rows) => rows.filter((x) => x.id !== id));
  };

  const summary = useMemo(() => monthSummary(trips), [trips]);

  return (
    <>
      <h1 className="text-lg font-semibold text-text">{t('trips.title')}</h1>
      {loading ? (
        <p className="text-sm text-muted">{t('label.checking')}</p>
      ) : error ? (
        <p className="text-sm text-risk-high">{t('trips.loadFailed')}</p>
      ) : trips.length === 0 ? (
        <p className="text-sm text-muted">{t('trips.empty')}</p>
      ) : (
        <>
          <MonthSummary summary={summary} />
          <ul className="space-y-2">
            {trips.map((trip) => (
              <TripCard key={trip.id} trip={trip} onDelete={() => remove(trip.id)} />
            ))}
          </ul>
          <p className="text-center text-xs text-muted">{t('trips.swipeHint')}</p>
        </>
      )}
    </>
  );
}
