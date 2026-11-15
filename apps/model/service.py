"""
RideGuard live-risk model service.

Serves the model trained by train.py (see rideguard_model.py). The NestJS
HttpScorer calls POST /behaviour-score; fusion with the location prior,
thresholds and trip logging stay in the Node app.

Run:  uvicorn service:app --port 8000      (from apps/model)
"""
from __future__ import annotations

import os
import pathlib
from typing import Literal

import pandas as pd
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from rideguard_model import RAW_FEATURES, LiveModel
from severity_model import INPUTS as SEVERITY_INPUTS, SeverityModel

HERE = pathlib.Path(__file__).resolve().parent
model = LiveModel.load(HERE / "artifacts")
# Optional: "how bad if a crash happens", trained on UK police records.
severity = (SeverityModel.load(HERE / "artifacts")
            if (HERE / "artifacts" / "severity.cbm").exists() else None)

# Optional shared secret with the API. When set, callers must send it, so the
# model cannot be called directly from the internet around the API's checks.
SERVICE_TOKEN = os.environ.get("MODEL_SERVICE_TOKEN")


class Features(BaseModel):
    Bike_Speed: float = Field(ge=0, le=300)
    Speed_Limit: float = Field(ge=20, le=120)
    Talk_While_Riding: Literal["Never", "Sometimes", "Regularly"]
    Weather: Literal["Clear", "Foggy", "Rainy"]
    Road_condition: Literal["Dry", "Wet"]
    Time_of_Day: Literal["Morning", "Noon", "Afternoon", "Evening", "Night"]
    Road_Type: Literal["City Road", "Highway", "Village Road"]
    Traffic_Density: float = Field(ge=1, le=8)
    Is_Dark: bool = False
    Area: Literal["Urban", "Rural"] = "Urban"


app = FastAPI(title="RideGuard live-risk model")


def _check(token: str | None) -> None:
    if SERVICE_TOKEN and token != SERVICE_TOKEN:
        raise HTTPException(status_code=401, detail="invalid service token")


@app.get("/health")
def health():
    return {"status": "ok", "model_version": model.meta["model_version"],
            "inputs": RAW_FEATURES, "metrics": model.meta["metrics"]["test"],
            "severity": severity.meta["test"] if severity else None}


@app.post("/behaviour-score")
def behaviour_score(f: Features, x_service_token: str | None = Header(default=None)):
    _check(x_service_token)
    row = f.model_dump()
    p = model.class_proba(pd.DataFrame([row])[RAW_FEATURES])[0]
    return {
        "score": round(float(LiveModel.score_of(p[None, :])[0]), 6),
        "probabilities": {"noAccident": round(float(p[0]), 6), "moderate": round(float(p[1]), 6),
                          "severe": round(float(p[2]), 6)},
        "factors": model.factors(row),
        "conformalSet": model.conformal_set(p),
        "isPlaceholder": False,
        "modelVersion": model.meta["model_version"],
        "severity": _severity(row),
    }


def _severity(row: dict) -> dict | None:
    if severity is None:
        return None
    ksi = float(severity.ksi(pd.DataFrame([row])[SEVERITY_INPUTS])[0])
    return {"ksi": round(ksi, 4), "source": severity.meta["source"],
            "validatedIn": severity.meta["validated_in"], "modelVersion": severity.meta["model_version"]}
