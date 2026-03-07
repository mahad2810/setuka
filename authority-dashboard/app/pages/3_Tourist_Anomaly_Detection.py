import streamlit as st
import pandas as pd
import json
import os
import sys

# Ensure isolating module can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from isolation_module.server import run_detection_pipeline
import folium
from streamlit_folium import folium_static

st.set_page_config(page_title="Tourist Anomaly Detection", layout="wide")

st.title("🌲 Tourist Isolation Forest & Rule-based Detection")
st.markdown("This module monitors tourist GPS routes against their planned schedules, detecting overstays, unexpected route deviations, and emergency stops using unsupervised ML.")

# We will cache the pipeline so we don't rerun it every time the streamlit UI interacts
if 'report_data' not in st.session_state:
    st.session_state.report_data = None

col1, col2 = st.columns([1, 4])
with col1:
    if st.button("🔄 Refresh Detection Pipeline", type="primary"):
        with st.spinner("Running Feature Engineering, Isolation Forest, and Rules..."):
            st.session_state.report_data = run_detection_pipeline()
            st.success("Pipeline executed successfully!")

report = st.session_state.report_data

if report is None:
    st.info("Click 'Refresh Detection Pipeline' to load anomaly data.")
    st.stop()

# Overall Summary Metrics
st.markdown("---")
st.subheader("Global Detection Summary")
metric_col1, metric_col2, metric_col3, metric_col4 = st.columns(4)
metric_col1.metric("Total Tourists Monitored", report.get("total_tourists", 0))
metric_col2.metric("Total GPS Points Analyzed", report.get("total_gps_points", 0))
metric_col3.metric("Flagged Tourists", report.get("flagged_count", 0))
metric_col4.metric("Last Updated", report.get("generated_at", "")[:16].replace("T", " "))

st.markdown("---")
st.subheader("Tourist Anomaly Explorer")

flagged_tourists = report.get("flagged_tourist_ids", [])
all_tourists = sorted(report.get("tourists", {}).keys())

selected_tourist = st.selectbox("Select Tourist ID to view details:", all_tourists)

