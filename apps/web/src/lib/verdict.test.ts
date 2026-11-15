import { describe, it, expect } from 'vitest';
import { buildVerdict, buildRouteVerdict, mapCause } from '@/lib/verdict';
import { DEFAULT_FEATURES, type FeatureVector } from '@rideguard/shared';
import type { RiskFactor, ScorePointResponse, ScoreRouteResponse, RouteSegment } from '@rideguard/shared';

const features = (over: Partial<FeatureVector> = {}): FeatureVector => ({ ...DEFAULT_FEATURES, ...over });

const factor = (id: RiskFactor['id'], impact: number): RiskFactor => ({ id, name: id, impact });

const result = (over: Partial<ScorePointResponse> = {}): ScorePointResponse => ({
  R: 0.4,
  advisoryLevel: 'Medium',
  behaviourScore: 0.3,
  spatialPrior: 0.5,
  probabilities: { noAccident: 0.5, moderate: 0.5, severe: 0 },
  topFactors: [],
  conformalSet: [],
  isPlaceholder: false,
  modelVersion: 'test',
  scorerVersion: 'test',
  severity: null,
  ...over,
});

describe('buildVerdict', () => {
  it('reports Unknown when there is no result, never Low', () => {
    const v = buildVerdict(null, features());
    expect(v.level).toBe('Unknown');
    expect(v.score).toBeNull();
    expect(v.modelReasons).toEqual([]);
  });

  it('carries the level and score through from the API', () => {
    const v = buildVerdict(result({ R: 0.395, advisoryLevel: 'Medium' }), features());
    expect(v.level).toBe('Medium');
    expect(v.score).toBe('40');
  });

  it('names a blackspot when the location prior is high', () => {
    expect(buildVerdict(result({ spatialPrior: 0.95 }), features()).modelReasons).toContain('reason.blackspot');
    expect(buildVerdict(result({ spatialPrior: 0.6 }), features()).modelReasons).not.toContain('reason.blackspot');
  });

  it('names a factor only when the model says it raised the score', () => {
    const v = buildVerdict(result({ topFactors: [factor('overLimit', 0.18), factor('phone', 0.3)] }), features());
    expect(v.modelReasons).toEqual(['reason.phone', 'reason.overLimit']);
    // Over the limit, but the model did not move on it: not claimed as a reason.
    const quiet = buildVerdict(result({ topFactors: [] }), features({ Bike_Speed: 60, Speed_Limit: 40 }));
    expect(quiet.modelReasons).not.toContain('reason.overLimit');
  });

  it('ignores factors too small to matter', () => {
    const v = buildVerdict(result({ topFactors: [factor('traffic', 0.005)] }), features());
    expect(v.modelReasons).toEqual([]);
  });

  it('puts weather and night in watch-outs, never in model reasons', () => {
    const v = buildVerdict(
      result({ topFactors: [factor('weather', 0.05), factor('dark', 0.05)] }),
      features({ Weather: 'Rainy', Road_condition: 'Wet', Time_of_Day: 'Night' }),
    );
    expect(v.watchOuts).toEqual(['watch.rain', 'watch.wet', 'watch.night']);
    expect(v.modelReasons.every((k) => !k.startsWith('watch.'))).toBe(true);
  });

  it('caps each list at three so the band stays readable', () => {
    const v = buildVerdict(
      result({ spatialPrior: 0.95, topFactors: [factor('overLimit', 0.4), factor('phone', 0.3), factor('traffic', 0.1)] }),
      features({ Weather: 'Rainy', Road_condition: 'Wet', Time_of_Day: 'Night' }),
    );
    expect(v.modelReasons.length).toBe(3);
    expect(v.modelReasons[0]).toBe('reason.blackspot');
    expect(v.watchOuts.length).toBeLessThanOrEqual(3);
  });

  it('surfaces the placeholder flag', () => {
    expect(buildVerdict(result({ isPlaceholder: true }), features()).isPlaceholder).toBe(true);
  });
});

const seg = (over: Partial<RouteSegment> = {}): RouteSegment => ({
  segId: 0, lat: 23.78, lon: 90.4, R: 0.4, level: 'Medium', spatialPrior: 0.5, ...over,
});
const route = (over: Partial<ScoreRouteResponse> = {}): ScoreRouteResponse => ({
  segments: [seg()], meanRisk: 0.42, maxRisk: 0.5, p90Risk: 0.48, routeLevel: 'Medium',
  behaviourScore: 0.4, topFactors: [], riskiestSegId: 0, isPlaceholder: false,
  modelVersion: 'test', scorerVersion: 'test', ...over,
});

describe('buildRouteVerdict', () => {
  it('reports Unknown with no route, never Low', () => {
    expect(buildRouteVerdict(null, features()).level).toBe('Unknown');
  });

  it('takes level and score from the route mean', () => {
    const v = buildRouteVerdict(route({ meanRisk: 0.42, routeLevel: 'Medium' }), features());
    expect(v.level).toBe('Medium');
    expect(v.score).toBe('42');
  });

  it('names a blackspot if any point on the route passes one', () => {
    const v = buildRouteVerdict(
      route({ segments: [seg({ spatialPrior: 0.5 }), seg({ segId: 1, spatialPrior: 0.95 })] }),
      features(),
    );
    expect(v.modelReasons).toContain('reason.blackspot');
  });
});

describe('mapCause', () => {
  it('describes a heavy-history area where conditions matter little', () => {
    expect(mapCause(result({ spatialPrior: 0.95, behaviourScore: 0.2 })))
      .toEqual(['map.cause.area.high', 'map.cause.ride.small']);
  });

  it('describes a spot with no recorded crashes where conditions drive the reading', () => {
    expect(mapCause(result({ spatialPrior: 0.5, behaviourScore: 0.7 })))
      .toEqual(['map.cause.area.low', 'map.cause.ride.main']);
  });

  it('has a middle band for both halves', () => {
    expect(mapCause(result({ spatialPrior: 0.7, behaviourScore: 0.4 })))
      .toEqual(['map.cause.area.some', 'map.cause.ride.part']);
  });
});
