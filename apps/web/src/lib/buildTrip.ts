import type {
  CreateTripInput,
  FeatureVector,
  LatLon,
  ScorePointResponse,
  ScoreRouteResponse,
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
}

/** Assemble a Section-10 trip record from current state + a prediction. */
export function buildTrip(a: BuildArgs): CreateTripInput {
  const pred = a.route ?? a.point;
  const R =
    a.route?.meanRisk ?? (a.point ? a.point.R : 0);
  const level = a.route?.routeLevel ?? a.point?.advisoryLevel ?? 'Low';
  const behaviour =
    a.route?.behaviourScore ?? a.point?.behaviourScore ?? 0;
  const spatial = a.point?.spatialPrior ?? 0;

  return {
    rider_id: a.riderId,
    app_version: '1.0.0',
    consent: a.consent,
    trip: {
      start_time: a.startTime,
      end_time: new Date().toISOString(),
      origin: a.origin,
      destination: a.destination,
      distance_km: 0,
    },
    context: {
      time_of_day: a.features.Time_of_Day,
      day_of_week: dayOfWeek(),
      weather: {
        condition: a.weather.condition,
        temp_c: a.weather.tempC,
        rain_mm_hr: a.weather.rainMmHr,
      },
      rider: {
        helmet: a.features.Wearing_Helmet,
        valid_license: a.features.Valid_Driving_License,
        riding_experience_years: a.features.Riding_Experience,
        road_type: a.features.Road_Type,
        phone_use: a.features.Talk_While_Riding !== 'Never',
        alcohol: a.features.Biker_Alcohol === 1,
        over_speed_limit: a.features.Bike_Speed > a.features.Speed_Limit,
      },
    },
    prediction: {
      behaviour_score: behaviour,
      spatial_prior: spatial,
      fused_risk_R: R,
      advisory_level: level,
      conformal_set: a.point?.conformalSet ?? [],
      top_factors: pred?.topFactors ?? [],
      segments:
        a.route?.segments.map((s) => ({
          seg_id: s.segId,
          lat: s.lat,
          lon: s.lon,
          R: s.R,
          level: s.level,
          warning_issued: s.level === 'High',
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
      advisory_acknowledged: true,
    },
  };
}
