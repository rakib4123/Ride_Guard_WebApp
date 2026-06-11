# RideGuard Tier-1 model service

The real behavioural model (CatBoost + per-class isotonic calibration + APS
split-conformal), served over HTTP for the NestJS API. This is the Section 6.1
"Python sidecar" path: the model stays in Python; everything else (fusion,
spatial prior, thresholds, trip logging) stays in the Node app.

## Train

You need the Mendeley bike dataset (`MotorBike_Accident.pkl` or `.xlsx`).

```bash
pip install -r requirements.txt
RIDEGUARD_DATA_DIR=/path/to/dataset python train.py
```

This writes `artifacts/` (CatBoost model, isotonics, conformal qhat, metadata).
A pre-trained `artifacts/` is included so the service runs out of the box.

## Serve

```bash
uvicorn service:app --port 8000
```

- `GET  /health` — model version + reproduced validation metrics
- `GET  /meta` — value domains + numeric ranges for the 19 features
- `POST /behaviour-score` — returns `{ score, probabilities, factors (SHAP), conformalSet, isPlaceholder:false }`

## Wire to the API

Set `MODEL_SERVICE_URL=http://localhost:8000` for the NestJS API; it will use the
real model instead of the built-in mock. Unset it to fall back to the mock.

> Honesty note: reproduced test accuracy ~0.97 largely reflects that the survey
> dataset is a deterministic lookup table (every feature combo is unique). The
> conformal set + calibration are the trustworthy outputs; treat the score as an
> advisory, not a validated crash forecast.
