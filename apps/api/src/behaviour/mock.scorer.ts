import { Injectable } from '@nestjs/common';
import type {
  BehaviourResult,
  ClassProbabilities,
  FeatureVector,
  RiskFactor,
  RiskFactorId,
  SeverityClass,
} from '@rideguard/shared';
import { BehaviourScorer } from './behaviour.scorer';

/**
 * Transparent placeholder used when the model service is unset or unreachable.
 * Same inputs and factor ids as the real model, simple additive rules, and
 * always flagged `isPlaceholder: true` so the rider sees "sample reading".
 */
@Injectable()
export class MockScorer implements BehaviourScorer {
  score(f: FeatureVector): BehaviourResult {
    const factors: RiskFactor[] = [];
    let s = 0.1;
    const add = (id: RiskFactorId, name: string, amount: number) => {
      s += amount;
      factors.push({ id, name, impact: amount });
    };

    const over = f.Bike_Speed - f.Speed_Limit;
    if (over > 0) add('overLimit', 'Over the speed limit', Math.min(0.4, over / 100));
    if (f.Talk_While_Riding !== 'Never') add('phone', 'Phone use while riding', 0.25);
    if (f.Weather !== 'Clear') add('weather', 'Rain or fog', 0.05);
    if (f.Road_condition === 'Wet') add('wet', 'Wet road', 0.05);
    if (f.Time_of_Day === 'Night' || f.Time_of_Day === 'Evening') add('dark', 'Riding in the dark', 0.05);
    if (f.Traffic_Density >= 6) add('traffic', 'Heavy traffic', 0.05);

    s = Math.min(s, 1);
    const probabilities = this.probabilitiesFromOrdinal(s);
    return {
      score: s,
      probabilities,
      factors: factors.sort((a, b) => b.impact - a.impact).slice(0, 4),
      conformalSet: this.conformalSet(probabilities),
      isPlaceholder: true,
    };
  }

  /** Probabilities [No Accident, Moderate, Severe] whose ordinal value equals s. */
  private probabilitiesFromOrdinal(s: number): ClassProbabilities {
    const clamp = (x: number) => Math.max(0, Math.min(1, x));
    if (s <= 0.5) return { noAccident: clamp(1 - 2 * s), moderate: clamp(2 * s), severe: 0 };
    return { noAccident: 0, moderate: clamp(2 * (1 - s)), severe: clamp(2 * s - 1) };
  }

  private conformalSet(p: ClassProbabilities): SeverityClass[] {
    const entries: [SeverityClass, number][] = [
      ['No Accident', p.noAccident], ['Moderate', p.moderate], ['Severe', p.severe],
    ];
    const set = entries.filter(([, prob]) => prob >= 0.1).map(([cls]) => cls);
    return set.length ? set : [entries.sort((a, b) => b[1] - a[1])[0][0]];
  }
}
