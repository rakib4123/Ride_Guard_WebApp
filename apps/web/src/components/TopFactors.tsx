import type { RiskFactor } from '@rideguard/shared';

export function TopFactors({ factors }: { factors: RiskFactor[] }) {
  if (!factors.length) {
    return (
      <p className="text-sm text-muted">
        No elevated factors right now. Risk reflects the baseline and location.
      </p>
    );
  }
  const max = Math.max(...factors.map((f) => f.impact), 0.01);
  return (
    <ul className="space-y-2.5">
      {factors.map((f) => (
        <li key={f.name}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="text-sm text-text">{f.name}</span>
            <span className="font-mono tabular text-xs text-muted">
              +{Math.round(f.impact * 100)}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-signal"
              style={{ width: `${(f.impact / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
