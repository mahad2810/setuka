# Setuka
## Your Digital Guardian On Every Journey

> Every tourist deserves to travel without fear. Setuka is a full-stack platform that
> wraps every phase of a tourist's journey — from trip planning to on-ground
> navigation to command‑center monitoring — in a real-time safety net.


---
🎥 **Demo video:** [Watch the prototype](https://drive.google.com/file/d/1IelTJ_iL28HlAaDKf4RTseadTMvYKnAx/view?usp=sharing)

## 🚀 Project Overview

### Problem: The Crisis in the Clouds

Adventure tourism is expanding rapidly (19% CAGR), yet safety infrastructure
remains stagnant, creating a deadly **"Triple Threat"** in mountain corridors:

- **Gap 1: Connectivity Void (Physical):** 40% of key corridors are "Digital
  Dark Zones" where cellular signals vanish. Affordable satellite alternatives
  are often illegal or restricted in sensitive border regions.

- **Gap 2: Information Vacuum (Data):** Authorities operate in silos with zero
  real-time data on crowd density or route blockages, leading to reactive
  rather than proactive disaster management.

- **Gap 3: Response Lag (Operational):** Without precise coordinates or health
  vitals, emergency response is delayed by 15–30 minutes, turning survivable
  injuries into fatalities.

### Solution: The Setuka Ecosystem

Setuka is an IoT-based, AI-driven ecosystem that bridges the gap between
travelers and authorities through three integrated layers:

1. **AI-Powered Tourist App**
   - Real-time Safety Scoring: Provides live scores for road conditions,
     accident rates, and crime levels at the user's current location.
   - Itinerary-Based Planning: Users map daily destinations to see all
     available routes ranked by safety scores.
   - Blockchain Digital ID: Generates a tamper-proof ID (anchored on the
     Polygon network) containing medical and insurance info. It is accessible
     via offline QR codes and biometrics for instant verification by responders
     even without internet.
   - Dynamic Geofencing: Uses safety heatmaps to provide instant warnings if a
     tourist enters a high-risk zone.

2. **IoT LoRa-Based Wearable**
   - Multi-Sensor Integration: Equipped with LoRa (sx1262), GPS (Quectel
     EC200U), and SpO2 sensors to monitor real-time location and health vitals.
   - Triple-Mode Transmission Protocol: Ensures SOS delivery via:
     * Direct Cloud: When internet is available.
     * SMS: Via cellular networks in partial signal areas.
     * LoRa-to-LoRa: In zero-connectivity zones using a built-in Peer-to-Peer
       network that relays signals through other nearby Setuka devices until
       they reach a receiver.
   - Auto-SOS: Automatically triggers emergency alerts based on critical health
     vital anomalies.

3. **Unified Command Dashboard for Authorities**
   - Real-Time Cluster Map: Provides a live visualization of all tourist
     locations and density clusters.
   - Anomaly & Inactivity Detection: AI-powered algorithms flag route
     deviations or unusual inactivity instantly.
   - Crowd & Resource Management: Suggests itinerary alternatives to tourists
     when locations become overcrowded and reallocates patrolling staff to
     high-risk zones in real-time.

### Unique Selling Propositions (USP)

- **Legal Compliance:** Unlike satellite SOS devices (like Garmin) which face
  legal bans and jail risks in Indian border regions, Setuka is a fully legal,
  ground-based mesh solution.
- **Offline Resilience:** While family safety apps like Life360 fail without
  cellular data, Setuka’s LoRa Mesh and offline Digital IDs ensure
  functionality in total digital darkness.
- **Affordability:** Provides military-grade safety infrastructure at a highly
  accessible price point (₹50/day rental model).

### Impact

- **Life Dependency:** Reduces emergency reporting time from 30 minutes to
  seconds, ensuring the "Golden Hour" of medical treatment is never lost.
- **Sustainable Tourism:** Enhances destination safety, directly increasing
  tourist confidence and driving economic growth in remote mountain regions
  (supporting SDG 8, 9, and 11).
- **Vision 2030:** Aims to establish the global gold standard for adventure
  safety, protecting over 1 million lives annually.

Setuka consists of two core applications working in tandem:

1. **Authority Dashboard** (`authority-dashboard/`) – an AI-backed public safety
   console for crowd monitoring, police patrol optimization, and live tourist
   tracking across Northeast India.
2. **Tourist App** (`tourist-app/`) – a Progressive Web App that gives travellers a
   personal safety dashboard, digital ID card, itinerary management, and location
   broadcasting powered by machine learning and LLM-generated advisories.

Both components interoperate via a simple FastAPI backend that tracks tourist
locations; additional subfolders (`blockchain/`, `components/`, `hooks/`, etc.)
contain shared libraries and blockchain contracts for the digital ID system.



---

## 📁 High-Level Structure

```
setuka/
├── authority-dashboard/   # AI safety dashboard & API backend (Python/Streamlit)
├── tourist-app/           # Next.js PWA for tourists (TypeScript/React)
├── blockchain/            # Smart contracts and deployment scripts
├── components/            # Reusable UI components for the tourist app
├── hooks/                 # Custom React hooks used by the app
├── lib/                   # Shared TypeScript utilities (API client, utils)
├── public/                # Static assets for the tourist app
└── utils/                 # Python helper modules used by dashboard
```

> See each subdirectory for its own `README.md` with deeper details. This
> parent document ties them together and provides global setup instructions.

---

## 🧩 Features Summary

| Component | Highlights |
|-----------|------------|
| Dashboard | DBSCAN crowd clustering, heatmaps, police reallocation via LLMs,
|           | Isolation Forest tourist anomaly detection, live tracking map |
| Tourist App | Location-based safety score (0–100), crime/road/accident indexes,
|             | digital blockchain ID, itinerary management, PWA installable, AI safety
|             | narrative |
| Backend API | FastAPI endpoints for tourist location ingestion/querying |
| ML & Data | Custom regression models for safety scoring, Groq/Google Gemini LLM
|           | integrations, GeoPandas & Folium visualisations |

---

## 🔧 Setup Instructions

### Python Environment (Authority Dashboard)

```bash
cd authority-dashboard
python -m venv venv
# Windows
venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
```

Create a `.env` in `authority-dashboard/` from the `.env.example` and add the
keys listed below.

### Node Environment (Tourist App)

```bash
cd tourist-app
npm install              # or yarn
```

Optionally set up a `.env.local` with any frontend-specific variables (e.g. API
base URL).

### API Keys

Both sides rely on external services. Add them to `authority-dashboard/.env`:

```
GOOGLE_API_KEY=your_gemini_key      # for Google Gemini LLM
GROQ_API_KEY=your_groq_key          # for Groq LLM via LangChain
OPENCAGE_API_KEY=your_opencage_key  # reverse geocoding
```

You can obtain these from their respective portals (see sub‑README files).

---

## ▶️ Running the System

1. **Start the dashboard backend & UI** (serves the API and the Streamlit app):

   ```bash
   cd authority-dashboard
   python run_dashboard.py
   ```

   - FastAPI will listen on `http://localhost:8000`.
   - Streamlit dashboard is available at `http://localhost:8501`.

2. **Run the tourist web app** (after starting the API):

   ```bash
   cd tourist-app
   npm run dev              # Next.js dev server at http://localhost:3000
   ```

   The PWA interacts with the dashboard API to fetch safety scores and to
   periodically `POST /api/location` with the tourist's current coordinates.

3. **Blockchain (optional)** – deploy contracts using scripts in `blockchain/` if
   you wish to generate digital ID cards on Polygon.

---

## 📡 API Endpoints

The FastAPI backend exposes these simple routes:

| Method | Path                     | Description |
|--------|--------------------------|-------------|
| POST   | `/api/location`          | Submit tourist location (body: `tourist_id`, `lat`, `lng`) |
| GET    | `/api/location`          | Retrieve all active tourists |
| GET    | `/api/location/{id}`     | Retrieve a specific tourist |
| DELETE | `/api/location/{id}`     | Remove a tourist from tracking |
| DELETE | `/api/location`          | Clear all tracked tourists |

Data is stored in `live_location.json`; swap with a database for production.

---

## 🧠 Machine Learning & Safety Scoring

- **Crowd Safety** uses DBSCAN clustering and assigns risk levels to GPS
  observations from the police patrol dataset.
- **Tourist Safety Score** (used by the app) is computed by two region‑specific
  regression models (Kolkata & Darjeeling). Inputs include crime level, road
  condition, and accident risk; outputs are normalised to a 0–100 score and
  augmented with a Groq LLM narrative.
- **Anomaly Detection** runs an Isolation Forest pipeline in
  `authority-dashboard/isolation_module/` to spot tourists deviating from
  itineraries.

Refer to the respective sub‑READMEs for full dataset sources, formulas, and
evaluation metrics.

---

## 🔗 Integration & Architecture

- The dashboard backend acts as the single source of truth for live tourist
  locations and safety calculations.
- The tourist app fetches safety scores and posts location updates; it also
  displays the blockchain-issued digital ID card generated by the smart
  contracts under `blockchain/`.
- LLMs (Groq & Google Gemini) are consumed by `authority-dashboard/utils` via
  LangChain agents defined in `langchain_agents.py` and `ai_agents.py`.

---

## 📦 Additional Folders

- `blockchain/`: smart contract (`DigitalTouristID.sol`), deployment scripts,
  and configuration for Polygon.
- `components/`, `hooks/`, `lib/`, `public/`, `styles/`, `scripts/`: supporting
  resources for the tourist app.
- `authority-dashboard/utils/`: Python utilities for clustering, map generation,
  preprocessing, and geocoding.

---

## 🧩 Extending & Customizing

- Add new analytics pages to the dashboard by creating Python scripts in
  `authority-dashboard/app/pages/`.
- Swap out or retrain the ML models by modifying the code in
  `authority-dashboard/isolation_module/` or the safety score service (`safety_score.py`).
- Replace LLM backends or tweak LangChain prompt templates in the utils folder.
- Build mobile‑focused UI components under `components/` and wire them into the
  tourist app.

---

## 🤝 Contributing

1. Fork the repository and create a feature branch.
2. Implement your changes and add tests when applicable.
3. Submit a pull request with a clear description.

---

## 📄 License

This project is licensed under the MIT License. See `LICENSE` for details.

---

> _Questions? Open an issue or contact the maintainers._
