import type { BehaviourResult, FeatureVector } from '@rideguard/shared';

/** Injection token for the active behaviour scorer implementation. */
export const BEHAVIOUR_SCORER = Symbol('BEHAVIOUR_SCORER');

/**
 * The Tier-1 seam. Today this is the transparent mock. To use the real model,
 * implement this interface with an OnnxScorer (Section 6.2) or a thin client
 * to a Python/FastAPI sidecar (Section 6.1) and bind it in BehaviourModule.
 * Nothing else in the app changes.
 */
export interface BehaviourScorer {
  score(features: FeatureVector): BehaviourResult | Promise<BehaviourResult>;
}
