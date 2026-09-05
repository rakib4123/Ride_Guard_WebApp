import { Injectable, Logger } from '@nestjs/common';
import type { BehaviourResult, FeatureVector } from '@rideguard/shared';
import { BehaviourScorer } from './behaviour.scorer';
import { MockScorer } from './mock.scorer';

/** Parses an env var as a number, falling back to `fallback` for missing, empty, or non-numeric values. */
function parseEnvNumber(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return raw !== undefined && raw !== '' && Number.isFinite(n) ? n : fallback;
}

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
  // `Number(x)` turns a non-numeric env value into NaN and an empty string
  // into 0; either would make `attempt <= this.retries` false on the first
  // try, so the scorer would silently return the mock forever with no log.
  // Guard with Number.isFinite and fall back to the documented defaults.
  private readonly timeoutMs = parseEnvNumber(process.env.MODEL_TIMEOUT_MS, 30_000);
  private readonly retries = parseEnvNumber(process.env.MODEL_RETRIES, 1);

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
