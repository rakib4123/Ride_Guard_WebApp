'use client';

import { useEffect, useRef, useState } from 'react';
import type { LatLon } from '@rideguard/shared';
import { useDebounce } from '@/hooks/useDebounce';
import { searchPlaces, shortLabel, type GeoResult } from '@/lib/geocode';

/** Google-style place autocomplete, powered by OSM Nominatim. */
export function LocationSearch({
  placeholder = 'Search a place…',
  onSelect,
  near,
  variant = 'pill',
}: {
  placeholder?: string;
  onSelect: (loc: LatLon, label: string) => void;
  /** Rank results towards this point (the map's current spot). */
  near?: LatLon;
  /** 'pill' floats over the map on its own; 'inline' sits inside a panel. */
  variant?: 'pill' | 'inline';
}) {
  const nearRef = useRef(near);
  nearRef.current = near;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounce(query, 450);
  const boxRef = useRef<HTMLDivElement>(null);
  const pill = variant === 'pill';

  useEffect(() => {
    let active = true;
    if (debounced.trim().length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    searchPlaces(debounced, nearRef.current)
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
      <div className={`flex items-center gap-2 ${pill
        ? 'h-12 rounded-full bg-white px-4 shadow-lift focus-within:ring-2 focus-within:ring-signal/40'
        : 'h-11 rounded-xl bg-panel2 px-3 focus-within:ring-2 focus-within:ring-signal/40'}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
          strokeLinecap="round" className="flex-none text-muted" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-text placeholder:text-muted focus:outline-none"
        />
        {loading ? (
          <span className="h-4 w-4 flex-none animate-spin rounded-full border-2 border-signal/30 border-t-signal" aria-hidden="true" />
        ) : query && (
          <button type="button" onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
            aria-label="Clear" className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-muted hover:bg-panel2">
            ✕
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <ul className="rg-fade-up absolute z-[1000] mt-2 max-h-72 w-full overflow-auto rounded-2xl bg-white py-1 shadow-dial">
          {results.map((r, i) => (
            <li key={`${r.lat}-${r.lon}-${i}`}>
              <button
                type="button"
                onClick={() => {
                  onSelect({ lat: r.lat, lon: r.lon }, r.label);
                  setQuery(shortLabel(r.label));
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-text hover:bg-panel2"
              >
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-panel2 text-muted" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" /></svg>
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{shortLabel(r.label)}</span>
                  <span className="block truncate text-xs text-muted">{r.label}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
