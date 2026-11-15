"""
RideGuard live-risk model: everything shared by train.py and service.py.

The model sees ONLY what the phone measures or derives on its own. The rider is
asked nothing:

    Bike_Speed         GPS speed (km/h)
    Speed_Limit        posted limit (OSM maxspeed, else road-class default)
    Talk_While_Riding  'Regularly' while the screen is touched on the move, else 'Never'
    Weather            Open-Meteo at the rider's location
    Road_condition     wet when it is raining or foggy
    Time_of_Day        the phone's clock
    Road_Type          the OSM road class under the rider
    Traffic_Density    1..8: time-of-day estimate, raised by live traffic / the crowd

Design:
  * Ordinal, not multiclass. Two binary models give A = P(severity >= Moderate)
    and B = P(severity >= Severe). The app's score s = 0.5*P(Mod) + 1*P(Sev)
    equals 0.5*A + 0.5*B exactly.
  * Monotone. Speed, over-limit, phone use, rain, fog, wet road, darkness and
    traffic may only RAISE risk. The training data contains relationships that
    contradict road-safety evidence (rain "safer" than clear, helmet irrelevant);
    the constraints stop the model from learning those backwards.
  * Calibrated with isotonic regression on a held-out split, and wrapped in
    split-conformal sets calibrated on a further split used for nothing else.
  * No scikit-learn / pickle: isotonic maps are stored as JSON thresholds.
"""
from __future__ import annotations

import json
import pathlib
from dataclasses import dataclass

import numpy as np
import pandas as pd
from catboost import CatBoostClassifier

LABELS = ["No Accident", "Moderate Accident", "Severe Accident"]
SEVERITY_OUT = {"No Accident": "No Accident", "Moderate Accident": "Moderate", "Severe Accident": "Severe"}

RAW_FEATURES = ["Bike_Speed", "Speed_Limit", "Talk_While_Riding", "Weather", "Road_condition",
                "Time_of_Day", "Road_Type", "Traffic_Density"]
ROAD_TYPES = ["City Road", "Highway", "Village Road"]
FREQ = {"Never": 0, "Sometimes": 1, "Regularly": 2}
# Darkness: daylight periods 0, evening (dusk in Dhaka) 1, night 2.
DARK = {"Morning": 0, "Noon": 0, "Afternoon": 0, "Evening": 1, "Night": 2}

# Ranges seen in training. Inputs are clamped to these so the trees never
# extrapolate (e.g. 0 km/h at a red light; the data starts at 20).
RANGES = {"Bike_Speed": (20.0, 120.0), "Speed_Limit": (40.0, 80.0), "Traffic_Density": (1.0, 8.0)}

# Encoded column -> monotone direction (+1 = may only raise risk, 0 = free).
# The posted limit enters only through over_limit. As a free input it learned a
# dataset artefact (a 50 km/h road scored 0.44 at 30 km/h, a 60 road 0.00).
ENCODED: list[tuple[str, int]] = [
    ("speed", +1), ("over_limit", +1), ("phone", +1),
    ("rain", +1), ("fog", +1), ("wet", +1), ("dark", +1), ("traffic", +1),
    *[(f"road={r}", 0) for r in ROAD_TYPES],
]
ENCODED_COLS = [c for c, _ in ENCODED]
MONOTONE = [m for _, m in ENCODED]

# Factors explained to the rider: id -> (label, counterfactual "safe" setting).
FACTORS: dict[str, str] = {
    "overLimit": "Over the speed limit",
    "phone": "Phone use while riding",
    "weather": "Rain or fog",
    "wet": "Wet road",
    "dark": "Riding in the dark",
    "traffic": "Heavy traffic",
}


def encode(raw: pd.DataFrame) -> pd.DataFrame:
    """Raw live features -> the model's numeric columns (with clamping)."""
    d = raw.copy()
    for c, (lo, hi) in RANGES.items():
        d[c] = pd.to_numeric(d[c]).astype(float).clip(lo, hi)
    e = pd.DataFrame(index=d.index)
    e["speed"] = d.Bike_Speed
    e["over_limit"] = (d.Bike_Speed - d.Speed_Limit).clip(lower=0)
    e["phone"] = d.Talk_While_Riding.map(FREQ).astype(float)
    e["rain"] = (d.Weather == "Rainy").astype(float)
    e["fog"] = (d.Weather == "Foggy").astype(float)
    e["wet"] = (d.Road_condition == "Wet").astype(float)
    e["dark"] = d.Time_of_Day.map(DARK).astype(float)
    e["traffic"] = d.Traffic_Density
    for r in ROAD_TYPES:
        e[f"road={r}"] = (d.Road_Type == r).astype(float)
    if e.isna().any().any():
        bad = e.columns[e.isna().any()].tolist()
        raise ValueError(f"unrecognised categorical value in {bad}")
    return e[ENCODED_COLS]


