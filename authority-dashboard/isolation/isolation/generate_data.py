"""
Generate synthetic tourist data for Isolation Forest anomaly detection.
Uses OSRM (OpenStreetMap) routing for REALISTIC road-following GPS traces.

Creates:
  1. planned_routes.csv       — 10 tourists, each with a 10-hour planned route (POI stops)
  2. planned_route_paths.csv  — Detailed road-following geometry between planned POIs
  3. actual_gps.csv           — 1-min interval GPS traces for 7 hours (with anomalies)
  4. anomaly_log.csv          — Ground-truth log of all injected anomalies

Area: Darjeeling, West Bengal, India
"""

import csv
import random
import math
import time
import json
import os
from datetime import datetime, timedelta

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    print("⚠️  requests not installed, falling back to straight-line interpolation")

random.seed(42)

# ──────────────────────────────────────────────
# 1. DARJEELING POINTS OF INTEREST (POIs)
# ──────────────────────────────────────────────
POIS = {
    "Tiger Hill":              (27.0125, 88.2650),
    "Batasia Loop":            (27.0230, 88.2580),
    "Ghoom Monastery":         (27.0200, 88.2620),
    "Darjeeling Mall Road":    (27.0410, 88.2627),
    "Observatory Hill":        (27.0430, 88.2600),
    "Peace Pagoda":            (27.0350, 88.2530),
    "Padmaja Naidu Zoo":       (27.0480, 88.2560),
    "Himalayan Mountaineering": (27.0490, 88.2580),
    "Rock Garden":             (27.0280, 88.2480),
    "Happy Valley Tea Estate": (27.0370, 88.2500),
    "Toy Train Station":       (27.0440, 88.2630),
    "Tenzing Rock":            (27.0320, 88.2550),
    "Nehru Road Market":       (27.0400, 88.2640),
    "Chowrasta Square":        (27.0420, 88.2610),
    "Lloyd Botanical Garden":  (27.0460, 88.2540),
}

POI_NAMES = list(POIS.keys())
TRANSPORT_MODES = ["walk", "car", "shared_jeep"]

# Cache for OSRM responses to avoid duplicate calls
_route_cache = {}


# ──────────────────────────────────────────────
# 2. OSRM ROAD ROUTING
# ──────────────────────────────────────────────

def get_road_route(start_lat, start_lon, end_lat, end_lon, profile="driving"):
    """
    Get road-following route from OSRM (OpenStreetMap).
    Returns list of (lat, lon) waypoints along the road.
    Falls back to straight-line if OSRM unavailable.
    """
    cache_key = f"{start_lat:.6f},{start_lon:.6f}_{end_lat:.6f},{end_lon:.6f}_{profile}"
    if cache_key in _route_cache:
        return _route_cache[cache_key]

    if not HAS_REQUESTS:
        return None

    # Map transport modes to OSRM profiles
    osrm_profile = "foot" if profile == "walk" else "driving"

    url = (
        f"http://router.project-osrm.org/route/v1/{osrm_profile}/"
        f"{start_lon},{start_lat};{end_lon},{end_lat}"
        f"?overview=full&geometries=geojson&steps=false"
    )

    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("code") == "Ok" and data.get("routes"):
                coords = data["routes"][0]["geometry"]["coordinates"]
                # OSRM returns [lon, lat], we need (lat, lon)
                road_points = [(c[1], c[0]) for c in coords]
                _route_cache[cache_key] = road_points
                return road_points
    except Exception as e:
        print(f"    ⚠️  OSRM request failed: {e}")

    return None


