"""
FastAPI Server for Tourist Anomaly Detection.

Routes:
  GET /refresh          — Run full detection pipeline, save JSON, return flagged tourists
  GET /tourist/{id}     — Get anomaly details for a specific tourist
"""

import json
import os
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# ── Import detection pipeline ──
from detect_anomalies import (
    FEATURE_COLS,
    apply_rule_based_filter,
    engineer_features,
    load_actual_gps,
    load_anomaly_log,
    load_planned_paths,
    load_planned_routes,
    train_isolation_forest,
)

# ──────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────

RESULTS_JSON = Path("results/anomaly_report.json")

app = FastAPI(
    title="🌲 Tourist Anomaly Detection API",
    description="Isolation Forest + Rule-based anomaly detection for tourist GPS data",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────
# SEVERITY CLASSIFICATION
# ──────────────────────────────────────────────

def classify_severity(row: dict) -> str:
    """
    Classify anomaly severity based on feature values.

    Levels:
      CRITICAL  — Immediate danger (impossible speed, extreme deviation, major overstay)
      HIGH      — Strong anomaly (significant deviation or overstay)
      MODERATE  — Notable deviation from plan
      LOW       — Minor anomaly (borderline detection)
    """
    speed = row.get("speed", 0)
    dev_clipped = row.get("deviation_clipped", 0)
    dwell_excess = row.get("dwell_excess_minutes", 0)
    dev_z = row.get("deviation_z_score", 0)
    phase_mm = row.get("phase_mismatch", 0)
    if_score = row.get("if_anomaly_score", 0)

    # CRITICAL: physical impossibility or extreme deviation
    if speed > 1500:
        return "CRITICAL"
    if dev_clipped > 800 and dev_z > 3.0:
        return "CRITICAL"
    if dwell_excess > 60:
        return "CRITICAL"

    # HIGH: significant anomaly
    if dev_clipped > 500 or dwell_excess > 30:
        return "HIGH"
    if dev_z > 2.5 and phase_mm == 1:
        return "HIGH"

    # MODERATE: clear deviation
    if dev_clipped > 200 or dwell_excess > 10:
        return "MODERATE"
    if if_score < -0.15:
        return "MODERATE"

    # LOW: borderline
    return "LOW"


def classify_anomaly_type(row: dict) -> str:
    """
    Infer the anomaly type from feature values.
    """
    speed = row.get("speed", 0)
    dev_clipped = row.get("deviation_clipped", 0)
    dwell_excess = row.get("dwell_excess_minutes", 0)
    is_stationary = row.get("is_stationary", 0)
    acceleration = row.get("acceleration", 0)

    if speed > 1500:
        return "speed_spike"
    if dwell_excess > 10:
        return "dwell_overstay"
    if dev_clipped > 200:
        return "route_deviation"
    if is_stationary == 1 and acceleration < -50:
        return "sudden_stop"
    if dev_clipped > 50:
        return "route_deviation"
    if is_stationary == 1:
        return "sudden_stop"

    return "general_anomaly"


# ──────────────────────────────────────────────
# DETECTION PIPELINE (reusable)
# ──────────────────────────────────────────────

def run_detection_pipeline() -> dict:
    """
    Run the full Isolation Forest + Rules pipeline and return
    structured anomaly report as a dict.
    """
    print("\n🔄 Running full anomaly detection pipeline...")

    # Load data
    gps_df = load_actual_gps()
    planned_df = load_planned_routes()
    paths_df = load_planned_paths()
    anomaly_log = load_anomaly_log()

    # Feature engineering
    features_df = engineer_features(gps_df, planned_df, paths_df)

    # Isolation Forest
    true_anomaly_rate = gps_df["status"].str.startswith("ANOMALY").mean()
    results_df, model, scaler = train_isolation_forest(
        features_df,
        contamination=round(max(true_anomaly_rate, 0.01), 3)
    )

    # Rule-based post-filtering
    results_df = apply_rule_based_filter(results_df)

    # ── Build structured report ──
    report = {
        "generated_at": datetime.now().isoformat(),
        "total_gps_points": len(results_df),
        "total_tourists": int(results_df["tourist_id"].nunique()),
        "tourists": {},
    }

    # Build planned stops lookup for embedding into events
    planned_stops = {}
    for _, row in planned_df.iterrows():
        tid = row["tourist_id"]
        if tid not in planned_stops:
            planned_stops[tid] = []
        planned_stops[tid].append({
            "stop_order": int(row["stop_order"]),
            "poi_name": row["poi_name"],
            "lat": float(row["poi_lat"]),
            "lon": float(row["poi_lon"]),
            "planned_arrival": str(row["planned_arrival"]),
            "planned_departure": str(row["planned_departure"]),
        })

    def find_nearest_stop(tid, event_ts):
        """Find the planned stop nearest to an event timestamp."""
        if tid not in planned_stops:
            return None
        stops = sorted(planned_stops[tid], key=lambda s: s["stop_order"])
        nearest = stops[0]
        for stop in stops:
            if stop["planned_arrival"] <= event_ts:
                nearest = stop
        return nearest

    for tid in sorted(results_df["tourist_id"].unique()):
        t_df = results_df[results_df["tourist_id"] == tid]
        anomaly_points = t_df[t_df["is_hybrid_anomaly"] == 1]

        is_flagged = len(anomaly_points) > 0

        # Build anomaly events (group consecutive anomaly points into events)
        anomaly_events = []
        if is_flagged:
            event_points = anomaly_points.to_dict("records")
            current_event = None

            for pt in event_points:
                pt_info = {
                    "timestamp": str(pt["timestamp"]),
                    "actual_lat": float(pt["latitude"]),
                    "actual_lon": float(pt["longitude"]),
                    "speed": round(float(pt["speed"]), 1),
                    "deviation_m": round(float(pt["deviation_clipped"]), 1),
                    "dwell_excess_min": round(float(pt["dwell_excess_minutes"]), 1),
                    "deviation_z_score": round(float(pt["deviation_z_score"]), 2),
                    "if_score": round(float(pt["if_anomaly_score"]), 4),
                    "rule_applied": pt.get("rule_applied", "none"),
                }

                anomaly_type = classify_anomaly_type(pt)
                severity = classify_severity(pt)

                if current_event is None or current_event["type"] != anomaly_type:
                    # Start new event
                    if current_event is not None:
                        anomaly_events.append(current_event)
                    current_event = {
                        "type": anomaly_type,
                        "severity": severity,
                        "start_timestamp": str(pt["timestamp"]),
                        "end_timestamp": str(pt["timestamp"]),
                        "duration_minutes": 1,
                        "max_severity": severity,
                        "points": [pt_info],
                    }
                else:
                    # Extend current event
                    current_event["end_timestamp"] = str(pt["timestamp"])
                    current_event["duration_minutes"] += 1
                    current_event["points"].append(pt_info)
                    # Upgrade severity if higher
                    sev_order = {"LOW": 0, "MODERATE": 1, "HIGH": 2, "CRITICAL": 3}
                    if sev_order.get(severity, 0) > sev_order.get(current_event["max_severity"], 0):
                        current_event["max_severity"] = severity

            if current_event is not None:
                anomaly_events.append(current_event)

            # Embed planned POI info directly into each event
            for event in anomaly_events:
                stop = find_nearest_stop(tid, event["start_timestamp"])
                if stop:
                    event["nearest_planned_poi"] = stop["poi_name"]
                    event["planned_lat"] = stop["lat"]
                    event["planned_lon"] = stop["lon"]
                    event["planned_arrival"] = stop["planned_arrival"]
                    event["planned_departure"] = stop["planned_departure"]
                else:
                    event["nearest_planned_poi"] = None
                    event["planned_lat"] = None
                    event["planned_lon"] = None
                    event["planned_arrival"] = None
                    event["planned_departure"] = None

        # Tourist record (no planned_stops, no planned_coordinates_at_anomaly)
        tourist_record = {
            "tourist_id": tid,
            "anomaly_detected": is_flagged,
            "total_points": int(len(t_df)),
            "anomaly_points_count": int(len(anomaly_points)),
            "anomaly_percentage": round(100 * len(anomaly_points) / len(t_df), 1),
            "anomaly_events": anomaly_events,
        }

        # Summary fields for flagged tourists
        if is_flagged:
            severities = [e["max_severity"] for e in anomaly_events]
            sev_order = {"LOW": 0, "MODERATE": 1, "HIGH": 2, "CRITICAL": 3}
            tourist_record["overall_severity"] = max(severities, key=lambda s: sev_order.get(s, 0))
            tourist_record["anomaly_types"] = list(set(e["type"] for e in anomaly_events))
        else:
            tourist_record["overall_severity"] = "NONE"
            tourist_record["anomaly_types"] = []

        report["tourists"][tid] = tourist_record

    # ── Summary stats ──
    flagged = [tid for tid, t in report["tourists"].items() if t["anomaly_detected"]]
    report["flagged_count"] = len(flagged)
    report["flagged_tourist_ids"] = flagged

    return report


def save_report(report: dict):
    """Save report to JSON file."""
    RESULTS_JSON.parent.mkdir(parents=True, exist_ok=True)

    # Convert any remaining numpy/pandas types
    def convert(obj):
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, (np.ndarray,)):
            return obj.tolist()
        if isinstance(obj, (pd.Timestamp,)):
            return str(obj)
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

    with open(RESULTS_JSON, "w") as f:
        json.dump(report, f, indent=2, default=convert)

    print(f"✅ Report saved to {RESULTS_JSON} ({RESULTS_JSON.stat().st_size / 1024:.1f} KB)")


