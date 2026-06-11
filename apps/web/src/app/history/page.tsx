'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { AdvisoryBadge } from '@/components/AdvisoryBadge';
import { listTrips, deleteTrip, type SavedTrip } from '@/lib/trips';
import type { AdvisoryLevel } from '@rideguard/shared';

export default function HistoryPage() {
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listTrips()
      .then((t) => setTrips(t))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load trips.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    await deleteTrip(id);
    setTrips((t) => t.filter((x) => x.id !== id));
  };

  return (
    <>
      <Card title="My trip history">
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : error ? (
          <p className="text-sm text-risk-high">{error}</p>
        ) : trips.length === 0 ? (
          <p className="text-sm text-muted">
            No saved trips yet. On the Now screen, tap “Save to my trips” to keep a record here.
          </p>
        ) : (
          <ul className="space-y-2">
            {trips.map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded-xl border border-line bg-panel2 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono tabular text-sm text-text">
                      {t.risk != null ? Math.round(t.risk * 100) : '—'}
                    </span>
                    {t.advisory && <AdvisoryBadge level={t.advisory as AdvisoryLevel} />}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {t.data?.locName ?? (t.lat != null ? `${t.lat.toFixed(3)}, ${t.lon?.toFixed(3)}` : '—')}
                    {' · '}{new Date(t.created_at).toLocaleString()}
                  </div>
                </div>
                <button onClick={() => remove(t.id)}
                  className="ml-3 shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs text-muted hover:text-risk-high">
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
