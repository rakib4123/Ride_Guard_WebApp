"""
Train the RideGuard live-risk model (see rideguard_model.py for the design).

Data: the Mendeley motorbike dataset (MotorBike_Accident.xlsx, all 15,100 rows).
Only the 8 inputs the phone measures are used; no rider questions.

Splits (stratified, seed 0), each used for exactly one job:
    55% train  ->  15% isotonic calibration  ->  15% conformal  ->  15% test

Usage:
    RIDEGUARD_DATA_DIR=/path/to/risk_dataset python train.py
(defaults to ../../../risk_dataset relative to this file)
"""
from __future__ import annotations

import json
import os
import pathlib

import numpy as np
import pandas as pd
from catboost import CatBoostClassifier

from rideguard_model import (LABELS, MONOTONE, RAW_FEATURES, LiveModel, encode,
                             fit_isotonic)

HERE = pathlib.Path(__file__).resolve().parent
ART = HERE / "artifacts"
SEED, ALPHA = 0, 0.10
MODEL_VERSION = "rideguard-live-2026-11"


def find_data() -> pathlib.Path:
    dirs = [os.environ.get("RIDEGUARD_DATA_DIR", ""), str(HERE.parents[2] / "risk_dataset"), str(HERE)]
    for d in filter(None, dirs):
        p = pathlib.Path(d) / "MotorBike_Accident.xlsx"
        if p.exists():
            return p
    raise FileNotFoundError(f"MotorBike_Accident.xlsx not found in {dirs}")


def split(y: np.ndarray, fracs=(0.55, 0.15, 0.15, 0.15)) -> list[np.ndarray]:
    """Stratified split into index arrays."""
    rng = np.random.default_rng(SEED)
    parts: list[list[int]] = [[] for _ in fracs]
    edges = np.cumsum(fracs)[:-1]
    for k in np.unique(y):
        ids = np.flatnonzero(y == k)
        rng.shuffle(ids)
        for i, chunk in enumerate(np.split(ids, (edges * len(ids)).astype(int))):
            parts[i].extend(chunk.tolist())
    return [np.array(sorted(p)) for p in parts]


def fit_binary(X: pd.DataFrame, t: np.ndarray, monotone: bool) -> CatBoostClassifier:
    m = CatBoostClassifier(iterations=500, depth=6, learning_rate=0.06, loss_function="Logloss",
                           random_seed=SEED, verbose=False,
                           **({"monotone_constraints": MONOTONE} if monotone else {}))
    m.fit(X, t)
    return m


def macro_f1(yt: np.ndarray, yp: np.ndarray) -> float:
    f = []
    for k in range(3):
        tp = ((yp == k) & (yt == k)).sum()
        fp = ((yp == k) & (yt != k)).sum()
        fn = ((yp != k) & (yt == k)).sum()
        f.append(2 * tp / max(2 * tp + fp + fn, 1))
    return float(np.mean(f))


def ece(yt: np.ndarray, p: np.ndarray, bins: int = 10) -> float:
    conf, pred = p.max(1), p.argmax(1)
    out = 0.0
    for lo, hi in zip(np.linspace(0, 1, bins + 1)[:-1], np.linspace(0, 1, bins + 1)[1:]):
        m = (conf > lo) & (conf <= hi)
        if m.any():
            out += m.mean() * abs((pred[m] == yt[m]).mean() - conf[m].mean())
    return float(out)


def stress_test(model: LiveModel, raw: pd.DataFrame) -> list[dict]:
    """Make one factor worse for every row; risk should never fall."""
    base = model.score(raw)
    scen = {
        "speed +20 km/h": lambda d: d.assign(Bike_Speed=d.Bike_Speed + 20),
        "phone use": lambda d: d.assign(Talk_While_Riding="Regularly"),
        "rain (from clear)": lambda d: d.assign(Weather=np.where(d.Weather == "Clear", "Rainy", d.Weather)),
        "wet road": lambda d: d.assign(Road_condition="Wet"),
        "night": lambda d: d.assign(Time_of_Day="Night"),
        "traffic +2": lambda d: d.assign(Traffic_Density=(d.Traffic_Density + 2).clip(upper=8)),
    }
    rows = []
    for name, f in scen.items():
        delta = model.score(f(raw.copy())) - base
        rows.append({"scenario": name, "mean_change": round(float(delta.mean()), 4),
                     "pct_rows_risk_fell": round(float((delta < -1e-6).mean() * 100), 2)})
    return rows


