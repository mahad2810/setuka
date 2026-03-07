"""
Isolation Forest Anomaly Detection Pipeline for Tourist GPS Data.

Pipeline:
  1. Load planned routes (POI stops + road geometry) & actual GPS traces
  2. Engineer features per GPS point:
     - Route deviation (distance to planned path)
     - Speed & acceleration
     - Bearing change
     - Dwell-time ratio
     - Rolling-window aggregates
  3. Train Isolation Forest (unsupervised)
  4. Score each GPS point as normal / anomaly
  5. Evaluate against ground-truth anomaly_log.csv
  6. Output results + per-tourist report

Usage:
    uv run python detect_anomalies.py
"""

import math
import csv
import os
from collections import defaultdict
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

# ──────────────────────────────────────────────
# 1. DATA LOADING
# ──────────────────────────────────────────────

def load_actual_gps(filepath="data/actual_gps.csv"):
    """Load actual GPS traces into a DataFrame."""
    df = pd.read_csv(filepath)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    return df


def load_planned_routes(filepath="data/planned_routes.csv"):
    """Load planned route POI stops."""
    df = pd.read_csv(filepath)
    return df


def load_planned_paths(filepath="data/planned_route_paths.csv"):
    """Load detailed road geometry for planned routes."""
    df = pd.read_csv(filepath)
    return df


def load_anomaly_log(filepath="data/anomaly_log.csv"):
    """Load ground-truth anomaly log."""
    df = pd.read_csv(filepath)
    df["start_time"] = pd.to_datetime(df["start_time"])
    df["end_time"] = pd.to_datetime(df["end_time"])
    return df


# ──────────────────────────────────────────────
# 2. HELPER FUNCTIONS
# ──────────────────────────────────────────────

def haversine(lat1, lon1, lat2, lon2):
    """Distance in meters between two points."""
    R = 6371000
    phi1, phi2 = np.radians(lat1), np.radians(lat2)
    dphi = np.radians(lat2 - lat1)
    dlam = np.radians(lon2 - lon1)
    a = np.sin(dphi / 2) ** 2 + np.cos(phi1) * np.cos(phi2) * np.sin(dlam / 2) ** 2
    return R * 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))


def bearing(lat1, lon1, lat2, lon2):
    """Bearing in degrees from point 1 to point 2."""
    lat1, lon1 = np.radians(lat1), np.radians(lon1)
    lat2, lon2 = np.radians(lat2), np.radians(lon2)
    dlon = lon2 - lon1
    x = np.sin(dlon) * np.cos(lat2)
    y = np.cos(lat1) * np.sin(lat2) - np.sin(lat1) * np.cos(lat2) * np.cos(dlon)
    return np.degrees(np.arctan2(x, y)) % 360


def min_distance_to_path(lat, lon, path_lats, path_lons):
    """Minimum distance from a point to any point on a path (in meters)."""
    if len(path_lats) == 0:
        return 99999.0
    distances = haversine(lat, lon, path_lats, path_lons)
    return np.min(distances)


# ──────────────────────────────────────────────
# 3. FEATURE ENGINEERING (v2 — improved)
# ──────────────────────────────────────────────

def build_schedule_lookup(planned_routes_df, tourist_id):
    """
    Build a minute-by-minute schedule for a tourist.
    Returns a dict: timestamp → { phase, poi_name, planned_departure, planned_dwell }

    FIX #1: This lets us know EXACTLY what the tourist should be doing at
    every minute, so we can detect dwell overstays by computing
    "minutes past planned departure" — a feature the old code lacked.
    """
    plan = planned_routes_df[planned_routes_df["tourist_id"] == tourist_id].sort_values("stop_order")
    schedule = {}  # timestamp_minute → info dict

    rows = plan.to_dict("records")
    for i, row in enumerate(rows):
        arrival = pd.Timestamp(row["planned_arrival"])
        departure = pd.Timestamp(row["planned_departure"])
        dwell_min = int(row["planned_dwell_minutes"])

        # Mark dwell phase
        for m in range(dwell_min):
            ts = arrival + pd.Timedelta(minutes=m)
            schedule[ts] = {
                "phase": "dwell",
                "poi_name": row["poi_name"],
                "poi_lat": row["poi_lat"],
                "poi_lon": row["poi_lon"],
                "planned_departure": departure,
                "planned_dwell": dwell_min,
            }

        # Mark transit phase (to next stop)
        if i < len(rows) - 1:
            transit_min = int(row["transit_minutes_to_next"])
            for m in range(transit_min):
                ts = departure + pd.Timedelta(minutes=m)
                schedule[ts] = {
                    "phase": "transit",
                    "poi_name": None,
                    "poi_lat": None,
                    "poi_lon": None,
                    "planned_departure": departure,
                    "planned_dwell": 0,
                    "transport_mode": row["transport_to_next"],
                }

    return schedule


