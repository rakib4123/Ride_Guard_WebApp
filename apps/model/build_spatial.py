"""
Build the location layer: one crash grid per region, each from that region's own
motorcycle crashes, each checked on later years it was not built from.

Regions and sources:
  dhaka  Mendeley Dhaka crash dataset (Accident_Dataset_Dhaka.xlsx), location columns only
  gb     UK STATS19 motorcyclist casualties (DfT, Open Government Licence v3.0)
  nyc    NYC Motor Vehicle Collisions involving a motorcycle/moped/scooter (NYC Open Data)

Method per region: motorcycle crash counts per grid cell, with the cell size
(250 m - 2 km) chosen per region by a check on later years: given the same map
area, which size's busiest past cells contain the most later crashes. Sparse
GPS crash records (GB, NYC) need bigger cells than Dhaka's geocoded place names,
which pile up on a few hundred points. Cell index must match cellIndex() in
packages/shared/src/spatial.ts.

Writes apps/api/data/hotspots.json.
Env: RIDEGUARD_DATA_DIR (Dhaka xlsx), UK_DATA_DIR (uk_*_<year>.csv), NYC_DATA (csv path)
"""
from __future__ import annotations

import json
import os
import pathlib

import numpy as np
import pandas as pd

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
AUDIT_RAW = ROOT / "RideGuard_Audit" / "data" / "raw"
OUT = HERE.parent / "api" / "data" / "hotspots.json"
M_PER_DEG = 111_320.0
MARGIN_M = 1_000
MAX_BLOOMS_PER_REGION = 300


def first_existing(*paths) -> pathlib.Path:
    for p in paths:
        if p and pathlib.Path(p).exists():
            return pathlib.Path(p)
    raise FileNotFoundError(f"none of {paths} exist")


# ------------------------------------------------------------------ loaders
def load_dhaka() -> pd.DataFrame:
    p = first_existing(os.environ.get("RIDEGUARD_DATA_DIR", "") and
                       pathlib.Path(os.environ["RIDEGUARD_DATA_DIR"]) / "Accident_Dataset_Dhaka.xlsx",
                       ROOT / "risk_dataset" / "Accident_Dataset_Dhaka.xlsx")
    df = pd.read_excel(p)
    moto = df["Vehicle Info"].str.contains("Motorcycle", case=False) | (df["Victim Category"] == "Motorcyclist")
    return pd.DataFrame({"lat": df.Latitude, "lon": df.Longitude, "year": df.Year})[moto]


def load_gb() -> pd.DataFrame:
    base = os.environ.get("UK_DATA_DIR", "")
    parts = []
    for year in (2022, 2023):
        col = first_existing(base and pathlib.Path(base) / f"uk_collision_{year}.csv",
                             AUDIT_RAW / f"uk_collision_{year}.csv", AUDIT_RAW / f"uk{year}" / f"uk_collision_{year}.csv")
        cas = first_existing(base and pathlib.Path(base) / f"uk_casualty_{year}.csv",
                             AUDIT_RAW / f"uk_casualty_{year}.csv", AUDIT_RAW / f"uk{year}" / f"uk_casualty_{year}.csv")
        c = pd.read_csv(col, low_memory=False, usecols=["collision_index", "latitude", "longitude"])
        k = pd.read_csv(cas, low_memory=False, usecols=["collision_index", "casualty_type"])
        ids = k[k.casualty_type.isin({2, 3, 4, 5, 23, 97})].collision_index.unique()
        c = c[c.collision_index.isin(ids)]
        parts.append(pd.DataFrame({"lat": c.latitude, "lon": c.longitude, "year": year}))
    return pd.concat(parts).dropna()


def load_nyc() -> pd.DataFrame:
    p = first_existing(os.environ.get("NYC_DATA", ""), AUDIT_RAW / "nyc_collisions.csv")
    d = pd.read_csv(p, low_memory=False, usecols=["crash_date", "latitude", "longitude",
                                                   "vehicle_type_code1", "vehicle_type_code2"])
    vt = (d.vehicle_type_code1.fillna("") + "|" + d.vehicle_type_code2.fillna("")).str.lower()
    d = d[vt.str.contains("motorcycle|motorbike|moped|scooter")]
    d = d[d.latitude.between(40.45, 40.95) & d.longitude.between(-74.30, -73.65)]
    return pd.DataFrame({"lat": d.latitude, "lon": d.longitude,
                         "year": pd.to_datetime(d.crash_date).dt.year})


REGIONS = [
    {"id": "dhaka", "name": "Dhaka", "country": "BD", "load": load_dhaka, "split": 2016,
     "credit": "Mendeley Data: Bangladesh Road Traffic Accident Dataset (Nur & Afridi, 2025)",
     "note": "crash locations are geocoded place names"},
    {"id": "gb", "name": "Great Britain", "country": "GB", "load": load_gb, "split": 2022,
     "credit": "Department for Transport, STATS19 road safety data (Open Government Licence v3.0)",
     "note": "police-reported injury collisions involving a motorcyclist"},
    {"id": "nyc", "name": "New York City", "country": "US", "load": load_nyc, "split": 2022,
     "credit": "NYC Open Data: Motor Vehicle Collisions - Crashes (NYPD)",
     "note": "police-reported collisions involving a motorcycle, moped or scooter"},
]