def sample_points_along_path(road_points, num_points, noise_std=0.00003):
    """
    Sample `num_points` evenly spaced along a road geometry.
    Adds small GPS noise for realism.
    """
    if not road_points or len(road_points) < 2:
        return None

    # Calculate cumulative distances along the path
    distances = [0.0]
    for i in range(1, len(road_points)):
        d = haversine_distance(
            road_points[i - 1][0], road_points[i - 1][1],
            road_points[i][0], road_points[i][1]
        )
        distances.append(distances[-1] + d)

    total_distance = distances[-1]
    if total_distance < 1:  # Less than 1 meter
        return [(road_points[0][0], road_points[0][1])] * num_points

    sampled = []
    for i in range(num_points):
        # Target distance along the path
        target_d = (i / max(num_points - 1, 1)) * total_distance

        # Find the segment containing this distance
        seg_idx = 0
        for j in range(1, len(distances)):
            if distances[j] >= target_d:
                seg_idx = j - 1
                break
        else:
            seg_idx = len(distances) - 2

        # Interpolate within this segment
        seg_start_d = distances[seg_idx]
        seg_end_d = distances[seg_idx + 1]
        seg_len = seg_end_d - seg_start_d

        if seg_len > 0:
            t = (target_d - seg_start_d) / seg_len
        else:
            t = 0

        lat = road_points[seg_idx][0] + t * (road_points[seg_idx + 1][0] - road_points[seg_idx][0])
        lon = road_points[seg_idx][1] + t * (road_points[seg_idx + 1][1] - road_points[seg_idx][1])

        # Add GPS noise
        lat += random.gauss(0, noise_std)
        lon += random.gauss(0, noise_std)

        sampled.append((lat, lon))

    return sampled


# ──────────────────────────────────────────────
# 3. HELPER FUNCTIONS
# ──────────────────────────────────────────────

def haversine_distance(lat1, lon1, lat2, lon2):
    """Distance in meters between two lat-lon points."""
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def interpolate_straight(start_lat, start_lon, end_lat, end_lon, num_points, noise_std=0.00005):
    """Straight-line interpolation (fallback when OSRM unavailable)."""
    points = []
    for i in range(num_points):
        t = i / max(num_points - 1, 1)
        lat = start_lat + t * (end_lat - start_lat) + random.gauss(0, noise_std)
        lon = start_lon + t * (end_lon - start_lon) + random.gauss(0, noise_std)
        points.append((lat, lon))
    return points


def interpolate_path(start_lat, start_lon, end_lat, end_lon, num_points,
                     noise_std=0.00003, transport_mode="driving"):
    """
    Generate GPS points between two locations following real roads.
    Falls back to straight-line if OSRM is unavailable.
    """
    # Try OSRM road routing first
    road_points = get_road_route(start_lat, start_lon, end_lat, end_lon, profile=transport_mode)

    if road_points:
        sampled = sample_points_along_path(road_points, num_points, noise_std=noise_std)
        if sampled:
            return sampled

    # Fallback: straight line
    return interpolate_straight(start_lat, start_lon, end_lat, end_lon, num_points, noise_std=0.00005)


def generate_dwell_points(lat, lon, num_points, wander_radius=0.0002):
    """GPS points for a tourist dwelling at a location."""
    points = []
    for _ in range(num_points):
        dlat = random.gauss(0, wander_radius / 3)
        dlon = random.gauss(0, wander_radius / 3)
        points.append((lat + dlat, lon + dlon))
    return points


# ──────────────────────────────────────────────
# 4. GENERATE PLANNED ROUTES
# ──────────────────────────────────────────────

