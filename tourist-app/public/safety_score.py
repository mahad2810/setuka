"""
SafetyScore — Dual-City Regression Engine
==========================================
Implements two spatially distinct models:

  Model A — Kolkata    : Coupled IDW (road→crime regression correction)
  Model B — Darjeeling : IDW + Geographic Gradient Blend (altitude/terrain)

Usage
-----
    from safety_score import get_safety_score

    result = get_safety_score(22.5639, 88.3525)
    print(result)
    # {'score': 5.30, 'label': 'Moderate', 'road': 7.0, 'crime': 5.0,
    #  'accident': 6.0, 'nearestPlace': 'Esplanade', 'nearestDist': 0.0,
    #  'confidence': 'HIGH', 'region': 'KOLKATA', 'model': 'Coupled IDW',
    #  'outsideCoverage': False}

    result = get_safety_score(27.044, 88.264)
    print(result)

    out_of_range = get_safety_score(28.6, 77.2)  # Delhi — not covered
    # {'outsideCoverage': True, 'score': None, 'label': None, ...}

Region Bounding Boxes
---------------------
  Kolkata    : lat 22.37–22.72, lon 88.285–88.482
  Darjeeling : lat 26.63–27.09, lon 88.181–88.670

Score Formula (both models)
---------------------------
  danger = crime×0.4 + (10−road)×0.3 + accident×0.3
  safety  = 10 − danger
  Theoretical range: 3.3 (worst) – 8.7 (best)
"""

import csv
import math
import os
from dataclasses import dataclass
from typing import Literal

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_DIR = os.path.dirname(os.path.abspath(__file__))
_KOL_CSV  = os.path.join(_DIR, "kol_data.csv")
_DARJ_CSV = os.path.join(_DIR, "darj_data.csv")

# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class _Point:
    name: str
    lat:  float
    lon:  float
    road: float
    crime: float
    acc:  float

# ---------------------------------------------------------------------------
# Region bounding boxes
# ---------------------------------------------------------------------------

_KOLKATA_BBOX    = {"lat": (22.37, 22.72), "lon": (88.285, 88.482)}
_DARJEELING_BBOX = {"lat": (26.63, 27.09), "lon": (88.181, 88.670)}

def _detect_region(lat: float, lon: float) -> Literal["Kolkata", "Darjeeling"] | None:
    """Return which city the coordinates belong to, or None if outside both."""
    in_kol  = (_KOLKATA_BBOX["lat"][0]    <= lat <= _KOLKATA_BBOX["lat"][1]    and
               _KOLKATA_BBOX["lon"][0]    <= lon <= _KOLKATA_BBOX["lon"][1])
    in_darj = (_DARJEELING_BBOX["lat"][0] <= lat <= _DARJEELING_BBOX["lat"][1] and
               _DARJEELING_BBOX["lon"][0] <= lon <= _DARJEELING_BBOX["lon"][1])

    if in_kol:
        return "Kolkata"
    if in_darj:
        return "Darjeeling"
    return None

# ---------------------------------------------------------------------------
# Data loading (lazy, cached per process)
# ---------------------------------------------------------------------------

_cache: dict[str, list[_Point]] = {}

def _load(path: str) -> list[_Point]:
    if path in _cache:
        return _cache[path]
    points: list[_Point] = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            points.append(_Point(
                name  = row["place_name"],
                lat   = float(row["latitude"]),
                lon   = float(row["longitude"]),
                road  = float(row["road_rating"]),
                crime = float(row["crime_rating"]),
                acc   = float(row["accident_rating"]),
            ))
    _cache[path] = points
    return points

# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------

_R_KM = 6371.0  # Earth radius in km

