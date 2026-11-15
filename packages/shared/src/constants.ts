/**
 * Fusion + advisory constants shared by the API and the web app.
 */

/** Weight of the location prior in the fusion rule R = s * (1 + lambda * (2*pi - 1)). */
export const FUSION_LAMBDA = 0.3;

/** Ordinal severity weights for [No Accident, Moderate, Severe]. */
export const SEVERITY_WEIGHTS = {
  noAccident: 0.0,
  moderate: 0.5,
  severe: 1.0,
} as const;

/** Advisory thresholds on the fused risk R. */
export const ADVISORY_THRESHOLDS = {
  /** R < MEDIUM  -> Low */
  medium: 0.33,
  /** R < HIGH    -> Medium ; R >= HIGH -> High */
  high: 0.6,
} as const;

/**
 * Location prior at or above which a place is named a crash blackspot: the
 * densest cells, holding roughly the top fifth of recorded crashes.
 */
export const BLACKSPOT_PRIOR = 0.9;

/** Route polyline sample spacing in metres. */
export const ROUTE_SAMPLE_METERS = 75;
/** Route scoring limits: keep one request from costing the server minutes. */
export const ROUTE_MAX_POINTS = 5_000;
export const ROUTE_MAX_KM = 150;

/** Model + schema versions stamped onto every trip log. */
export const MODEL_VERSION = 'rideguard-2026-11';
export const TRIP_SCHEMA_VERSION = '2.0';
