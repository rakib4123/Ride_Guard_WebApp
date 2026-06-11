# RideGuard

A rider-facing **risk-advisory and data-collection** web app for motorcyclists in
Dhaka. It shows a single, calibrated risk reading before and during a trip by fusing a
behavioural score with where incidents have historically clustered, and it logs trips
(with consent) so the framework can eventually be validated against real outcomes.

> **Honest framing (Handoff Section 11).** RideGuard is **not** a proven crash
> predictor. The behavioural model is trained on self-reported survey data with no
> demonstrated real-time predictive power. The whole app is currently in *data-collection
> mode* behind a transparent placeholder scorer. This framing is built into the UI and
> should stay there until the model is validated.

---

## Stack

A npm-workspaces monorepo:

| Package | Tech | Role |
| --- | --- | --- |
| `apps/web` | **Next.js 14** (React 18, App Router, TypeScript, Tailwind) | Rider UI: Now / Route / Map / About |
| `apps/api` | **NestJS 10** (Node, TypeScript) | Scoring, spatial prior, trip logging, OpenAPI |
| `packages/shared` | TypeScript | Shared types, the trip schema, and the scoring constants both apps import |
| `apps/model` | **FastAPI** (Python) | Tier-1 model sidecar: trained CatBoost + isotonic + conformal, served over HTTP |

Maps, search, and routing use **OpenStreetMap** end-to-end, no API keys: Leaflet +
CARTO dark tiles, **Nominatim** for place search/geocoding, and **OSRM** for road
routing. Weather uses **Open-Meteo** (keyless).

### Map & location features (the Google-Maps-like layer, on OSM)

- **Place search / autocomplete** — type a Dhaka place; suggestions come from Nominatim.
- **Pick on the map** — drag the pin or tap anywhere to set a location; reverse geocoding
  names the spot.
- **Live risk** — on the Now screen the risk re-scores as you drag the pin or move, with a
  *Follow GPS* mode (`watchPosition`) for continuous updates while riding.
- **Road routing** — the Route screen pulls a real driving polyline from OSRM, samples it
  every 75 m server-side, and colours each segment by risk (straight-line fallback if OSRM
  is unreachable).
- **Spot check** — the Map screen overlays the 253 real hotspot clusters and shows the live
  fused risk at any point you pick.

> Nominatim's public endpoint allows ~1 req/sec and asks for attribution (search is
> debounced accordingly); OSRM's demo server is rate-limited. For production load, self-host
> both or use a paid provider — swap the base URLs in `lib/geocode.ts` and `lib/routing.ts`.

---

## The model is real and wired in

The Tier-1 model has been trained from the Mendeley bike dataset using the published
pipeline's exact recipe and is served from `apps/model`:

- **CatBoost MultiClass** (iterations 400, depth 6, lr 0.06, seed 0) over the 19 gated
  pre-crash features → **per-class isotonic calibration** → ordinal score
  `s = P @ [0, 0.5, 1]`, plus **APS split-conformal** sets (α = 0.10).
- Training reproduces the published metrics exactly: test accuracy **0.9715**, macro-F1
  **0.9718**, calibrated ECE **0.0076**, conformal coverage **0.895** (target 0.90).
- Per-request **SHAP** values become the "why this score" factors.

The behaviour score sits behind the same clean seam as before:

```
apps/api/src/behaviour/
  behaviour.scorer.ts   <- interface + DI token
  http.scorer.ts        <- calls the Python model service (active when MODEL_SERVICE_URL is set)
  mock.scorer.ts        <- transparent fallback (used if the service is unset/unreachable)
  behaviour.module.ts   <- picks HttpScorer or MockScorer from the env
```

