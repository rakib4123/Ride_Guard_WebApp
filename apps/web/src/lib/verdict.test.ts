import { describe, it, expect } from 'vitest';
import { buildVerdict, buildRouteVerdict, mapCause } from '@/lib/verdict';
import { DEFAULT_PROFILE, DEFAULT_TOGGLES, type FeatureVector } from '@rideguard/shared';
import type { ScorePointResponse, ScoreRouteResponse, RouteSegment } from '@rideguard/shared';

const features = (over: Partial<FeatureVector> = {}): FeatureVector => ({
  ...DEFAULT_PROFILE,
  ...DEFAULT_TOGGLES,
  Weather: 'Clear',
  Time_of_Day: 'Morning',
  ...over,
});

const result = (over: Partial<ScorePointResponse> = {}): ScorePointResponse => ({
  R: 0.4,
  advisoryLevel: 'Medium',
  behaviourScore: 0.3,
  spatialPrior: 0.2,
  probabilities: { noAccident: 0.5, moderate: 0.5, severe: 0 },
  topFactors: [],
  conformalSet: [],
  isPlaceholder: false,
  modelVersion: 'test',
  scorerVersion: 'test',
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

  it('names a blackspot when the spatial prior is high', () => {
    const v = buildVerdict(result({ spatialPrior: 0.95 }), features());
    expect(v.modelReasons).toContain('reason.blackspot');
  });

  it('does not name a blackspot when the prior is low', () => {
    const v = buildVerdict(result({ spatialPrior: 0.6 }), features());
    expect(v.modelReasons).not.toContain('reason.blackspot');
  });

  it('names speeding only when over the posted limit', () => {
    const over = buildVerdict(result(), features({ Bike_Speed: 60, Speed_Limit: 40 }));
    expect(over.modelReasons).toContain('reason.overLimit');
    const under = buildVerdict(result(), features({ Bike_Speed: 35, Speed_Limit: 40 }));
    expect(under.modelReasons).not.toContain('reason.overLimit');
  });

  it('names the behavioural factors the model actually weighs', () => {
    const v = buildVerdict(
      result(),
      features({ Wearing_Helmet: 'No', Biker_Alcohol: 1, Talk_While_Riding: 'Regularly' }),
    );
    expect(v.modelReasons).toContain('reason.noHelmet');
    expect(v.modelReasons).toContain('reason.alcohol');
    expect(v.modelReasons).toContain('reason.phone');
  });

  it('puts weather and night in watch-outs, never in model reasons', () => {
    const v = buildVerdict(
      result(),
      features({ Weather: 'Rainy', Road_condition: 'Wet', Time_of_Day: 'Night' }),
    );
    expect(v.watchOuts).toContain('watch.rain');
    expect(v.watchOuts).toContain('watch.wet');
    expect(v.watchOuts).toContain('watch.night');
    for (const key of v.watchOuts) expect(v.modelReasons).not.toContain(key);
  });

  it('never lets a watch-out key appear as a model reason', () => {
    const v = buildVerdict(result({ spatialPrior: 0.9 }), features({ Weather: 'Foggy' }));
    expect(v.modelReasons.every((k) => !k.startsWith('watch.'))).toBe(true);
    expect(v.watchOuts.every((k) => k.startsWith('watch.'))).toBe(true);
  });

  it('caps each list at three so the band stays readable', () => {
    const v = buildVerdict(
      result({ spatialPrior: 0.9 }),
      features({
        Wearing_Helmet: 'No', Biker_Alcohol: 1, Talk_While_Riding: 'Regularly',
        Smoke_While_Riding: 'Regularly', Bike_Speed: 90, Speed_Limit: 40,
        Weather: 'Rainy', Road_condition: 'Wet', Time_of_Day: 'Night',
      }),
    );
    expect(v.modelReasons.length).toBeLessThanOrEqual(3);
    expect(v.watchOuts.length).toBeLessThanOrEqual(3);
  });

  it('surfaces the placeholder flag', () => {
    expect(buildVerdict(result({ isPlaceholder: true }), features()).isPlaceholder).toBe(true);
  });
});

const seg = (over: Partial<RouteSegment> = {}): RouteSegment => ({
  segId: 0, lat: 23.78, lon: 90.4, R: 0.4, level: 'Medium', spatialPrior: 0.2, ...over,
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
      route({ segments: [seg({ spatialPrior: 0.1 }), seg({ segId: 1, spatialPrior: 0.95 })] }),
      features(),
    );
    expect(v.modelReasons).toContain('reason.blackspot');
  });
});

describe('mapCause', () => {
  it('describes a heavy-history area where the settings matter little', () => {
    expect(mapCause(result({ spatialPrior: 0.95, behaviourScore: 0.2 })))
      .toEqual(['map.cause.area.high', 'map.cause.ride.small']);
  });

  it('describes a quiet area where the settings drive the reading', () => {
    expect(mapCause(result({ spatialPrior: 0.1, behaviourScore: 0.7 })))
      .toEqual(['map.cause.area.low', 'map.cause.ride.main']);
  });

  it('has a middle band for both halves', () => {
    expect(mapCause(result({ spatialPrior: 0.6, behaviourScore: 0.4 })))
      .toEqual(['map.cause.area.some', 'map.cause.ride.part']);
  });
});
