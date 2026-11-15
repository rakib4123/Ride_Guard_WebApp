/**
 * Trip log schema (Handoff Section 10). This is the artifact that lets the
 * framework be validated on real outcomes later, so keep it stable and
 * version it with `schema_version`.
 */

import type { AdvisoryLevel, SeverityClass } from './scoring';

export type IncidentType = 'none' | 'near_miss' | 'hard_brake' | 'swerve' | 'crash';

export interface TripConsent {
  logging: boolean;
  raw_gps: boolean;
}

export interface TripWeather {
  condition: string;
  temp_c: number;
  rain_mm_hr: number;
}

/** Crowd measured around the rider (D2D). Null fields were not measurable. */
export interface TripCrowd {
  /** RideGuard phones nearby, and those grouped into vehicles. */
  riders_nearby: number | null;
  vehicles_nearby: number | null;
  /** Other Bluetooth devices nearby, and those grouped (null when the browser cannot scan). */
  ble_devices: number | null;
  ble_groups: number | null;
}

/** What the app measured — the model's inputs. Nothing here is asked of the rider. */
export interface TripMeasuredContext {
  road_type: string;
  speed_limit_kmh: number;
  bike_speed_kmh: number;
  over_speed_limit: boolean;
  phone_use: boolean;
  traffic_density: number;
  crowd: TripCrowd | null;
}

export interface PredictionSegment {
  seg_id: number;
  lat: number;
  lon: number;
  R: number;
  level: AdvisoryLevel;
  warning_issued: boolean;
  warning_time: string | null;
}

export interface AutoEvent {
  type: IncidentType;
  time: string;
  decel_g: number;
  lat: number;
  lon: number;
}

export interface TripLog {
  schema_version: string;
  trip_id: string;
  rider_id: string;
  app_version: string;
  model_version: string;
  consent: TripConsent;
  trip: {
    start_time: string;
    end_time: string;
    origin: { lat: number; lon: number };
    destination: { lat: number; lon: number };
    distance_km: number;
  };
  context: {
    time_of_day: string;
    day_of_week: string;
    weather: TripWeather;
    measured: TripMeasuredContext;
  };
  prediction: {
    behaviour_score: number;
    spatial_prior: number;
    fused_risk_R: number;
    advisory_level: AdvisoryLevel;
    conformal_set: SeverityClass[];
    /** True when the mock scored this trip; such trips must not feed validation. */
    is_placeholder: boolean;
    /** Model artifact version that scored the trip, or 'mock'. */
    scorer_version: string;
    /** P(killed or seriously injured | crash) from the UK severity model, if available. */
    severity_ksi?: number | null;
    top_factors: { name: string; impact: number }[];
    segments: PredictionSegment[];
  };
  outcome: {
    incident: {
      occurred: boolean;
      type: IncidentType;
      severity_self_report: string;
      time: string | null;
      lat: number | null;
      lon: number | null;
      nearest_seg_id: number | null;
    };
    auto_events: AutoEvent[];
    rider_felt_risky_rating: number | null;
  };
  response: {
    speed_before_warning_kmh: number | null;
    speed_after_warning_kmh: number | null;
    rerouted_after_warning: boolean;
    advisory_acknowledged: boolean;
  };
}

/** What the client posts; the API fills ids, hashing, versions, timestamps. */
export type CreateTripInput = Omit<
  TripLog,
  'schema_version' | 'trip_id' | 'rider_id' | 'model_version'
> & {
  /** Raw (unhashed) rider id; the API hashes it before storage. */
  rider_id: string;
};
