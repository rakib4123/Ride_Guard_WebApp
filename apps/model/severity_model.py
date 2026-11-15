"""
RideGuard severity model: "if a motorcycle crash happens here, now, how likely is
the rider to be killed or seriously injured (KSI)?"

Trained on real police records: UK STATS19 motorcyclist casualties (Department
for Transport, Open Government Licence v3.0). Inputs are only what the app can
measure without asking the rider:

    Speed_Limit     posted limit (km/h)
    Is_Dark         from sunrise/sunset at the rider's location (Open-Meteo is_day)
    Weather         Clear / Foggy / Rainy
    Road_condition  Dry / Wet
    Area            Urban / Rural (from the reverse-geocoded place)
    Time_of_Day     clock band (same bands as the app)

Speed limit and darkness are constrained to only raise severity. The others are
left free: the real data says, for example, that wet-road crashes are slightly
LESS severe (riders slow down), and a real effect should not be overridden.
"""
from __future__ import annotations

import json
import pathlib
from dataclasses import dataclass

import numpy as np
import pandas as pd
from catboost import CatBoostClassifier

from rideguard_model import apply_isotonic

INPUTS = ["Speed_Limit", "Is_Dark", "Weather", "Road_condition", "Area", "Time_of_Day"]
TIMES = ["Morning", "Noon", "Afternoon", "Evening", "Night"]

ENCODED: list[tuple[str, int]] = [
    ("speed_limit", +1), ("dark", +1), ("rain", 0), ("fog", 0), ("wet", 0), ("rural", 0),
    *[(f"tod={t}", 0) for t in TIMES],
]
ENCODED_COLS = [c for c, _ in ENCODED]
MONOTONE = [m for _, m in ENCODED]
LIMIT_RANGE = (30.0, 115.0)   # 20 mph .. 70 mph, the range seen in training


def time_of_day(hour: int) -> str:
    """Same bands as the web app's timeOfDay()."""
    if 5 <= hour < 11:
        return "Morning"
    if 11 <= hour < 14:
        return "Noon"
    if 14 <= hour < 17:
        return "Afternoon"
    if 17 <= hour < 21:
        return "Evening"
    return "Night"


def encode(raw: pd.DataFrame) -> pd.DataFrame:
    e = pd.DataFrame(index=raw.index)
    e["speed_limit"] = pd.to_numeric(raw.Speed_Limit).astype(float).clip(*LIMIT_RANGE)
    e["dark"] = raw.Is_Dark.astype(bool).astype(float)
    e["rain"] = (raw.Weather == "Rainy").astype(float)
    e["fog"] = (raw.Weather == "Foggy").astype(float)
    e["wet"] = (raw.Road_condition == "Wet").astype(float)
    e["rural"] = (raw.Area == "Rural").astype(float)
    for t in TIMES:
        e[f"tod={t}"] = (raw.Time_of_Day == t).astype(float)
    return e[ENCODED_COLS]


@dataclass
class SeverityModel:
    model: CatBoostClassifier
    iso: dict
    meta: dict

    def ksi(self, raw: pd.DataFrame) -> np.ndarray:
        p = self.model.predict_proba(encode(raw))[:, 1]
        return np.clip(apply_isotonic(self.iso, p), 1e-4, 1 - 1e-4)

    def save(self, art: pathlib.Path) -> None:
        art.mkdir(parents=True, exist_ok=True)
        self.model.save_model(str(art / "severity.cbm"))
        json.dump(self.iso, open(art / "severity_calibration.json", "w"))
        json.dump(self.meta, open(art / "severity_meta.json", "w"), indent=2)

    @classmethod
    def load(cls, art: pathlib.Path) -> "SeverityModel":
        m = CatBoostClassifier()
        m.load_model(str(art / "severity.cbm"))
        return cls(m, json.load(open(art / "severity_calibration.json")),
                   json.load(open(art / "severity_meta.json")))