t_data = report["tourists"].get(selected_tourist)
if t_data:
    st.markdown(f"### Details for {selected_tourist}")
    if not t_data.get("anomaly_detected"):
        st.success("✅ Clean: No anomalies detected for this tourist route.")
    else:
        st.error(f"⚠️ Anomalies Detected! Overall Severity: {t_data.get('overall_severity')}")
        st.write(f"**Anomaly Percentage:** {t_data.get('anomaly_percentage')}% ({t_data.get('anomaly_points_count')} out of {t_data.get('total_points')} points)")
        st.write(f"**Types of Anomalies:** {', '.join(t_data.get('anomaly_types', []))}")
        
        st.markdown("#### Anomaly Events Timeline")
        events = t_data.get("anomaly_events", [])
        for e in events:
            with st.expander(f"[{e['severity']}] {e['type']} ({e['duration_minutes']} minutes)"):
                st.write(f"**Started:** {e['start_timestamp']}")
                st.write(f"**Ended:** {e['end_timestamp']}")
                if e.get('nearest_planned_poi'):
                    st.write(f"**Nearest Planned POI:** {e['nearest_planned_poi']}")
                df_points = pd.DataFrame(e.get("points", []))
                if not df_points.empty:
                    st.dataframe(df_points[['timestamp', 'speed', 'deviation_m', 'dwell_excess_min', 'rule_applied']])
                    
        st.markdown("#### Route Deviation Map")
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        planned_paths_file = os.path.join(base_dir, 'isolation_module', 'data', 'planned_route_paths.csv')
        actual_gps_file = os.path.join(base_dir, 'isolation_module', 'data', 'actual_gps.csv')
        
        try:
            planned_df = pd.read_csv(planned_paths_file)
            actual_df = pd.read_csv(actual_gps_file)
            
            tourist_planned = planned_df[planned_df['tourist_id'] == selected_tourist]
            tourist_actual = actual_df[actual_df['tourist_id'] == selected_tourist]
            
            if not tourist_actual.empty:
                m = folium.Map(
                    location=[tourist_actual['latitude'].mean(), tourist_actual['longitude'].mean()],
                    zoom_start=13,
                    tiles="CartoDB dark_matter",
                )

                # ── Planned route (neon blue solid line) ────────────────
                if not tourist_planned.empty:
                    planned_coords = tourist_planned[['latitude', 'longitude']].values.tolist()
                    folium.PolyLine(
                        planned_coords, color='#2979ff', weight=4,
                        opacity=0.8, tooltip='📌 Planned Route',
                    ).add_to(m)
                    # Start / End markers for planned route
                    folium.Marker(
                        planned_coords[0],
                        tooltip='🏁 Planned Start',
                        icon=folium.Icon(color='blue', icon='flag', prefix='fa'),
                    ).add_to(m)
                    folium.Marker(
                        planned_coords[-1],
                        tooltip='🏁 Planned End',
                        icon=folium.Icon(color='darkblue', icon='flag-checkered', prefix='fa'),
                    ).add_to(m)

                # ── Actual GPS trace (neon red dashed) ──────────────────
                actual_coords = tourist_actual[['latitude', 'longitude']].values.tolist()
                folium.PolyLine(
                    actual_coords, color='#ff1744', weight=2.5,
                    opacity=0.9, dash_array='6 4', tooltip='🛰️ Actual GPS Trace',
                ).add_to(m)
                # Actual start dot
                folium.CircleMarker(
                    actual_coords[0], radius=7, color='#ff1744',
                    fill=True, fill_color='#ff1744', fill_opacity=0.9,
                    tooltip='📍 Actual Start',
                ).add_to(m)

                # ── Anomaly markers (glowing orange) ────────────────────
                SEV_COLOR = {'HIGH': '#ff4b4b', 'MEDIUM': '#ffa500', 'LOW': '#ffee58'}
                for e in events:
                    pts = e.get('points', [])
                    if pts:
                        try:
                            lat = pts[0].get('lat', pts[0].get('latitude'))
                            lon = pts[0].get('lon', pts[0].get('longitude'))
                            if lat is not None and lon is not None:
                                sev = str(e.get('severity', 'MEDIUM')).upper()
                                hex_c = SEV_COLOR.get(sev, '#ffa500')
                                popup_html = f"""
                                <div style="font-family:Inter,sans-serif;min-width:200px;">
                                    <h4 style="margin:0 0 6px;color:{hex_c};">⚠️ {e['type']}</h4>
                                    <b>Severity:</b> {e['severity']}<br>
                                    <b>Duration:</b> {e['duration_minutes']} min<br>
                                    <b>Nearest POI:</b> {e.get('nearest_planned_poi','N/A')}
                                </div>"""
                                # Glow ring
                                folium.CircleMarker(
                                    [lat, lon], radius=20, color=hex_c,
                                    fill=True, fill_color=hex_c,
                                    fill_opacity=0.12, weight=1.5,
                                ).add_to(m)
                                folium.Marker(
                                    [lat, lon],
                                    popup=folium.Popup(popup_html, max_width=240),
                                    tooltip=f"⚠️ {e['type']} ({e['severity']})",
                                    icon=folium.Icon(color='orange', icon='exclamation-triangle', prefix='fa'),
                                ).add_to(m)
                        except KeyError:
                            pass

                folium_static(m, width=900, height=500)
                st.markdown(
                    "**Map Legend:** "
                    "<span style='color:#2979ff;font-weight:600;'>━━ Planned Route</span>&nbsp;&nbsp;"
                    "<span style='color:#ff1744;font-weight:600;'>╌╌ Actual GPS Trace</span>&nbsp;&nbsp;"
                    "<span style='color:#ffa500;font-weight:600;'>⚠ Anomaly Point</span>",
                    unsafe_allow_html=True,
                )
        except Exception as e:
            st.warning(f"Could not load map data: {e}")
else:
    st.warning("No data found for the selected tourist.")