def load_report() -> dict | None:
    """Load existing report from JSON, or None if not found."""
    if RESULTS_JSON.exists():
        with open(RESULTS_JSON) as f:
            return json.load(f)
    return None


# ──────────────────────────────────────────────
# API ROUTES
# ──────────────────────────────────────────────

@app.get("/")
def root():
    """Health check and API overview."""
    report = load_report()
    return {
        "service": "🌲 Tourist Anomaly Detection API",
        "version": "1.0.0",
        "endpoints": {
            "/refresh": "Run detection pipeline and return flagged tourists",
            "/tourist/{tourist_id}": "Get anomaly details for a specific tourist",
        },
        "report_exists": report is not None,
        "last_generated": report["generated_at"] if report else None,
    }


@app.get("/refresh")
def refresh():
    """
    Run the full anomaly detection pipeline on all tourists.

    - Executes Isolation Forest + Rule-based filtering
    - Saves complete results to anomaly_report.json
    - Returns only flagged tourist IDs with anomaly type and severity
    """
    report = run_detection_pipeline()
    save_report(report)

    # Build compact response (only flagged tourists)
    flagged_summary = []
    for tid in report["flagged_tourist_ids"]:
        tourist = report["tourists"][tid]
        flagged_summary.append({
            "tourist_id": tid,
            "overall_severity": tourist["overall_severity"],
            "anomaly_types": tourist["anomaly_types"],
            "anomaly_points": tourist["anomaly_points_count"],
            "anomaly_percentage": tourist["anomaly_percentage"],
            "events_count": len(tourist["anomaly_events"]),
            "event_summaries": [
                {
                    "type": e["type"],
                    "severity": e["max_severity"],
                    "start": e["start_timestamp"],
                    "end": e["end_timestamp"],
                    "duration_min": e["duration_minutes"],
                }
                for e in tourist["anomaly_events"]
            ],
        })

    # Sort by severity (CRITICAL first)
    sev_order = {"CRITICAL": 0, "HIGH": 1, "MODERATE": 2, "LOW": 3}
    flagged_summary.sort(key=lambda x: sev_order.get(x["overall_severity"], 99))

    return {
        "status": "success",
        "generated_at": report["generated_at"],
        "total_tourists": report["total_tourists"],
        "flagged_count": report["flagged_count"],
        "flagged_tourists": flagged_summary,
    }


@app.get("/tourist/{tourist_id}")
def get_tourist(tourist_id: str):
    """
    Get full anomaly details for a specific tourist.

    If no report exists in the JSON cache, runs the detection pipeline first.
    Returns all anomaly info: events, timestamps, severity, coordinates, etc.
    """
    # Normalize ID format (accept "T001", "t001", "001", "1")
    if not tourist_id.upper().startswith("T"):
        tourist_id = f"T{tourist_id.zfill(3)}"
    else:
        tourist_id = tourist_id.upper()

    # Try loading existing report
    report = load_report()

    # If no report exists, run detection first
    if report is None:
        print(f"📋 No report found, running detection pipeline...")
        report = run_detection_pipeline()
        save_report(report)

    # Check if tourist exists
    if tourist_id not in report["tourists"]:
        available = sorted(report["tourists"].keys())
        raise HTTPException(
            status_code=404,
            detail={
                "error": f"Tourist '{tourist_id}' not found",
                "available_tourist_ids": available,
            }
        )

    tourist = report["tourists"][tourist_id]

    return {
        "status": "success",
        "report_generated_at": report["generated_at"],
        "tourist": tourist,
    }


# ──────────────────────────────────────────────
# RUN
# ──────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
