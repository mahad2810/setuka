import streamlit as st
import pandas as pd
import os
import sys

# Ensure utils can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

st.set_page_config(
    page_title="NE India Public Safety Dashboard",
    page_icon="🛡️",
    layout="wide"
)

def main():
    st.title("🛡️ Crowd & Police Patrol Management System")
    st.markdown("""
    An AI-driven public safety platform for real-time crowd monitoring, police patrol optimization, and tourist safety management across Northeast India.
    """)
    
    # Check if files exist
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    spatial_path = os.path.join(base_dir, 'isolation_module', 'data', 'actual_gps.csv')
    tourist_path = os.path.join(base_dir, 'isolation_module', 'data', 'actual_gps.csv')
    police_path = os.path.join(base_dir, 'police_patrol_dataset.csv')
    
    st.header("Overview")
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.info("📊 Spatial Observations")
        if os.path.exists(spatial_path):
            df = pd.read_csv(spatial_path)
            st.metric("Total Records", len(df))
        else:
            st.warning("spatial_dataset.csv missing.")
            
    with col2:
        st.success("👥 Tourist Itineraries")
        if os.path.exists(tourist_path):
            df = pd.read_csv(tourist_path)
            st.metric("Total Tourists", len(df))
        else:
            st.warning("tourist_dataset.csv missing.")
            
    with col3:
        st.error("🚓 Active Patrols")
        if os.path.exists(police_path):
            df = pd.read_csv(police_path)
            st.metric("Total Officers", len(df))
        else:
            st.warning("police_patrol_dataset.csv missing.")

    st.markdown("---")
    st.subheader("Navigation Guide")
    st.markdown("""
    👈 Use the sidebar to navigate between operational pages:
    - **1 Crowd Safety Scoring:** Perform clustering (DBSCAN) and live risk scoring via an external Safety Scale API.
    - **2 AI Recommendations:** Access AI-driven strategies to reallocate patrols, enhance safety, and interact with LLMs (LangChain, Groq, Gemini).
    - **3 Tourist Anomaly Detection:** Run the Isolation Forest pipeline to detect route deviations and overstays.
    """)

    st.markdown("---")
    st.subheader("📍 Live Tourist Tracking")
    st.write("Real-time locations of **all active tourists** sent from the Tourist Webapp.")

    import json
    from streamlit_folium import folium_static
    import folium
    from datetime import datetime, timezone, timedelta

    IST = timezone(timedelta(hours=5, minutes=30))

    def to_ist(ts_str: str) -> str:
        """Convert a UTC ISO timestamp string to IST and return HH:MM:SS IST."""
        if not ts_str or ts_str == "N/A":
            return "N/A"
        try:
            # Handle both 'Z' suffix and '+00:00' offset
            ts_str = ts_str.replace("Z", "+00:00")
            dt_utc = datetime.fromisoformat(ts_str)
            dt_ist = dt_utc.astimezone(IST)
            return dt_ist.strftime("%d %b %Y, %I:%M:%S %p IST")
        except Exception:
            return ts_str

    live_loc_path = os.path.join(base_dir, "live_location.json")

    # ── Colour palette — cycles through for N tourists ─────────────────────
    PALETTE = [
        ("#00e5ff", "cadetblue"),   # cyan
        ("#00e676", "green"),        # green
        ("#ff4b4b", "red"),          # red
        ("#ffa500", "orange"),       # orange
        ("#ce93d8", "purple"),       # purple
        ("#f06292", "pink"),         # pink
        ("#80cbc4", "darkgreen"),    # teal
        ("#fff176", "beige"),        # yellow
    ]

    header_col, refresh_col = st.columns([5, 1])
    with refresh_col:
        st.button("🔄 Refresh")

    try:
        with open(live_loc_path, "r") as f:
            all_locs: dict = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        all_locs = {}

    # ── Migrate old single-tourist flat format → new multi-user dict ────────
    # Old format: {"latitude": 25.5, "longitude": 85.1, "tourist_id": "...", ...}
    # New format: {"tourist_id_key": {"latitude": ..., "longitude": ..., ...}, ...}
    if "latitude" in all_locs:
        old = all_locs
        tid_key = old.get("tourist_id", "Unknown")
        all_locs = {tid_key: old}

    # Extra safety: keep only dict entries (ignore stray scalar values)
    all_locs = {k: v for k, v in all_locs.items() if isinstance(v, dict)}

    if not all_locs:
        st.info("⏳ No live location broadcasts received yet from any Tourist App.")
    else:
        tourists = list(all_locs.values())
        n = len(tourists)

        with header_col:
            st.success(f"🟢 **{n} active tourist{'s' if n != 1 else ''}** currently broadcasting.")

        # ── Summary table ───────────────────────────────────────────────────
        summary_rows = []
        for entry in tourists:
            ts = entry.get("timestamp", "N/A")
            summary_rows.append({
                "Tourist ID":  entry.get("tourist_id", "?"),
                "Latitude":    round(entry.get("latitude",  0), 5),
                "Longitude":   round(entry.get("longitude", 0), 5),
                "Last Seen (IST)": to_ist(ts),
            })
        st.dataframe(
            pd.DataFrame(summary_rows),
            use_container_width=True,
            hide_index=True,
        )

        # ── Optional: filter to specific tourist ────────────────────────────
        all_ids = ["All tourists"] + [e.get("tourist_id", "?") for e in tourists]
        selected_id = st.selectbox("🔍 Focus on tourist:", all_ids)

        # ── Build Folium map ─────────────────────────────────────────────────
        # Centre on mean of all (or the selected tourist)
        if selected_id == "All tourists":
            visible = tourists
            centre_lat = sum(e["latitude"]  for e in tourists) / n
            centre_lon = sum(e["longitude"] for e in tourists) / n
            zoom      = 12
        else:
            visible = [e for e in tourists if e.get("tourist_id") == selected_id]
            centre_lat = visible[0]["latitude"]
            centre_lon = visible[0]["longitude"]
            zoom       = 15

        m = folium.Map(
            location=[centre_lat, centre_lon],
            zoom_start=zoom,
            tiles="CartoDB dark_matter",
        )

        for idx, entry in enumerate(visible):
            hex_c, folium_c = PALETTE[idx % len(PALETTE)]
            lat = entry["latitude"]
            lon = entry["longitude"]
            tid = entry.get("tourist_id", "Unknown")
            ts  = entry.get("timestamp", "N/A")
            ts_display = to_ist(ts)

            # Outer glow
            folium.CircleMarker(
                location=[lat, lon],
                radius=24,
                color=hex_c,
                fill=True,
                fill_color=hex_c,
                fill_opacity=0.12,
                weight=1.5,
            ).add_to(m)

            # Inner pulse dot
            folium.CircleMarker(
                location=[lat, lon],
                radius=9,
                color=hex_c,
                fill=True,
                fill_color=hex_c,
                fill_opacity=0.7,
                weight=2,
            ).add_to(m)

            popup_html = f"""
            <div style="font-family:Inter,sans-serif;min-width:190px;">
                <h4 style="margin:0 0 6px;color:{hex_c};">🧍 {tid}</h4>
                <b>Lat:</b> {lat:.6f}<br>
                <b>Lon:</b> {lon:.6f}<br>
                <b>Last Seen:</b> {ts_display}
            </div>"""

            folium.Marker(
                location=[lat, lon],
                popup=folium.Popup(popup_html, max_width=260),
                tooltip=f"🧍 {tid} — {ts_display}",
                icon=folium.Icon(
                    color=folium_c,
                    icon="person-walking",
                    prefix="fa",
                ),
            ).add_to(m)

        folium_static(m, height=480)

if __name__ == "__main__":
    main()