def engineer_features(gps_df, planned_routes_df, planned_paths_df):
    """
    Compute per-GPS-point features for Isolation Forest.

    v2 IMPROVEMENTS:

    FIX #1 — Schedule-aware dwell features (solves low dwell overstay recall):
      - time_past_planned_departure:  minutes past when tourist should have left
      - dwell_excess_minutes:         max(0, actual_dwell - planned_dwell)
      - should_be_in_transit:         1 if schedule says transit but tourist is stationary
      - phase_mismatch:              1 if actual behavior doesn't match planned phase

    FIX #2 — Route deviation normalization (reduces false positives):
      - deviation_clipped:           deviation set to 0 if < 50m (GPS noise floor)
      - deviation_z_score:           per-tourist z-score of deviation
      - Longer rolling windows (10-min) for smoother signals
    """
    print("   ⚙️  Computing features per GPS point (v2 — improved)...")

    all_features = []
    tourist_ids = gps_df["tourist_id"].unique()

    for tid in sorted(tourist_ids):
        tourist_gps = gps_df[gps_df["tourist_id"] == tid].copy().reset_index(drop=True)
        tourist_plan = planned_routes_df[planned_routes_df["tourist_id"] == tid]
        tourist_paths = planned_paths_df[planned_paths_df["tourist_id"] == tid]

        # Pre-extract planned path coordinates
        path_lats = tourist_paths["latitude"].values.astype(float)
        path_lons = tourist_paths["longitude"].values.astype(float)

        # Pre-extract POI coordinates
        poi_lats = tourist_plan["poi_lat"].values.astype(float)
        poi_lons = tourist_plan["poi_lon"].values.astype(float)
        poi_dwells = tourist_plan["planned_dwell_minutes"].values.astype(float)

        # ── FIX #1: Build schedule lookup ──
        schedule = build_schedule_lookup(planned_routes_df, tid)

        n = len(tourist_gps)
        lats = tourist_gps["latitude"].values
        lons = tourist_gps["longitude"].values
        timestamps = tourist_gps["timestamp"].values

        # ── Feature arrays ──
        dist_to_route = np.zeros(n)
        dist_to_poi = np.zeros(n)
        nearest_poi_dwell = np.zeros(n)
        speed = np.zeros(n)
        acceleration = np.zeros(n)
        bearings = np.zeros(n)
        bearing_change = np.zeros(n)

        # FIX #1: Schedule-aware arrays
        time_past_departure = np.zeros(n)     # How many min past planned departure
        dwell_excess_minutes = np.zeros(n)    # max(0, actual - planned) dwell
        should_be_in_transit = np.zeros(n)    # 1 if should be moving but isn't
        phase_mismatch = np.zeros(n)          # 1 if behavior ≠ planned phase

        # Track actual dwell at each POI
        current_poi_name = None
        current_poi_dwell_count = 0

        for i in range(n):
            # Distance to planned route path
            dist_to_route[i] = min_distance_to_path(lats[i], lons[i], path_lats, path_lons)

            # Distance to nearest POI
            poi_distances = haversine(lats[i], lons[i], poi_lats, poi_lons)
            nearest_idx = np.argmin(poi_distances)
            dist_to_poi[i] = poi_distances[nearest_idx]
            nearest_poi_dwell[i] = poi_dwells[nearest_idx]

            # Speed (m/min)
            if i > 0:
                d = haversine(lats[i - 1], lons[i - 1], lats[i], lons[i])
                speed[i] = d
                bearings[i] = bearing(lats[i - 1], lons[i - 1], lats[i], lons[i])

            # Acceleration & bearing change
            if i > 1:
                acceleration[i] = speed[i] - speed[i - 1]
                bc = abs(bearings[i] - bearings[i - 1])
                if bc > 180:
                    bc = 360 - bc
                bearing_change[i] = bc

            # ── FIX #1: Schedule-aware features ──
            ts = pd.Timestamp(timestamps[i])
            sched = schedule.get(ts)

            near_any_poi = dist_to_poi[i] < 100  # Within 100m of a POI
            is_moving = speed[i] > 5              # Moving > 5 m/min

            if sched:
                planned_dep = sched["planned_departure"]
                planned_phase = sched["phase"]

                # Time past planned departure
                minutes_past = (ts - planned_dep).total_seconds() / 60
                time_past_departure[i] = max(0, minutes_past)

                # Phase mismatch:
                #   Schedule says "transit" but tourist is near a POI and stationary
                #   Schedule says "dwell" but tourist is far from POI and moving
                if planned_phase == "transit" and near_any_poi and not is_moving:
                    should_be_in_transit[i] = 1
                    phase_mismatch[i] = 1
                elif planned_phase == "dwell" and not near_any_poi and is_moving:
                    phase_mismatch[i] = 1
            else:
                # Timestamp is BEYOND the entire plan (tourist is past schedule)
                # This itself is a strong signal — they're still out when plan is done
                if len(schedule) > 0:
                    last_planned_time = max(schedule.keys())
                    minutes_over = (ts - last_planned_time).total_seconds() / 60
                    time_past_departure[i] = max(0, minutes_over)

            # Track actual dwell duration at current POI
            if near_any_poi:
                nearest_poi = tourist_plan.iloc[nearest_idx]["poi_name"]
                if nearest_poi == current_poi_name:
                    current_poi_dwell_count += 1
                else:
                    current_poi_name = nearest_poi
                    current_poi_dwell_count = 1

                planned_d = nearest_poi_dwell[i]
                if planned_d > 0:
                    dwell_excess_minutes[i] = max(0, current_poi_dwell_count - planned_d)
            else:
                current_poi_name = None
                current_poi_dwell_count = 0

        # ── Basic derived features ──
        is_stationary = (speed < 5).astype(float)

        stationary_streak = np.zeros(n)
        for i in range(n):
            if is_stationary[i]:
                stationary_streak[i] = stationary_streak[i - 1] + 1 if i > 0 else 1

        # Dwell ratio (as before)
        near_poi_streak = np.zeros(n)
        for i in range(n):
            if dist_to_poi[i] < 100:
                near_poi_streak[i] = near_poi_streak[i - 1] + 1 if i > 0 else 1

        dwell_ratio = np.where(
            nearest_poi_dwell > 0,
            near_poi_streak / nearest_poi_dwell,
            0
        )

        # ── FIX #2: Route deviation normalization ──
        GPS_NOISE_FLOOR = 50  # meters — below this, treat as zero deviation

        # Clip small deviations (GPS noise)
        deviation_clipped = np.where(dist_to_route > GPS_NOISE_FLOOR, dist_to_route, 0.0)

        # Per-tourist z-score of deviation (normalized)
        dev_mean = dist_to_route.mean()
        dev_std = dist_to_route.std()
        if dev_std > 0:
            deviation_z_score = (dist_to_route - dev_mean) / dev_std
        else:
            deviation_z_score = np.zeros(n)

        # ── Rolling window features (longer windows for stability) ──
        speed_series = pd.Series(speed)
        dev_clipped_series = pd.Series(deviation_clipped)

        speed_rolling_mean = speed_series.rolling(window=5, min_periods=1).mean().values
        speed_rolling_std = speed_series.rolling(window=5, min_periods=1).std().fillna(0).values
        deviation_rolling_mean = dev_clipped_series.rolling(window=10, min_periods=1).mean().values
        deviation_rolling_max = dev_clipped_series.rolling(window=15, min_periods=1).max().values

        hour_of_day = tourist_gps["timestamp"].dt.hour.values.astype(float)

        # ── Build feature DataFrame ──
        features = pd.DataFrame({
            "tourist_id": tourist_gps["tourist_id"].values,
            "timestamp": tourist_gps["timestamp"].values,
            "latitude": lats,
            "longitude": lons,
            "ground_truth": tourist_gps["status"].values,
            # ── FEATURES for Isolation Forest ──
            # Route deviation (FIX #2: clipped + z-scored)
            "deviation_clipped": deviation_clipped,
            "deviation_z_score": deviation_z_score,
            "dist_to_nearest_poi": dist_to_poi,
            # Movement
            "speed": speed,
            "acceleration": acceleration,
            "bearing_change": bearing_change,
            "is_stationary": is_stationary,
            "stationary_streak": stationary_streak,
            # Dwell (original)
            "dwell_ratio": dwell_ratio,
            # Dwell (FIX #1: schedule-aware)
            "time_past_departure": time_past_departure,
            "dwell_excess_minutes": dwell_excess_minutes,
            "should_be_in_transit": should_be_in_transit,
            "phase_mismatch": phase_mismatch,
            # Rolling
            "speed_rolling_mean_5": speed_rolling_mean,
            "speed_rolling_std_5": speed_rolling_std,
            "deviation_rolling_mean_10": deviation_rolling_mean,
            "deviation_rolling_max_15": deviation_rolling_max,
            "hour_of_day": hour_of_day,
            # Keep raw for analysis (not used as IF feature)
            "_raw_dist_to_route": dist_to_route,
        })

        all_features.append(features)
        print(f"      {tid}: {n} pts | "
              f"avg dev: {dist_to_route.mean():.0f}m (clipped: {deviation_clipped.mean():.0f}m) | "
              f"max dwell_excess: {dwell_excess_minutes.max():.0f} min")

    return pd.concat(all_features, ignore_index=True)


