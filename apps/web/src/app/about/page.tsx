'use client';

import { Card } from '@/components/Card';
import { SHAP_GLOBAL } from '@/lib/shap';

export default function AboutPage() {
  const max = Math.max(...SHAP_GLOBAL.map((s) => s.value));
  return (
    <>
      <Card title="What RideGuard is">
        <p className="text-sm leading-relaxed text-text">
          RideGuard is a riding-safety <strong>advisory and data-collection tool</strong> for
          motorcyclists in Dhaka. It combines a behavioural risk score with a map of where
          incidents have historically clustered, and shows a single risk reading before and
          during a trip.
        </p>
      </Card>

      <Card title="The numbers, honestly">
        <ul className="space-y-2 text-sm leading-relaxed text-muted">
          <li>
            The behavioural model reports ~0.97 test accuracy — but in the source data every
            feature combination maps to exactly one label, so that figure largely reflects
            <span className="text-text"> memorising a deterministic table</span>, not predicting
            real crashes.
          </li>
          <li>
            On a pre-crash-only, leakage-controlled target, macro-F1 for severity drops to
            <span className="text-text"> ~0.23</span>. That gap is the honest measure of how
            little proven predictive signal there is today.
          </li>
          <li>
            Instead of a single confident class, the engine returns a conformal
            <span className="text-text"> set</span> of plausible severities with ~90%
            coverage, and escalates caution when unsure.
          </li>
          <li>
            The spatial layer is a <span className="text-text">relative</span> prior (253
            severity-weighted clusters + KDE), never a probability — it can modulate caution
            but cannot manufacture risk it has no exposure data for.
          </li>
        </ul>
      </Card>

      <Card title="What the model leans on">
        <p className="mb-3 text-xs text-muted">
          Real global feature importance (mean |SHAP|) from the trained pipeline.
        </p>
        <ul className="space-y-2">
          {SHAP_GLOBAL.map((s) => (
            <li key={s.feature}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-sm text-text">{s.label}</span>
                <span className="font-mono tabular text-xs text-muted">{s.value.toFixed(2)}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-signal" style={{ width: `${(s.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="How the score works">
        <ol className="space-y-2 text-sm leading-relaxed text-muted">
          <li>
            <span className="text-text">Behaviour (s).</span> Your profile and trip conditions
            give three calibrated class probabilities, collapsed to s = 0·P(None) +
            0.5·P(Moderate) + 1·P(Severe).
          </li>
          <li>
            <span className="text-text">Place (π).</span> Your location is compared against
            historical incident density to get a relative spatial prior in [0,1].
          </li>
          <li>
            <span className="text-text">Fusion (R).</span> R = clip(s · (1 + 0.30·(2π − 1)), 0, 1),
            banded into Low / Medium / High.
          </li>
        </ol>
        <p className="mt-3 text-xs text-signal">
          When the Tier-1 model service is running, scores come from the real trained
          model (CatBoost + isotonic calibration + conformal sets) and the placeholder
          badge disappears. Without it, the app falls back to a transparent mock, clearly
          marked on the gauge.
        </p>
      </Card>

      <Card title="What it senses while you ride">
        <ul className="space-y-2 text-sm leading-relaxed text-muted">
          <li><span className="text-text">Captured automatically:</span> speed (GPS), location,
            road type and speed limit (from the map), weather, road surface (from the weather),
            time of day, and a traffic estimate.</li>
          <li><span className="text-text">Live alerts:</span> phone use while moving, going over
            the speed limit, and entering a high-risk area — by banner, sound, vibration, or voice.</li>
          <li><span className="text-text">Assumed safe defaults:</span> helmet, alcohol, licence and
            bike condition. A web app on a phone genuinely can't sense these, so RideGuard assumes
            the safe case rather than guessing.</li>
          <li><span className="text-text">Phone-use detection</span> means the screen is being
            touched while you're moving — the honest, achievable signal a browser can read.</li>
        </ul>
      </Card>

      <Card title="Your data">
        <p className="text-sm leading-relaxed text-muted">
          Trips are logged only with your explicit consent. Your rider id is hashed before
          storage, and you can leave out your raw GPS trace. The trip log exists so the
          framework can eventually be validated against real outcomes — the honest next step
          before anyone should rely on it.
        </p>
      </Card>

      <p className="px-1 text-center text-xs text-muted">
        Maps &amp; search: OpenStreetMap · routing: OSRM · weather: Open-Meteo · model
        rideguard-2026-06
      </p>
    </>
  );
}
