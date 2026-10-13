'use client';

import type { ReactNode } from 'react';
import { useT } from '@/i18n/LocaleContext';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

// min-h-11 keeps every control at the spec's 44px touch target.
const base =
  'min-h-11 w-full rounded-lg border border-line bg-panel2 px-3 py-2 text-sm text-text ' +
  'focus:border-signal focus:outline-none';

export function Select<T extends string | number>({
  value, onChange, options, labelOf,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly T[];
  /** Display text for an option; the stored value stays the model's value. */
  labelOf?: (v: T) => string;
}) {
  return (
    <select
      className={base}
      value={String(value)}
      onChange={(e) => {
        const raw = e.target.value;
        const coerced = (typeof value === 'number' ? Number(raw) : raw) as T;
        onChange(coerced);
      }}
    >
      {options.map((o) => (
        <option key={String(o)} value={String(o)}>{labelOf ? labelOf(o) : String(o)}</option>
      ))}
    </select>
  );
}

export function NumberInput({
  value, onChange, min, max, step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      className={`${base} tabular`}
      value={Number.isFinite(value) ? value : ''}
      min={min} max={max} step={step}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

/** A labelled yes/no switch, styled like a dashboard indicator lamp. */
export function Lamp({
  label, on, onToggle, danger,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
  danger?: boolean;
}) {
  const t = useT();
  // Lit when on: green normally, red for a danger switch (e.g. alcohol).
  const active = on;
  const color = danger ? '#D92D20' : '#0B7A43';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-line bg-panel2 px-3 py-2 text-left text-sm transition-colors hover:border-signal/40"
    >
      <span className="text-text">{label}</span>
      <span className="flex items-center gap-2">
        <span className="text-xs text-muted">{on ? t('opt.Yes') : t('opt.No')}</span>
        <span className="h-2.5 w-2.5 rounded-full"
          style={{
            background: active ? color : '#CBD5E1',
            boxShadow: active ? `0 0 8px ${color}` : 'none',
          }} />
      </span>
    </button>
  );
}
