'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useT } from '@/i18n/LocaleContext';
import { useAuth } from '@/context/AuthContext';
import { signInHref } from '@/lib/nav';
import { listTrips, deleteTrip, type SavedTrip } from '@/lib/trips';
import { monthSummary } from '@/lib/tripSummary';
import { MonthSummary } from '@/components/MonthSummary';
import { TripCard } from '@/components/TripCard';

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  if (authLoading) return null;
  if (!user) return <SignInGate />;
  return <Trips />;
}

/** Guests can use the whole app; only their saved rides need an account. */
function SignInGate() {
  const t = useT();
  return (
    <div className="rg-fade-up mx-auto max-w-md rounded-xl2 bg-white p-6 text-center shadow-card">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-signal/10 text-signal" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 4v4h4" /><path d="M12 8v4l3 2" />
        </svg>
      </div>
      <h1 className="text-lg font-semibold text-text">{t('trips.signInTitle')}</h1>
      <p className="mt-1 text-sm text-muted">{t('trips.signInBody')}</p>
      <div className="mt-5 flex flex-col gap-2">
        <Link href={signInHref('/history')}
          className="flex min-h-12 items-center justify-center rounded-xl bg-signal text-sm font-semibold text-white shadow-soft">
          {t('profile.signIn')}
        </Link>
        <Link href={signInHref('/history', 'signup')}
          className="flex min-h-12 items-center justify-center rounded-xl border border-line text-sm font-semibold text-text">
          {t('auth.createAccount')}
        </Link>
      </div>
    </div>
  );
}

function Trips() {
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
