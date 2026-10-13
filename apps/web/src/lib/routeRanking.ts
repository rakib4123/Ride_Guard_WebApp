export interface RankInput {
  durationMin: number;
  meanRisk: number;
  /** Highest spatial prior anywhere on the route. */
  worstPrior: number;
}

export interface RankedRoute {
  /** Index into the input list. */
  index: number;
  label: 'route.safest' | 'route.fastest' | 'route.option';
  /** 1-based position in the ranking, for "Route n". */
  n: number;
  /** Minutes longer than the fastest route (0 for the fastest). */
  extraMin: number;
  /** True if this route avoids a blackspot that another route passes. */
  avoidsBlackspot: boolean;
}

/** Same cut as the verdict's "crash blackspot nearby". */
const BLACKSPOT_PRIOR = 0.9;

/**
 * Rank route alternatives by fused risk, lowest first (spec 5.1), so the
 * picker leads with the safer choice and says what it costs in time.
 */
export function rankRoutes(items: RankInput[]): RankedRoute[] {
  if (!items.length) return [];
  const fastest = Math.min(...items.map((r) => r.durationMin));
  const anyBlackspot = items.some((r) => r.worstPrior >= BLACKSPOT_PRIOR);
  const order = items
    .map((r, index) => ({ r, index }))
    .sort((a, b) => a.r.meanRisk - b.r.meanRisk || a.r.durationMin - b.r.durationMin);

  return order.map(({ r, index }, pos) => ({
    index,
    label: pos === 0 && items.length > 1 ? 'route.safest'
      : r.durationMin === fastest ? 'route.fastest'
        : 'route.option',
    n: pos + 1,
    extraMin: Math.round(r.durationMin - fastest),
    avoidsBlackspot: anyBlackspot && r.worstPrior < BLACKSPOT_PRIOR,
  }));
}