# ──────────────────────────────────────────────
# 4. ISOLATION FOREST TRAINING & DETECTION
# ──────────────────────────────────────────────

FEATURE_COLS = [
    # FIX #2: Route deviation (normalized, noise-filtered)
    "deviation_clipped",          # 0 if < 50m, otherwise raw distance
    "deviation_z_score",          # Per-tourist normalized deviation
    "dist_to_nearest_poi",
    # Movement
    "speed",
    "acceleration",
    "bearing_change",
    "is_stationary",
    "stationary_streak",
    # FIX #1: Schedule-aware dwell features
    "dwell_ratio",
    "time_past_departure",        # Minutes past planned departure ⭐ KEY
    "dwell_excess_minutes",       # Extra minutes at a POI ⭐ KEY
    "should_be_in_transit",       # Should be moving but isn't
    "phase_mismatch",             # Behavior ≠ planned phase
    # Rolling window (FIX #2: wider windows for stability)
    "speed_rolling_mean_5",
    "speed_rolling_std_5",
    "deviation_rolling_mean_10",  # 10-min window (was 5)
    "deviation_rolling_max_15",   # 15-min window (was 10)
    "hour_of_day",
]


def train_isolation_forest(features_df, contamination=0.08):
    """
    Train Isolation Forest and score each GPS point.
    
    contamination: expected fraction of anomalies (~8% based on our injected anomalies)
    """
    print(f"\n🌲 Training Isolation Forest...")
    print(f"   Features: {len(FEATURE_COLS)}")
    print(f"   Data points: {len(features_df)}")
    print(f"   Contamination: {contamination}")

    X = features_df[FEATURE_COLS].values

    # Standardize features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Train Isolation Forest
    clf = IsolationForest(
        n_estimators=200,         # More trees = more robust
        max_samples="auto",
        contamination=contamination,
        max_features=1.0,
        random_state=42,
        n_jobs=-1,                # Use all CPU cores
    )
    clf.fit(X_scaled)

    # Predict: 1 = normal, -1 = anomaly
    predictions = clf.predict(X_scaled)

    # Anomaly scores (lower = more anomalous)
    scores = clf.decision_function(X_scaled)

    features_df = features_df.copy()
    features_df["if_prediction"] = predictions
    features_df["if_anomaly_score"] = scores
    features_df["is_if_anomaly"] = (predictions == -1).astype(int)

    n_anomalies = (predictions == -1).sum()
    print(f"   Anomalies detected: {n_anomalies} / {len(features_df)} "
          f"({100 * n_anomalies / len(features_df):.1f}%)")

    return features_df, clf, scaler


