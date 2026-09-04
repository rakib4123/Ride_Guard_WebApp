import { Injectable, Logger } from '@nestjs/common';
import type { BehaviourResult, FeatureVector } from '@rideguard/shared';
import { BehaviourScorer } from './behaviour.scorer';
import { MockScorer } from './mock.scorer';

/**
 * Real Tier-1 scorer: calls the Python model sidecar (apps/model) over HTTP.
 * Falls back to the transparent mock if MODEL_SERVICE_URL is unset or the
 * service is unreachable, so the app keeps working either way.
 *
 * The timeout is generous by default: on Render's free plan the model service
 * sleeps after ~15 min idle and takes 30–60 s to wake, so a short timeout would
 * guarantee a mock result (labelled "sample" to the rider) on the first ride of
 * the day. One retry covers the wake-up, after which responses are fast.
 */
@Injectable()
export class HttpScorer implements BehaviourScorer {
  private readonly logger = new Logger(HttpScorer.name);
  private readonly url = process.env.MODEL_SERVICE_URL;
  private readonly timeoutMs = Number(process.env.MODEL_TIMEOUT_MS ?? 30_000);
  private readonly retries = Number(process.env.MODEL_RETRIES ?? 1);

  constructor(private readonly fallback: MockScorer) {}

  async score(features: FeatureVector): Promise<BehaviourResult> {
    if (!this.url) return this.fallback.score(features);

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        return await this.request(features);
      } catch (err) {
        const last = attempt === this.retries;
        this.logger.warn(
          `Model service attempt ${attempt + 1}/${this.retries + 1} failed: ${String(err)}` +
            (last ? ' — using mock.' : ' — retrying (service may be waking).'),
        );
      }
    }

    const r = await this.fallback.score(features);
    return { ...r, isPlaceholder: true };
  }

  private async request(features: FeatureVector): Promise<BehaviourResult> {
    const res = await fetch(`${this.url}/behaviour-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(features),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`model service ${res.status}`);
    return (await res.json()) as BehaviourResult;
  }
}
