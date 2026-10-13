import type { FeatureVector, ScorePointResponse, ScoreRouteResponse } from '@rideguard/shared';
import type { MessageKey } from '@/i18n/messages/en';
import type { RiskLevel } from '@/lib/riskTokens';
import { fmt } from '@/lib/fmt';

/**
 * Above this, the location's crash history is worth naming. The prior is a
 * percentile of crash locations, so 0.9 means the densest 10% of them.
 */
const BLACKSPOT_PRIOR = 0.9;
const MAX_ITEMS = 3;

export interface Verdict {
  level: RiskLevel;
  /** 0..100 as a string, or null when there is no reading at all. */
  score: string | null;
  /** Factors that genuinely moved the score. */
  modelReasons: MessageKey[];
  /** Human advice the model does NOT account for. Never mixed with the above. */
  watchOuts: MessageKey[];
  isPlaceholder: boolean;
}

/**
 * Turn a scoring response into something a rider can read.
 *
 * The split between `modelReasons` and `watchOuts` is deliberate and load-
 * bearing (spec section 8). The audit of 2026-09-03 measured the shipped model
 * assigning wet roads a mean effect of -0.009 and night -0.013 — it reads them
 * as marginally *safer*. Presenting them as reasons for the score would
 * overclaim; dropping them would leave a safety app silent about riding in
 * heavy rain at night. So they ride along, clearly labelled as something else.
 */
export function buildVerdict(
  result: ScorePointResponse | null,
  features: FeatureVector,
): Verdict {
  const watchOuts = collectWatchOuts(features);

  // No reading is not a safe reading. Never fall back to 'Low'.
  if (!result) {
    return { level: 'Unknown', score: null, modelReasons: [], watchOuts, isPlaceholder: false };
  }

  return {
    level: result.advisoryLevel,
    score: fmt.pct(result.R),
    modelReasons: collectModelReasons(result.spatialPrior, features),
    watchOuts,
    isPlaceholder: result.isPlaceholder,
  };
}

/**
 * The same verdict for a whole route. The level and score come from the
 * route's mean risk (what the API advises on); a blackspot is named if the
 * route passes through one anywhere along its length.
 */
export function buildRouteVerdict(
  route: ScoreRouteResponse | null,
  features: FeatureVector,
): Verdict {
  const watchOuts = collectWatchOuts(features);
  if (!route) {
    return { level: 'Unknown', score: null, modelReasons: [], watchOuts, isPlaceholder: false };
  }
  const worstPrior = route.segments.reduce((m, s) => Math.max(m, s.spatialPrior), 0);
  return {
    level: route.routeLevel,
    score: fmt.pct(route.meanRisk),
    modelReasons: collectModelReasons(worstPrior, features),
    watchOuts,
    isPlaceholder: route.isPlaceholder,
  };
}

/**
 * Plain-language cause for the Map screen (spec section 6): one sentence on the
 * place, one on how much the rider's own settings matter there. Replaces the
 * raw Fused R / Spatial pi / Behaviour s readout in the rider view.
 */
export function mapCause(r: ScorePointResponse): [MessageKey, MessageKey] {
  const area: MessageKey =
    r.spatialPrior >= BLACKSPOT_PRIOR ? 'map.cause.area.high'
      : r.spatialPrior >= 0.5 ? 'map.cause.area.some'
        : 'map.cause.area.low';
  // Same cut points as the advisory bands, applied to the behaviour score
  // alone: high on its own means the settings drive the reading.
  const ride: MessageKey =
    r.behaviourScore >= 0.6 ? 'map.cause.ride.main'
      : r.behaviourScore >= 0.33 ? 'map.cause.ride.part'
        : 'map.cause.ride.small';
  return [area, ride];
}

function collectModelReasons(spatialPrior: number, f: FeatureVector): MessageKey[] {
  const out: MessageKey[] = [];
  if (spatialPrior >= BLACKSPOT_PRIOR) out.push('reason.blackspot');
  if (f.Bike_Speed > f.Speed_Limit) out.push('reason.overLimit');
  if (f.Biker_Alcohol === 1) out.push('reason.alcohol');
  if (f.Talk_While_Riding !== 'Never') out.push('reason.phone');
  if (f.Wearing_Helmet === 'No') out.push('reason.noHelmet');
  if (f.Smoke_While_Riding !== 'Never') out.push('reason.smoking');
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
