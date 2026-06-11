import { Injectable, Logger } from '@nestjs/common';
import type { BehaviourResult, FeatureVector } from '@rideguard/shared';
import { BehaviourScorer } from './behaviour.scorer';
import { MockScorer } from './mock.scorer';

/**
 * Real Tier-1 scorer: calls the Python model sidecar (apps/model) over HTTP.
 * Falls back to the transparent mock if MODEL_SERVICE_URL is unset or the
 * service is unreachable, so the app keeps working either way.
 */
@Injectable()
export class HttpScorer implements BehaviourScorer {
  private readonly logger = new Logger(HttpScorer.name);
  private readonly url = process.env.MODEL_SERVICE_URL;

  constructor(private readonly fallback: MockScorer) {}

  async score(features: FeatureVector): Promise<BehaviourResult> {
    if (!this.url) return this.fallback.score(features);
    try {
      const res = await fetch(`${this.url}/behaviour-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(features),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`model service ${res.status}`);
      return (await res.json()) as BehaviourResult;
    } catch (err) {
      this.logger.warn(`Model service unavailable, using mock: ${String(err)}`);
      const r = await this.fallback.score(features);
      return { ...r, isPlaceholder: true };
    }
  }
}
