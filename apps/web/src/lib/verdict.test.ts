import { describe, it, expect } from 'vitest';
import { buildVerdict } from '@/lib/verdict';
import { DEFAULT_PROFILE, DEFAULT_TOGGLES, type FeatureVector } from '@rideguard/shared';
import type { ScorePointResponse } from '@rideguard/shared';

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
    const v = buildVerdict(result({ spatialPrior: 0.8 }), features());
    expect(v.modelReasons).toContain('reason.blackspot');
  });

  it('does not name a blackspot when the prior is low', () => {
    const v = buildVerdict(result({ spatialPrior: 0.1 }), features());
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