# ──────────────────────────────────────────────
# 5. RULE-BASED POST-FILTERING (Hybrid Layer)
# ──────────────────────────────────────────────

def apply_rule_based_filter(df):
    """
    Apply domain-specific rules AFTER Isolation Forest to:
      A) PROMOTE missed anomalies (increase recall)
      B) SUPPRESS false positives (increase precision)
      C) PERSISTENCE filter (reduce noise)

    This hybrid approach combines IF's unsupervised pattern detection
    with hard domain rules that encode physical impossibilities.
    """
    df = df.copy()
    df["is_hybrid_anomaly"] = df["is_if_anomaly"].copy()
    df["rule_applied"] = "none"  # Track which rule fired

    promoted = 0
    suppressed = 0

    # ══════════════════════════════════════════════
    # A) PROMOTION RULES — Catch what IF missed
    # ══════════════════════════════════════════════

    # Rule 1: Dwell Overstay — if excess > 15 min, it's definitely anomalous
    mask_dwell = (
        (df["is_hybrid_anomaly"] == 0) &
        (df["dwell_excess_minutes"] > 15)
    )
    df.loc[mask_dwell, "is_hybrid_anomaly"] = 1
    df.loc[mask_dwell, "rule_applied"] = "promote:dwell_excess>15min"
    promoted += mask_dwell.sum()

    # Rule 2: Impossible Speed — > 1500 m/min (~90 km/h in mountains = impossible)
    mask_speed = (
        (df["is_hybrid_anomaly"] == 0) &
        (df["speed"] > 1500)
    )
    df.loc[mask_speed, "is_hybrid_anomaly"] = 1
    df.loc[mask_speed, "rule_applied"] = "promote:speed>1500m/min"
    promoted += mask_speed.sum()

    # Rule 3: Severe Route Deviation — requires BOTH high z-score AND high absolute
    # This prevents false flags on normal tourists who simply have a different OSRM path.
    # z-score > 2.5 means "unusual even for THIS tourist" + > 500m absolute distance
    mask_deviation = (
        (df["is_hybrid_anomaly"] == 0) &
        (df["deviation_z_score"] > 2.5) &
        (df["deviation_clipped"] > 500) &
        (df["deviation_rolling_mean_10"] > 400)
    )
    df.loc[mask_deviation, "is_hybrid_anomaly"] = 1
    df.loc[mask_deviation, "rule_applied"] = "promote:deviation_zscore+absolute"
    promoted += mask_deviation.sum()

    # Rule 4: Phase Mismatch — schedule says transit but tourist is stationary
    mask_phase = (
        (df["is_hybrid_anomaly"] == 0) &
        (df["should_be_in_transit"] == 1) &
        (df["stationary_streak"] > 10)  # Stationary for 10+ consecutive min
    )
    df.loc[mask_phase, "is_hybrid_anomaly"] = 1
    df.loc[mask_phase, "rule_applied"] = "promote:phase_mismatch+stationary"
    promoted += mask_phase.sum()

    # ══════════════════════════════════════════════
    # B) SUPPRESSION RULES — Remove false positives
    # ══════════════════════════════════════════════

    # Rule 5: Low-signal suppression — IF flagged it, but ALL signals are mild
    # If deviation is small, speed is normal, no dwell excess → likely GPS noise
    mask_suppress = (
        (df["is_hybrid_anomaly"] == 1) &
        (df["rule_applied"] == "none") &  # Only suppress IF flags, not rule promotions
        (df["deviation_clipped"] < 150) &    # Close to planned route
        (df["speed"] < 300) &                # Normal speed
        (df["dwell_excess_minutes"] < 5) &   # Not overstaying
        (df["phase_mismatch"] == 0) &        # Correct phase
        (df["deviation_z_score"] < 1.5)      # Not unusual for this tourist
    )
    df.loc[mask_suppress, "is_hybrid_anomaly"] = 0
    df.loc[mask_suppress, "rule_applied"] = "suppress:low_signal"
    suppressed += mask_suppress.sum()

    # Rule 6: Borderline suppression — IF barely flagged it AND no strong indicator
    mask_borderline = (
        (df["is_hybrid_anomaly"] == 1) &
        (df["rule_applied"] == "none") &
        (df["if_anomaly_score"] > -0.05) &   # IF score barely below threshold
        (df["dwell_excess_minutes"] < 10) &
        (df["deviation_z_score"] < 2.0)
    )
    df.loc[mask_borderline, "is_hybrid_anomaly"] = 0
    df.loc[mask_borderline, "rule_applied"] = "suppress:borderline"
    suppressed += mask_borderline.sum()

    # ══════════════════════════════════════════════
    # C) PERSISTENCE FILTER — Remove isolated noise
    # ══════════════════════════════════════════════
    # Require 3+ consecutive anomaly points (per tourist)
    # Isolated single-point flags are likely noise

    persistence_suppressed = 0
    for tid in df["tourist_id"].unique():
        tmask = df["tourist_id"] == tid
        indices = df.index[tmask]
        anomaly_flags = df.loc[indices, "is_hybrid_anomaly"].values.copy()

        # Find runs of consecutive anomalies
        n = len(anomaly_flags)
        filtered = anomaly_flags.copy()

        i = 0
        while i < n:
            if anomaly_flags[i] == 1:
                # Find the run length
                j = i
                while j < n and anomaly_flags[j] == 1:
                    j += 1
                run_length = j - i

                # Suppress runs shorter than 3 points
                if run_length < 3:
                    filtered[i:j] = 0
                    persistence_suppressed += run_length

                i = j
            else:
                i += 1

        df.loc[indices, "is_hybrid_anomaly"] = filtered
        # Mark suppressed points
        newly_suppressed = (anomaly_flags == 1) & (filtered == 0)
        suppress_indices = indices[newly_suppressed]
        df.loc[suppress_indices, "rule_applied"] = "suppress:persistence<3"

    suppressed += persistence_suppressed

    # ── Summary ──
    total_hybrid = df["is_hybrid_anomaly"].sum()
    print(f"\n📏 RULE-BASED POST-FILTERING")
    print(f"   Promoted (missed → flagged):   +{promoted} points")
    print(f"   Suppressed (false → removed):  -{suppressed} points")
    print(f"   IF-only anomalies:             {df['is_if_anomaly'].sum()}")
    print(f"   Hybrid anomalies (IF + Rules): {total_hybrid}")

    # Breakdown by rule
    rule_counts = df[df["rule_applied"] != "none"]["rule_applied"].value_counts()
    if len(rule_counts) > 0:
        print(f"\n   Rule breakdown:")
        for rule, count in rule_counts.items():
            print(f"     {rule}: {count} points")

    return df


