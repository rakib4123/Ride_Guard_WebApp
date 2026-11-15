import { BLACKSPOT_PRIOR } from '@rideguard/shared';
import type {
  FeatureVector, RiskFactor, RiskFactorId, ScorePointResponse, ScoreRouteResponse,
} from '@rideguard/shared';
import type { MessageKey } from '@/i18n/messages/en';
import type { RiskLevel } from '@/lib/riskTokens';
import { fmt } from '@/lib/fmt';

const MAX_ITEMS = 3;
/** A factor must add at least this many score points (of 100) to be named. */
const MIN_REASON_IMPACT = 0.02;

/** Factors that are reasons when the model says they raised the score. */
const REASON_KEY: Partial<Record<RiskFactorId, MessageKey>> = {
  overLimit: 'reason.overLimit',
  phone: 'reason.phone',
  traffic: 'reason.traffic',
};

export interface Verdict {
  level: RiskLevel;
  /** 0..100 as a string, or null when there is no reading at all. */
  score: string | null;
  /** Factors the model says raised the score, plus a nearby blackspot. */
  modelReasons: MessageKey[];
  /** Human advice the model barely weighs. Never mixed with the above. */
  watchOuts: MessageKey[];
  isPlaceholder: boolean;
}

/**
 * Turn a scoring response into something a rider can read.
 *
 * Reasons come from the scorer's own factor list (score points each measured
 * factor added), so a reason is only named when it actually moved the score.
 * Rain, fog, wet roads and night add almost nothing in the training data, so
 * they ride along as "watch out" advice instead of being claimed as reasons.
 */
export function buildVerdict(result: ScorePointResponse | null, features: FeatureVector): Verdict {
  const watchOuts = collectWatchOuts(features);
  // No reading is not a safe reading. Never fall back to 'Low'.
  if (!result) {
    return { level: 'Unknown', score: null, modelReasons: [], watchOuts, isPlaceholder: false };
  }
  return {
    level: result.advisoryLevel,
    score: fmt.pct(result.R),
    modelReasons: collectModelReasons(result.spatialPrior, result.topFactors),
    watchOuts,
    isPlaceholder: result.isPlaceholder,
  };
}

/**
 * The same verdict for a whole route: level and score from the route's mean
 * risk; a blackspot is named if the route passes one anywhere.
 */
export function buildRouteVerdict(route: ScoreRouteResponse | null, features: FeatureVector): Verdict {
  const watchOuts = collectWatchOuts(features);
  if (!route) {
    return { level: 'Unknown', score: null, modelReasons: [], watchOuts, isPlaceholder: false };
  }
  const worstPrior = route.segments.reduce((m, s) => Math.max(m, s.spatialPrior), 0);
  return {
    level: route.routeLevel,
    score: fmt.pct(route.meanRisk),
    modelReasons: collectModelReasons(worstPrior, route.topFactors),
    watchOuts,
    isPlaceholder: route.isPlaceholder,
  };
}

/**
 * Plain-language cause for the Map screen: one sentence on the place, one on
 * how much the current speed and conditions matter there.
 */
export function mapCause(r: ScorePointResponse): [MessageKey, MessageKey] {
  const area: MessageKey =
    r.spatialPrior >= BLACKSPOT_PRIOR ? 'map.cause.area.high'
      : r.spatialPrior > 0.5 ? 'map.cause.area.some'
        : 'map.cause.area.low';
  const ride: MessageKey =
    r.behaviourScore >= 0.6 ? 'map.cause.ride.main'
      : r.behaviourScore >= 0.33 ? 'map.cause.ride.part'
        : 'map.cause.ride.small';
  return [area, ride];
}

function collectModelReasons(spatialPrior: number, factors: RiskFactor[]): MessageKey[] {
  const out: MessageKey[] = [];
  if (spatialPrior >= BLACKSPOT_PRIOR) out.push('reason.blackspot');
  for (const f of [...factors].sort((a, b) => b.impact - a.impact)) {
    const key = REASON_KEY[f.id];
    if (key && f.impact >= MIN_REASON_IMPACT && !out.includes(key)) out.push(key);
  }
  return out.slice(0, MAX_ITEMS);
}

function collectWatchOuts(f: FeatureVector): MessageKey[] {
  const out: MessageKey[] = [];
  if (f.Weather === 'Rainy') out.push('watch.rain');
  if (f.Weather === 'Foggy') out.push('watch.fog');
  if (f.Road_condition === 'Wet') out.push('watch.wet');
  if (f.Time_of_Day === 'Night') out.push('watch.night');
  return out.slice(0, MAX_ITEMS);
}
