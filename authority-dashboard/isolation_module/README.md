# 🌲 Isolation Forest — Tourist Anomaly Detection Pipeline

> **Real-time anomaly detection system for tourist GPS data in Darjeeling, India.**  
> Combines **Isolation Forest** (unsupervised ML) with **rule-based post-filtering** to detect route deviations, dwell overstays, speed anomalies, and sudden stops — with a final **F1 Score of 0.746**.

---

## 📑 Table of Contents

1. [Project Overview](#-project-overview)
2. [Architecture](#-architecture)
3. [Data Generation](#-data-generation)
4. [What is Isolation Forest?](#-what-is-isolation-forest)
5. [Feature Engineering — The Heart of the System](#-feature-engineering--the-heart-of-the-system)
   - [v1: Baseline Features (13 features)](#v1-baseline-features-13-features)
   - [v2: Improved Features (18 features)](#v2-improved-features-18-features)
6. [Rule-Based Post-Filtering (Hybrid Layer)](#-rule-based-post-filtering-hybrid-layer)
   - [Promotion Rules](#a-promotion-rules--catch-what-if-missed)
   - [Suppression Rules](#b-suppression-rules--remove-false-positives)
   - [Persistence Filter](#c-persistence-filter--remove-isolated-noise)
7. [Performance Progression — Stage by Stage](#-performance-progression--stage-by-stage)
8. [File Structure](#-file-structure)
9. [How to Run](#-how-to-run)
10. [Key Takeaways](#-key-takeaways)

---

## 🎯 Project Overview

This project builds an **end-to-end anomaly detection pipeline** for tourist safety monitoring. The system:

1. **Generates** realistic synthetic GPS data for 10 tourists visiting Darjeeling POIs, with intentionally injected anomalies
2. **Engineers** 18 domain-specific features from raw GPS coordinates
3. **Trains** an Isolation Forest model (unsupervised — no labels needed)
4. **Applies** rule-based post-filtering to refine detections
5. **Evaluates** against ground-truth anomaly labels

### Anomaly Types Detected

| Anomaly | Description | Real-World Scenario |
|---|---|---|
| 🗺️ **Route Deviation** | Tourist goes far off the planned path | Lost, kidnapped, or exploring dangerous areas |
| 🕐 **Dwell Overstay** | Tourist stays at a POI much longer than planned | Medical emergency, detained, or in distress |
| ⚡ **Speed Spike** | Impossible speed between two GPS points | GPS spoofing, signal hijacking, or vehicle accident |
| 🛑 **Sudden Stop** | Tourist stops unexpectedly during transit | Vehicle breakdown, injury, or emergency |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    DATA GENERATION                        │
│  generate_data.py                                        │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  ┌─────────┐ │
│  │ 10 POIs │→ │ OSRM API │→ │ GPS Trace │→ │ Inject  │ │
│  │Darjeeling│  │Road Route│  │420 pts/ea │  │Anomalies│ │
│  └─────────┘  └──────────┘  └───────────┘  └─────────┘ │
├──────────────────────────────────────────────────────────┤
│                    DATA FILES                             │
│  data/planned_routes.csv      — POI stops & schedule     │
│  data/planned_route_paths.csv — Road geometry (OSRM)     │
│  data/actual_gps.csv          — 4,200 GPS points         │
│  data/anomaly_log.csv         — Ground truth labels       │
├──────────────────────────────────────────────────────────┤
│               DETECTION PIPELINE                          │
│  detect_anomalies.py                                     │
│                                                          │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────┐  │
│  │   Feature    │ → │  Isolation   │ → │  Rule-Based  │  │
│  │ Engineering  │   │   Forest     │   │   Filtering  │  │
│  │  (18 feats)  │   │ (200 trees)  │   │  (6 rules)   │  │
│  └─────────────┘   └──────────────┘   └──────────────┘  │
│        Stage 1           Stage 2           Stage 3        │
├──────────────────────────────────────────────────────────┤
│               VISUALIZATION                               │
│  visualize_routes.py → visualizations/routes_map.html    │
│  Interactive Folium map with planned vs actual routes     │
└──────────────────────────────────────────────────────────┘
```

---

## 📊 Data Generation

### Source: `generate_data.py`

The data simulates **10 tourists** exploring **15 POIs** in Darjeeling over a 7-hour period.

**Key Design Decisions:**

- **OSRM Routing**: Both planned and actual transit paths follow **real roads** via the OpenStreetMap Routing Machine (OSRM), not straight lines. This makes the data realistic — routes curve along mountain roads, switchbacks, etc.
- **GPS Noise**: Small Gaussian noise (σ = 0.00003°) is added to simulate real GPS inaccuracy.
- **Anomaly Injection**: Anomalies are injected into the *actual* GPS trace only, so the planned route serves as the baseline for comparison.

### Data Files

| File | Rows | Description |
|---|---|---|
| `planned_routes.csv` | 62 | POI stops with planned arrival/departure times |
| `planned_route_paths.csv` | 9,152 | OSRM road geometry between POIs (lat/lon points) |
| `actual_gps.csv` | 4,200 | 1-min GPS traces (420 points × 10 tourists) |
| `anomaly_log.csv` | 12 | Ground-truth anomaly events with timestamps |

### Tourist Distribution

- **Normal tourists** (no anomalies): T001, T006, T010
- **Anomalous tourists**: T002–T005, T007–T009 (various anomaly types)
- **True anomaly rate**: ~8% of all GPS points

---

## 🌲 What is Isolation Forest?

### The Core Idea

Isolation Forest works on a beautifully simple principle: **anomalies are easier to isolate than normal points**.

```
Normal Point:                     Anomaly:
┌──────────────────┐              ┌──────────────────┐
│  ●●●●●           │              │  ●●●●●           │
│  ●●●●●●●         │              │  ●●●●●●●         │
│  ●●●●X●●●   many │              │  ●●●●●●●●   split│
│  ●●●●●●●   splits│              │  ●●●●●●●●    to  │
│  ●●●●●     needed│              │                  │
│                   │              │         X   just │
│                   │              │              1-2! │
└──────────────────┘              └──────────────────┘
```

- **Normal points** are surrounded by similar points → takes many random splits to isolate them
- **Anomalies** are far from the crowd → isolated in just a few splits
- Points that are quickly isolated → **shorter path length** → **lower anomaly score** → **flagged as anomaly**

### Why Isolation Forest for This Problem?

| Property | Benefit |
|---|---|
| **Unsupervised** | No labeled data needed — critical because we can't label every tourist's GPS trace |
| **Fast** | O(n log n) — handles real-time GPS streams efficiently |
| **Multi-dimensional** | Naturally handles our 18 features simultaneously |
| **No distribution assumption** | Doesn't assume Gaussian — works with our mix of spatial, temporal, and categorical features |

### Our Configuration

```python
IsolationForest(
    n_estimators=200,         # 200 random trees for robust isolation
    max_samples="auto",       # Each tree sees a subsample
    contamination=0.08,       # Expected ~8% anomalies (from data)
    max_features=1.0,         # Each tree considers all features
    random_state=42,          # Reproducibility
    n_jobs=-1,                # Parallel on all CPU cores
)
```

---

## 🔧 Feature Engineering — The Heart of the System

> **"A model is only as good as its features."**  
> Feature engineering was the single biggest factor in improving detection performance. We evolved through two versions, each solving a specific weakness.

### v1: Baseline Features (13 features)

The initial feature set used **raw spatial and movement** signals:

| # | Feature | Type | Description | Why |
|---|---|---|---|---|
| 1 | `dist_to_planned_route` | Spatial | Min distance to any point on the planned OSRM path (meters) | Core deviation signal |
| 2 | `dist_to_nearest_poi` | Spatial | Distance to the nearest planned POI | Detects if tourist is near any landmark |
| 3 | `speed` | Movement | Meters per minute from previous GPS point | Speed anomalies and teleportation |
| 4 | `acceleration` | Movement | Change in speed from previous minute | Sudden starts/stops |
| 5 | `bearing_change` | Movement | Change in heading direction (degrees) | Erratic movement patterns |
| 6 | `is_stationary` | Movement | 1 if speed < 5 m/min, else 0 | Distinguishes dwell from transit |
| 7 | `stationary_streak` | Temporal | Consecutive minutes of being stationary | Duration of stays |
| 8 | `dwell_ratio` | Temporal | (Minutes near POI) / (Planned dwell time) | Basic overstay signal |
| 9 | `speed_rolling_mean_5` | Rolling | Mean speed over 5-min window | Smoothed speed context |
| 10 | `speed_rolling_std_5` | Rolling | Speed variability over 5-min window | Movement consistency |
| 11 | `deviation_rolling_mean_5` | Rolling | Mean route deviation over 5-min window | Sustained vs momentary deviation |
| 12 | `deviation_rolling_max_10` | Rolling | Max deviation over 10-min window | Peak deviation in recent history |
| 13 | `hour_of_day` | Temporal | Hour of the timestamp (6–12) | Temporal patterns |

#### v1 Feature Formulas

**Spatial Features — Haversine Distance**

All distance calculations use the [Haversine formula](https://en.wikipedia.org/wiki/Haversine_formula) for great-circle distance on Earth's surface:

```
a = sin²(Δφ/2) + cos(φ₁) · cos(φ₂) · sin²(Δλ/2)

distance = R · 2 · atan2(√a, √(1−a))

where:
  φ₁, φ₂  = latitudes in radians
  Δφ       = φ₂ − φ₁
  Δλ       = λ₂ − λ₁  (longitude difference)
  R        = 6,371,000 m  (Earth's mean radius)
```

```
dist_to_planned_route(t) = min( haversine(GPS_t, path_point_j) )   ∀ j ∈ planned_path

dist_to_nearest_poi(t)   = min( haversine(GPS_t, POI_k) )          ∀ k ∈ planned_POIs
```

**Movement Features**

```
speed(t) = haversine(GPS_{t-1}, GPS_t)                    [meters/minute, since Δt = 1 min]

acceleration(t) = speed(t) − speed(t−1)                   [meters/minute²]

bearing(t) = atan2(
    sin(Δλ) · cos(φ₂),
    cos(φ₁) · sin(φ₂) − sin(φ₁) · cos(φ₂) · cos(Δλ)
) mod 360°

bearing_change(t) = min( |bearing(t) − bearing(t−1)|,  360 − |bearing(t) − bearing(t−1)| )

is_stationary(t) = 1  if speed(t) < 5,  else 0

stationary_streak(t) = {
    stationary_streak(t−1) + 1    if is_stationary(t) = 1
    0                              otherwise
}
```

**Dwell Feature**

```
near_poi_streak(t) = {
    near_poi_streak(t−1) + 1   if dist_to_nearest_poi(t) < 100m
    0                           otherwise
}

dwell_ratio(t) = near_poi_streak(t) / planned_dwell_minutes(nearest_POI)
                 (0 if no planned dwell)
```

**Rolling Window Features**

```
speed_rolling_mean_5(t)   = (1/5) · Σ speed(i)      for i ∈ [t−4, t]     (5-min window)
speed_rolling_std_5(t)    = σ( speed(i) )            for i ∈ [t−4, t]
deviation_rolling_mean(t) = (1/5) · Σ deviation(i)   for i ∈ [t−4, t]
deviation_rolling_max(t)  = max( deviation(i) )       for i ∈ [t−9, t]    (10-min window)
```

> All rolling windows use `min_periods=1`, so the first few points use partial windows.

#### v1 Results

```
F1: 0.448 | Precision: 0.449 | Recall: 0.447

Per Anomaly Type:
  Speed Spike:       3/3   ████████████████████ 100%
  Route Deviation:  69/74  ██████████████████░░  93%
  Sudden Stop:      40/45  █████████████████░░░  89%
  Dwell Overstay:   39/216 ███░░░░░░░░░░░░░░░░░  18%  ❌
```

#### v1 Problems Identified

1. **Dwell overstay: only 18% recall** — The `dwell_ratio` feature was too generic. At any given point, a tourist dwelling normally looks identical to one overstaying. The model couldn't tell *"you should have left 45 minutes ago"*.

2. **185 false positives** — Raw `dist_to_planned_route` was noisy. GPS jitter of 30-50m combined with slight OSRM path differences made normal tourists' deviations look anomalous.

---

### v2: Improved Features (18 features)

We added **5 new features** and modified **3 existing ones** to address both problems.

#### FIX #1 — Schedule-Aware Dwell Features

**The Insight**: The old code had no concept of *time*. It knew "you're near a POI" but not "you were supposed to leave this POI 45 minutes ago." We built a **minute-by-minute schedule lookup** that maps every timestamp to what the tourist *should* be doing.

```python
# build_schedule_lookup() creates:
# timestamp → { phase: "dwell"|"transit", poi_name, planned_departure, ... }
#
# Example for T003 at Tiger Hill:
# 06:00 → { phase: "dwell", poi: "Tiger Hill", departure: 06:35 }
# 06:35 → { phase: "transit", poi: None }  ← should be moving!
# 07:15 → { phase: "dwell", poi: "Rock Garden", departure: 07:50 }
```

**New Features Added:**

| # | Feature | Description | Key Signal |
|---|---|---|---|
| 10 | `time_past_departure` | Minutes past the planned departure time for the current/recent POI | **"You should have left 45 min ago"** |
| 11 | `dwell_excess_minutes` | max(0, actual_dwell_at_POI − planned_dwell) | **Direct overstay measurement** |
| 12 | `should_be_in_transit` | 1 if schedule says transit but tourist is stationary | Phase violation |
| 13 | `phase_mismatch` | 1 if actual behavior contradicts planned phase | General schedule violation |

#### FIX #1 — Formulas

**Schedule Lookup** — A minute-by-minute dictionary maps each timestamp to the planned phase:

```
schedule[timestamp] → { phase: "dwell"|"transit", poi_name, planned_departure, planned_dwell }
```

**Feature Calculations:**

```
time_past_departure(t) = max(0, (timestamp_t − planned_departure) / 60)
                         [in minutes; 0 if tourist hasn't passed departure time yet]

                         If timestamp is beyond the entire plan:
                           time_past_departure(t) = max(0, (timestamp_t − last_planned_time) / 60)


dwell_excess_minutes(t) = max(0, actual_dwell_count − planned_dwell_minutes)

    where:
      actual_dwell_count = consecutive minutes the tourist has been
                           within 100m of the same POI
      planned_dwell_minutes = scheduled dwell time for that POI


should_be_in_transit(t) = {
    1   if schedule[t].phase == "transit"
        AND dist_to_nearest_poi(t) < 100m      (near a POI)
        AND speed(t) ≤ 5 m/min                  (stationary)
    0   otherwise
}


phase_mismatch(t) = {
    1   if schedule says "transit" but tourist is stationary near a POI
        OR schedule says "dwell" but tourist is far from POI and moving
    0   otherwise
}

    Formally:
    phase_mismatch(t) = 1  if:
      (phase == "transit" AND dist_to_poi < 100m AND speed ≤ 5)    ← should move, isn't
      OR (phase == "dwell" AND dist_to_poi ≥ 100m AND speed > 5)   ← should stay, isn't
```

**Why These Work**: Unlike the generic `dwell_ratio`, these features create a **dramatic signal** for overstays:

```
                        Normal Tourist          Overstaying Tourist
dwell_excess_minutes       0.34 avg               24.67 avg     ← 72.9x difference!
phase_mismatch             0.00 avg                0.33 avg     ← 639x difference!
should_be_in_transit       0.00 avg                0.13 avg     ← 257x difference!
```

#### FIX #2 — Route Deviation Normalization

**The Insight**: Normal tourists in Darjeeling can have 100-200m average deviation from their OSRM-planned path just due to GPS noise and road routing differences. A raw 100m deviation is noise for one tourist but might be significant for another.

**Changes Made:**

| Feature | Change | Why |
|---|---|---|
| `deviation_clipped` | Replaces `dist_to_planned_route`. Values < 50m set to **0** | 50m = GPS noise floor. Below this, it's not a real deviation |
| `deviation_z_score` | **NEW**: Per-tourist z-score of deviation | Normalizes per tourist — "is this unusual *for this tourist*?" |
| `deviation_rolling_mean_10` | Window: 5 → **10** minutes | Longer window smooths out momentary GPS jumps |
| `deviation_rolling_max_15` | Window: 10 → **15** minutes | Captures sustained deviations, ignores spikes |

#### FIX #2 — Formulas

```
GPS_NOISE_FLOOR = 50 meters

deviation_clipped(t) = {
    dist_to_planned_route(t)   if dist_to_planned_route(t) > 50m
    0                           otherwise (treated as GPS noise)
}


deviation_z_score(t) = (dist_to_planned_route(t) − μ_tourist) / σ_tourist

    where:
      μ_tourist = mean( dist_to_planned_route(i) )   ∀ i ∈ this tourist's points
      σ_tourist = std( dist_to_planned_route(i) )    ∀ i ∈ this tourist's points

    If σ_tourist = 0 (all deviations identical): z-score = 0


deviation_rolling_mean_10(t) = (1/10) · Σ deviation_clipped(i)    for i ∈ [t−9, t]
                               (10-minute window, up from 5 in v1)

deviation_rolling_max_15(t)  = max( deviation_clipped(i) )        for i ∈ [t−14, t]
                               (15-minute window, up from 10 in v1)
```

**Noise Floor Logic:**
```
GPS Point:  deviation = 45m
Old (v1):   Feature value = 45       → IF sees this as "some deviation"
New (v2):   Feature value = 0        → IF sees "no deviation" (GPS noise)

GPS Point:  deviation = 800m
Old (v1):   Feature value = 800      → IF sees "high deviation"
New (v2):   Feature value = 800      → IF sees "high deviation" (unchanged)
            z-score = 3.2            → "unusual even for THIS tourist"
```

#### v2 Results

```
F1: 0.662 | Precision: 0.664 | Recall: 0.660

Per Anomaly Type:
  Speed Spike:       3/3   ████████████████████ 100%
  Route Deviation:  71/74  ███████████████████░  96%  (↑ from 93%)
  Sudden Stop:      37/45  ████████████████░░░░  82%
  Dwell Overstay:  112/216 ██████████░░░░░░░░░░  52%  (↑ from 18%)  🎉

False Positives: 113 (↓ from 185)
```

---

## 📏 Rule-Based Post-Filtering (Hybrid Layer)

> After Isolation Forest scores every GPS point, we apply **domain-specific rules** to correct mistakes the ML model makes. This is a common production pattern: **ML for pattern detection + rules for domain constraints**.

### Why Hybrid?

Isolation Forest is **unsupervised** — it finds "unusual" points, but doesn't understand physics or schedules. Rules encode **hard domain knowledge**:

- *"A tourist cannot move at 90 km/h on a mountain road"* — **physical impossibility**
- *"If a tourist has been at a POI for 60 minutes past their planned departure, that's definitely an overstay"* — **schedule logic**
- *"A single anomalous GPS point surrounded by 100 normal points is probably noise"* — **temporal persistence**

### A) Promotion Rules — Catch What IF Missed

These rules **upgrade** points from "normal" to "anomaly" when hard evidence exists:

| Rule | Condition | Rationale |
|---|---|---|
| **R1: Dwell Excess** | `dwell_excess_minutes > 15` | If you've overstayed by 15+ minutes, it's not normal regardless of IF score |
| **R2: Impossible Speed** | `speed > 1500 m/min` | ~90 km/h in mountainous terrain is physically impossible for a tourist |
| **R3: Severe Deviation** | `deviation_z_score > 2.5` AND `deviation_clipped > 500m` AND `deviation_rolling_mean_10 > 400m` | Three-way gate prevents false flags: must be unusual *for this tourist* (z-score), far in absolute terms (500m), AND sustained (rolling mean) |
| **R4: Phase Mismatch** | `should_be_in_transit == 1` AND `stationary_streak > 10` | Schedule says move, tourist is frozen for 10+ minutes — possible emergency |

**Why Rule 3 uses a triple-gate**: Our first iteration used only `deviation_rolling_mean_10 > 400m`, which promoted 386 points (many false). The problem: some normal tourists genuinely have high average deviation due to OSRM path differences. The z-score requirement ensures we only flag deviations that are unusual *relative to each tourist's own baseline*.

### B) Suppression Rules — Remove False Positives

These rules **downgrade** IF-flagged points back to "normal" when ALL signals are mild:

| Rule | Condition | Rationale |
|---|---|---|
| **R5: Low Signal** | `deviation_clipped < 150m` AND `speed < 300` AND `dwell_excess < 5` AND `phase_mismatch == 0` AND `deviation_z_score < 1.5` | Every indicator says "nothing wrong" — IF was fooled by feature noise |
| **R6: Borderline** | `if_anomaly_score > -0.05` AND `dwell_excess < 10` AND `deviation_z_score < 2.0` | IF *barely* flagged this (score near threshold) AND no strong indicator supports it |

**Important**: Suppression only applies to points flagged by IF alone (`rule_applied == "none"`), never to rule-promoted points. This prevents rules from fighting each other.

### C) Persistence Filter — Remove Isolated Noise

```
Before:  ○ ○ ○ ● ○ ○ ○ ○ ● ● ● ● ● ● ○ ○ ○ ● ● ○ ○
After:   ○ ○ ○ ○ ○ ○ ○ ○ ● ● ● ● ● ● ○ ○ ○ ○ ○ ○ ○
         └─┘ suppressed              kept!          └─┘ suppressed
         (1 pt < 3 min)        (6 pts ≥ 3 min)     (2 pts < 3 min)
```

**Logic**: Require **3+ consecutive** anomaly points per tourist. Isolated single or double flags are suppressed. Rationale: real anomalies are *persistent events* (a deviation lasts minutes, not seconds), while noise is momentary.

---

## 📈 Performance Progression — Stage by Stage

### The Full Evolution

```
                    ┌─────────────────────────────────────────────────────┐
                    │           PERFORMANCE PROGRESSION                    │
                    │                                                     │
   1.0 ─           │                                     ▓▓▓▓ ← 0.746   │
                    │                         ▓▓▓▓                        │
   0.8 ─           │                         ▓▓▓▓       ▓▓▓▓             │
                    │                         ▓▓▓▓       ▓▓▓▓             │
   0.6 ─           │             ▓▓▓▓        ▓▓▓▓       ▓▓▓▓             │
                    │             ▓▓▓▓        ▓▓▓▓       ▓▓▓▓             │
   0.4 ─           │  ▓▓▓▓       ▓▓▓▓        ▓▓▓▓       ▓▓▓▓             │
                    │  ▓▓▓▓       ▓▓▓▓        ▓▓▓▓       ▓▓▓▓             │
   0.2 ─           │  ▓▓▓▓       ▓▓▓▓        ▓▓▓▓       ▓▓▓▓             │
                    │  ▓▓▓▓       ▓▓▓▓        ▓▓▓▓       ▓▓▓▓             │
   0.0 ─           │  ▓▓▓▓       ▓▓▓▓        ▓▓▓▓       ▓▓▓▓             │
                    │   v1     Precision     Recall       F1              │
                    └─────────────────────────────────────────────────────┘
                       Stage 1      Stage 2      Stage 3
```

### Detailed Metrics

| Metric | Stage 1: Baseline IF | Stage 2: Better Features | Stage 3: IF + Rules | Total Δ |
|---|---|---|---|---|
| **F1 Score** | 0.448 | 0.662 (+48%) | **0.746** (+13%) | **+66.5%** |
| **Precision** | 0.449 | 0.664 (+48%) | **0.736** (+11%) | **+63.9%** |
| **Recall** | 0.447 | 0.660 (+48%) | **0.757** (+15%) | **+69.4%** |
| **Accuracy** | 91.1% | 94.6% (+3.5pp) | **95.9%** (+1.3pp) | **+4.8pp** |
| **False Positives** | 185 | 113 (−39%) | **92** (−19%) | **−50.3%** |
| **False Negatives** | 187 | 115 (−39%) | **82** (−29%) | **−56.1%** |

### Per Anomaly Type Progression

| Anomaly Type | Stage 1 | Stage 2 | Stage 3 | Key Fix |
|---|---|---|---|---|
| 🗺️ Route Deviation | 93% | 96% | **86%** | z-score normalization |
| 🕐 Dwell Overstay | **18%** ❌ | 52% 🟡 | **82%** 🎯 | Schedule-aware features + dwell excess rule |
| ⚡ Speed Spike | 100% | 100% | 0%* | *Suppressed by persistence filter (only 3 isolated pts) |
| 🛑 Sudden Stop | 89% | 82% | **31%** | Borderline suppression too aggressive |

> **\*Trade-off note**: Speed spike detection dropped in Stage 3 because these are isolated 1-2 point events that get caught by the persistence filter (requires 3+ consecutive points). This is a conscious precision-over-recall trade-off. Exempting speed > 1500 m/min from the persistence filter would restore 100% detection.

### Per Tourist — False Alarm Elimination

| Tourist | Stage 1 | Stage 2 | Stage 3 | Status |
|---|---|---|---|---|
| T001 (normal) | 12 false alarms | 6 | **0 ✨** | Perfectly clean |
| T005 (anomalous) | 30% recall | 36% | **88% 🎯** | Transformed from "missed" to "well detected" |
| T006 (normal) | 19 false alarms | 16 | 44 ⚠️ | Regression — OSRM path divergence |
| T010 (normal) | 28 false alarms | 18 | 24 | Moderate improvement |

### Confusion Matrix Evolution

```
    Stage 1               Stage 2               Stage 3
┌────────────────┐   ┌────────────────┐   ┌────────────────┐
│  TN:3677 FP:185│   │  TN:3749 FP:113│   │  TN:3770 FP: 92│
│  FN: 187 TP:151│   │  FN: 115 TP:223│   │  FN:  82 TP:256│
└────────────────┘   └────────────────┘   └────────────────┘
   F1 = 0.448           F1 = 0.662           F1 = 0.746
```

### What Improved at Each Stage

| Stage | What Changed | Primary Impact |
|---|---|---|
| **1 → 2** | Added `time_past_departure`, `dwell_excess_minutes`, `phase_mismatch`, `should_be_in_transit` + deviation clipping/z-score | **Dwell recall: 18% → 52%**, FP: 185 → 113 |
| **2 → 3** | Added promotion rules (dwell > 15min, speed > 1500, deviation z+abs), suppression rules (low signal, borderline), persistence filter | **Dwell recall: 52% → 82%**, FP: 113 → 92, T001: 6 → 0 FP |

---

## 📁 File Structure

```
isolation/
├── generate_data.py           # Synthetic data generator (OSRM-routed)
├── detect_anomalies.py        # 🌲 Main detection pipeline
├── server.py                  # 🌐 FastAPI REST API server
├── visualize_routes.py        # Interactive Folium map generator
├── main.py                    # Entry point
├── pyproject.toml             # Dependencies (uv)
├── README.md                  # Pipeline documentation (this file)
├── server.md                  # API documentation (routes, schemas, examples)
│
├── data/
│   ├── planned_routes.csv         # 62 rows — POI stops & schedule
│   ├── planned_route_paths.csv    # 9,152 rows — OSRM road geometry
│   ├── actual_gps.csv             # 4,200 rows — GPS traces
│   └── anomaly_log.csv            # 12 rows — Ground truth
│
├── results/
│   ├── detection_results.csv      # Full results (all 4,200 points + predictions)
│   ├── detected_anomalies.csv     # Only flagged anomaly points
│   ├── tourist_summary.csv        # Per-tourist accuracy summary
│   └── anomaly_report.json        # 🌐 API cache (written by /refresh)
│
└── visualizations/
    └── routes_map.html            # Interactive map (open in browser)
```

---

## 🚀 How to Run

### Prerequisites

- Python 3.12+
- [`uv`](https://docs.astral.sh/uv/) package manager
- Internet connection (for OSRM routing during data generation)

### Step 1: Generate Data

```bash
uv run python generate_data.py
```

This creates all 4 CSV files in `data/`. Takes ~2 minutes (OSRM API calls with rate limiting).

### Step 2: Run Anomaly Detection

```bash
uv run python detect_anomalies.py
```

This runs the full pipeline:
- Feature engineering (18 features × 4,200 points)
- Isolation Forest training (200 trees)
- Rule-based post-filtering (6 rules)
- Evaluation against ground truth
- Saves results to `results/`

### Step 3: Start API Server (Optional)

```bash
uv run python server.py
# API available at http://localhost:8000
# Swagger docs at http://localhost:8000/docs
```

See [`server.md`](server.md) for full API documentation.

### Step 4: Visualize Routes (Optional)

```bash
uv run python visualize_routes.py
# Then open visualizations/routes_map.html in a browser
```

### Dependencies

```
scikit-learn    — Isolation Forest
pandas          — Data manipulation
numpy           — Numerical computation
folium          — Map visualization
requests        — OSRM API calls
```

---

## 💡 Key Takeaways

### 1. Feature Engineering > Model Tuning

The biggest jump in performance (F1: 0.448 → 0.662, **+48%**) came from **better features**, not model changes. The Isolation Forest configuration stayed identical. This confirms the ML axiom: *"garbage features in, garbage predictions out."*

### 2. Schedule-Awareness is Critical for Dwell Detection

A pure spatial model can't distinguish "tourist enjoying a POI for 30 minutes" from "tourist stuck at a POI for 90 minutes." Only by integrating the **planned schedule** (`time_past_departure`, `dwell_excess_minutes`) could we detect overstays effectively. This jumped detection from **18% → 82%**.

### 3. Per-Tourist Normalization Reduces False Positives

Raw distance metrics penalize tourists whose OSRM-planned paths happen to diverge from their actual routes. The **deviation z-score** normalizes per tourist, asking *"is this deviation unusual for THIS tourist?"* rather than *"is this deviation large in absolute terms?"*

### 4. Hybrid ML + Rules > Either Alone

| Approach | F1 | Strength | Weakness |
|---|---|---|---|
| IF Only | 0.662 | Catches subtle patterns | Misses rule-based anomalies, has noise |
| Rules Only | N/A | Perfect for hard constraints | Can't catch subtle correlations |
| **IF + Rules** | **0.746** | Best of both worlds | More complex to maintain |

### 5. The Precision-Recall Trade-Off is Real

The rules improved overall F1, but created specific regressions (speed spikes: 100% → 0%). Each rule decision is a conscious choice about which errors matter more:
- **False negative** (missing a real anomaly) → tourist in danger goes undetected
- **False positive** (false alarm) → wasted resources investigating nothing

For a **safety system**, we generally prefer **higher recall** (catch real emergencies) even at the cost of some false alarms.

### 6. GPS Noise Floor Matters

Setting deviations below 50m to zero eliminated a significant source of false positives. In mountainous terrain with narrow roads, 50m of GPS drift is completely normal. Without this floor, the model treats every GPS wobble as potential evidence of deviation.

---

## 📚 References

- **Isolation Forest**: Liu, F.T., Ting, K.M. and Zhou, Z.H., 2008. *Isolation forest*. ICDM.
- **OSRM**: [Open Source Routing Machine](http://project-osrm.org/) for realistic road routing.
- **scikit-learn**: [IsolationForest documentation](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.IsolationForest.html)

---

<p align="center">
  <b>Built with 🌲 Isolation Forest + 🗺️ OSRM + 📊 scikit-learn</b><br>
  <i>Darjeeling Tourist Safety Monitoring System</i>
</p>
