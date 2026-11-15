'use client';

import { Card } from '@/components/Card';

/** Average score points (of 100) each measured factor added on the test set. */
const FACTOR_POINTS: { label: string; value: number }[] = [
  { label: 'Over the speed limit', value: 22.54 },
  { label: 'Phone use while riding', value: 12.09 },
  { label: 'Heavy traffic', value: 3.54 },
  { label: 'Rain or fog', value: 0.31 },
  { label: 'Wet road', value: 0.15 },
  { label: 'Riding in the dark', value: 0.05 },
];

export default function AboutPage() {
  const max = Math.max(...FACTOR_POINTS.map((s) => s.value));
  return (
    <>
      <Card title="What RideGuard is">
        <p className="text-sm leading-relaxed text-text">
          RideGuard is a riding-safety <strong>advisory</strong> for motorcyclists. It combines a
          risk score from what your phone measures with maps of where motorcycle crashes have been
          recorded (Dhaka, Great Britain and New York City so far), and shows one reading before and
          during a ride.
        </p>
      </Card>

      <Card title="You are asked nothing">
        <p className="text-sm leading-relaxed text-muted">
          The score uses only what the phone measures: <span className="text-text">GPS speed, the
          posted speed limit, touching the screen while moving, weather, road surface, time of day,
          road type and traffic</span>. Helmet, alcohol and other habits can&apos;t be measured by a
          phone, so they are left out rather than guessed.
        </p>
      </Card>

      <Card title="The numbers, honestly">
        <ul className="space-y-2 text-sm leading-relaxed text-muted">
          <li>
            Trained on all 15,100 rows of the Mendeley motorbike dataset. On held-out data it
            classifies severity with <span className="text-text">0.62 macro-F1</span>, its
            probabilities are calibrated (error 0.04), and its 90% plausible-outcome sets hold the
            true outcome 94% of the time.
          </li>
          <li>
            The model is <span className="text-text">constrained</span>: going faster, touching the
            phone, rain, a wet road, darkness and traffic can only raise the risk, never lower it.
            Without that rule it scored higher (0.82) but read +20 km/h as safer for many riders,
            because the training data contains such backwards patterns. The posted limit counts only
            through how far you are over it: on its own it had learned that a 50 km/h road is
            riskier than a 60 km/h one even at 30 km/h, a quirk of the data.
          </li>
          <li>
            The training data holds almost no signal for rain, wet roads or darkness, so those add
            little to the score. RideGuard still tells you to watch out for them.
          </li>
          <li>
            No crash model is exact. This is a guide to when to take extra care, not a prediction
            that a crash will or won&apos;t happen.
          </li>
        </ul>
      </Card>

      <Card title="What raises the score">
        <p className="mb-3 text-xs text-muted">
          Average score points (out of 100) each factor added on the test set.
        </p>
        <ul className="space-y-2">
          {FACTOR_POINTS.map((s) => (
            <li key={s.label}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-sm text-text">{s.label}</span>
                <span className="font-mono tabular text-xs text-muted">+{s.value.toFixed(1)}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-signal" style={{ width: `${(s.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Where crashes happen">
        <p className="mb-2 text-sm leading-relaxed text-muted">
          Each region uses its own motorcycle crashes, counted per 250 m area and checked on later
          years it was not built from. Within 5% of each region&apos;s crash area, the busiest
          places held:
        </p>
        <ul className="space-y-1 text-sm text-muted">
          <li><span className="text-text">Dhaka</span> — 33% of later crashes (39,397 crashes, Mendeley, 2007–2021; locations are geocoded place names)</li>
          <li><span className="text-text">Great Britain</span> — 10% (32,950 crashes, Department for Transport STATS19, 2022–2023)</li>
          <li><span className="text-text">New York City</span> — 14% (17,491 crashes, NYC Open Data, 2020–2025)</li>
        </ul>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          A recorded crash area can raise your reading by up to 30%. A spot with no record, or a
          place outside these regions, leaves it unchanged: missing records are not evidence of safety.
        </p>
      </Card>

      <Card title="How bad, if a crash happens">
        <p className="text-sm leading-relaxed text-muted">
          A second model, trained on 15,859 motorcyclist casualties in UK police records (2022) and
          checked on all 15,321 from 2023, estimates the chance of death or serious injury if a crash
          happened: from about <span className="text-text">32%</span> on a 30 mph town road in
          daylight to <span className="text-text">67%</span> on a 60 mph rural road in the dark
          (AUC 0.68, well calibrated). It uses the speed limit, darkness, weather, road surface, town
          or countryside, and time of day. Outside Britain it is shown as not yet checked for that
          country.
        </p>
      </Card>

      <Card title="People around you">
        <ul className="space-y-2 text-sm leading-relaxed text-muted">
          <li><span className="text-text">Other RideGuard riders:</span> while you ride, if you
            switch it on, your phone shares an anonymous position with the server for a few seconds
            at a time. Nothing is stored and the id changes every 10 minutes.</li>
          <li><span className="text-text">Other phones:</span> where the browser can scan Bluetooth
            (Android Chrome with an experimental setting), nearby advertising devices are counted.</li>
          <li><span className="text-text">One bus is one group:</span> phones that move together, or
            arrive and fade together, are counted once. Your own earbuds and a pillion phone are
            left out.</li>
          <li>Most people carry no detectable phone, so the count is a lower bound. It can only raise
            the traffic estimate, never lower it.</li>
        </ul>
      </Card>

      <Card title="Your data">
        <p className="text-sm leading-relaxed text-muted">
          Research trip logs are sent only with your consent, your rider id is hashed before
          storage, and you can leave out your GPS trail. To work, the app sends your location to
          OpenStreetMap (place names, roads), Open-Meteo (weather) and CARTO (map tiles). Crash
          data: Department for Transport STATS19 (Open Government Licence v3.0), NYC Open Data,
          and Mendeley Data.
        </p>
      </Card>

      <p className="px-1 text-center text-xs text-muted">
        Maps &amp; search: OpenStreetMap · routing: OSRM · weather: Open-Meteo · model
        rideguard-live-2026-11
      </p>
    </>
  );
}
