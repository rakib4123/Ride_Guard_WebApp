import type { FeatureVector } from './features';

export type AdvisoryLevel = 'Low' | 'Medium' | 'High';
export type SeverityClass = 'No Accident' | 'Moderate' | 'Severe';

export interface LatLon {
  lat: number;
  lon: number;
}

/** Factor ids the scorers report; the web app translates them. */
export type RiskFactorId = 'overLimit' | 'phone' | 'weather' | 'wet' | 'dark' | 'traffic';

/**
 * A measured factor that raised the score. `impact` is in score units (0..1):
 * how much lower the score would be with that factor at its safe setting.
 */
export interface RiskFactor {
  id: RiskFactorId;
  name: string;
  impact: number;
}

/** Three calibrated class probabilities from Tier-1. */
export interface ClassProbabilities {
  noAccident: number;
  moderate: number;
  severe: number;
}

/**
 * "If a motorcycle crash happened here, now, how likely is the rider to be
 * killed or seriously injured?" From real UK police records (STATS19).
 */
export interface SeverityEstimate {
  /** Probability of death or serious injury, given a crash. */
  ksi: number;
  /** Where the estimate's data comes from. */
  source: string;
  /** ISO countries where it has been checked on held-out data. */
  validatedIn: string[];
  modelVersion: string;
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
  /** Version of the model artifact that produced the score (the model service reports it). */
  modelVersion?: string;
  /** Severity if a crash happened, when the model service has the severity model. */
  severity?: SeverityEstimate | null;
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
  /** Which scorer produced behaviourScore: the model artifact version, or 'mock'. */
  scorerVersion: string;
  /** Death-or-serious-injury chance if a crash happened here (null when unavailable). */
  severity: SeverityEstimate | null;
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
  /** Which scorer produced behaviourScore: the model artifact version, or 'mock'. */
  scorerVersion: string;
}

export interface Hotspot {
  lat: number;
  lon: number;
  count: number;
  normDensity: number;
}
