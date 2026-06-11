'use client';

import { useEffect, useRef, useState } from 'react';
import type { LatLon } from '@rideguard/shared';
import { useDebounce } from '@/hooks/useDebounce';
import { searchPlaces, shortLabel, type GeoResult } from '@/lib/geocode';

/** Google-style place autocomplete, powered by OSM Nominatim. */
export function LocationSearch({
  placeholder = 'Search a place in Dhaka…',
  onSelect,
}: {
  placeholder?: string;
  onSelect: (loc: LatLon, label: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounce(query, 450);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    if (debounced.trim().length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    searchPlaces(debounced)
      .then((r) => active && (setResults(r), setOpen(true)))
      .catch(() => active && setResults([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [debounced]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-line bg-panel2 px-3 py-2 text-sm text-text focus:border-signal focus:outline-none"
      />
      {loading && (
        <span className="absolute right-3 top-2.5 text-xs text-muted">…</span>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-[1000] mt-1 max-h-60 w-full overflow-auto rounded-lg border border-line bg-panel shadow-dial">
          {results.map((r, i) => (
            <li key={`${r.lat}-${r.lon}-${i}`}>
              <button
                type="button"
                onClick={() => {
                  onSelect({ lat: r.lat, lon: r.lon }, r.label);
                  setQuery(shortLabel(r.label));
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm text-text hover:bg-panel2"
              >
                <span className="block">{shortLabel(r.label)}</span>
                <span className="block truncate text-xs text-muted">{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
