import type {
  CreateTripInput,
  FeatureVector,
  LatLon,
  ScorePointResponse,
  ScoreRouteResponse,
  TripCrowd,
} from '@rideguard/shared';
import { dayOfWeek } from './format';

interface BuildArgs {
  riderId: string;
  features: FeatureVector;
  origin: LatLon;
  destination: LatLon;
  point?: ScorePointResponse;
  route?: ScoreRouteResponse;
  weather: { condition: string; tempC: number; rainMmHr: number };
  consent: { logging: boolean; raw_gps: boolean };
  startTime: string;
  distanceKm?: number;
  /** The crowd measured during the ride (D2D), if it was measured. */
  crowd?: TripCrowd | null;
}

/** Assemble a schema-2.0 trip record from current state + a prediction. */
export function buildTrip(a: BuildArgs): CreateTripInput {
  const pred = a.route ?? a.point;
  const R = a.route?.meanRisk ?? (a.point ? a.point.R : 0);
  const level = a.route?.routeLevel ?? a.point?.advisoryLevel ?? 'Low';
  const behaviour = a.route?.behaviourScore ?? a.point?.behaviourScore ?? 0;
  const spatial = a.point?.spatialPrior
    ?? (a.route?.segments.length ? a.route.segments.reduce((s, x) => s + x.spatialPrior, 0) / a.route.segments.length : 0.5);
  const f = a.features;

  return {
    rider_id: a.riderId,
    app_version: '2.0.0',
    consent: a.consent,
    trip: {
      start_time: a.startTime,
      end_time: new Date().toISOString(),
      origin: a.origin,
      destination: a.destination,
      distance_km: a.distanceKm ?? 0,
    },
    context: {
      time_of_day: f.Time_of_Day,
      day_of_week: dayOfWeek(),
      weather: {
        condition: a.weather.condition,
        temp_c: a.weather.tempC,
        rain_mm_hr: a.weather.rainMmHr,
      },
      measured: {
        road_type: f.Road_Type,
        speed_limit_kmh: f.Speed_Limit,
        bike_speed_kmh: f.Bike_Speed,
        over_speed_limit: f.Bike_Speed > f.Speed_Limit,
        phone_use: f.Talk_While_Riding !== 'Never',
        traffic_density: f.Traffic_Density,
        crowd: a.crowd ?? null,
      },
    },
    prediction: {
      behaviour_score: behaviour,
      spatial_prior: spatial,
      fused_risk_R: R,
      advisory_level: level,
      conformal_set: a.point?.conformalSet ?? [],
      is_placeholder: pred?.isPlaceholder ?? true,
      scorer_version: pred?.scorerVersion ?? 'none',
      severity_ksi: a.point?.severity?.ksi ?? null,
      top_factors: pred?.topFactors ?? [],
      segments:
        a.route?.segments.map((s) => ({
          seg_id: s.segId,
          lat: s.lat,
          lon: s.lon,
          R: s.R,
          level: s.level,
          warning_issued: false,
          warning_time: null,
        })) ?? [],
    },
    outcome: {
      incident: {
        occurred: false,
        type: 'none',
        severity_self_report: '',
        time: null,
        lat: null,
        lon: null,
        nearest_seg_id: null,
      },
      auto_events: [],
      rider_felt_risky_rating: null,
    },
    response: {
      speed_before_warning_kmh: null,
      speed_after_warning_kmh: null,
      rerouted_after_warning: false,
      // Not observed by the app, so not claimed.
      advisory_acknowledged: false,
    },
  };
}
