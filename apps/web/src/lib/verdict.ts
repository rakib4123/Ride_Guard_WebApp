import type { FeatureVector, ScorePointResponse } from '@rideguard/shared';
import type { MessageKey } from '@/i18n/messages/en';
import type { RiskLevel } from '@/lib/riskTokens';
import { fmt } from '@/lib/fmt';

/** Above this, the location's crash history is worth naming. */
const BLACKSPOT_PRIOR = 0.5;
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
    modelReasons: collectModelReasons(result, features),
    watchOuts,
    isPlaceholder: result.isPlaceholder,
  };
}

function collectModelReasons(r: ScorePointResponse, f: FeatureVector): MessageKey[] {
  const out: MessageKey[] = [];
  if (r.spatialPrior >= BLACKSPOT_PRIOR) out.push('reason.blackspot');
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