# ------------------------------------------------------------------ grid
def keys_for(df: pd.DataFrame, grid_m: int, lat0: float) -> pd.Series:
    i = np.floor(df.lat.to_numpy() * M_PER_DEG / grid_m).astype(int)
    j = np.floor(df.lon.to_numpy() * M_PER_DEG * np.cos(np.radians(lat0)) / grid_m).astype(int)
    return pd.Series([f"{a}_{b}" for a, b in zip(i, j)], index=df.index)


def capture_at(df: pd.DataFrame, split: int, grid_m: int, lat0: float, budget_km2: float) -> float:
    """Share of later crashes inside the busiest past cells covering `budget_km2`."""
    k = keys_for(df, grid_m, lat0)
    past = k[df.year <= split].value_counts()
    future = k[df.year > split].value_counts()
    n_cells = max(1, int(round(budget_km2 / (grid_m / 1000) ** 2)))
    chosen = past.index[:n_cells]
    return float(future.reindex(chosen, fill_value=0).sum() / future.sum())


RESOLUTIONS_M = [250, 500, 1000, 2000]


def build_region(spec: dict) -> dict:
    df = spec["load"]().dropna()
    lat0 = round(float(df.lat.mean()), 4)

    # Pick the grid size by how well past crashes locate LATER crashes, all
    # sizes given the same map area to work with: 5% of the area of the
    # 250 m cells that ever had a crash. Ratio to the area share = lift.
    footprint_km2 = keys_for(df, 250, lat0).nunique() * 0.0625
    budget_km2 = 0.05 * footprint_km2
    trials = {r: capture_at(df, spec["split"], r, lat0, budget_km2) for r in RESOLUTIONS_M}
    grid_m = max(trials, key=trials.get)
    validation = {
        "fit_years": f"{int(df.year.min())}-{spec['split']}",
        "test_years": f"{spec['split'] + 1}-{int(df.year.max())}",
        "area_budget_km2": round(budget_km2, 1),
        "capture_by_grid_m": {str(r): round(c, 3) for r, c in trials.items()},
        "chosen_grid_m": grid_m,
        "share_of_later_crashes_in_top_area": round(trials[grid_m], 3),
        "lift_vs_random_area": round(trials[grid_m] / 0.05, 2),
    }

    df["i"], df["j"] = (np.floor(df.lat.to_numpy() * M_PER_DEG / grid_m).astype(int),
                        np.floor(df.lon.to_numpy() * M_PER_DEG * np.cos(np.radians(lat0)) / grid_m).astype(int))
    df["key"] = df.i.astype(str) + "_" + df.j.astype(str)
    g = df.groupby(["i", "j"]).agg(count=("key", "size"), lat=("lat", "mean"), lon=("lon", "mean")).reset_index()
    g = g.sort_values("count", ascending=False)
    mx = float(g["count"].max())
    pad_lat = MARGIN_M / M_PER_DEG
    pad_lon = pad_lat / np.cos(np.radians(lat0))
    region = {
        "id": spec["id"], "name": spec["name"], "country": spec["country"],
        "credit": spec["credit"], "note": spec["note"],
        "method": f"motorcycle crash counts per {grid_m} m grid cell (size chosen on later years)",
        "years": f"{int(df.year.min())}-{int(df.year.max())}",
        "crashes": int(len(df)),
        "validation": validation,
        "bbox": {"minLat": round(float(df.lat.min() - pad_lat), 5), "maxLat": round(float(df.lat.max() + pad_lat), 5),
                 "minLon": round(float(df.lon.min() - pad_lon), 5), "maxLon": round(float(df.lon.max() + pad_lon), 5)},
        "gridM": grid_m, "lat0": lat0,
        "cells": [{"i": int(r.i), "j": int(r.j), "count": int(r["count"])} for _, r in g.iterrows()],
    }
    blooms = [{"lat": round(float(r.lat), 6), "lon": round(float(r.lon), 6), "count": int(r["count"]),
               "normDensity": round(float(r["count"]) / mx, 4)} for _, r in g.head(MAX_BLOOMS_PER_REGION).iterrows()]
    return region, blooms


def main() -> None:
    regions, hotspots = [], []
    for spec in REGIONS:
        r, b = build_region(spec)
        regions.append(r)
        hotspots.extend(b)
        v = r["validation"]
        print(f"{r['name']:14s} {r['crashes']:>7,} crashes | check {v['fit_years']} -> {v['test_years']} | "
              f"later crashes caught in 5% of the area, by grid size: {v['capture_by_grid_m']} | "
              f"chosen {v['chosen_grid_m']} m -> {v['share_of_later_crashes_in_top_area']:.0%} "
              f"({v['lift_vs_random_area']}x random), {len(r['cells']):,} cells")
    OUT.write_text(json.dumps({"source": "pipeline", "regions": regions, "hotspots": hotspots}, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
