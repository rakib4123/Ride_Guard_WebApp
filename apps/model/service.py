"""
RideGuard Tier-1 model service.

Loads the trained CatBoost + isotonic + conformal artifacts and serves the real
behavioural risk for the NestJS API (the Section 6.1 "Python sidecar" path). The
NestJS HttpScorer calls POST /behaviour-score; everything downstream (fusion,
spatial prior, thresholds, trip logging) stays in the Node app.

Run:  uvicorn service:app --port 8000      (from apps/model, after train.py)
"""
from __future__ import annotations
import json, pathlib
import numpy as np
import pandas as pd
import joblib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from catboost import CatBoostClassifier, Pool

HERE = pathlib.Path(__file__).resolve().parent
ART = HERE / "artifacts"

meta = json.load(open(ART / "meta.json"))
LABELS: list[str] = meta["labels"]
RISK_W: dict[str, float] = meta["risk_weights"]
CAT_COLS: list[str] = meta["cat_cols"]
FEATURES: list[str] = meta["feature_order"]
QHAT: float = meta["qhat"]

model = CatBoostClassifier()
model.load_model(str(ART / "tier1_catboost.cbm"))
isotonics = joblib.load(ART / "isotonics.joblib")
_cls = list(model.classes_)
_idx = [_cls.index(c) for c in LABELS]

LABEL_OUT = {"No Accident": "noAccident", "Moderate Accident": "moderate", "Severe Accident": "severe"}
SEVERITY_LABEL = {"No Accident": "No Accident", "Moderate Accident": "Moderate", "Severe Accident": "Severe"}
FACTOR_LABEL = {
    "Talk_While_Riding": "Phone use while riding", "Smoke_While_Riding": "Smoking while riding",
    "Wearing_Helmet": "Helmet use", "Biker_Alcohol": "Alcohol", "Bike_Speed": "Bike speed",
    "Speed_Limit": "Speed limit", "Road_Type": "Road type", "Road_condition": "Road condition",
    "Traffic_Density": "Traffic density", "Weather": "Weather", "Time_of_Day": "Time of day",
    "Biker_Occupation": "Occupation", "Biker_Education_Level": "Education",
    "Valid_Driving_License": "Valid license", "Bike_Condition": "Bike condition",
    "Motorcycle_Ownership": "Ownership", "Riding_Experience": "Riding experience",
    "Daily_Travel_Distance": "Daily distance", "Biker_Age": "Age",
}


class Features(BaseModel):
    Biker_Age: float
    Biker_Occupation: str
    Biker_Education_Level: str
    Riding_Experience: float
    Daily_Travel_Distance: float
    Talk_While_Riding: str
    Smoke_While_Riding: str
    Wearing_Helmet: str
    Motorcycle_Ownership: str
    Valid_Driving_License: str
    Bike_Condition: str
    Road_Type: str
    Road_condition: str
    Weather: str
    Time_of_Day: str
    Traffic_Density: float
    Speed_Limit: float
    Bike_Speed: float
    Biker_Alcohol: float


app = FastAPI(title="RideGuard Tier-1 model service")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def _frame(f: Features) -> pd.DataFrame:
    row = {c: getattr(f, c) for c in FEATURES}
    df = pd.DataFrame([row])[FEATURES]
    for c in CAT_COLS:
        df[c] = df[c].astype(object)
    for c in FEATURES:
        if c not in CAT_COLS:
            df[c] = pd.to_numeric(df[c])
    return df


def _calibrated(df: pd.DataFrame) -> np.ndarray:
    raw = model.predict_proba(df)[:, _idx]
    cal = np.column_stack([isotonics[j].predict(raw[:, j]) for j in range(len(LABELS))])
    cal = np.clip(cal, 1e-6, None)
    return cal / cal.sum(1, keepdims=True)


def _factors(df: pd.DataFrame, top: int = 4):
    pool = Pool(df, cat_features=CAT_COLS)
    arr = np.array(model.get_feature_importance(pool, type="ShapValues"))
    # multiclass: (n, n_classes, n_features+1); contribution to ordinal risk:
    shap = arr[0, :, :-1] if arr.ndim == 3 else arr[0:1, :-1]
    contrib = np.zeros(len(FEATURES))
    if arr.ndim == 3:
        for ci, cname in enumerate(_cls):
            contrib += RISK_W.get(cname, 0.0) * shap[ci, :]
    names = model.feature_names_
    pairs = [(FACTOR_LABEL.get(names[i], names[i]), float(contrib[i])) for i in range(len(names))]
    pairs = [p for p in pairs if p[1] > 0]
    pairs.sort(key=lambda x: -x[1])
    return [{"name": n, "impact": round(v, 4)} for n, v in pairs[:top]]


def _conformal(probs: np.ndarray) -> list[str]:
    keep = [SEVERITY_LABEL[LABELS[j]] for j in range(len(LABELS)) if (1.0 - probs[j]) <= QHAT]
    return keep or [SEVERITY_LABEL[LABELS[int(probs.argmax())]]]


@app.get("/health")
def health():
    return {"status": "ok", "model_version": meta["model_version"],
            "labels": LABELS, "metrics": meta["metrics"]}


@app.get("/meta")
def get_meta():
    return {"domains": meta["domains"], "numeric_ranges": meta["numeric_ranges"],
            "shap_note": "per-request SHAP contribution to ordinal risk"}


@app.post("/behaviour-score")
def behaviour_score(f: Features):
    df = _frame(f)
    probs = _calibrated(df)[0]
    w = np.array([RISK_W[c] for c in LABELS])
    score = float(probs @ w)
    return {
        "score": round(score, 6),
        "probabilities": {LABEL_OUT[LABELS[j]]: round(float(probs[j]), 6) for j in range(len(LABELS))},
        "factors": _factors(df),
        "conformalSet": _conformal(probs),
        "isPlaceholder": False,
        "modelVersion": meta["model_version"],
    }