# ──────────────────────────────────────────────
# 6. EVALUATION AGAINST GROUND TRUTH
# ──────────────────────────────────────────────

def evaluate(results_df, prediction_col="is_if_anomaly", label="Isolation Forest"):
    """
    Compare predictions against ground truth.
    prediction_col: which column to evaluate (is_if_anomaly or is_hybrid_anomaly)
    """
    print(f"\n" + "=" * 60)
    print(f"📊 EVALUATION: {label} vs Ground Truth")
    print("=" * 60)

    # Ground truth
    results_df["is_true_anomaly"] = results_df["ground_truth"].str.startswith("ANOMALY").astype(int)

    pred = results_df[prediction_col]
    true = results_df["is_true_anomaly"]

    true_pos = ((pred == 1) & (true == 1)).sum()
    false_pos = ((pred == 1) & (true == 0)).sum()
    true_neg = ((pred == 0) & (true == 0)).sum()
    false_neg = ((pred == 0) & (true == 1)).sum()

    total = len(results_df)
    total_true = true.sum()
    total_pred = pred.sum()

    precision = true_pos / max(true_pos + false_pos, 1)
    recall = true_pos / max(true_pos + false_neg, 1)
    f1 = 2 * precision * recall / max(precision + recall, 1e-10)
    accuracy = (true_pos + true_neg) / total

    print(f"\n  Total GPS points:        {total}")
    print(f"  True anomaly points:     {total_true} ({100 * total_true / total:.1f}%)")
    print(f"  {label} anomalies:  {total_pred} ({100 * total_pred / total:.1f}%)")

    print(f"\n  ┌──────────────────────────────────────┐")
    print(f"  │        CONFUSION MATRIX               │")
    print(f"  ├──────────────┬───────────┬────────────┤")
    print(f"  │              │ Predicted │ Predicted  │")
    print(f"  │              │  Normal   │  Anomaly   │")
    print(f"  ├──────────────┼───────────┼────────────┤")
    print(f"  │ True Normal  │  {true_neg:>5}    │  {false_pos:>5}     │")
    print(f"  │ True Anomaly │  {false_neg:>5}    │  {true_pos:>5}     │")
    print(f"  └──────────────┴───────────┴────────────┘")

    print(f"\n  Precision : {precision:.3f}")
    print(f"  Recall    : {recall:.3f}")
    print(f"  F1 Score  : {f1:.3f}")
    print(f"  Accuracy  : {accuracy:.3f}")

    # ── Per-Tourist Breakdown ──
    print(f"\n{'─' * 60}")
    print(f"📋 PER-TOURIST BREAKDOWN")
    print(f"{'─' * 60}")
    print(f"  {'Tourist':<10} {'True':>6} {'Detected':>10} {'Recall':>8} {'False+':>8} {'Status'}")
    print(f"  {'─' * 55}")

    for tid in sorted(results_df["tourist_id"].unique()):
        t_df = results_df[results_df["tourist_id"] == tid]
        t_true = t_df["is_true_anomaly"].sum()
        t_detected = ((t_df[prediction_col] == 1) & (t_df["is_true_anomaly"] == 1)).sum()
        t_false_pos = ((t_df[prediction_col] == 1) & (t_df["is_true_anomaly"] == 0)).sum()
        t_recall = t_detected / max(t_true, 1) if t_true > 0 else float("nan")

        if t_true == 0:
            status = "✅ Normal" + (f" (⚠️ {t_false_pos} false alarms)" if t_false_pos > 0 else " ✨ clean")
        elif t_recall >= 0.7:
            status = "🎯 Well detected"
        elif t_recall >= 0.3:
            status = "🟡 Partially detected"
        else:
            status = "❌ Missed"

        recall_str = f"{t_recall:.2f}" if t_true > 0 else "  N/A"
        print(f"  {tid:<10} {t_true:>6} {t_detected:>10} {recall_str:>8} {t_false_pos:>8}  {status}")

    # ── Per Anomaly Type Breakdown ──
    print(f"\n{'─' * 60}")
    print(f"🚨 PER ANOMALY TYPE DETECTION RATE")
    print(f"{'─' * 60}")

    anomaly_types = results_df[results_df["is_true_anomaly"] == 1]["ground_truth"].unique()
    for atype in sorted(anomaly_types):
        mask = results_df["ground_truth"] == atype
        total_of_type = mask.sum()
        detected = (mask & (results_df[prediction_col] == 1)).sum()
        rate = detected / max(total_of_type, 1)
        bar = "█" * int(rate * 20) + "░" * (20 - int(rate * 20))
        print(f"  {atype:<30} {detected:>4}/{total_of_type:<4}  {bar} {rate:.0%}")

    return {
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "accuracy": accuracy,
        "true_pos": true_pos,
        "false_pos": false_pos,
        "true_neg": true_neg,
        "false_neg": false_neg,
    }


