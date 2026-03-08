# 🛡️ Crowd & Police Patrol Management System

An AI-driven public safety dashboard for **real-time crowd monitoring**, **police patrol optimization**, and **tourist safety management** across Northeast India.

---

## What It Does

| Module | Description |
|---|---|
| **Crowd Safety Scoring** | Clusters GPS observations with DBSCAN, scores each zone's risk level, and visualizes hotspots on an interactive map |
| **AI Recommendations** | Uses LangChain + Groq/Gemini LLMs to generate patrol reallocation strategies and actionable safety recommendations |
| **Tourist Anomaly Detection** | Runs an Isolation Forest pipeline to flag tourists deviating from planned routes or overstaying checkpoints |
| **Live Tourist Tracking** | Real-time map of all active tourists broadcasting location from the Tourist Webapp |

---

## Project Structure

```
DoubleSlash/
├── api.py                   # FastAPI backend — receives & serves live tourist locations
├── run_dashboard.py         # Entry point: starts FastAPI + Streamlit together
├── app/
│   ├── main.py              # Streamlit home page + live tracking map
│   └── pages/
│       ├── 1_Crowd_Safety_Scoring.py
│       ├── 2_AI_Recommendations.py
│       └── 3_Tourist_Anomaly_Detection.py
├── utils/
│   ├── map_layers.py        # Folium map builders (heatmap, clusters, police, tourist layers)
│   ├── clustering.py        # DBSCAN clustering logic
│   ├── preprocessing.py     # Data cleaning and feature engineering
│   ├── ai_agents.py         # Gemini AI integration
│   ├── langchain_agents.py  # LangChain + Groq agent chains
│   └── geocoding_utils.py   # OpenCage reverse geocoding
├── isolation_module/        # Isolation Forest anomaly detection pipeline
├── live_location.json       # Auto-updated by FastAPI — stores latest tourist coordinates
├── police_patrol_dataset.csv
└── .env                     # API keys (see setup below)
```

---

## Setup

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure API keys

Create a `.env` file in the project root:

```env
GOOGLE_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
OPENCAGE_API_KEY=your_opencage_key
```

| Key | Get it from |
|---|---|
| `GOOGLE_API_KEY` | [aistudio.google.com](https://aistudio.google.com) |
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) |
| `OPENCAGE_API_KEY` | [opencagedata.com](https://opencagedata.com) |

### 3. Run

```bash
python run_dashboard.py
```

This starts:
- **FastAPI backend** on `http://localhost:8000`
- **Streamlit dashboard** on `http://localhost:8501`

---

## Live Tourist Tracking

Tourists open the Tourist Webapp on their phone and it sends `POST /api/location` with their coordinates and a unique `tourist_id` (their email or session ID). The dashboard reads `live_location.json` and plots all active tourists in real time.

**API endpoints:**

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/location` | Submit tourist location |
| `GET` | `/api/location` | Get all active tourists |
| `GET` | `/api/location/{id}` | Get a specific tourist |
| `DELETE` | `/api/location/{id}` | Remove a tourist |
| `DELETE` | `/api/location` | Clear all |

---

## Tech Stack

- **Dashboard** — Streamlit + Folium (interactive maps)
- **ML** — scikit-learn (Isolation Forest, DBSCAN), XGBoost
- **LLMs** — Google Gemini, Groq (LLaMA), LangChain
- **Backend** — FastAPI + Uvicorn
- **Geo** — GeoPandas, Shapely, OpenCage Geocoding
