import { riskColor } from '@/lib/format';
import type { AdvisoryLevel } from '@rideguard/shared';

export function AdvisoryBadge({ level }: { level: AdvisoryLevel }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: `${riskColor[level]}1a`, color: riskColor[level] }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: riskColor[level] }} />
      {level}
    </span>
  );
}
