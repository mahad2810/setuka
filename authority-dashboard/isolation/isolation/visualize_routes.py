"""
Visualize Planned vs Actual Tourist Routes on an Interactive Map.

Generates: visualizations/routes_map.html
  - Each tourist has a distinct color
  - Planned route: dashed line + diamond markers at POIs
  - Actual GPS trace: solid line + red circles for anomaly points
  - Layer control to toggle each tourist on/off
"""

import csv
import folium
from folium import plugins
import os
from collections import defaultdict

# ──────────────────────────────────────────────
# 1. LOAD DATA
# ──────────────────────────────────────────────

def load_planned_routes(filepath="data/planned_routes.csv"):
    routes = defaultdict(list)
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            routes[row["tourist_id"]].append({
                "stop_order": int(row["stop_order"]),
                "poi_name": row["poi_name"],
                "lat": float(row["poi_lat"]),
                "lon": float(row["poi_lon"]),
                "arrival": row["planned_arrival"],
                "departure": row["planned_departure"],
                "dwell_min": int(row["planned_dwell_minutes"]),
                "transport": row["transport_to_next"],
                "transit_min": int(row["transit_minutes_to_next"]),
            })
    return routes


def load_actual_gps(filepath="data/actual_gps.csv"):
    traces = defaultdict(list)
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            traces[row["tourist_id"]].append({
                "timestamp": row["timestamp"],
                "lat": float(row["latitude"]),
                "lon": float(row["longitude"]),
                "status": row["status"],
                "context": row["context"],
            })
    return traces


def load_planned_paths(filepath="data/planned_route_paths.csv"):
    """Load detailed road geometry for planned routes."""
    paths = defaultdict(lambda: defaultdict(list))
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            tid = row["tourist_id"]
            seg = int(row["segment_order"])
            paths[tid][seg].append({
                "lat": float(row["latitude"]),
                "lon": float(row["longitude"]),
                "point_order": int(row["point_order"]),
                "from_poi": row["from_poi"],
                "to_poi": row["to_poi"],
                "transport_mode": row["transport_mode"],
            })
    # Sort each segment's points by point_order
    for tid in paths:
        for seg in paths[tid]:
            paths[tid][seg].sort(key=lambda p: p["point_order"])
    return paths


def load_anomaly_log(filepath="data/anomaly_log.csv"):
    anomalies = defaultdict(list)
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            anomalies[row["tourist_id"]].append({
                "type": row["anomaly_type"],
                "start": row["start_time"],
                "end": row["end_time"],
                "description": row["description"],
                "severity": row["severity"],
            })
    return anomalies


# ──────────────────────────────────────────────
# 2. COLOR PALETTE
# ──────────────────────────────────────────────

COLORS = [
    "#e6194b",  # Red
    "#3cb44b",  # Green
    "#4363d8",  # Blue
    "#f58231",  # Orange
    "#911eb4",  # Purple
    "#42d4f4",  # Cyan
    "#f032e6",  # Magenta
    "#bfef45",  # Lime
    "#fabed4",  # Pink
    "#469990",  # Teal
]

ANOMALY_ICONS = {
    "ANOMALY_route_deviation": {"color": "red", "icon": "exclamation-triangle", "prefix": "fa"},
    "ANOMALY_dwell_overstay": {"color": "orange", "icon": "clock-o", "prefix": "fa"},
    "ANOMALY_speed_spike": {"color": "darkred", "icon": "bolt", "prefix": "fa"},
    "ANOMALY_sudden_stop": {"color": "purple", "icon": "stop-circle", "prefix": "fa"},
}


# ──────────────────────────────────────────────
# 3. BUILD MAP
# ──────────────────────────────────────────────

