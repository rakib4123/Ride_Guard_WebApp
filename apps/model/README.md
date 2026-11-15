# RideGuard live-risk model

The model behind every RideGuard reading, served over HTTP for the NestJS API.
Fusion with the location layer, thresholds and trip logging stay in the Node app.

## What it uses

Only what the phone measures — the rider is asked nothing:

| Input | Source |
|---|---|
| `Bike_Speed` | GPS |
| `Speed_Limit` | OSM `maxspeed`, else a road-class default |
| `Talk_While_Riding` | `Regularly` while the screen is touched on the move |
| `Weather`, `Road_condition` | Open-Meteo |
| `Time_of_Day` | clock |
| `Road_Type` | OSM road class |
| `Traffic_Density` | time-of-day estimate, raised by live traffic / the crowd around the rider |

## How it works (`rideguard_model.py`)

- **Ordinal:** two CatBoost models give P(crash ≥ Moderate) and P(≥ Severe); the
  score `s = 0.5·P(Mod) + 1·P(Sev)` equals their average.
- **Monotone:** speed, over-limit, phone use, rain, fog, wet road, darkness and traffic
  can only raise risk. The training data contains backwards patterns (rain "safer",
  speed "safer" for many rows); without the constraint the model learns them.
- **Calibrated** (isotonic, own split) and **conformal** (90% sets, own split).
- **Explained in score units:** each factor's impact is how much lower the score would
  be with that factor at its safe setting.
- No scikit-learn or pickle: calibration is stored as JSON.

## Train

```bash
pip install -r requirements.txt
RIDEGUARD_DATA_DIR=/path/to/risk_dataset python train.py           # live-risk model -> artifacts/
UK_DATA_DIR=/path/to/stats19 python train_severity.py              # severity model  -> artifacts/
RIDEGUARD_DATA_DIR=... UK_DATA_DIR=... NYC_DATA=... python build_spatial.py  # -> ../api/data/hotspots.json
```

STATS19 files: <https://www.data.gov.uk/dataset/cb7ae6f0-4be6-4935-9277-47e5ce24a11f>
(named `uk_collision_<year>.csv`, `uk_casualty_<year>.csv`). NYC:
<https://data.cityofnewyork.us/Public-Safety/Motor-Vehicle-Collisions-Crashes/h9gi-nx95>.

`train.py` uses all 15,100 rows of `MotorBike_Accident.xlsx` split 55/15/15/15
(train / calibration / conformal / test). Current test results:

| | Monotone (shipped) | Unconstrained, same inputs |
|---|---|---|
| Macro-F1 | 0.624 | 0.819 |
| Calibration error (ECE) | 0.041 | 0.016 |
| 90% set coverage / size | 0.938 / 2.06 | 0.897 / 1.22 |
| Rows where a danger *lowers* risk | **0%** | up to 45% |

The posted limit enters only through `over_limit`: as a free input it learned a
dataset artefact (a 50 km/h road scored 0.44 at 30 km/h, a 60 km/h road 0.00).
Dropping it cost ~0.14 macro-F1 that came from that artefact.

## Severity model (`severity_model.py`, `train_severity.py`)

"If a crash happens here, now, how likely is the rider to be killed or seriously
injured?" Trained on UK STATS19 motorcyclist casualties (DfT, Open Government
Licence v3.0): 15,859 riders in 2022, tested on all 15,321 in 2023.

| Test (2023) | |
|---|---|
| AUC | 0.684 |
| Brier skill vs base rate | 9.5% |
| Calibration | predicted 12/23/30/34/57% vs observed 13/23/33/36/56% by quintile |

Inputs: speed limit, darkness, weather, road surface, town/countryside, time of
day. Speed limit and darkness may only raise severity; the rest follow the data
(wet-road crashes are slightly *less* severe — riders slow down).

## Location layer (`build_spatial.py`)

One crash grid per region, each from that region's motorcycle crashes; the cell
size (250 m – 2 km) is chosen per region on later years. Share of later crashes
inside the busiest 5% of each region's crash area:

| Region | Crashes | Check | Caught | vs random |
|---|---|---|---|---|
| Dhaka (Mendeley) | 39,397 | 2007–16 → 2017–21 | 33% | 6.6× |
| Great Britain (STATS19) | 32,950 | 2022 → 2023 | 10% | 2.1× |
| New York City (NYC Open Data) | 17,491 | 2020–22 → 2023–25 | 14% | 2.8× |

Dhaka's coordinates are geocoded place names, which concentrate crashes on a few
hundred points and inflate its figure.

The previous model (all 19 inputs including rider questions) is kept in
`legacy-2026-06/` for comparison.

## Serve

```bash
uvicorn service:app --port 8000
```

- `GET  /health` — model versions + test metrics
- `POST /behaviour-score` — `{ score, probabilities, factors, conformalSet, isPlaceholder:false, modelVersion, severity }`

Set `MODEL_SERVICE_TOKEN` here and on the API to refuse callers other than the API.