Set `MODEL_SERVICE_URL=http://localhost:8000` and the API uses the real model
(`isPlaceholder: false`, the gauge's placeholder badge disappears). Unset it and the app
still runs on the transparent mock. The app's feature schema (`packages/shared`) matches
the model's training categories exactly, so the API forwards the feature vector straight
to the service with no remapping.

A pre-trained `apps/model/artifacts/` ships with the project, so the service runs without
the dataset. To retrain: `cd apps/model && pip install -r requirements.txt &&
RIDEGUARD_DATA_DIR=/path/to/dataset python train.py`. The datasets themselves are not
redistributed (see `apps/model/README.md` for the Mendeley DOIs).

Everything else — fusion maths, advisory thresholds, route sampling, spatial prior, trip
logging — is final.

---

## What is real vs placeholder

| Piece | Status |
| --- | --- |
| Fusion `R = clip(s·(1+0.30·(2π−1)), 0, 1)` (Section 5) | **Real** (`scoring.service.ts`) |
| Advisory bands Low/Med/High at 0.33 / 0.60 | **Real** |
| Route polyline sampling every 75 m + mean/p90/max | **Real** |
| Trip log schema, consent gate, rider-id hashing (Section 10) | **Real** |
| Spatial prior π | **Real maths + real data** — Gaussian kernel (300 m, matching the pipeline KDE bandwidth) over the published cluster centres |
| Hotspots | **Real** — 253 severity-weighted DBSCAN clusters from `results/hotspots.csv` (`apps/api/data/hotspots.json`, `source: "pipeline"`) |
| Behaviour score `s` | **Real** when the model service runs (CatBoost + isotonic + conformal); transparent mock fallback otherwise |
| Conformal severity sets | **Real** — APS split-conformal, α = 0.10 |
| Per-factor explanations | **Real** — per-request SHAP (mock heuristic when on fallback) |
| Global feature importance (About screen) | **Real** — mean \|SHAP\| from `results/shap_global.csv` |
| Validation figures (About screen) | **Real** — from `results/metrics.json`, framed honestly |

---

## Run it

Requires Node 18.18+ and a normal internet connection (the web build fetches Google Fonts;
the app fetches weather and map tiles at runtime).

```bash
npm install
npm run dev          # builds shared, then runs API (:4000) + web (:3000) together
```

Then open <http://localhost:3000>. API docs (Swagger) live at
<http://localhost:4000/api/docs>.

**For real model scores**, also start the Python sidecar and point the API at it:

```bash
cd apps/model && pip install -r requirements.txt
npm run dev:model                 # FastAPI model service on :8000 (from repo root)
# in the API env: MODEL_SERVICE_URL=http://localhost:8000
```

With the service running, `/api/health` reports `scorer: "tier1-model"` and the gauge
drops its placeholder badge. Without it, the app runs on the transparent mock.

Run pieces individually:

```bash
npm run build:shared      # must run before the apps (they import its dist/)
npm run dev:api           # NestJS on :4000
npm run dev:web           # Next.js on :3000
npm run dev:model         # FastAPI model service on :8000
npm run build             # production build of shared + api + web
```

Config: copy `apps/api/.env.example` → `apps/api/.env` and
`apps/web/.env.local.example` → `apps/web/.env.local` if you need non-default ports/URLs.

---

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET`  | `/api/health` | Liveness + which scorer is active |
| `POST` | `/api/score` | Fused risk for one point (`features` + `location`) |
| `POST` | `/api/score/route` | Per-segment + aggregate risk for a polyline |
| `GET`  | `/api/hotspots` | Hotspot points for the map |
| `POST` | `/api/trips` | Store a trip log (requires logging consent) |
| `GET`  | `/api/trips` / `/api/trips/:id` | Read stored trips (pilot/admin) |

Trip persistence is a file-backed repository (`FileTripsRepository`) behind a
`TripsRepository` interface — swap in Postgres/Prisma for production without touching the
service.

---

## Swapping in production data & services

1. **Model** — already trained and served by `apps/model` (`HttpScorer` calls it). For
   higher throughput you can export CatBoost → ONNX and add an in-process `OnnxScorer`, or
   scale the sidecar horizontally; the `BehaviourScorer` seam keeps the rest unchanged.
2. **Hotspots** — the real 253-cluster `results/hotspots.csv` is already integrated as
   `apps/api/data/hotspots.json`. For a true KDE surface (rather than the kernel
   approximation over cluster centres), replace `SpatialService.prior()` with a query
   against the pipeline's fitted density.
3. **Routing** — the Route screen samples a straight line today; wire a Directions API and
   feed its polyline into the same `/score/route` endpoint (Section 8).
4. **Trips DB** — bind a database `TripsRepository`.
5. **Maps** — switch CARTO tiles for Google Maps if/when billing is set up.

---

## Decisions to confirm (Handoff Section 12)

- Fusion weight λ = 0.30 and thresholds 0.33 / 0.60 are taken verbatim; tune against data.
- Conformal sets are a placeholder cutoff in the mock; replace with real conformal
  prediction when the model lands.
- Rider identity is hashed but otherwise unauthenticated — decide the real auth/identity
  model before any pilot.
- The hard-brake threshold (~0.45 g) is defined in shared constants for the client
  accelerometer logic; the in-app accelerometer capture is not yet implemented.

---

## Project layout

```
rideguard/
├─ package.json                 # workspaces + dev/build scripts
├─ packages/shared/             # types (model schema), trip schema, scoring constants
└─ apps/
   ├─ api/                      # NestJS: behaviour / spatial / scoring / trips / health
   ├─ web/                      # Next.js: now / route / map / about
   └─ model/                    # FastAPI Tier-1 sidecar: train.py, service.py, artifacts/
```
