import { Inject, Injectable } from '@nestjs/common';
import {
  ADVISORY_THRESHOLDS,
  FUSION_LAMBDA,
  MODEL_VERSION,
  ROUTE_SAMPLE_METERS,
} from '@rideguard/shared';
import type {
  AdvisoryLevel,
  BehaviourResult,
  FeatureVector,
  LatLon,
  RouteSegment,
  ScorePointResponse,
  ScoreRouteResponse,
} from '@rideguard/shared';
import { BEHAVIOUR_SCORER, BehaviourScorer } from '../behaviour/behaviour.scorer';
import { SpatialService, haversineMeters } from '../spatial/spatial.service';

@Injectable()
export class ScoringService {
  constructor(
    @Inject(BEHAVIOUR_SCORER) private readonly behaviour: BehaviourScorer,
    private readonly spatial: SpatialService,
  ) {}

  /** Fusion of behavioural score s with spatial prior pi (Handoff Section 5). */
  static fuse(s: number, pi: number): number {
    const r = s * (1 + FUSION_LAMBDA * (2 * pi - 1));
    return Math.max(0, Math.min(1, r));
  }

  /** Advisory band on the fused risk R (Handoff Section 5). */
  static advisory(R: number): AdvisoryLevel {
    if (R < ADVISORY_THRESHOLDS.medium) return 'Low';
    if (R < ADVISORY_THRESHOLDS.high) return 'Medium';
    return 'High';
  }

  async scorePoint(
    features: FeatureVector,
    location: LatLon,
  ): Promise<ScorePointResponse> {
    const b = await this.behaviour.score(features);
    const pi = this.spatial.prior(location);
    const R = ScoringService.fuse(b.score, pi);
    return {
      R,
      advisoryLevel: ScoringService.advisory(R),
      behaviourScore: b.score,
      spatialPrior: pi,
      probabilities: b.probabilities,
      topFactors: b.factors,
      conformalSet: b.conformalSet,
      isPlaceholder: b.isPlaceholder,
      modelVersion: MODEL_VERSION,
    };
  }

  /**
   * Route scoring (Section 5): one behavioural score for the whole trip, the
   * spatial prior sampled along the polyline every 75 m. Mean -> route advisory;
   * per-segment values kept for the coloured map path.
   */
  async scoreRoute(
    features: FeatureVector,
    path: LatLon[],
  ): Promise<ScoreRouteResponse> {
    const b: BehaviourResult = await this.behaviour.score(features);
    const samples = samplePolyline(path, ROUTE_SAMPLE_METERS);

    const segments: RouteSegment[] = samples.map((pt, i) => {
      const pi = this.spatial.prior(pt);
      const R = ScoringService.fuse(b.score, pi);
      return {
        segId: i,
        lat: pt.lat,
        lon: pt.lon,
        R,
        level: ScoringService.advisory(R),
        spatialPrior: pi,
      };
    });

    const risks = segments.map((s) => s.R);
    const meanRisk = risks.reduce((a, c) => a + c, 0) / risks.length;
    const maxRisk = Math.max(...risks);
    const p90Risk = percentile(risks, 0.9);
    const riskiestSegId = segments.reduce(
      (best, s) => (s.R > segments[best].R ? s.segId : best),
      0,
    );

    return {
      segments,
      meanRisk,
      maxRisk,
      p90Risk,
      routeLevel: ScoringService.advisory(meanRisk),
      behaviourScore: b.score,
      topFactors: b.factors,
      riskiestSegId,
      isPlaceholder: b.isPlaceholder,
      modelVersion: MODEL_VERSION,
    };
  }
}

/** Sample a polyline at a fixed spacing (metres), keeping vertices. */
export function samplePolyline(path: LatLon[], spacingM: number): LatLon[] {
  const out: LatLon[] = [path[0]];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dist = haversineMeters(a, b);
    const steps = Math.max(1, Math.floor(dist / spacingM));
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      out.push({
        lat: a.lat + (b.lat - a.lat) * t,
        lon: a.lon + (b.lon - a.lon) * t,
      });
    }
  }
  return out;
}

/** Nearest-rank percentile (q in [0,1]). */
export function percentile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}