# ──────────────────────────────────────────────
# 6. FEATURE IMPORTANCE ANALYSIS
# ──────────────────────────────────────────────

def analyze_feature_importance(results_df):
    """
    Analyze which features differ most between normal and anomalous points.
    Uses difference in means (standardized) as a proxy for importance.
    """
    print(f"\n{'─' * 60}")
    print(f"🔬 FEATURE ANALYSIS: What makes anomalies different?")
    print(f"{'─' * 60}")

    normal = results_df[results_df["is_true_anomaly"] == 0]
    anomaly = results_df[results_df["is_true_anomaly"] == 1]

    print(f"\n  {'Feature':<30} {'Normal (mean)':>14} {'Anomaly (mean)':>16} {'Ratio':>8}")
    print(f"  {'─' * 70}")

    for col in FEATURE_COLS:
        n_mean = normal[col].mean()
        a_mean = anomaly[col].mean()
        ratio = a_mean / max(n_mean, 1e-10)

        # Highlight big differences
        if ratio > 2 or ratio < 0.5:
            marker = " ⭐"
        else:
            marker = ""

        print(f"  {col:<30} {n_mean:>14.2f} {a_mean:>16.2f} {ratio:>7.2f}x{marker}")


# ──────────────────────────────────────────────
# 7. SAVE RESULTS
# ──────────────────────────────────────────────

