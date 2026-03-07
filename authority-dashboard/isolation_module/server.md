# 🌐 API Documentation — Tourist Anomaly Detection Server

> **FastAPI-powered REST API** that runs the Isolation Forest + Rule-based anomaly detection pipeline and serves structured results over HTTP.

---

## 📑 Table of Contents

1. [Quick Start](#-quick-start)
2. [Base URL & Configuration](#-base-url--configuration)
3. [Endpoints Overview](#-endpoints-overview)
4. [Route: `GET /`](#get--—-health-check)
5. [Route: `GET /refresh`](#get-refresh-—-run-detection-pipeline)
6. [Route: `GET /tourist/{tourist_id}`](#get-touristtourist_id-—-get-tourist-details)
7. [Severity Classification Logic](#-severity-classification-logic)
8. [Anomaly Type Inference Logic](#-anomaly-type-inference-logic)
9. [JSON Cache — `anomaly_report.json`](#-json-cache-—-anomaly_reportjson)
10. [Error Handling](#-error-handling)
11. [CORS Configuration](#-cors-configuration)
12. [Dependencies](#-dependencies)

---

## 🚀 Quick Start

```bash
# Install dependencies (if not already)
uv add fastapi uvicorn

# Start the server
uv run python server.py

# Server runs at http://localhost:8000
```

The server exposes the Swagger UI at: `http://localhost:8000/docs`

---

## ⚙️ Base URL & Configuration

| Setting | Value |
|---|---|
| **Host** | `0.0.0.0` |
| **Port** | `8000` |
| **Framework** | FastAPI 0.135+ |
| **ASGI Server** | Uvicorn |
| **JSON Cache Path** | `results/anomaly_report.json` |

---

## 📋 Endpoints Overview

| Method | Route | Description | Triggers Pipeline? |
|---|---|---|---|
| `GET` | `/` | Health check & API overview | ❌ Never |
| `GET` | `/refresh` | Run full detection, save JSON, return flagged tourists | ✅ Always |
| `GET` | `/tourist/{tourist_id}` | Get anomaly details for one tourist | ⚠️ Only if no cached JSON |

---

## `GET /` — Health Check

Returns the API status and whether a cached report exists.

### Request

```
GET http://localhost:8000/
```

### Response Schema

```json
{
  "service": "string",           // API name
  "version": "string",           // API version (e.g., "1.0.0")
  "endpoints": {                 // Available endpoints
    "/refresh": "string",
    "/tourist/{tourist_id}": "string"
  },
  "report_exists": "boolean",   // true if anomaly_report.json exists
  "last_generated": "string|null"  // ISO timestamp of last report, or null
}
```

### Example Response

```json
{
  "service": "🌲 Tourist Anomaly Detection API",
  "version": "1.0.0",
  "endpoints": {
    "/refresh": "Run detection pipeline and return flagged tourists",
    "/tourist/{tourist_id}": "Get anomaly details for a specific tourist"
  },
  "report_exists": true,
  "last_generated": "2026-03-06T11:28:30.206372"
}
```

---

## `GET /refresh` — Run Detection Pipeline

Runs the **complete anomaly detection pipeline** on all tourists:

1. Loads GPS data, planned routes, and planned paths from `./data/`
2. Engineers 18 features per GPS point
3. Trains Isolation Forest (200 trees)
4. Applies 6 rule-based post-filters
5. Classifies severity and anomaly type for each detected anomaly
6. Saves full results to `results/anomaly_report.json`
7. Returns **only flagged tourists** (compact summary)

### Request

```
GET http://localhost:8000/refresh
```

### Response Schema

```json
{
  "status": "string",                 // "success"
  "generated_at": "string",           // ISO timestamp
  "total_tourists": "integer",        // Total tourists analyzed
  "flagged_count": "integer",         // How many tourists have anomalies
  "flagged_tourists": [               // Array of flagged tourist summaries
    {
      "tourist_id": "string",              // e.g., "T003"
      "overall_severity": "string",        // "CRITICAL" | "HIGH" | "MODERATE" | "LOW"
      "anomaly_types": ["string"],         // e.g., ["dwell_overstay", "speed_spike"]
      "anomaly_points": "integer",         // Total anomalous GPS points
      "anomaly_percentage": "float",       // % of total GPS points flagged
      "events_count": "integer",           // Number of distinct anomaly events
      "event_summaries": [                 // Compact event list
        {
          "type": "string",                //  Anomaly type
          "severity": "string",            // Max severity in this event
          "start": "string",               // Event start timestamp
          "end": "string",                 // Event end timestamp
          "duration_min": "integer"         // Duration in minutes
        }
      ]
    }
  ]
}
```

> **Note**: `flagged_tourists` is sorted by severity — `CRITICAL` first, then `HIGH`, `MODERATE`, `LOW`.

### Example Response

```json
{
  "status": "success",
  "generated_at": "2026-03-06T11:28:30.206372",
  "total_tourists": 10,
  "flagged_count": 8,
  "flagged_tourists": [
    {
      "tourist_id": "T003",
      "overall_severity": "CRITICAL",
      "anomaly_types": ["dwell_overstay", "speed_spike", "sudden_stop", "route_deviation"],
      "anomaly_points": 63,
      "anomaly_percentage": 15.0,
      "events_count": 4,
      "event_summaries": [
        {
          "type": "dwell_overstay",
          "severity": "CRITICAL",
          "start": "2026-03-05 06:50:00",
          "end": "2026-03-05 07:49:00",
          "duration_min": 60
        },
        {
          "type": "speed_spike",
          "severity": "CRITICAL",
          "start": "2026-03-05 07:50:00",
          "end": "2026-03-05 07:50:00",
          "duration_min": 1
        }
      ]
    },
    {
      "tourist_id": "T004",
      "overall_severity": "HIGH",
      "anomaly_types": ["dwell_overstay", "sudden_stop"],
      "anomaly_points": 32,
      "anomaly_percentage": 7.6,
      "events_count": 2,
      "event_summaries": [
        {
          "type": "dwell_overstay",
          "severity": "HIGH",
          "start": "2026-03-05 11:58:00",
          "end": "2026-03-05 12:15:00",
          "duration_min": 18
        }
      ]
    }
  ]
}
```

### Performance

| Metric | Value |
|---|---|
| **Pipeline Runtime** | ~20-60 seconds (depends on hardware) |
| **Data Processed** | 4,200 GPS points × 18 features |
| **JSON Output Size** | ~148 KB |

---

## `GET /tourist/{tourist_id}` — Get Tourist Details

Returns **full anomaly details** for a specific tourist, including every anomaly event with per-point GPS data.

### Caching Behavior

| JSON Cache State | Behavior |
|---|---|
| ✅ Exists | Reads from cache (instant response) |
| ❌ Missing | Runs full pipeline first, saves JSON, then responds |

### Request

```
GET http://localhost:8000/tourist/{tourist_id}
```

### Path Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `tourist_id` | string | ✅ | Tourist ID. Flexible format (see normalization below) |

### Tourist ID Normalization

The endpoint auto-normalizes tourist IDs to canonical format (uppercase `T` + zero-padded number):

| Input | Normalized To |
|---|---|
| `T003` | `T003` |
| `t003` | `T003` |
| `003` | `T003` |
| `3` | `T003` |

### Response Schema

```json
{
  "status": "string",                      // "success"
  "report_generated_at": "string",         // ISO timestamp of cache
  "tourist": {
    "tourist_id": "string",                // e.g., "T003"
    "anomaly_detected": "boolean",         // true if any anomalies found
    "total_points": "integer",             // Total GPS points for this tourist
    "anomaly_points_count": "integer",     // GPS points flagged as anomaly
    "anomaly_percentage": "float",         // % of points flagged
    "overall_severity": "string",          // "CRITICAL"|"HIGH"|"MODERATE"|"LOW"|"NONE"
    "anomaly_types": ["string"],           // Unique anomaly types across all events

    "anomaly_events": [                    // Grouped anomaly events
      {
        // ── Event Metadata ──
        "type": "string",                       // Anomaly type (see classification)
        "severity": "string",                   // Starting severity
        "max_severity": "string",               // Highest severity across all points
        "start_timestamp": "string",            // First point timestamp
        "end_timestamp": "string",              // Last point timestamp
        "duration_minutes": "integer",          // Event duration

        // ── Planned Context (embedded) ──
        "nearest_planned_poi": "string",        // Nearest planned POI name
        "planned_lat": "float",                 // Planned POI latitude
        "planned_lon": "float",                 // Planned POI longitude
        "planned_arrival": "string",            // Planned arrival at this POI
        "planned_departure": "string",          // Planned departure from this POI

        // ── Per-Point Data ──
        "points": [
          {
            "timestamp": "string",              // GPS point timestamp
            "actual_lat": "float",              // Actual latitude
            "actual_lon": "float",              // Actual longitude
            "speed": "float",                   // Speed in m/min
            "deviation_m": "float",             // Route deviation (clipped, meters)
            "dwell_excess_min": "float",        // Minutes overstaying at POI
            "deviation_z_score": "float",       // Per-tourist normalized deviation
            "if_score": "float",                // Isolation Forest anomaly score
            "rule_applied": "string"            // Which rule flagged/suppressed this
          }
        ]
      }
    ]
  }
}
```

### Example Response — Flagged Tourist (T003)

```json
{
  "status": "success",
  "report_generated_at": "2026-03-06T11:28:30.206372",
  "tourist": {
    "tourist_id": "T003",
    "anomaly_detected": true,
    "total_points": 420,
    "anomaly_points_count": 63,
    "anomaly_percentage": 15.0,
    "overall_severity": "CRITICAL",
    "anomaly_types": ["dwell_overstay", "speed_spike", "sudden_stop", "route_deviation"],
    "anomaly_events": [
      {
        "type": "dwell_overstay",
        "severity": "HIGH",
        "max_severity": "CRITICAL",
        "start_timestamp": "2026-03-05 06:50:00",
        "end_timestamp": "2026-03-05 07:49:00",
        "duration_minutes": 60,
        "nearest_planned_poi": "Tiger Hill",
        "planned_lat": 27.0125,
        "planned_lon": 88.265,
        "planned_arrival": "2026-03-05 06:00:00",
        "planned_departure": "2026-03-05 06:36:00",
        "points": [
          {
            "timestamp": "2026-03-05 06:50:00",
            "actual_lat": 27.012512,
            "actual_lon": 88.265015,
            "speed": 4.4,
            "deviation_m": 562.1,
            "dwell_excess_min": 15.0,
            "deviation_z_score": 1.35,
            "if_score": -0.1478,
            "rule_applied": "none"
          }
        ]
      },
      {
        "type": "speed_spike",
        "severity": "CRITICAL",
        "max_severity": "CRITICAL",
        "start_timestamp": "2026-03-05 07:50:00",
        "end_timestamp": "2026-03-05 07:50:00",
        "duration_minutes": 1,
        "nearest_planned_poi": "Rock Garden",
        "planned_lat": 27.028,
        "planned_lon": 88.248,
        "planned_arrival": "2026-03-05 07:26:00",
        "planned_departure": "2026-03-05 09:12:00",
        "points": [
          {
            "timestamp": "2026-03-05 07:50:00",
            "actual_lat": 27.02806,
            "actual_lon": 88.24797,
            "speed": 2416.4,
            "deviation_m": 190.5,
            "dwell_excess_min": 0.0,
            "deviation_z_score": -0.24,
            "if_score": -0.1546,
            "rule_applied": "none"
          }
        ]
      }
    ]
  }
}
```

### Example Response — Normal Tourist (T001)

```json
{
  "status": "success",
  "report_generated_at": "2026-03-06T11:28:30.206372",
  "tourist": {
    "tourist_id": "T001",
    "anomaly_detected": false,
    "total_points": 420,
    "anomaly_points_count": 0,
    "anomaly_percentage": 0.0,
    "overall_severity": "NONE",
    "anomaly_types": [],
    "anomaly_events": []
  }
}
```

---

## 🔴 Severity Classification Logic

Each anomaly point is assigned a severity level. The **event's `max_severity`** is the highest severity among its points, and the **tourist's `overall_severity`** is the highest across all events.

### Classification Rules (evaluated in order — first match wins)

```
┌──────────────────────────────────────────────────────────────────────┐
│                    SEVERITY DECISION TREE                            │
│                                                                      │
│   speed > 1500 m/min ─────────────────────────────→ CRITICAL        │
│   deviation > 800m AND z-score > 3.0 ─────────────→ CRITICAL        │
│   dwell_excess > 60 min ──────────────────────────→ CRITICAL        │
│                                                                      │
│   deviation > 500m OR dwell_excess > 30 min ──────→ HIGH            │
│   z-score > 2.5 AND phase_mismatch == 1 ──────────→ HIGH            │
│                                                                      │
│   deviation > 200m OR dwell_excess > 10 min ──────→ MODERATE        │
│   if_score < -0.15 ───────────────────────────────→ MODERATE        │
│                                                                      │
│   (everything else) ──────────────────────────────→ LOW             │
└──────────────────────────────────────────────────────────────────────┘
```

### Severity Thresholds Table

| Level | Color | Conditions | Real-World Interpretation |
|---|---|---|---|
| **CRITICAL** | 🔴 | Speed > 1500 m/min (~90 km/h) | Impossible speed — GPS spoofing or vehicle crash |
| | | Deviation > 800m + z-score > 3.0 | Extreme off-path — tourist may be in danger |
| | | Dwell excess > 60 min | Major overstay — possible emergency |
| **HIGH** | 🟠 | Deviation > 500m OR dwell > 30min | Significant anomaly — needs attention |
| | | z-score > 2.5 + phase mismatch | Unusual behavior + wrong schedule phase |
| **MODERATE** | 🟡 | Deviation > 200m OR dwell > 10min | Notable deviation — monitor closely |
| | | IF score < -0.15 | Strong statistical anomaly |
| **LOW** | 🟢 | Everything else | Borderline detection — probably noise |

---

## 🏷️ Anomaly Type Inference Logic

Each anomaly point is classified into a type based on which feature is most dominant:

### Classification Rules (evaluated in order — first match wins)

```python
if speed > 1500:                              → "speed_spike"
if dwell_excess > 10:                         → "dwell_overstay"
if deviation_clipped > 200:                   → "route_deviation"
if is_stationary == 1 AND acceleration < -50: → "sudden_stop"
if deviation_clipped > 50:                    → "route_deviation"
if is_stationary == 1:                        → "sudden_stop"
else:                                         → "general_anomaly"
```

### Type Reference

| Type | Key Signal | Description |
|---|---|---|
| `speed_spike` | speed > 1500 m/min | Physically impossible speed between consecutive GPS points |
| `dwell_overstay` | dwell_excess > 10 min | Tourist staying at POI significantly longer than planned |
| `route_deviation` | deviation > 200m (or > 50m) | Tourist is off the planned route path |
| `sudden_stop` | stationary + large deceleration | Unexpected stop during transit phase |
| `general_anomaly` | none dominant | Anomaly detected by IF but no single feature dominates |

---

## 💾 JSON Cache — `anomaly_report.json`

The `/refresh` endpoint saves the full detection results to `results/anomaly_report.json`. The `/tourist/{id}` endpoint reads from this cache.

### File Structure

```json
{
  "generated_at": "2026-03-06T11:28:30.206372",
  "total_gps_points": 4200,
  "total_tourists": 10,
  "flagged_count": 8,
  "flagged_tourist_ids": ["T002", "T003", "T004", ...],

  "tourists": {
    "T001": { "... tourist record ..." },
    "T002": { "... tourist record ..." },
    "...": "..."
  }
}
```

Each tourist record has the same schema as the `tourist` field in the `/tourist/{id}` response.

### Cache Invalidation

- The cache is **overwritten entirely** on every `/refresh` call
- There is no TTL or auto-expiry — stale data persists until the next `/refresh`
- The `/tourist/{id}` route auto-triggers a pipeline run only when **no cache file exists at all**

---

## ❌ Error Handling

### 404 — Tourist Not Found

Returned when the requested tourist ID doesn't exist in the report.

```json
{
  "detail": {
    "error": "Tourist 'T999' not found",
    "available_tourist_ids": ["T001", "T002", "T003", "T004", "T005", "T006", "T007", "T008", "T009", "T010"]
  }
}
```

### 500 — Pipeline Error

Returned if the detection pipeline crashes (e.g., missing data files).

```json
{
  "detail": "Internal server error"
}
```

---

## 🌐 CORS Configuration

The server allows requests from **any origin** for development purposes:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

> ⚠️ **Production Note**: Restrict `allow_origins` to your frontend domain in production.

---

## 📦 Dependencies

| Package | Version | Purpose |
|---|---|---|
| `fastapi` | ≥ 0.135 | Web framework |
| `uvicorn` | ≥ 0.41 | ASGI server |
| `pandas` | ≥ 3.0 | Data manipulation |
| `numpy` | ≥ 2.4 | Numerical computation |
| `scikit-learn` | ≥ 1.8 | Isolation Forest model |

### Install

```bash
uv add fastapi uvicorn
```

---

## 🔗 Related Files

| File | Description |
|---|---|
| `server.py` | FastAPI server (this document's source) |
| `detect_anomalies.py` | Detection pipeline (imported by server) |
| `README.md` | Full pipeline documentation with feature engineering details |
| `results/anomaly_report.json` | JSON cache written by `/refresh` |

---

<p align="center">
  <b>🌐 FastAPI + 🌲 Isolation Forest + 📏 Rule-Based Filtering</b><br>
  <i>Darjeeling Tourist Safety Monitoring API</i>
</p>
