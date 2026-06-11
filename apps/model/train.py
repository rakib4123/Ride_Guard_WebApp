"""
Train the real RideGuard Tier-1 behavioural model from the Mendeley bike dataset,
following the published pipeline exactly (tier1_behavioral.py / calibration.py /
conformal.py), and save deployable artifacts the FastAPI service loads.

Recipe (verbatim from the repo):
  - 19 gated pre-crash features (config/feature_gate.yaml), target Accident_Severity
  - 60/20/20 train/calibration/test split, stratified, seed 0
  - CatBoost MultiClass (iterations=400, depth=6, lr=0.06, seed 0)
  - per-class isotonic calibration on the calibration split
  - APS split-conformal (alpha=0.10) on the calibration split
  - ordinal risk score s = P @ [0, 0.5, 1]

Usage:  RIDEGUARD_DATA_DIR=/path/with/MotorBike_Accident.(pkl|xlsx) python train.py
"""
from __future__ import annotations
import json, os, pathlib
import numpy as np
import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import accuracy_score, f1_score
from catboost import CatBoostClassifier, Pool

HERE = pathlib.Path(__file__).resolve().parent
ART = HERE / "artifacts"
ART.mkdir(exist_ok=True)

ALLOWED = ["Biker_Age","Biker_Occupation","Biker_Education_Level","Riding_Experience",
    "Daily_Travel_Distance","Talk_While_Riding","Smoke_While_Riding","Wearing_Helmet",
    "Motorcycle_Ownership","Valid_Driving_License","Bike_Condition","Road_Type",
    "Road_condition","Weather","Time_of_Day","Traffic_Density","Speed_Limit",
    "Bike_Speed","Biker_Alcohol"]
TARGET = "Accident_Severity"
LABELS = ["No Accident", "Moderate Accident", "Severe Accident"]
RISK_W = {"No Accident": 0.0, "Moderate Accident": 0.5, "Severe Accident": 1.0}
ALPHA = 0.10
SEED = 0

def find_data() -> pathlib.Path:
    names = ["MotorBike_Accident.pkl", "MotorBike_Accident.xlsx"]
    dirs = [os.environ.get("RIDEGUARD_DATA_DIR",""), "/mnt/user-data/uploads",
            "/home/claude/results_extract", str(HERE)]
    for d in dirs:
        if not d: continue
        for n in names:
            p = pathlib.Path(d)/n
            if p.exists(): return p
    raise FileNotFoundError(f"MotorBike_Accident.(pkl|xlsx) not found in {dirs}")

def load():
    p = find_data()
    df = pd.read_pickle(p) if p.suffix==".pkl" else pd.read_excel(p)
    df = df.loc[:, ~df.columns.str.contains("Unnamed|ENCODING", regex=True)]
    X = df[ALLOWED].copy()
    isnum = pd.api.types.is_numeric_dtype
    cat_cols = [c for c in ALLOWED if not isnum(X[c])]
    for c in cat_cols:
        X[c] = X[c].astype(object)
    y = df[TARGET].astype(str)
    return X, y, cat_cols

def onehot(idx, k):
    o = np.zeros((len(idx), k)); o[np.arange(len(idx)), idx] = 1; return o

def ece(y_oh, proba, n_bins=10):
    conf = proba.max(1); pred = proba.argmax(1); true = y_oh.argmax(1)
    correct = (pred==true).astype(float); bins = np.linspace(0,1,n_bins+1); e=0.0
    for lo,hi in zip(bins[:-1],bins[1:]):
        m=(conf>lo)&(conf<=hi)
        if m.sum(): e += m.mean()*abs(correct[m].mean()-conf[m].mean())
    return float(e)

def main():
    X, y, cat_cols = load()
    print(f"loaded {len(X)} rows, {len(cat_cols)} categorical cols")
    Xtr,Xtmp,ytr,ytmp = train_test_split(X,y,test_size=0.4,stratify=y,random_state=SEED)
    Xcal,Xte,ycal,yte = train_test_split(Xtmp,ytmp,test_size=0.5,stratify=ytmp,random_state=SEED)

    model = CatBoostClassifier(iterations=400, depth=6, learning_rate=0.06,
        loss_function="MultiClass", random_seed=SEED, verbose=False)
    model.fit(Xtr, ytr, cat_features=cat_cols)
    cls = list(model.classes_); idx = [cls.index(c) for c in LABELS]

    # per-class isotonic on calibration split
    p_cal = model.predict_proba(Xcal)[:, idx]
    ycal_oh = onehot(np.array([LABELS.index(v) for v in ycal]), len(LABELS))
    isos=[]
    for j in range(len(LABELS)):
        iso = IsotonicRegression(out_of_bounds="clip", y_min=0, y_max=1)
        iso.fit(p_cal[:, j], ycal_oh[:, j]); isos.append(iso)

    def calibrated(Xdf):
        raw = model.predict_proba(Xdf)[:, idx]
        cal = np.column_stack([isos[j].predict(raw[:, j]) for j in range(len(LABELS))])
        cal = np.clip(cal, 1e-6, None)
        return cal / cal.sum(1, keepdims=True)

    # APS split-conformal qhat on calibration split (calibrated probs)
    pc = calibrated(Xcal)
    ycal_idx = np.array([LABELS.index(v) for v in ycal])
    scores = 1.0 - pc[np.arange(len(ycal_idx)), ycal_idx]
    n = len(ycal_idx); k = min(max(int(np.ceil((n+1)*(1-ALPHA))),1), n)
    qhat = float(np.sort(scores)[k-1])

    # metrics on test
    p_te = calibrated(Xte)
    yte_idx = np.array([LABELS.index(v) for v in yte])
    yte_oh = onehot(yte_idx, len(LABELS))
    pred = np.array([LABELS[i] for i in p_te.argmax(1)])
    p_raw_te = model.predict_proba(Xte)[:, idx]
    cov = float(((1.0 - p_te[np.arange(len(yte_idx)), yte_idx]) <= qhat).mean())
    setsz = float(np.maximum(((1.0 - p_te) <= qhat).sum(1), 1).mean())
    metrics = {
        "test_accuracy": round(accuracy_score(yte, pred),4),
        "test_macro_f1": round(f1_score(yte, pred, average="macro"),4),
        "ece_uncalibrated": round(ece(yte_oh, p_raw_te),4),
        "ece_calibrated": round(ece(yte_oh, p_te),4),
        "conformal_coverage": round(cov,4),
        "conformal_avg_set_size": round(setsz,4),
        "conformal_target": 1-ALPHA,
    }

    # value domains for the UI / validation
    domains = {c: sorted(map(str, X[c].unique())) for c in cat_cols}
    numeric = [c for c in ALLOWED if c not in cat_cols]
    nranges = {c: [float(X[c].min()), float(X[c].max())] for c in numeric}

    model.save_model(str(ART/"tier1_catboost.cbm"))
    joblib.dump(isos, ART/"isotonics.joblib")
    meta = {"labels": LABELS, "risk_weights": RISK_W, "cat_cols": cat_cols,
            "numeric_cols": numeric, "feature_order": ALLOWED, "alpha": ALPHA,
            "qhat": qhat, "metrics": metrics, "domains": domains,
            "numeric_ranges": nranges, "model_version": "rideguard-tier1-2026-06"}
    json.dump(meta, open(ART/"meta.json","w"), indent=2)
    print("metrics:", json.dumps(metrics))
    print("saved artifacts to", ART)

if __name__ == "__main__":
    main()
