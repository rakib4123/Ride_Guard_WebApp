import { Injectable } from '@nestjs/common';
import type {
  BehaviourResult,
  ClassProbabilities,
  FeatureVector,
  RiskFactor,
  SeverityClass,
} from '@rideguard/shared';
import { BehaviourScorer } from './behaviour.scorer';

/**
 * Transparent placeholder scorer (Handoff Section 6, option 3). It reproduces
 * the handoff's mock additive logic to produce the ordinal score `s`, then
 * derives a 3-class probability split whose ordinal value equals `s`, so the
 * downstream maths is identical to what the real CatBoost+isotonic model will
 * feed. Clearly flagged as a placeholder via `isPlaceholder: true`.
 */
@Injectable()
export class MockScorer implements BehaviourScorer {
  score(f: FeatureVector): BehaviourResult {
    const contributions: RiskFactor[] = [];
    let s = 0.15;
    const add = (name: string, amount: number) => {
      s += amount;
      contributions.push({ name, impact: amount });
    };

    if (f.Talk_While_Riding === 'Regularly') add('Phone use while riding', 0.25);
    else if (f.Talk_While_Riding === 'Sometimes') add('Phone use while riding', 0.12);
    if (f.Smoke_While_Riding === 'Regularly') add('Smoking while riding', 0.2);
    else if (f.Smoke_While_Riding === 'Sometimes') add('Smoking while riding', 0.1);
    if (f.Biker_Alcohol === 1) add('Alcohol', 0.25);
    if (f.Wearing_Helmet === 'No') add('No helmet', 0.1);
    if (f.Bike_Speed > f.Speed_Limit) add('Over the speed limit', 0.1);
    if (f.Traffic_Density >= 6) add('Heavy traffic', 0.05);

    s = Math.min(s, 1);

    const probabilities = this.probabilitiesFromOrdinal(s);
    const topFactors = contributions
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 4);

    return {
      score: s,
      probabilities,
      factors: topFactors,
      conformalSet: this.conformalSet(probabilities),
      isPlaceholder: true,
    };
  }

  /**
   * Build class probabilities [No Accident, Moderate, Severe] whose ordinal
   * score 0*pNo + 0.5*pMod + 1*pSev exactly equals s (Section 5 weights).
   */
  private probabilitiesFromOrdinal(s: number): ClassProbabilities {
    let noAccident: number;
    let moderate: number;
    let severe: number;
    if (s <= 0.5) {
      severe = 0;
      moderate = 2 * s;
      noAccident = 1 - moderate;
    } else {
      noAccident = 0;
      moderate = 2 * (1 - s);
      severe = 1 - moderate;
    }
    return {
      noAccident: this.clamp01(noAccident),
      moderate: this.clamp01(moderate),
      severe: this.clamp01(severe),
    };
  }

  /** Plausible classes at a coverage-like cutoff (placeholder for conformal). */
  private conformalSet(p: ClassProbabilities): SeverityClass[] {
    const entries: [SeverityClass, number][] = [
      ['No Accident', p.noAccident],
      ['Moderate', p.moderate],
      ['Severe', p.severe],
    ];
    const set = entries.filter(([, prob]) => prob >= 0.1).map(([cls]) => cls);
    return set.length ? set : [entries.sort((a, b) => b[1] - a[1])[0][0]];
  }

  private clamp01(x: number): number {
    return Math.max(0, Math.min(1, x));
  }
}
