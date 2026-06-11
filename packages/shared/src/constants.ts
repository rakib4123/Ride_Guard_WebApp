/**
 * Fusion + advisory constants. These are taken verbatim from the RideGuard
 * build handoff (Section 5 / Section 13) and must not be changed casually:
 * they are part of the model definition, not UI preferences.
 */

/** Spatial fusion weight. Handoff Section 5: lambda = 0.30. */
export const FUSION_LAMBDA = 0.3;

/** Ordinal severity weights for [No Accident, Moderate, Severe]. Section 5. */
export const SEVERITY_WEIGHTS = {
  noAccident: 0.0,
  moderate: 0.5,
  severe: 1.0,
} as const;

/** Advisory thresholds on the fused risk R. Section 5. */
export const ADVISORY_THRESHOLDS = {
  /** R < MEDIUM  -> Low */
  medium: 0.33,
  /** R < HIGH    -> Medium ; R >= HIGH -> High */
  high: 0.6,
} as const;

/** Route polyline sample spacing in metres. Section 5. */
export const ROUTE_SAMPLE_METERS = 75;

/**
 * Hard-brake detection threshold in g, used by the client accelerometer
 * logic and echoed here so the API and UI agree. Section 10 ("about 0.45 g").
 */
export const HARD_BRAKE_G = 0.45;

/**
 * Kernel bandwidth (metres) for the in-app Gaussian approximation of the KDE
 * prior. Matches the pipeline's kde_bw_m = 300 (tier2_spatial.py).
 */
export const SPATIAL_KERNEL_SIGMA_M = 300;

/** Model + schema versions stamped onto every trip log. */
export const MODEL_VERSION = 'rideguard-2026-06';
export const TRIP_SCHEMA_VERSION = '1.0';
