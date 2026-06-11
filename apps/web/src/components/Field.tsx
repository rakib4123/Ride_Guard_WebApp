'use client';

import type { ReactNode } from 'react';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

const base =
  'w-full rounded-lg border border-line bg-panel2 px-3 py-2 text-sm text-text ' +
  'focus:border-signal focus:outline-none';

export function Select<T extends string | number>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly T[];
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
        <option key={String(o)} value={String(o)}>{String(o)}</option>
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
      className={`${base} tabular`}
      value={Number.isFinite(value) ? value : ''}
      min={min} max={max} step={step}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

/** A compact yes/no toggle styled like a dashboard indicator lamp. */
export function Lamp({
  label, on, onToggle, danger,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
  danger?: boolean;
}) {
  const active = danger ? on : !on; // for danger lamps, "on" lights red
  const color = danger ? '#E5484D' : '#2FBF71';
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center justify-between gap-2 rounded-lg border border-line bg-panel2 px-3 py-2 text-left text-sm transition-colors hover:border-signal/40"
    >
      <span className="text-text">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted">{on ? 'Yes' : 'No'}</span>
        <span className="h-2.5 w-2.5 rounded-full"
          style={{
            background: active ? color : '#CBD5E1',
            boxShadow: active ? `0 0 8px ${color}` : 'none',
          }} />
      </span>
    </button>
  );
}
