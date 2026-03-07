import streamlit as st
import pandas as pd
from streamlit_folium import folium_static
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from utils.preprocessing import load_spatial_data, load_police_data, load_tourist_data
from utils.ai_agents import IntegratedAIManager, PoliceRecommendationAgent, TouristSafetyAgent
from utils.langchain_agents import IntegratedLangChainManager
from utils.map_layers import create_reallocation_map
import concurrent.futures
import requests

def fetch_safety_score(lat, lon):
    url = f"https://safetyscore-regression.onrender.com/score?lat={lat}&lon={lon}"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            return data.get('score', 0), data.get('label', 'Unknown')
    except:
        pass
    return 5.0, 'Unknown'

def score_tourist_locations(tourist_df):
    latest = tourist_df.sort_values('timestamp').groupby('tourist_id').last().reset_index()
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        future_to_idx = {
            executor.submit(fetch_safety_score, row['latitude'], row['longitude']): i
            for i, row in latest.iterrows()
        }
        for future in concurrent.futures.as_completed(future_to_idx):
            idx = future_to_idx[future]
            try:
                score, label = future.result()
            except:
                score, label = 5.0, 'Unknown'
            # Convert safety score 0-10 (higher=safer) to risk score 0-1 (higher=riskier) for agents
            risk = max(0.0, min(1.0, (10.0 - float(score)) / 10.0))
            latest.at[idx, 'risk_score'] = risk
            latest.at[idx, 'safety_label'] = label
            latest.at[idx, 'people_count'] = 1
    return latest

st.set_page_config(page_title="AI Recommendations", layout="wide")
st.title("🤖 AI-Driven Recommendations")

sidebar = st.sidebar
sidebar.header("Agent Toggles")
use_langchain = sidebar.checkbox("Enable AI Task Force Auto-Dispatch", True)
use_comprehensive = sidebar.checkbox("Generate Comprehensive Report", False)

@st.cache_data
def get_datasets():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    spatial = load_spatial_data(os.path.join(base_dir, 'isolation_module', 'data', 'actual_gps.csv'))
    police = load_police_data(os.path.join(base_dir, 'police_patrol_dataset.csv'))
    tourist = load_tourist_data(os.path.join(base_dir, 'isolation_module', 'data', 'actual_gps.csv'))
    return spatial, police, tourist

try:
    spatial_df, patrol_df, tourist_df = get_datasets()
except Exception as e:
    st.error(f"Error loading datasets: {e}")
    st.stop()

if 'ai_results' not in st.session_state:
    st.session_state.ai_results = {}

if sidebar.button("Generate Recommendations", type="primary"):
    with st.spinner("Fetching live area safety scores for tourist locations..."):
        scored_tourists_df = score_tourist_locations(tourist_df)
        
    with st.spinner("AI Agents are analyzing the current live state..."):
        st.session_state.realloc_map = create_reallocation_map(scored_tourists_df, patrol_df)
        
        if use_langchain:
            manager = IntegratedLangChainManager()
            st.session_state.ai_results['langchain'] = manager.run_multi_agent_analysis(scored_tourists_df, patrol_df, scored_tourists_df)
            
        if use_comprehensive:
            manager = IntegratedAIManager()
            st.session_state.ai_results['comprehensive'] = manager.generate_comprehensive_report(scored_tourists_df, patrol_df, scored_tourists_df)

if 'langchain' in st.session_state.ai_results:
    st.header("LangChain Multi-Agent Analysis")
    results = st.session_state.ai_results['langchain']
    col1, col2, col3 = st.columns(3)
    with col1:
        st.subheader("Police Allocation")
        st.info(results.get('police_allocation', 'N/A'))
    with col2:
        st.subheader("Tourist Management")
        st.success(results.get('tourist_management', 'N/A'))
    with col3:
        st.warning(results.get('low_crowd_recommendations', 'N/A'))
        
    st.markdown("---")

if 'realloc_map' in st.session_state:
    st.subheader("📍 Real-time Patrol Reallocation Map")
    folium_static(st.session_state.realloc_map, width=1200, height=500)
    st.markdown("**Legend:** Gray = Current | Red = Target Hotspot | Blue Line = Reallocation Path")
    st.markdown("---")

if 'comprehensive' in st.session_state.ai_results:
    st.header("Comprehensive Groq / Gemini Report")
    report = st.session_state.ai_results['comprehensive']
        
    st.subheader("Critical Alerts")
    for alert in report.get('critical_alerts', []):
        st.error(alert)
        
    st.subheader("Police Recommendation (Groq)")
    st.write(report.get('police', {}))
    
    st.subheader("Tourist Safety (Gemini)")
    st.write(report.get('tourist', {}))
