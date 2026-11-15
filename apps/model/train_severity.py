"""
Train the severity model (severity_model.py) on real UK police records.

Data: DfT STATS19 collision + casualty files (Open Government Licence v3.0),
motorcyclist casualties only. Download from
https://www.data.gov.uk/dataset/cb7ae6f0-4be6-4935-9277-47e5ce24a11f
and point UK_DATA_DIR at a folder holding:
    uk_collision_<year>.csv  and  uk_casualty_<year>.csv

Honest evaluation: train on TRAIN_YEAR (80% fit, 20% isotonic calibration),
test on every row of TEST_YEAR — a year the model has never seen.

Usage: UK_DATA_DIR=/path python train_severity.py
"""
from __future__ import annotations

import os
import pathlib

import numpy as np
import pandas as pd
from catboost import CatBoostClassifier

from rideguard_model import fit_isotonic
from severity_model import INPUTS, MONOTONE, SeverityModel, encode, time_of_day

HERE = pathlib.Path(__file__).resolve().parent
ART = HERE / "artifacts"
TRAIN_YEAR, TEST_YEAR, SEED = 2022, 2023, 0
MOTO = {2, 3, 4, 5, 23, 97}  # STATS19 casualty_type: motorcycle (all engine sizes, electric, unknown)
MPH = 1.609344


def find_file(kind: str, year: int) -> pathlib.Path:
    dirs = [os.environ.get("UK_DATA_DIR", ""),
            str(HERE.parents[2] / "RideGuard_Audit" / "data" / "raw"),
            str(HERE.parents[2] / "RideGuard_Audit" / "data" / "raw" / f"uk{year}")]
    for d in filter(None, dirs):
        p = pathlib.Path(d) / f"uk_{kind}_{year}.csv"
        if p.exists():
            return p
    raise FileNotFoundError(f"uk_{kind}_{year}.csv not found in {dirs}")


def load_year(year: int) -> tuple[pd.DataFrame, np.ndarray]:
    col = pd.read_csv(find_file("collision", year), low_memory=False)
    cas = pd.read_csv(find_file("casualty", year), low_memory=False)
    d = cas[cas.casualty_type.isin(MOTO)].merge(col, on="collision_index", suffixes=("", "_c"))
    d = d[(d.speed_limit > 0) & d.time.notna() & d.light_conditions.isin([1, 4, 5, 6, 7])
          & d.weather_conditions.isin([1, 2, 3, 4, 5, 6, 7]) & d.road_surface_conditions.isin([1, 2, 3, 4, 5])
          & d.urban_or_rural_area.isin([1, 2])]
    hour = pd.to_numeric(d.time.str.slice(0, 2), errors="coerce")
    d = d[hour.notna()]
    hour = hour[hour.notna()].astype(int)
    raw = pd.DataFrame({
        "Speed_Limit": d.speed_limit * MPH,
        "Is_Dark": d.light_conditions != 1,
        "Weather": d.weather_conditions.map({1: "Clear", 4: "Clear", 2: "Rainy", 5: "Rainy",
                                             3: "Rainy", 6: "Rainy", 7: "Foggy"}),
        "Road_condition": d.road_surface_conditions.map({1: "Dry", 2: "Wet", 3: "Wet", 4: "Wet", 5: "Wet"}),
        "Area": d.urban_or_rural_area.map({1: "Urban", 2: "Rural"}),
        "Time_of_Day": hour.map(time_of_day),
    }).reset_index(drop=True)
    y = (d.casualty_severity <= 2).astype(int).to_numpy()   # 1 fatal, 2 serious -> KSI
    return raw[INPUTS], y


def auc(y: np.ndarray, p: np.ndarray) -> float:
    """Mann-Whitney AUC with tie handling."""
    r = pd.Series(p).rank().to_numpy()
    n1 = y.sum()
    n0 = len(y) - n1
    return float((r[y == 1].sum() - n1 * (n1 + 1) / 2) / (n1 * n0))


def calib_table(y: np.ndarray, p: np.ndarray, bins: int = 5) -> list[dict]:
    q = np.quantile(p, np.linspace(0, 1, bins + 1))
    out = []
    for i, (lo, hi) in enumerate(zip(q[:-1], q[1:])):
        m = (p >= lo) & ((p <= hi) if i == bins - 1 else (p < hi))
        if m.any():
            out.append({"predicted": round(float(p[m].mean()), 3), "observed": round(float(y[m].mean()), 3),
                        "n": int(m.sum())})
    return out


def main() -> None:
    Xtr_raw, ytr = load_year(TRAIN_YEAR)
    Xte_raw, yte = load_year(TEST_YEAR)
    rng = np.random.default_rng(SEED)
    idx = rng.permutation(len(ytr))
    cut = int(0.8 * len(idx))
    fit_i, cal_i = idx[:cut], idx[cut:]

    X = encode(Xtr_raw)
    m = CatBoostClassifier(iterations=400, depth=4, learning_rate=0.05, loss_function="Logloss",
                           random_seed=SEED, verbose=False, monotone_constraints=MONOTONE)
    m.fit(X.iloc[fit_i], ytr[fit_i])
    iso = fit_isotonic(m.predict_proba(X.iloc[cal_i])[:, 1], ytr[cal_i].astype(float))
    sev = SeverityModel(m, iso, meta={})

    p = sev.ksi(Xte_raw)
    base = float(ytr.mean())
    brier = float(((p - yte) ** 2).mean())
    brier_base = float(((base - yte) ** 2).mean())

    examples = {
        "30 mph, town, daylight, dry": dict(Speed_Limit=30 * MPH, Is_Dark=False, Weather="Clear", Road_condition="Dry", Area="Urban", Time_of_Day="Afternoon"),
        "30 mph, town, dark, rain": dict(Speed_Limit=30 * MPH, Is_Dark=True, Weather="Rainy", Road_condition="Wet", Area="Urban", Time_of_Day="Night"),
        "60 mph, rural, daylight, dry": dict(Speed_Limit=60 * MPH, Is_Dark=False, Weather="Clear", Road_condition="Dry", Area="Rural", Time_of_Day="Afternoon"),
        "60 mph, rural, dark": dict(Speed_Limit=60 * MPH, Is_Dark=True, Weather="Clear", Road_condition="Dry", Area="Rural", Time_of_Day="Night"),
    }
    ex = sev.ksi(pd.DataFrame(list(examples.values()))[INPUTS])

    sev.meta = {
        "model_version": "rideguard-severity-uk-2026-11",
        "question": "P(rider killed or seriously injured | motorcycle crash happens)",
        "source": "UK STATS19 (Department for Transport), Open Government Licence v3.0",
        "inputs": INPUTS,
        "train": {"year": TRAIN_YEAR, "riders": int(len(ytr)), "ksi_share": round(base, 4)},
        "test": {
            "year": TEST_YEAR, "riders": int(len(yte)), "ksi_share": round(float(yte.mean()), 4),
            "auc": round(auc(yte, p), 4),
            "brier": round(brier, 4), "brier_base_rate_only": round(brier_base, 4),
            "brier_skill": round(1 - brier / brier_base, 4),
            "calibration_quintiles": calib_table(yte, p),
        },
        "examples_ksi": {k: round(float(v), 3) for k, v in zip(examples, ex)},
        "validated_in": ["GB"],
    }
    sev.save(ART)
    import json
    print(json.dumps(sev.meta, indent=2))


if __name__ == "__main__":
    main()
