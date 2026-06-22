'use client';

import { riskColor, levelFor, pct } from '@/lib/format';

/**
 * The signature element: a precision half-dial that reads like a motorcycle
 * instrument. A faint full track sits under three advisory zones, fine tick
 * marks ring the outside like a speedometer, and a needle points to the fused
 * risk R. One bold object — everything around it stays quiet.
 */
const CX = 120;
const CY = 132;
const R = 100;

function polar(v: number, radius = R) {
  const theta = (Math.PI * (180 - 180 * v)) / 180;
  return { x: CX + radius * Math.cos(theta), y: CY - radius * Math.sin(theta) };
}

function arc(from: number, to: number, radius = R) {
  const a = polar(from, radius);
  const b = polar(to, radius);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${radius} ${radius} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

const TICKS = Array.from({ length: 17 }, (_, i) => i / 16);

export function RiskGauge({
  value,
  placeholder,
}: {
  value: number;
  placeholder?: boolean;
}) {
  const level = levelFor(value);
  const needle = polar(value, R - 8);
  const color = riskColor[level];
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 240 162" className="w-full max-w-[360px]" role="img"
        aria-label={`Risk ${pct(value)}, advisory ${level}`}>
        {/* faint full track */}
        <path d={arc(0, 1)} stroke="#E1E6EF" strokeWidth="14" fill="none" strokeLinecap="round" />

        {/* tick marks (speedometer feel) */}
        {TICKS.map((t, i) => {
          const major = i % 4 === 0;
          const a = polar(t, R + 9);
          const b = polar(t, R + (major ? 17 : 13));
          return (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={major ? '#94A3B8' : '#CBD5E1'} strokeWidth={major ? 2 : 1.25} strokeLinecap="round" />
          );
        })}

        {/* advisory zones */}
        <path d={arc(0.0, 0.31)} stroke="#12B76A" strokeWidth="13" fill="none" strokeLinecap="round" />
        <path d={arc(0.345, 0.575)} stroke="#F79009" strokeWidth="13" fill="none" strokeLinecap="round" />
        <path d={arc(0.61, 1.0)} stroke="#F04438" strokeWidth="13" fill="none" strokeLinecap="round" />

        {/* needle */}
        <line x1={CX} y1={CY} x2={needle.x} y2={needle.y}
          stroke={color} strokeWidth="3.5" strokeLinecap="round" />
        <circle cx={CX} cy={CY} r="8.5" fill="#FFFFFF" stroke={color} strokeWidth="3" />
        <circle cx={CX} cy={CY} r="2.5" fill={color} />

        {/* readout */}
        <text x={CX} y={CY - 36} textAnchor="middle"
          className="font-mono tabular" fontSize="36" fontWeight="700"
          fill={color} letterSpacing="-1">{pct(value)}</text>
        <text x={CX} y={CY - 16} textAnchor="middle" fontSize="10.5"
          letterSpacing="3" fill="#5B6675" className="font-mono">RISK</text>
      </svg>

      <div className="mt-1 flex items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold tracking-tightish"
          style={{ background: `${color}16`, color }}>
          <span className="h-2 w-2 rounded-full" style={{ background: color }} />
          {level} advisory
        </span>
        {placeholder && (
          <span className="rounded-full bg-signal/10 px-2.5 py-1 text-xs font-medium text-signal">
            placeholder model
          </span>
        )}
      </div>
    </div>
  );
}
