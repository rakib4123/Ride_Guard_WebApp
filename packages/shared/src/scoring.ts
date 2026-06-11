import type { FeatureVector } from './features';

export type AdvisoryLevel = 'Low' | 'Medium' | 'High';
export type SeverityClass = 'No Accident' | 'Moderate' | 'Severe';

export interface LatLon {
  lat: number;
  lon: number;
}

/** A named driver of the score (SHAP in production; heuristic in the mock). */
export interface RiskFactor {
  name: string;
  impact: number;
}

/** Three calibrated class probabilities from Tier-1. */
export interface ClassProbabilities {
  noAccident: number;
  moderate: number;
  severe: number;
}

/** Output of the behaviour scorer (the swappable Tier-1 seam). */
export interface BehaviourResult {
  /** Ordinal behavioural score s in [0,1] (Section 5). */
  score: number;
  probabilities: ClassProbabilities;
  factors: RiskFactor[];
  /** Plausible severity classes at 90% coverage (Section 2/4, optional in v1). */
  conformalSet: SeverityClass[];
  /** True when produced by the mock placeholder rather than the real model. */
  isPlaceholder: boolean;
}

/** Request to score a single point. */
export interface ScorePointRequest {
  features: FeatureVector;
  location: LatLon;
}

/** Response for a single point. */
export interface ScorePointResponse {
  R: number;
  advisoryLevel: AdvisoryLevel;
  behaviourScore: number;
  spatialPrior: number;
  probabilities: ClassProbabilities;
  topFactors: RiskFactor[];
  conformalSet: SeverityClass[];
  isPlaceholder: boolean;
  modelVersion: string;
}

/** One sampled point along a route. */
export interface RouteSegment {
  segId: number;
  lat: number;
  lon: number;
  R: number;
  level: AdvisoryLevel;
  spatialPrior: number;
}

/** Request to score a route. Behaviour features are constant; only pi varies. */
export interface ScoreRouteRequest {
  features: FeatureVector;
  /** At least origin + destination. Intermediate waypoints optional. */
  path: LatLon[];
}

export interface ScoreRouteResponse {
  segments: RouteSegment[];
  meanRisk: number;
  maxRisk: number;
  p90Risk: number;
  routeLevel: AdvisoryLevel;
  behaviourScore: number;
  topFactors: RiskFactor[];
  riskiestSegId: number;
  isPlaceholder: boolean;
  modelVersion: string;
}

export interface Hotspot {
  lat: number;
  lon: number;
  count: number;
  normDensity: number;
}