def create_map(planned_routes, planned_paths, actual_traces, anomaly_log):
    # Center the map on Darjeeling
    m = folium.Map(
        location=[27.035, 88.258],
        zoom_start=14,
        tiles=None,
        control_scale=True,
    )

    # Add multiple tile layers
    folium.TileLayer(
        "OpenStreetMap",
        name="🗺️ Street Map",
    ).add_to(m)

    folium.TileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attr="Esri",
        name="🛰️ Satellite",
    ).add_to(m)

    folium.TileLayer(
        "cartodbdark_matter",
        name="🌙 Dark Mode",
    ).add_to(m)

    tourist_ids = sorted(planned_routes.keys())

    for idx, tourist_id in enumerate(tourist_ids):
        color = COLORS[idx % len(COLORS)]
        stops = planned_routes[tourist_id]
        gps_points = actual_traces[tourist_id]
        tourist_anomalies = anomaly_log.get(tourist_id, [])

        anomaly_label = ""
        if tourist_anomalies:
            types = set(a["type"] for a in tourist_anomalies)
            anomaly_label = f" ⚠️ [{', '.join(types)}]"
        else:
            anomaly_label = " ✅ Normal"

        # ── Feature Group for this tourist ──
        fg_planned = folium.FeatureGroup(
            name=f"📋 {tourist_id} — Planned Route",
            show=(idx < 3),  # Show first 3 by default
        )
        fg_actual = folium.FeatureGroup(
            name=f"📡 {tourist_id} — Actual GPS{anomaly_label}",
            show=(idx < 3),
        )

        # ── PLANNED ROUTE: Road-following dashed line + POI markers ──
        tourist_path_segments = planned_paths.get(tourist_id, {})

        if tourist_path_segments:
            # Draw each road segment between POIs
            for seg_order in sorted(tourist_path_segments.keys()):
                seg_points = tourist_path_segments[seg_order]
                seg_coords = [(p["lat"], p["lon"]) for p in seg_points]
                from_poi = seg_points[0]["from_poi"]
                to_poi = seg_points[0]["to_poi"]
                transport = seg_points[0]["transport_mode"]

                folium.PolyLine(
                    seg_coords,
                    color=color,
                    weight=3,
                    opacity=0.7,
                    dash_array="10 6",
                    tooltip=f"{tourist_id} — {from_poi} → {to_poi} ({transport})",
                ).add_to(fg_planned)
        else:
            # Fallback: straight lines between POIs
            planned_coords = [(s["lat"], s["lon"]) for s in stops]
            folium.PolyLine(
                planned_coords,
                color=color,
                weight=3,
                opacity=0.7,
                dash_array="10 6",
                tooltip=f"{tourist_id} — Planned Route",
            ).add_to(fg_planned)

        # POI markers (diamonds)
        for stop in stops:
            popup_html = f"""
            <div style="font-family: 'Segoe UI', sans-serif; min-width: 200px;">
                <h4 style="margin:0; color:{color};">📍 {stop['poi_name']}</h4>
                <hr style="margin:4px 0;">
                <b>Tourist:</b> {tourist_id}<br>
                <b>Stop #:</b> {stop['stop_order']}<br>
                <b>Arrive:</b> {stop['arrival']}<br>
                <b>Depart:</b> {stop['departure']}<br>
                <b>Dwell:</b> {stop['dwell_min']} min<br>
                <b>Next via:</b> {stop['transport']} ({stop['transit_min']} min)
            </div>
            """
            folium.Marker(
                location=[stop["lat"], stop["lon"]],
                popup=folium.Popup(popup_html, max_width=300),
                tooltip=f"{tourist_id} → {stop['poi_name']} (Stop #{stop['stop_order']})",
                icon=folium.Icon(
                    color="white",
                    icon_color=color,
                    icon="star",
                    prefix="fa",
                ),
            ).add_to(fg_planned)

        # ── ACTUAL GPS TRACE: Solid line ──
        actual_coords = [(p["lat"], p["lon"]) for p in gps_points]

        # Solid polyline for the actual path
        folium.PolyLine(
            actual_coords,
            color=color,
            weight=2.5,
            opacity=0.9,
            tooltip=f"{tourist_id} — Actual Track",
        ).add_to(fg_actual)

        # ── ANOMALY MARKERS ──
        # Group consecutive anomaly points and place a single marker at the midpoint
        anomaly_segments = []
        current_segment = []

        for pt in gps_points:
            if "ANOMALY" in pt["status"]:
                current_segment.append(pt)
            else:
                if current_segment:
                    anomaly_segments.append(current_segment)
                    current_segment = []
        if current_segment:
            anomaly_segments.append(current_segment)

        for seg in anomaly_segments:
            # Highlight the anomaly path in red
            seg_coords = [(p["lat"], p["lon"]) for p in seg]
            folium.PolyLine(
                seg_coords,
                color="red",
                weight=5,
                opacity=0.8,
                dash_array="4 4",
            ).add_to(fg_actual)

            # Place a marker at the midpoint of the anomaly segment
            mid = seg[len(seg) // 2]
            anomaly_type = mid["status"]
            icon_cfg = ANOMALY_ICONS.get(anomaly_type, {"color": "red", "icon": "warning", "prefix": "fa"})

            # Find matching anomaly description from log
            matching_desc = ""
            for a in tourist_anomalies:
                if a["start"] <= mid["timestamp"] <= a["end"]:
                    matching_desc = a["description"]
                    break

            popup_html = f"""
            <div style="font-family: 'Segoe UI', sans-serif; min-width: 220px;">
                <h4 style="margin:0; color:red;">🚨 ANOMALY DETECTED</h4>
                <hr style="margin:4px 0;">
                <b>Tourist:</b> {tourist_id}<br>
                <b>Type:</b> {anomaly_type.replace('ANOMALY_', '')}<br>
                <b>Time:</b> {seg[0]['timestamp']} → {seg[-1]['timestamp']}<br>
                <b>Duration:</b> {len(seg)} minutes<br>
                <b>Location:</b> ({mid['lat']:.4f}, {mid['lon']:.4f})<br>
                <hr style="margin:4px 0;">
                <b>Details:</b> {matching_desc}
            </div>
            """

            folium.Marker(
                location=[mid["lat"], mid["lon"]],
                popup=folium.Popup(popup_html, max_width=350),
                tooltip=f"🚨 {tourist_id}: {anomaly_type.replace('ANOMALY_', '')} ({len(seg)} min)",
                icon=folium.Icon(
                    color=icon_cfg["color"],
                    icon=icon_cfg["icon"],
                    prefix=icon_cfg["prefix"],
                ),
            ).add_to(fg_actual)

        # Add feature groups to map
        fg_planned.add_to(m)
        fg_actual.add_to(m)

    # ── MAP CONTROLS ──
    folium.LayerControl(collapsed=False).add_to(m)

    # Add a title
    title_html = """
    <div style="
        position: fixed;
        top: 10px; left: 60px;
        z-index: 1000;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: 'Segoe UI', sans-serif;
        font-size: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    ">
        <b style="font-size: 16px;">🗺️ Tourist Route Visualization — Darjeeling</b><br>
        <span style="color: #aaa;">
            📋 Dashed = Planned Route &nbsp;|&nbsp;
            📡 Solid = Actual GPS &nbsp;|&nbsp;
            🔴 Red = Anomaly
        </span>
    </div>
    """
    m.get_root().html.add_child(folium.Element(title_html))

    # Add a legend
    legend_html = """
    <div style="
        position: fixed;
        bottom: 30px; left: 15px;
        z-index: 1000;
        background: rgba(255,255,255,0.95);
        padding: 12px 16px;
        border-radius: 8px;
        font-family: 'Segoe UI', sans-serif;
        font-size: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        max-height: 220px;
        overflow-y: auto;
    ">
        <b style="font-size: 13px;">🚨 Anomaly Types</b><br>
        <span style="color: red;">━━ Route Deviation</span> — Tourist went off planned path<br>
        <span style="color: orange;">━━ Dwell Overstay</span> — Stayed too long at a stop<br>
        <span style="color: darkred;">━━ Speed Spike</span> — Impossible movement speed<br>
        <span style="color: purple;">━━ Sudden Stop</span> — Unexpected halt during transit<br>
        <hr style="margin: 4px 0;">
        <b>Normal Tourists:</b> T001, T006, T010<br>
        <b>Anomalous:</b> T002, T003, T004, T005, T007, T008, T009
    </div>
    """
    m.get_root().html.add_child(folium.Element(legend_html))

    # Fullscreen plugin
    plugins.Fullscreen(
        position="topleft",
        title="Fullscreen",
        force_separate_button=True,
    ).add_to(m)

    # Minimap
    plugins.MiniMap(toggle_display=True).add_to(m)

    return m


# ──────────────────────────────────────────────
# 4. MAIN
# ──────────────────────────────────────────────

def main():
    print("🗺️  Loading data...")
    planned = load_planned_routes()
    planned_paths = load_planned_paths()
    actual = load_actual_gps()
    anomalies = load_anomaly_log()

    total_path_pts = sum(len(pts) for segs in planned_paths.values() for pts in segs.values())
    print(f"   Planned routes: {sum(len(v) for v in planned.values())} stops across {len(planned)} tourists")
    print(f"   Planned paths:  {total_path_pts} road geometry points")
    print(f"   GPS points:     {sum(len(v) for v in actual.values())} points across {len(actual)} tourists")
    print(f"   Anomalies:      {sum(len(v) for v in anomalies.values())} events")

    print("\n🎨 Building interactive map...")
    route_map = create_map(planned, planned_paths, actual, anomalies)

    os.makedirs("visualizations", exist_ok=True)
    output_path = "visualizations/routes_map.html"
    route_map.save(output_path)
    print(f"\n✅ Map saved to: {output_path}")
    print(f"   Open in browser to explore!")

    # Print per-tourist summary
    print("\n📊 Tourist Summary:")
    for tid in sorted(planned.keys()):
        stops = planned[tid]
        gps = actual[tid]
        anom = anomalies.get(tid, [])
        anom_pts = sum(1 for p in gps if "ANOMALY" in p["status"])
        status = "✅ Normal" if not anom else f"⚠️ {len(anom)} anomalies ({anom_pts} pts)"
        print(f"   {tid}: {len(stops)} planned stops | {len(gps)} GPS points | {status}")


if __name__ == "__main__":
    main()
