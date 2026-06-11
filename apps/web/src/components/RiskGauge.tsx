'use client';

import { riskColor, levelFor, pct } from '@/lib/format';

/**
 * The signature element: a half-dial that reads like a bike instrument. The
 * track is split into the model's three advisory zones; a needle points to the
 * fused risk R. One bold object — everything around it stays quiet.
 */
const CX = 120;
const CY = 132;
const R = 100;

function polar(v: number) {
  const theta = (Math.PI * (180 - 180 * v)) / 180;
  return { x: CX + R * Math.cos(theta), y: CY - R * Math.sin(theta) };
}

function arc(from: number, to: number) {
  const a = polar(from);
  const b = polar(to);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${R} ${R} 0 0 1 ${b.x.toFixed(
    2,
  )} ${b.y.toFixed(2)}`;
}

export function RiskGauge({
  value,
  placeholder,
}: {
  value: number;
  placeholder?: boolean;
}) {
  const level = levelFor(value);
  const needle = polar(value);
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 240 160" className="w-full max-w-[360px]" role="img"
        aria-label={`Risk ${pct(value)}, advisory ${level}`}>
        {/* zone tracks with small gaps */}
        <path d={arc(0.0, 0.32)} stroke="#16A34A" strokeWidth="14" fill="none" strokeLinecap="round" opacity="0.85" />
        <path d={arc(0.34, 0.585)} stroke="#F59E0B" strokeWidth="14" fill="none" strokeLinecap="round" opacity="0.85" />
        <path d={arc(0.605, 1.0)} stroke="#EF4444" strokeWidth="14" fill="none" strokeLinecap="round" opacity="0.85" />

        {/* needle */}
        <line x1={CX} y1={CY} x2={needle.x} y2={needle.y}
          stroke={riskColor[level]} strokeWidth="3.5" strokeLinecap="round" />
        <circle cx={CX} cy={CY} r="7" fill="#FFFFFF" stroke={riskColor[level]} strokeWidth="3" />

        {/* readout */}
        <text x={CX} y={CY - 34} textAnchor="middle"
          className="font-mono tabular" fontSize="34" fontWeight="700"
          fill={riskColor[level]}>{pct(value)}</text>
        <text x={CX} y={CY - 14} textAnchor="middle" fontSize="11"
          letterSpacing="2" fill="#64748B">RISK</text>
      </svg>

      <div className="mt-1 flex items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium"
          style={{ background: `${riskColor[level]}1a`, color: riskColor[level] }}>
          <span className="h-2 w-2 rounded-full" style={{ background: riskColor[level] }} />
          {level} advisory
        </span>
        {placeholder && (
          <span className="rounded-full bg-signal/10 px-2.5 py-1 text-xs text-signal">
            placeholder model
          </span>
        )}
      </div>
    </div>
  );
}