def save_results(results_df, output_dir="results"):
    """Save detection results to CSV files."""
    os.makedirs(output_dir, exist_ok=True)

    # Full results
    results_df.to_csv(f"{output_dir}/detection_results.csv", index=False)
    print(f"\n  ✅ Full results → {output_dir}/detection_results.csv")

    # Detected anomalies only
    anomalies = results_df[results_df["is_if_anomaly"] == 1].copy()
    anomalies.to_csv(f"{output_dir}/detected_anomalies.csv", index=False)
    print(f"  ✅ Detected anomalies → {output_dir}/detected_anomalies.csv ({len(anomalies)} points)")

    # Per-tourist summary
    summary = []
    for tid in sorted(results_df["tourist_id"].unique()):
        t_df = results_df[results_df["tourist_id"] == tid]
        summary.append({
            "tourist_id": tid,
            "total_points": len(t_df),
            "true_anomaly_points": int(t_df["is_true_anomaly"].sum()),
            "if_detected_points": int(t_df["is_if_anomaly"].sum()),
            "true_positive": int(((t_df["is_if_anomaly"] == 1) & (t_df["is_true_anomaly"] == 1)).sum()),
            "false_positive": int(((t_df["is_if_anomaly"] == 1) & (t_df["is_true_anomaly"] == 0)).sum()),
            "false_negative": int(((t_df["is_if_anomaly"] == 0) & (t_df["is_true_anomaly"] == 1)).sum()),
            "min_anomaly_score": float(t_df["if_anomaly_score"].min()),
            "mean_anomaly_score": float(t_df["if_anomaly_score"].mean()),
        })

    summary_df = pd.DataFrame(summary)
    summary_df.to_csv(f"{output_dir}/tourist_summary.csv", index=False)
    print(f"  ✅ Tourist summary → {output_dir}/tourist_summary.csv")