def generate_planned_routes(num_tourists=10, total_hours=10):
    """
    Each tourist gets 5-7 POIs over 10 hours.
    Also fetches OSRM road geometry for the path between each consecutive POI pair.
    Returns: (routes_list, route_paths_list)
    """
    routes = []
    route_paths = []  # Detailed road geometry between POIs
    start_date = datetime(2026, 3, 5, 6, 0, 0)

    for tourist_id in range(1, num_tourists + 1):
        tid = f"T{tourist_id:03d}"
        num_stops = random.randint(5, 7)
        selected_pois = random.sample(POI_NAMES, num_stops)
        selected_pois.sort(key=lambda p: POIS[p][0])

        current_time = start_date
        total_available_minutes = total_hours * 60
        total_dwell = int(total_available_minutes * 0.6)
        total_transit = total_available_minutes - total_dwell

        raw_dwells = [random.randint(20, 80) for _ in range(num_stops)]
        dwell_scale = total_dwell / sum(raw_dwells)
        dwell_times = [max(15, int(d * dwell_scale)) for d in raw_dwells]

        raw_transits = [random.randint(10, 40) for _ in range(num_stops - 1)]
        if sum(raw_transits) > 0:
            transit_scale = total_transit / sum(raw_transits)
            transit_times = [max(5, int(t * transit_scale)) for t in raw_transits]
        else:
            transit_times = [total_transit // max(num_stops - 1, 1)] * (num_stops - 1)

        print(f"     {tid}: ", end="", flush=True)

        for i, poi_name in enumerate(selected_pois):
            lat, lon = POIS[poi_name]
            arrival_time = current_time
            dwell = dwell_times[i]
            departure_time = arrival_time + timedelta(minutes=dwell)

            if i < num_stops - 1:
                transport = random.choice(TRANSPORT_MODES)
                transit = transit_times[i]
            else:
                transport = "end"
                transit = 0

            routes.append({
                "tourist_id": tid,
                "stop_order": i + 1,
                "poi_name": poi_name,
                "poi_lat": round(lat, 6),
                "poi_lon": round(lon, 6),
                "planned_arrival": arrival_time.strftime("%Y-%m-%d %H:%M:%S"),
                "planned_departure": departure_time.strftime("%Y-%m-%d %H:%M:%S"),
                "planned_dwell_minutes": dwell,
                "transport_to_next": transport,
                "transit_minutes_to_next": transit,
            })

            # Fetch road geometry to the NEXT POI
            if i < num_stops - 1:
                next_poi = selected_pois[i + 1]
                next_lat, next_lon = POIS[next_poi]
                print(f"🛣️", end="", flush=True)

                road_pts = get_road_route(lat, lon, next_lat, next_lon, profile=transport)
                time.sleep(0.3)  # Rate-limit OSRM

                if road_pts:
                    for pt_idx, (pt_lat, pt_lon) in enumerate(road_pts):
                        route_paths.append({
                            "tourist_id": tid,
                            "segment_order": i + 1,
                            "from_poi": poi_name,
                            "to_poi": next_poi,
                            "point_order": pt_idx,
                            "latitude": round(pt_lat, 6),
                            "longitude": round(pt_lon, 6),
                            "transport_mode": transport,
                        })
                else:
                    # Fallback: straight line with 20 intermediate points
                    for pt_idx in range(20):
                        t = pt_idx / 19
                        pt_lat = lat + t * (next_lat - lat)
                        pt_lon = lon + t * (next_lon - lon)
                        route_paths.append({
                            "tourist_id": tid,
                            "segment_order": i + 1,
                            "from_poi": poi_name,
                            "to_poi": next_poi,
                            "point_order": pt_idx,
                            "latitude": round(pt_lat, 6),
                            "longitude": round(pt_lon, 6),
                            "transport_mode": transport,
                        })

            current_time = departure_time + timedelta(minutes=transit)

        print(f" ✅ {num_stops} stops")

    return routes, route_paths


# ──────────────────────────────────────────────
# 5. GENERATE ACTUAL GPS TRACES (WITH ANOMALIES)
# ──────────────────────────────────────────────

ANOMALY_PLAN = {
    "T001": [],
    "T002": ["route_deviation"],
    "T003": ["dwell_anomaly"],
    "T004": ["speed_anomaly"],
    "T005": ["route_deviation", "dwell_anomaly"],
    "T006": [],
    "T007": ["route_deviation"],
    "T008": ["speed_anomaly"],
    "T009": ["dwell_anomaly", "speed_anomaly"],
    "T010": [],
}

DEVIATION_ZONES = [
    (27.005, 88.240),   # Remote forest south of Tiger Hill
    (27.055, 88.270),   # Off-trail area north
    (27.015, 88.275),   # Steep ravine area
]


def generate_actual_gps(planned_routes, total_hours=7):
    """
    Generate minute-by-minute GPS data following real roads.
    Inject anomalies based on ANOMALY_PLAN.
    """
    gps_data = []
    anomaly_log = []
    start_time = datetime(2026, 3, 5, 6, 0, 0)
    end_time = start_time + timedelta(hours=total_hours)

    tourist_routes = {}
    for row in planned_routes:
        tid = row["tourist_id"]
        if tid not in tourist_routes:
            tourist_routes[tid] = []
        tourist_routes[tid].append(row)

    total_tourists = len(tourist_routes)
    osrm_call_count = 0

    for t_idx, (tourist_id, stops) in enumerate(sorted(tourist_routes.items())):
        anomalies = ANOMALY_PLAN.get(tourist_id, [])
        minute_points = []

        print(f"   [{t_idx + 1}/{total_tourists}] {tourist_id}: ", end="", flush=True)

        for i, stop in enumerate(stops):
            poi_lat = stop["poi_lat"]
            poi_lon = stop["poi_lon"]
            arrival = datetime.strptime(stop["planned_arrival"], "%Y-%m-%d %H:%M:%S")
            departure = datetime.strptime(stop["planned_departure"], "%Y-%m-%d %H:%M:%S")
            dwell_minutes = int((departure - arrival).total_seconds() / 60)

            # Transit from previous stop (road-routed)
            if i > 0:
                prev_stop = stops[i - 1]
                prev_departure = datetime.strptime(prev_stop["planned_departure"], "%Y-%m-%d %H:%M:%S")
                transit_minutes = int((arrival - prev_departure).total_seconds() / 60)
                transport_mode = prev_stop["transport_to_next"]

                if transit_minutes > 0:
                    print(f"🛣️", end="", flush=True)
                    transit_points = interpolate_path(
                        prev_stop["poi_lat"], prev_stop["poi_lon"],
                        poi_lat, poi_lon,
                        transit_minutes,
                        noise_std=0.00003,
                        transport_mode=transport_mode,
                    )
                    osrm_call_count += 1

                    # Small delay to be nice to OSRM public server
                    time.sleep(0.3)

                    for j, (lat, lon) in enumerate(transit_points):
                        ts = prev_departure + timedelta(minutes=j)
                        if ts < end_time:
                            minute_points.append((ts, lat, lon, "transit", transport_mode))

            # Dwell at POI
            print(f"📍", end="", flush=True)
            dwell_pts = generate_dwell_points(poi_lat, poi_lon, dwell_minutes)
            for j, (lat, lon) in enumerate(dwell_pts):
                ts = arrival + timedelta(minutes=j)
                if ts < end_time:
                    minute_points.append((ts, lat, lon, "dwell", stop["poi_name"]))

        # Sort and trim
        minute_points.sort(key=lambda x: x[0])
        minute_points = [p for p in minute_points if p[0] < end_time]
        print(f" → {len(minute_points)} pts", end="")

        # ── Inject Anomalies ──

        # --- ROUTE DEVIATION ---
        if "route_deviation" in anomalies:
            deviation_start_idx = random.randint(
                int(len(minute_points) * 0.3),
                int(len(minute_points) * 0.5)
            )
            deviation_duration = random.randint(20, 35)
            deviation_target = random.choice(DEVIATION_ZONES)

            dev_start_time = minute_points[deviation_start_idx][0]
            anomaly_log.append({
                "tourist_id": tourist_id,
                "anomaly_type": "route_deviation",
                "start_time": dev_start_time.strftime("%Y-%m-%d %H:%M:%S"),
                "end_time": (dev_start_time + timedelta(minutes=deviation_duration)).strftime("%Y-%m-%d %H:%M:%S"),
                "description": f"Deviated to ({deviation_target[0]:.4f}, {deviation_target[1]:.4f}), "
                               f"~{deviation_duration} min off-route into remote area",
                "severity": "HIGH"
            })

            orig_lat = minute_points[deviation_start_idx][1]
            orig_lon = minute_points[deviation_start_idx][2]
            half = deviation_duration // 2

            # Deviation goes off-road (intentionally NOT road-snapped)
            outward = interpolate_straight(
                orig_lat, orig_lon,
                deviation_target[0], deviation_target[1],
                half, noise_std=0.0001
            )
            return_idx = min(deviation_start_idx + deviation_duration, len(minute_points) - 1)
            return_lat = minute_points[return_idx][1]
            return_lon = minute_points[return_idx][2]
            inward = interpolate_straight(
                deviation_target[0], deviation_target[1],
                return_lat, return_lon,
                deviation_duration - half, noise_std=0.0001
            )

            deviation_path = outward + inward
            for j, (lat, lon) in enumerate(deviation_path):
                idx = deviation_start_idx + j
                if idx < len(minute_points):
                    ts = minute_points[idx][0]
                    minute_points[idx] = (ts, lat, lon, "ANOMALY_route_deviation", "off-route")

            print(f" | 🗺️ deviation", end="")

        # --- DWELL-TIME ANOMALY ---
        if "dwell_anomaly" in anomalies:
            dwell_segments = []
            current_dwell_start = None
            for idx, pt in enumerate(minute_points):
                if pt[3] == "dwell":
                    if current_dwell_start is None:
                        current_dwell_start = idx
                elif current_dwell_start is not None:
                    dwell_segments.append((current_dwell_start, idx - 1))
                    current_dwell_start = None
            if current_dwell_start is not None:
                dwell_segments.append((current_dwell_start, len(minute_points) - 1))

            if dwell_segments:
                seg = random.choice(dwell_segments[:len(dwell_segments) // 2 + 1])
                seg_start, seg_end = seg
                poi_name = minute_points[seg_start][4]
                poi_lat = minute_points[seg_start][1]
                poi_lon = minute_points[seg_start][2]
                extra_dwell = random.randint(60, 90)

                anomaly_log.append({
                    "tourist_id": tourist_id,
                    "anomaly_type": "dwell_time_anomaly",
                    "start_time": minute_points[seg_start][0].strftime("%Y-%m-%d %H:%M:%S"),
                    "end_time": minute_points[min(seg_end + extra_dwell, len(minute_points) - 1)][0].strftime("%Y-%m-%d %H:%M:%S"),
                    "description": f"Overstayed at {poi_name} by ~{extra_dwell} extra minutes "
                                   f"(planned dwell: {seg_end - seg_start + 1} min, "
                                   f"actual: {seg_end - seg_start + 1 + extra_dwell} min)",
                    "severity": "MEDIUM-HIGH"
                })

                extra_pts = generate_dwell_points(poi_lat, poi_lon, extra_dwell, wander_radius=0.00015)
                for j in range(extra_dwell):
                    idx = seg_end + 1 + j
                    if idx < len(minute_points):
                        ts = minute_points[idx][0]
                        lat, lon = extra_pts[j]
                        minute_points[idx] = (ts, lat, lon, "ANOMALY_dwell_overstay", poi_name)

                print(f" | 🕐 dwell", end="")

        # --- SPEED ANOMALY ---
        if "speed_anomaly" in anomalies:
            transit_indices = [i for i, pt in enumerate(minute_points) if pt[3] == "transit"]
            if len(transit_indices) > 20:
                anomaly_idx = transit_indices[len(transit_indices) // 2]
                original_lat = minute_points[anomaly_idx][1]
                original_lon = minute_points[anomaly_idx][2]
                teleport_lat = original_lat + random.uniform(0.02, 0.03)
                teleport_lon = original_lon + random.uniform(0.02, 0.03)

                anomaly_log.append({
                    "tourist_id": tourist_id,
                    "anomaly_type": "speed_anomaly",
                    "start_time": minute_points[anomaly_idx][0].strftime("%Y-%m-%d %H:%M:%S"),
                    "end_time": minute_points[min(anomaly_idx + 2, len(minute_points) - 1)][0].strftime("%Y-%m-%d %H:%M:%S"),
                    "description": f"Impossible speed spike: jumped ~3km in 1 minute "
                                   f"from ({original_lat:.4f},{original_lon:.4f}) "
                                   f"to ({teleport_lat:.4f},{teleport_lon:.4f})",
                    "severity": "HIGH"
                })

                ts = minute_points[anomaly_idx][0]
                minute_points[anomaly_idx] = (ts, teleport_lat, teleport_lon, "ANOMALY_speed_spike", "teleport")

                # Sudden stop anomaly
                if len(transit_indices) > 40:
                    stop_start = transit_indices[len(transit_indices) * 3 // 4]
                    stop_lat = minute_points[stop_start][1]
                    stop_lon = minute_points[stop_start][2]
                    stop_duration = 15

                    anomaly_log.append({
                        "tourist_id": tourist_id,
                        "anomaly_type": "speed_anomaly_sudden_stop",
                        "start_time": minute_points[stop_start][0].strftime("%Y-%m-%d %H:%M:%S"),
                        "end_time": minute_points[min(stop_start + stop_duration, len(minute_points) - 1)][0].strftime("%Y-%m-%d %H:%M:%S"),
                        "description": f"Sudden stop for {stop_duration} min during transit "
                                       f"at ({stop_lat:.4f},{stop_lon:.4f}) — possible breakdown",
                        "severity": "MEDIUM"
                    })

                    for j in range(stop_duration):
                        idx = stop_start + j
                        if idx < len(minute_points):
                            ts = minute_points[idx][0]
                            jlat = stop_lat + random.gauss(0, 0.000005)
                            jlon = stop_lon + random.gauss(0, 0.000005)
                            minute_points[idx] = (ts, jlat, jlon, "ANOMALY_sudden_stop", "breakdown")

                print(f" | ⚡ speed", end="")

        print()  # Newline after tourist

        # Write to GPS data
        for ts, lat, lon, status, context in minute_points:
            gps_data.append({
                "tourist_id": tourist_id,
                "timestamp": ts.strftime("%Y-%m-%d %H:%M:%S"),
                "latitude": round(lat, 6),
                "longitude": round(lon, 6),
                "status": status,
                "context": context,
            })

    print(f"\n   🛣️  Total OSRM routing calls: {osrm_call_count}")
    return gps_data, anomaly_log


# ──────────────────────────────────────────────
# 6. WRITE CSV FILES
# ──────────────────────────────────────────────

def write_csv(filepath, data, fieldnames):
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(data)
    print(f"  ✅ Written {len(data)} rows → {filepath}")


def main():
    print("=" * 60)
    print("🗺️  TOURIST DATA GENERATOR — Darjeeling (Road-Routed)")
    print("=" * 60)

    if HAS_REQUESTS:
        print("✅ OSRM routing enabled — paths will follow real roads!")
    else:
        print("⚠️  No requests library — using straight-line paths")

    # ── Planned Routes ──
    print("\n📋 Generating planned routes (10 tourists × 10 hours)...")
    print("   🛣️  Fetching road geometry for planned routes from OSRM...\n")
    planned_routes, planned_paths = generate_planned_routes(num_tourists=10, total_hours=10)
    write_csv(
        "data/planned_routes.csv",
        planned_routes,
        fieldnames=[
            "tourist_id", "stop_order", "poi_name",
            "poi_lat", "poi_lon",
            "planned_arrival", "planned_departure",
            "planned_dwell_minutes",
            "transport_to_next", "transit_minutes_to_next"
        ]
    )
    write_csv(
        "data/planned_route_paths.csv",
        planned_paths,
        fieldnames=[
            "tourist_id", "segment_order", "from_poi", "to_poi",
            "point_order", "latitude", "longitude", "transport_mode"
        ]
    )

    # Route summary
    print("\n  📊 Route Summary:")
    tourist_ids = sorted(set(r["tourist_id"] for r in planned_routes))
    for tid in tourist_ids:
        stops = [r for r in planned_routes if r["tourist_id"] == tid]
        poi_names = [s["poi_name"] for s in stops]
        anomalies = ANOMALY_PLAN.get(tid, [])
        anomaly_str = ", ".join(anomalies) if anomalies else "none (normal)"
        print(f"     {tid}: {len(stops)} stops | Anomalies: {anomaly_str}")
        print(f"           Route: {' → '.join(poi_names)}")

    # ── Actual GPS ──
    print(f"\n📡 Generating actual GPS traces (7 hours, 1-min intervals)...")
    print(f"   🛣️  Fetching road routes from OSRM (OpenStreetMap)...\n")
    gps_data, anomaly_log = generate_actual_gps(planned_routes, total_hours=7)
    write_csv(
        "data/actual_gps.csv",
        gps_data,
        fieldnames=[
            "tourist_id", "timestamp",
            "latitude", "longitude",
            "status", "context"
        ]
    )

    # ── Anomaly Log ──
    print(f"\n🚨 Writing anomaly ground-truth log...")
    write_csv(
        "data/anomaly_log.csv",
        anomaly_log,
        fieldnames=[
            "tourist_id", "anomaly_type",
            "start_time", "end_time",
            "description", "severity"
        ]
    )

    # ── Summary ──
    print("\n" + "=" * 60)
    print("📊 DATA SUMMARY")
    print("=" * 60)
    print(f"  Tourists:           {len(tourist_ids)}")
    print(f"  Planned route rows: {len(planned_routes)}")
    print(f"  GPS data points:    {len(gps_data)}")
    print(f"  Anomalies injected: {len(anomaly_log)}")
    print()

    for tid in tourist_ids:
        tid_points = [g for g in gps_data if g["tourist_id"] == tid]
        anomaly_pts = [g for g in tid_points if "ANOMALY" in g["status"]]
        first_ts = tid_points[0]["timestamp"] if tid_points else "N/A"
        last_ts = tid_points[-1]["timestamp"] if tid_points else "N/A"
        print(f"  {tid}: {len(tid_points):>4} GPS points | "
              f"{len(anomaly_pts):>3} anomalous | "
              f"{first_ts} → {last_ts}")

    print("\n✅ All files saved to data/ directory!")


if __name__ == "__main__":
    os.makedirs("data", exist_ok=True)
    main()