def evaluate(model: LiveModel, raw: pd.DataFrame, y: np.ndarray) -> dict:
    p = model.class_proba(raw)
    pred = p.argmax(1)
    onehot = np.eye(3)[y]
    in_set = np.array([LABELS[y[i]].split()[0] in " ".join(model.conformal_set(p[i])) for i in range(len(y))])
    sizes = np.array([len(model.conformal_set(r)) for r in p])
    return {
        "macro_f1": round(macro_f1(y, pred), 4),
        "accuracy": round(float((pred == y).mean()), 4),
        "ece": round(ece(y, p), 4),
        "brier": round(float(((p - onehot) ** 2).sum(1).mean()), 4),
        "conformal_coverage": round(float(in_set.mean()), 4),
        "conformal_avg_set_size": round(float(sizes.mean()), 4),
    }


def build(raw: pd.DataFrame, y: np.ndarray, idx: list[np.ndarray], monotone: bool) -> LiveModel:
    tr, cal, con, _ = idx
    X = encode(raw)
    crash = fit_binary(X.iloc[tr], (y[tr] >= 1).astype(int), monotone)
    severe = fit_binary(X.iloc[tr], (y[tr] >= 2).astype(int), monotone)
    iso_c = fit_isotonic(crash.predict_proba(X.iloc[cal])[:, 1], (y[cal] >= 1).astype(float))
    iso_s = fit_isotonic(severe.predict_proba(X.iloc[cal])[:, 1], (y[cal] >= 2).astype(float))
    model = LiveModel(crash, severe, iso_c, iso_s, qhat=1.0, meta={})
    # split-conformal (LAC score) on its own split
    p = model.class_proba(raw.iloc[con])
    scores = np.sort(1.0 - p[np.arange(len(con)), y[con]])
    k = min(max(int(np.ceil((len(con) + 1) * (1 - ALPHA))), 1), len(con))
    model.qhat = float(scores[k - 1])
    return model


def main() -> None:
    df = pd.read_excel(find_data())
    raw = df[RAW_FEATURES].copy()
    y = df["Accident_Severity"].astype(str).map({l: i for i, l in enumerate(LABELS)}).to_numpy()
    idx = split(y)
    te = idx[3]
    print(f"rows {len(df)} | train {len(idx[0])} calib {len(idx[1])} conformal {len(idx[2])} test {len(te)}")

    free = build(raw, y, idx, monotone=False)
    model = build(raw, y, idx, monotone=True)

    sample = raw.iloc[te].sample(min(2000, len(te)), random_state=SEED)
    report = {
        "test": evaluate(model, raw.iloc[te], y[te]),
        "test_unconstrained_same_inputs": evaluate(free, raw.iloc[te], y[te]),
        "stress_test": stress_test(model, sample),
        "stress_test_unconstrained": stress_test(free, sample),
    }
    # Average score points each factor adds across the test set (for the About page).
    imp: dict[str, list[float]] = {}
    for row in sample.head(500).to_dict("records"):
        for f in model.factors(row, top=10):
            imp.setdefault(f["id"], []).append(f["impact"])
    report["mean_factor_points"] = {k: round(float(np.sum(v) / 500 * 100), 2) for k, v in
                                    sorted(imp.items(), key=lambda kv: -sum(kv[1]))}

    model.meta = {
        "model_version": MODEL_VERSION,
        "inputs": RAW_FEATURES,
        "labels": LABELS,
        "alpha": ALPHA,
        "ranges": {"Bike_Speed": [20, 120], "Speed_Limit": [40, 80], "Traffic_Density": [1, 8]},
        "data": {"file": "MotorBike_Accident.xlsx", "rows": int(len(df)),
                 "splits": {"train": len(idx[0]), "calibration": len(idx[1]),
                            "conformal": len(idx[2]), "test": len(te)}},
        "metrics": report,
    }
    model.save(ART)
    print(json.dumps(report, indent=2))
    print("saved", ART)


if __name__ == "__main__":
    main()