# ──────────────────────────────────────────────
# 9. MAIN
# ──────────────────────────────────────────────

def main():
    print("=" * 60)
    print("🌲 ISOLATION FOREST + RULES — Tourist Anomaly Detection")
    print("=" * 60)

    # ── Load Data ──
    print("\n📂 Loading data...")
    gps_df = load_actual_gps()
    planned_df = load_planned_routes()
    paths_df = load_planned_paths()
    anomaly_log = load_anomaly_log()

    print(f"   GPS points:      {len(gps_df)}")
    print(f"   Planned stops:   {len(planned_df)}")
    print(f"   Path geometry:   {len(paths_df)} points")
    print(f"   True anomalies:  {len(anomaly_log)} events")

    # ── Feature Engineering ──
    print(f"\n🔧 FEATURE ENGINEERING")
    features_df = engineer_features(gps_df, planned_df, paths_df)

    print(f"\n   Feature matrix shape: {features_df[FEATURE_COLS].shape}")
    print(f"   Features ({len(FEATURE_COLS)}): {FEATURE_COLS}")

    # ── Stage 1: Isolation Forest ──
    true_anomaly_rate = gps_df["status"].str.startswith("ANOMALY").mean()
    print(f"\n   True anomaly rate: {true_anomaly_rate:.3f} ({true_anomaly_rate * 100:.1f}%)")

    results_df, model, scaler = train_isolation_forest(
        features_df,
        contamination=round(true_anomaly_rate, 3)
    )

    # Evaluate IF alone
    if_metrics = evaluate(results_df, prediction_col="is_if_anomaly", label="IF Only")

    # ── Stage 2: Rule-Based Post-Filtering ──
    results_df = apply_rule_based_filter(results_df)

    # Evaluate Hybrid (IF + Rules)
    hybrid_metrics = evaluate(results_df, prediction_col="is_hybrid_anomaly", label="IF + Rules (Hybrid)")

    # ── Comparison Table ──
    print(f"\n{'=' * 60}")
    print(f"⚡ HEAD-TO-HEAD COMPARISON")
    print(f"{'=' * 60}")
    print(f"")
    print(f"  {'Metric':<20} {'IF Only':>12} {'IF + Rules':>12} {'Δ Change':>12}")
    print(f"  {'─' * 56}")
    for metric in ["precision", "recall", "f1", "accuracy"]:
        v1 = if_metrics[metric]
        v2 = hybrid_metrics[metric]
        delta = v2 - v1
        arrow = "↑" if delta > 0 else ("↓" if delta < 0 else "→")
        print(f"  {metric.capitalize():<20} {v1:>11.3f} {v2:>12.3f} {delta:>+11.3f} {arrow}")
    print(f"")
    print(f"  {'False Positives':<20} {if_metrics['false_pos']:>12} {hybrid_metrics['false_pos']:>12} {hybrid_metrics['false_pos'] - if_metrics['false_pos']:>+12}")
    print(f"  {'False Negatives':<20} {if_metrics['false_neg']:>12} {hybrid_metrics['false_neg']:>12} {hybrid_metrics['false_neg'] - if_metrics['false_neg']:>+12}")

    # ── Feature Analysis ──
    analyze_feature_importance(results_df)

    # ── Save Results ──
    print(f"\n{'─' * 60}")
    print(f"💾 SAVING RESULTS")
    save_results(results_df)

    print(f"\n{'=' * 60}")
    print(f"✅ PIPELINE COMPLETE")
    print(f"{'=' * 60}")
    print(f"   IF Only  →  F1: {if_metrics['f1']:.3f}  |  P: {if_metrics['precision']:.3f}  |  R: {if_metrics['recall']:.3f}")
    print(f"   Hybrid   →  F1: {hybrid_metrics['f1']:.3f}  |  P: {hybrid_metrics['precision']:.3f}  |  R: {hybrid_metrics['recall']:.3f}")
    print(f"   Files saved to results/ directory")


if __name__ == "__main__":
    main()
