import streamlit as st
import pandas as pd
import folium
from streamlit_folium import folium_static
import sys
import os
import requests
import concurrent.futures

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from utils.preprocessing import load_spatial_data
from utils.geocoding_utils import get_geocoder

st.set_page_config(page_title="Area Safety Analysis", layout="wide")

st.title("Live Tourist Location & Safety Scoring")

@st.cache_data
def load_data():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    spatial_path = os.path.join(base_dir, 'isolation_module', 'data', 'actual_gps.csv')
    if not os.path.exists(spatial_path):
        raise FileNotFoundError(f"Data not found at {spatial_path}")
    df = load_spatial_data(spatial_path)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    return df

try:
    gdf = load_data()
except Exception as e:
    st.error(f"Failed to load data: {e}")
    st.stop()

def fetch_safety_score(lat, lon):
    url = f"https://safetyscore-regression.onrender.com/score?lat={lat}&lon={lon}"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            return data.get('score', 0), data.get('label', 'Unknown')
    except:
        pass
    return None, 'Error'

# Sidebar slider
min_time = gdf["timestamp"].min()
max_time = gdf["timestamp"].max()

st.sidebar.header("Configuration")
selected_time = st.sidebar.slider(
    "Select Time",
    min_value=min_time.to_pydatetime(),
    max_value=max_time.to_pydatetime(),
    value=min_time.to_pydatetime(),
    step=pd.Timedelta(minutes=15),
    format="YYYY-MM-DD HH:mm"
)

use_safetyscore = st.sidebar.checkbox("Enable Live Safety Scores (API)", True)
use_geocoding = st.sidebar.checkbox("Enable Address Geocoding", True)

st.markdown(f"**Showing Tourist Locations near:** `{selected_time.strftime('%Y-%m-%d %H:%M')}`")

time_window = pd.Timedelta(minutes=30)
mask = (gdf["timestamp"] >= pd.to_datetime(selected_time) - time_window) & \
       (gdf["timestamp"] <= pd.to_datetime(selected_time) + time_window)

# Extract 1 location per tourist in this time window
current_gdf = gdf[mask].sort_values("timestamp").groupby("tourist_id").first().reset_index()

if current_gdf.empty:
    st.warning("No tourist activity detected at this time.")
else:
    if use_safetyscore:
        with st.spinner("Fetching Safety Scores for current tourist locations..."):
            with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                future_to_coords = {
                    executor.submit(fetch_safety_score, row['latitude'], row['longitude']): i 
                    for i, row in current_gdf.iterrows()
                }
                for future in concurrent.futures.as_completed(future_to_coords):
                    idx = future_to_coords[future]
                    try:
                        score, label = future.result()
                    except Exception as exc:
                        score, label = None, 'Error'
                    current_gdf.at[idx, 'computed_safety_score'] = score
                    current_gdf.at[idx, 'safety_level'] = label
                    
            current_gdf['computed_safety_score'] = current_gdf['computed_safety_score'].fillna(0.0)
            current_gdf['safety_level'] = current_gdf['safety_level'].fillna('Unknown')
            
            def map_severity(label):
                label = str(label).lower()
                if 'unsafe' in label: return 'red'
                if 'moderate' in label: return 'orange'
                return 'green'
            
            current_gdf['marker_color'] = current_gdf['safety_level'].apply(map_severity)

    else:
        current_gdf['computed_safety_score'] = 0.0
        current_gdf['safety_level'] = "N/A"
        current_gdf['marker_color'] = "blue"

    # Colour palette for safety levels
    COLOR_MAP = {
        'red':    {'hex': '#ff4b4b', 'label': 'Unsafe'},
        'orange': {'hex': '#ffa500', 'label': 'Moderate'},
        'green':  {'hex': '#00e676', 'label': 'Safe'},
        'blue':   {'hex': '#2196f3', 'label': 'Unknown'},
    }

    col_map, col_details = st.columns([1.5, 1])
    
    with col_map:
        m = folium.Map(
            location=[current_gdf['latitude'].mean(), current_gdf['longitude'].mean()],
            zoom_start=14,
            tiles='CartoDB dark_matter',
        )
        for _, row in current_gdf.iterrows():
            c = row.get('marker_color', 'blue')
            hex_c = COLOR_MAP.get(c, COLOR_MAP['blue'])['hex']
            score_val = row.get('computed_safety_score', 0)
            score_disp = f"{score_val:.2f}" if isinstance(score_val, float) else score_val

            popup_html = f"""
            <div style="font-family:Inter,sans-serif;min-width:190px;">
                <h4 style="margin:0 0 6px;color:{hex_c};">🧍 {row['tourist_id']}</h4>
                <b>Safety Level:</b> {row['safety_level']}<br>
                <b>Score:</b> {score_disp}<br>
                <b>Lat/Lon:</b> {row['latitude']:.5f}, {row['longitude']:.5f}
            </div>"""

            # Outer glow ring
            folium.CircleMarker(
                [row['latitude'], row['longitude']],
                radius=16, color=hex_c, fill=True,
                fill_color=hex_c, fill_opacity=0.12, weight=1,
            ).add_to(m)

            # Solid core circle
            folium.CircleMarker(
                [row['latitude'], row['longitude']],
                radius=7, color=hex_c, fill=True,
                fill_color=hex_c, fill_opacity=0.85, weight=2,
            ).add_to(m)

            folium.Marker(
                [row['latitude'], row['longitude']],
                popup=folium.Popup(popup_html, max_width=250),
                tooltip=f"{row['tourist_id']} — {row['safety_level']}",
                icon=folium.Icon(color=c if c in ('red','orange','green','blue') else 'blue',
                                 icon='person-walking', prefix='fa'),
            ).add_to(m)

        folium_static(m, width=650, height=450)
        
    with col_details:
        st.subheader("Safety Leaderboard")
        if use_safetyscore:
            # Drop geocoder if disabled
            if use_geocoding:
                geo = get_geocoder()
                with st.spinner("Geocoding addresses..."):
                    current_gdf = geo.add_addresses_to_dataframe(current_gdf)

            st.markdown("##### 🚨 Most Unsafe Areas")
            top_danger = current_gdf.sort_values('computed_safety_score', ascending=True).head(5)
            disp_cols = ['tourist_id', 'computed_safety_score', 'safety_level']
            if 'address' in top_danger: disp_cols.append('address')
            st.dataframe(top_danger[disp_cols])
            
            st.markdown("##### 🛡️ Safest Areas")
            top_safe = current_gdf.sort_values('computed_safety_score', ascending=False).head(5)
            st.dataframe(top_safe[disp_cols])
        else:
            st.write("Live Safety Scoring is currently disabled.")