# ---------------------------------------------------------------- isotonic
def fit_isotonic(x: np.ndarray, y: np.ndarray) -> dict:
    """Pool-adjacent-violators. Returns JSON-serialisable interpolation knots."""
    order = np.argsort(x, kind="mergesort")
    ux, inv = np.unique(x[order], return_inverse=True)
    w = np.bincount(inv).astype(float)
    s = np.bincount(inv, weights=y[order].astype(float))
    blocks: list[list[float]] = []          # [value, weight, x_start, x_end]
    for i in range(len(ux)):
        blocks.append([s[i] / w[i], w[i], ux[i], ux[i]])
        while len(blocks) > 1 and blocks[-2][0] > blocks[-1][0]:
            v2, w2, _, e2 = blocks.pop()
            v1, w1, s1, _ = blocks.pop()
            blocks.append([(v1 * w1 + v2 * w2) / (w1 + w2), w1 + w2, s1, e2])
    xs, ys = [], []
    for v, _, a, b in blocks:
        xs.append(float(a)); ys.append(float(v))
        if b > a:
            xs.append(float(b)); ys.append(float(v))
    return {"x": xs, "y": ys}


def apply_isotonic(knots: dict, x: np.ndarray) -> np.ndarray:
    return np.interp(x, knots["x"], knots["y"])


# ---------------------------------------------------------------- model
@dataclass
class LiveModel:
    crash: CatBoostClassifier        # P(y >= Moderate)
    severe: CatBoostClassifier       # P(y >= Severe)
    iso_crash: dict
    iso_severe: dict
    qhat: float
    meta: dict

    def class_proba(self, raw: pd.DataFrame) -> np.ndarray:
        X = encode(raw)
        a = apply_isotonic(self.iso_crash, self.crash.predict_proba(X)[:, 1])
        b = apply_isotonic(self.iso_severe, self.severe.predict_proba(X)[:, 1])
        a = np.clip(a, 1e-4, 1 - 1e-4)
        b = np.clip(np.minimum(b, a), 1e-4, None)       # ordinal: P(>=Sev) <= P(>=Mod)
        return np.column_stack([1 - a, a - b, b])

    @staticmethod
    def score_of(p: np.ndarray) -> np.ndarray:
        return p @ np.array([0.0, 0.5, 1.0])

    def score(self, raw: pd.DataFrame) -> np.ndarray:
        return self.score_of(self.class_proba(raw))

    def conformal_set(self, p_row: np.ndarray) -> list[str]:
        keep = [SEVERITY_OUT[LABELS[j]] for j in range(3) if 1.0 - p_row[j] <= self.qhat]
        return keep or [SEVERITY_OUT[LABELS[int(p_row.argmax())]]]

    def factors(self, row: dict, top: int = 4) -> list[dict]:
        """Score points each measured factor adds: s(actual) - s(that factor at its
        safe setting). Same units as the 0..100 score the rider sees."""
        variants = {
            "overLimit": {"Bike_Speed": min(float(row["Bike_Speed"]), float(row["Speed_Limit"]))},
            "phone": {"Talk_While_Riding": "Never"},
            "weather": {"Weather": "Clear"},
            "wet": {"Road_condition": "Dry"},
            "dark": {"Time_of_Day": "Afternoon"},
            "traffic": {"Traffic_Density": 1},
        }
        rows = [row] + [{**row, **v} for v in variants.values()]
        s = self.score(pd.DataFrame(rows)[RAW_FEATURES])
        out = [{"id": k, "name": FACTORS[k], "impact": round(float(s[0] - s[i + 1]), 4)}
               for i, k in enumerate(variants)]
        out = [f for f in out if f["impact"] > 0.0005]
        out.sort(key=lambda f: -f["impact"])
        return out[:top]

    # ------------------------------------------------------------ io
    def save(self, art: pathlib.Path) -> None:
        art.mkdir(parents=True, exist_ok=True)
        self.crash.save_model(str(art / "crash.cbm"))
        self.severe.save_model(str(art / "severe.cbm"))
        json.dump({"crash": self.iso_crash, "severe": self.iso_severe},
                  open(art / "calibration.json", "w"))
        json.dump({**self.meta, "qhat": self.qhat}, open(art / "meta.json", "w"), indent=2)

    @classmethod
    def load(cls, art: pathlib.Path) -> "LiveModel":
        crash, severe = CatBoostClassifier(), CatBoostClassifier()
        crash.load_model(str(art / "crash.cbm"))
        severe.load_model(str(art / "severe.cbm"))
        cal = json.load(open(art / "calibration.json"))
        meta = json.load(open(art / "meta.json"))
        return cls(crash, severe, cal["crash"], cal["severe"], float(meta["qhat"]), meta)