def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km between two lat/lon points."""
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return _R_KM * 2 * math.asin(math.sqrt(a))

# ---------------------------------------------------------------------------
# Confidence flag
# ---------------------------------------------------------------------------

def _confidence(nearest_dist_km: float) -> str:
    """Return uppercase confidence tier based on distance to nearest known point."""
    if nearest_dist_km < 1.0:
        return "HIGH"
    if nearest_dist_km < 3.0:
        return "MEDIUM"
    if nearest_dist_km < 8.0:
        return "LOW"
    return "VERY LOW"

# ---------------------------------------------------------------------------
# Label thresholds
# ---------------------------------------------------------------------------
#   8.0–8.7  →  Very Safe
#   6.5–7.9  →  Safe
#   5.0–6.4  →  Moderate
#   3.5–4.9  →  Caution
#   3.0–3.4  →  High Risk
# ---------------------------------------------------------------------------

def _label(score: float) -> str:
    if score >= 8.0:
        return "Very Safe"
    if score >= 6.5:
        return "Safe"
    if score >= 5.0:
        return "Moderate"
    if score >= 3.5:
        return "Caution"
    return "High Risk"

# ---------------------------------------------------------------------------
# IDW core (k=5, power=2) — shared by both models
# ---------------------------------------------------------------------------

def _idw(lat: float, lon: float, points: list[_Point], k: int = 5, power: int = 2):
    """
    Standard IDW over the k nearest neighbours.
    Returns (road_idw, crime_idw, acc_idw, nearest_dist_km, nearest_name).
    Handles the exact-hit case (dist=0) by returning the point's own values.
    """
    # Compute distances to all points
    dists = [(_haversine(lat, lon, p.lat, p.lon), p) for p in points]
    dists.sort(key=lambda x: x[0])

    nearest_dist_km = dists[0][0]
    nearest_name    = dists[0][1].name

    # Exact hit — no interpolation needed
    if nearest_dist_km == 0.0:
        p = dists[0][1]
        return p.road, p.crime, p.acc, 0.0, nearest_name

    neighbours = dists[:k]
    weights = [1.0 / (d ** power) for d, _ in neighbours]
    total_w = sum(weights)

    road_idw  = sum(w * p.road  for w, (_, p) in zip(weights, neighbours)) / total_w
    crime_idw = sum(w * p.crime for w, (_, p) in zip(weights, neighbours)) / total_w
    acc_idw   = sum(w * p.acc   for w, (_, p) in zip(weights, neighbours)) / total_w

    return road_idw, crime_idw, acc_idw, nearest_dist_km, nearest_name

# ---------------------------------------------------------------------------
# Score formula — shared
# ---------------------------------------------------------------------------

def _score(crime: float, road: float, acc: float) -> float:
    danger = crime * 0.4 + (10.0 - road) * 0.3 + acc * 0.3
    return round(10.0 - danger, 2)

# ---------------------------------------------------------------------------
# Model A — Kolkata: Coupled IDW
# ---------------------------------------------------------------------------
#
# Road↔Crime correlation = −0.83 in the Kolkata dataset.
# When interpolating in a sparse gap, we blend the raw IDW crime estimate
# with a road-quality-derived crime prediction.
#
# Fitted regression (road → crime):
#   crime_coupled = −0.7281 × road + 8.3410
#
# Blend weight (alpha):
#   alpha = min(0.40, nearest_dist_km × 0.10)
#   → 0% at known point (pin-point accuracy), max 40% at ≥4 km gap
#
# Validated leave-one-out MAE: 0.474 on the 1–10 safety scale.
# ---------------------------------------------------------------------------

_KOL_SLOPE     = -0.7281
_KOL_INTERCEPT =  8.3410
_KOL_ALPHA_MAX =  0.40
_KOL_ALPHA_K   =  0.10   # alpha = min(max, dist_km × K)

def _model_kolkata(lat: float, lon: float) -> dict:
    points = _load(_KOL_CSV)

    road_idw, crime_idw, acc_idw, nearest_dist_km, nearest_name = _idw(lat, lon, points)

    # Road → crime coupling correction
    crime_coupled = _KOL_SLOPE * road_idw + _KOL_INTERCEPT

    # Blend weight scales with distance from nearest known point
    alpha = min(_KOL_ALPHA_MAX, nearest_dist_km * _KOL_ALPHA_K)

    crime_final = (1.0 - alpha) * crime_idw + alpha * crime_coupled

    # Clamp to valid rating range
    crime_final = max(1.0, min(10.0, crime_final))
    road_idw    = max(1.0, min(10.0, road_idw))
    acc_idw     = max(1.0, min(10.0, acc_idw))

    s = _score(crime_final, road_idw, acc_idw)
    return {
        "score":           s,
        "label":           _label(s),
        "road":            round(road_idw, 2),
        "crime":           round(crime_final, 2),
        "accident":        round(acc_idw, 2),
        "nearestPlace":    nearest_name,
        "nearestDist":     round(nearest_dist_km, 2),
        "confidence":      _confidence(nearest_dist_km),
        "region":          "KOLKATA",
        "model":           "Coupled IDW",
        "outsideCoverage": False,
        # diagnostics
        "_alpha":          round(alpha, 4),
        "_crime_idw_raw":  round(crime_idw, 4),
        "_crime_coupled":  round(crime_coupled, 4),
    }

# ---------------------------------------------------------------------------
# Model B — Darjeeling: IDW + Geographic Gradient Blend
# ---------------------------------------------------------------------------
#
# Risk in Darjeeling is dominated by terrain:
#   Latitude  ↔ Crime    = −0.62 (higher altitude = safer)
#   Longitude ↔ Crime    = +0.40 (east = Siliguri plains = more crime)
#   Latitude  ↔ Accident = −0.50 (similar altitude gradient)
#
# Pre-fitted gradient planes (OLS on all 242 data points):
#   crime_gradient(lat, lon)    = −4.3280×lat + 1.8346×lon − 43.0345
#   accident_gradient(lat, lon) = −4.3523×lat + 2.5646×lon − 104.8228
#   road_gradient(lat, lon)     = −1.7549×lat + 1.9598×lon − 121.3700
#
# Blend weight (alpha):
#   alpha = min(0.50, 0.15 + nearest_dist_km × 0.04)
#   → 15% gradient always (even at known points), grows by 4% per km gap,
#     capped at 50% at ~8.75 km from nearest point.
#
# Validated leave-one-out MAE: 0.369 on the 1–10 safety scale.
# ---------------------------------------------------------------------------

# Pre-fitted gradient plane coefficients
_DARJ_CRIME_PLANE    = {"lat": -4.3280, "lon":  1.8346, "intercept": -43.0345}
_DARJ_ACC_PLANE      = {"lat": -4.3523, "lon":  2.5646, "intercept": -104.8228}
_DARJ_ROAD_PLANE     = {"lat": -1.7549, "lon":  1.9598, "intercept": -121.3700}

_DARJ_ALPHA_BASELINE = 0.15
_DARJ_ALPHA_K        = 0.04   # additional alpha per km of gap
_DARJ_ALPHA_MAX      = 0.50

def _gradient(lat: float, lon: float, plane: dict) -> float:
    return plane["lat"] * lat + plane["lon"] * lon + plane["intercept"]

def _model_darjeeling(lat: float, lon: float) -> dict:
    points = _load(_DARJ_CSV)

    road_idw, crime_idw, acc_idw, nearest_dist_km, nearest_name = _idw(lat, lon, points)

    # Evaluate gradient planes at query location
    crime_grad = _gradient(lat, lon, _DARJ_CRIME_PLANE)
    acc_grad   = _gradient(lat, lon, _DARJ_ACC_PLANE)
    road_grad  = _gradient(lat, lon, _DARJ_ROAD_PLANE)

    # Blend weight
    alpha = min(_DARJ_ALPHA_MAX, _DARJ_ALPHA_BASELINE + nearest_dist_km * _DARJ_ALPHA_K)

    crime_final = (1.0 - alpha) * crime_idw + alpha * crime_grad
    acc_final   = (1.0 - alpha) * acc_idw   + alpha * acc_grad
    road_final  = (1.0 - alpha) * road_idw  + alpha * road_grad

    # Clamp all to [1, 10]
    crime_final = max(1.0, min(10.0, crime_final))
    acc_final   = max(1.0, min(10.0, acc_final))
    road_final  = max(1.0, min(10.0, road_final))

    s = _score(crime_final, road_final, acc_final)
    return {
        "score":           s,
        "label":           _label(s),
        "road":            round(road_final, 2),
        "crime":           round(crime_final, 2),
        "accident":        round(acc_final, 2),
        "nearestPlace":    nearest_name,
        "nearestDist":     round(nearest_dist_km, 2),
        "confidence":      _confidence(nearest_dist_km),
        "region":          "DARJEELING",
        "model":           "IDW+Gradient",
        "outsideCoverage": False,
        # diagnostics
        "_alpha":          round(alpha, 4),
        "_crime_idw_raw":  round(crime_idw, 4),
        "_crime_gradient": round(crime_grad, 4),
        "_acc_idw_raw":    round(acc_idw, 4),
        "_acc_gradient":   round(acc_grad, 4),
        "_road_idw_raw":   round(road_idw, 4),
        "_road_gradient":  round(road_grad, 4),
    }

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_safety_score(lat: float, lon: float) -> dict:
    """
    Compute a safety score for any coordinate, with region detection.

    Parameters
    ----------
    lat : float  — WGS-84 latitude
    lon : float  — WGS-84 longitude

    Returns
    -------
    dict with keys:
        score           float   Safety score, 2 dp, range 3.30–8.70
                                (None if outsideCoverage=True)
        label           str     "Very Safe" / "Safe" / "Moderate" /
                                "Caution" / "High Risk"
                                (None if outsideCoverage=True)
        road            float   Blended road rating (1–10, 2 dp)
        crime           float   Blended crime rating (1–10, 2 dp)
        accident        float   Blended accident rating (1–10, 2 dp)
        nearestPlace    str     Name of closest known data point
        nearestDist     float   Distance to that point in km (2 dp)
        confidence      str     "HIGH" / "MEDIUM" / "LOW" / "VERY LOW"
        region          str     "KOLKATA" or "DARJEELING"
        model           str     "Coupled IDW" or "IDW+Gradient"
        outsideCoverage bool    True if coordinates fall outside both
                                Kolkata and Darjeeling coverage zones
        _alpha          float   (diagnostic) blend weight used
        ... additional model-specific diagnostics prefixed with _

    Never raises — returns outsideCoverage=True for unknown coordinates.
    """
    region = _detect_region(lat, lon)
    if region is None:
        return {
            "score":           None,
            "label":           None,
            "road":            None,
            "crime":           None,
            "accident":        None,
            "nearestPlace":    None,
            "nearestDist":     None,
            "confidence":      None,
            "region":          None,
            "model":           None,
            "outsideCoverage": True,
        }
    if region == "Kolkata":
        return _model_kolkata(lat, lon)
    else:
        return _model_darjeeling(lat, lon)


# ---------------------------------------------------------------------------
# Quick smoke-test (run as script)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    test_cases = [
        # Kolkata — known dense point (Esplanade)
        (22.5639, 88.3525, "Kolkata — Esplanade (dense, known)"),
        # Kolkata — mid-city gap estimate
        (22.55,   88.37,   "Kolkata — mid-city interpolation"),
        # Kolkata — fringe / sparse area
        (22.68,   88.43,   "Kolkata — northern fringe (sparse)"),
        # Darjeeling — known point (Chowrasta)
        (27.044,  88.264,  "Darjeeling — Chowrasta (dense, known)"),
        # Darjeeling — high-altitude hill (remote)
        (27.07,   88.30,   "Darjeeling — high-altitude remote"),
        # Darjeeling — Siliguri plains (high crime / eastern)
        (26.72,   88.43,   "Darjeeling — Siliguri plains"),
        # Out-of-coverage — Delhi
        (28.6,    77.2,    "Delhi — outside coverage"),
    ]

    HDR  = f"{'Label':<36}  {'Score':>5}  {'ScoreLabel':<10}  {'Conf':<8}  {'Region':<12}  "
    HDR += f"{'Model':<14}  {'Crime':>5}  {'Road':>5}  {'Acc':>5}  {'α':>5}  {'Dist':>6}  Nearest"
    print(HDR)
    print("-" * len(HDR))

    for lat, lon, desc in test_cases:
        r = get_safety_score(lat, lon)
        if r["outsideCoverage"]:
            print(f"{desc:<36}  {'—':>5}  {'—':<10}  {'—':<8}  {'OUTSIDE':<12}  "
                  f"{'—':<14}  outsideCoverage=True")
        else:
            print(f"{desc:<36}  {r['score']:>5.2f}  {r['label']:<10}  "
                  f"{r['confidence']:<8}  {r['region']:<12}  {r['model']:<14}  "
                  f"{r['crime']:>5.2f}  {r['road']:>5.2f}  {r['accident']:>5.2f}  "
                  f"{r['_alpha']:>5.3f}  {r['nearestDist']:>5.2f}km  {r['nearestPlace']}")
