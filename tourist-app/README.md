<div align="center">

# 🛡️ SETUKA
### *Smart Tourist Safety — Powered by AI, Secured by Blockchain*

<br/>

> **Every tourist deserves to travel without fear.**
> Setuka is a full-stack Progressive Web App that wraps every phase of a tourist's journey — from trip planning to on-ground navigation — in a real-time safety net.

<br/>

[![Next.js](https://img.shields.io/badge/Next.js_14-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white)](https://mongodb.com/)
[![Polygon](https://img.shields.io/badge/Blockchain-Polygon_Amoy-7B3FE4?logo=polygon)](https://polygon.technology/)
[![Groq](https://img.shields.io/badge/AI-Groq_LLM-F55036?logo=openai&logoColor=white)](https://groq.com/)
[![Mapbox](https://img.shields.io/badge/Maps-Mapbox_GL-4264FB?logo=mapbox)](https://mapbox.com/)
[![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8?logo=pwa)](https://web.dev/progressive-web-apps/)

</div>

---

## ✨ How Setuka Works — The Full Journey

> *Setuka isn't just an app. It's a safety companion from the moment you plan your trip to the moment you return home.*

---

### 🏠 Overview Tab — Your Safety Dashboard

The moment you open Setuka, you land on the **Overview tab** — a live safety command center built around your current GPS location.

**What you see at a glance:**

- 📊 **Overall Safety Score (0–100)** — A composite score for your exact location, updated automatically every time you move more than 80 meters
- 🔴 **Crime Rate Index** — Blended crime data rated on a 1–10 scale
- 🚗 **Accident Risk** — Traffic accident likelihood for your current area
- 🛣️ **Road Quality Rating** — Surface and infrastructure condition score
- 🤖 **AI Safety Narrative** — Groq LLM (Llama 3) generates a plain-text safety briefing in real time for your precise location, with contextual recommendations like "*avoid unlit side streets after 9 PM*"

**How the Safety Score is actually computed:**

The score is produced by a **custom dual-city regression engine** (`safety_score.py`) we built, trained, and deployed at [`safetyscore-regression.onrender.com`](https://safetyscore-regression.onrender.com). Here's the full picture of how it works — from raw data collection to the final number shown on your screen.

---

#### 📦 The Dataset — Where the Numbers Come From

We manually assembled two structured datasets covering **536 named locations** across two regions:

| Dataset | Locations | Coverage |
|---|---|---|
| `kol_data.csv` | **294 locations** | Kolkata, West Bengal |
| `darj_data.csv` | **242 locations** | Darjeeling district (incl. Siliguri, hill stations, tea estates, trek routes) |

Each location has three hand-researched ratings on a **1–10 scale**:

**🛣️ Road Condition** — sourced from:
- KMC (Kolkata Municipal Corporation) ward-level road surveys & pothole complaint records
- PWD West Bengal / NHIDCL / BRO — state highway and mountain road condition assessments
- NHAI — national highway condition data (NH 12, NH 16, NH 55, NH 31, EM Bypass)
- OpenStreetMap surface quality tags (`surface=asphalt`, `smoothness=*`)
- Google Street View imagery + user road quality reviews
- Media investigative reports (The Telegraph, Times of India Kolkata, Darjeeling Times)
- GTA (Gorkhaland Territorial Administration) hill-road maintenance records

**🔴 Crime Level** — sourced from:
- NCRB "Crime in India" 2021–2022 — district-level FIR counts mapped to neighborhoods
- Kolkata Police / Darjeeling Police / Siliguri Metropolitan Police — station-wise crime statistics (2023–2024)
- West Bengal Police district crime review portal
- Media reports (ABP, NDTV, Hills Post) — hotspot identification (Khidderpore, Metiabruz, Burrabazar, Mominpur)
- Darjeeling Tourism Police annual reports

**🚗 Accident Risk** — sourced from:
- MoRTH "Road Accidents in India" 2021–2023 — corridor-wise and city-level annual fatality stats
- Kolkata Traffic Police & Darjeeling Traffic Police — intersection and curve-wise black spot data
- iRAD (Integrated Road Accident Database) — geo-tagged FIR-linked accident records (2022–2024)
- SaveLIFE Foundation — accident black spot analysis for Kolkata and North Bengal hill roads
- BRO mountain road incident reports (landslide-triggered vehicle accidents)

**Coordinates** geocoded via OpenStreetMap / Nominatim, cross-validated with Google Maps and Survey of India topographic maps.

---

#### ⚙️ The Score Formula

Both models share the same final formula:

```
danger = (crime × 0.4) + ((10 − road) × 0.3) + (accident × 0.3)
safety_score = 10 − danger

Theoretical range: 3.3 (worst) → 8.7 (best)
```

Crime is weighted highest (40%) because it most directly impacts tourist safety. Road quality contributes 30% as an inverse factor (worse road = more dangerous). Accident risk accounts for the remaining 30%.

The raw score (3.3–8.7) is then normalised to 0–100 for display and labelled:

| Raw Score | Label | Dashboard Risk |
|---|---|---|
| 8.0–8.7 | ✅ Very Safe | 🟢 Low |
| 6.5–7.9 | ✅ Safe | 🟢 Low |
| 5.0–6.4 | ⚠️ Moderate | 🟡 Medium |
| 3.5–4.9 | 🔴 Caution | 🔴 High |
| 3.0–3.4 | 🔴 High Risk | 🔴 High |

---

#### 🧠 Two Separate Models — One Per Region

Because Kolkata and Darjeeling have fundamentally different risk profiles (traffic-density-driven vs. terrain-driven), we trained **two distinct interpolation models**:

**Model A — Kolkata: Coupled IDW**

Uses **Inverse Distance Weighting (IDW)** over the 5 nearest known locations (power=2), then applies a **road→crime regression correction** to handle data-sparse gaps.

Kolkata shows a strong road↔crime correlation of **−0.83** (poor roads cluster with high crime in the same neighborhoods). We fitted this as:

```
crime_coupled = −0.7281 × road_rating + 8.3410
```

A blend weight `alpha` (0% at known point → max 40% at ≥4 km gap) then mixes the raw IDW crime estimate with the road-derived prediction:

```
crime_final = (1 − alpha) × crime_idw + alpha × crime_coupled
```

✅ Validated leave-one-out MAE: **0.474** on the 1–10 scale.

---

**Model B — Darjeeling: IDW + Geographic Gradient Blend**

Hill terrain introduces a strong **latitude↔crime correlation (−0.62)** — higher altitude consistently means lower crime. Longitude also correlates positively with crime (+0.40) because eastern coordinates point toward Siliguri's denser urban areas.

We fitted three **OLS gradient planes** across all 242 data points:

```
crime_gradient(lat, lon)    = −4.328 × lat + 1.835 × lon − 43.035
accident_gradient(lat, lon) = −4.352 × lat + 2.565 × lon − 104.823
road_gradient(lat, lon)     = −1.755 × lat + 1.960 × lon − 121.370
```

A **15% gradient baseline** is always applied (even at known points), growing by 4% per km of gap from the nearest data point, capped at 50%:

```
alpha = min(0.50, 0.15 + nearest_dist_km × 0.04)
final = (1 − alpha) × idw_value + alpha × gradient_value
```

✅ Validated leave-one-out MAE: **0.369** on the 1–10 scale.

---

**Confidence Tiers** — both models report how reliable the estimate is:

| Distance to Nearest Data Point | Confidence |
|---|---|
| < 1 km | 🟢 HIGH |
| 1–3 km | 🟡 MEDIUM |
| 3–8 km | 🟠 LOW |
| > 8 km | 🔴 VERY LOW |

The ML score is then enriched by **Groq's LLM** (Llama 3), which reads the raw numbers and generates a 2–3 sentence plain-English safety briefing plus three specific recommendations for that precise location.

> If coordinates fall outside both the Kolkata bounding box (`lat 22.37–22.72, lon 88.285–88.482`) and Darjeeling bounding box (`lat 26.63–27.09, lon 88.181–88.670`), the API returns `outsideCoverage: true` and Setuka shows a neutral advisory instead.

---

### 🧳 Trip Registration → Your Digital Identity

Setuka transforms trip registration into a **complete digital onboarding** — creating a verifiable, emergency-ready identity for every tourist.

When you register a trip, you fill in **four layers of information:**

```
┌──────────────────────────────────────────────────────────────┐
│  ① Trip Details       →  Title, destination, travel dates   │
│  ② ID Proof           →  Passport number, nationality        │
│  ③ Medical Details    →  Blood type, allergies, medications, │
│                           insurance, doctor contact          │
│  ④ Emergency Contacts →  Name, phone, relationship          │
│  ⑤ Itinerary          →  Day-by-day activity schedule        │
└──────────────────────────────────────────────────────────────┘
```

---

### 🪪 The Digital ID Card System

Once registered, Setuka generates a **blockchain-secured Digital Tourist ID** — a tamper-proof, official-looking card that serves as your entire identity in one place.

**The card contains:**

| Section | Details |
|---|---|
| 🏷️ **Header** | Setuka branding, Tourist ID number, live status badge (ACTIVE / UPCOMING / EXPIRED) |
| 👤 **Identity** | Full name, nationality flag, masked passport number |
| 🗺️ **Trip** | Trip name, destination, travel date range, trip status |
| 🚨 **Emergency Strip** | Blood type (prominently displayed), allergies, medications, emergency contact with a **tap-to-call phone link**, insurance details |
| 📱 **QR Code** | A scannable QR that links to the live verification page |
| ⛓️ **Blockchain Badge** | A green pulsing "Blockchain Verified" badge when the record is anchored on-chain |
| 🔗 **PolygonScan Link** | Direct link to the on-chain transaction for public verification |

**Two access modes:**

- 📵 **Offline Mode** — The card is cached by the service worker. First responders can scan the QR or open the app without internet and get critical emergency details (blood type, allergies, emergency contact) instantly
- 🌐 **Online Mode** — Full verification via the `/verify/[id]` public page: shows the complete identity, trip status, biometric signature, and confirms blockchain integrity

**Blockchain layer:**

Each registration calls the `TouristID.sol` Solidity smart contract deployed on **Polygon Amoy Testnet**. The contract stores the tourist's ID, KYC type, trip dates, and emergency contact on-chain — immutable and publicly verifiable. The contract address is returned as a transaction hash displayed on the card.

```solidity
// On-chain record — cannot be altered once written
struct Tourist {
    string touristId;
    string name;
    string kycType;       // Passport / Aadhar / etc.
    string kycNumber;     // Masked on display
    uint256 startDate;
    uint256 endDate;
    string emergencyContactPhone;
    string itinerary;
    bool isActive;
}
```

The card can be **downloaded as a PNG** (via html2canvas at 2× resolution) or **shared** via the Web Share API (or clipboard fallback).

---

### 🗺️ Map Tab — AI-Powered Itinerary Navigation

The Map tab is where your uploaded itinerary comes alive on an **interactive Mapbox street map**.

**Here's the flow:**

1. **Today's Destinations Auto-Loaded** — On map open, Setuka reads your active trip's itinerary for today's date, extracts destination names using the **Groq LLM** (`/api/destinations/extract`), and geocodes each one via the **OpenCage Geocoding API**

2. **Numbered Destination Markers** — Each location appears as a numbered blue pin `①②③…` on the map, with popups showing the scheduled time and activity name

3. **Tap a Destination → Get Routes** — Clicking any marker instantly calls the **Google Directions API** which returns up to **3 alternative routes** (driving / walking / cycling)

4. **Route Safety Scoring** — Every route's coordinates are sampled (every 10th point) and sent to our SafetyScore API in parallel batches. Each route gets:
   - 📊 Average safety score across all sampled waypoints
   - 🔴 Count of "risky sections" (score < 40)
   - 🏷️ Overall route risk label (Low / Medium / High)

5. **Visual Route Comparison** — Routes are drawn on the map in distinct colors:
   - 🟢 Green → Route 1 (safest / fastest)
   - 🔵 Blue → Route 2 (alternative)
   - 🟡 Amber → Route 3 (third option)
   - The selected route is highlighted at full opacity (width: 6px), others dim to 50%

6. **Manual Itinerary Entry** — You can also paste raw itinerary text in the input panel; the AI parses it, extracts destinations, geocodes them, and plots them instantly

7. **Travel Mode Switch** — Toggle between 🚗 Driving, 🚶 Walking, and 🚴 Cycling — routes and distances update accordingly

8. **Live GPS Tracking on Map** — A green marker shows your real-time position (updated via `navigator.geolocation.watchPosition`), auto-centering as you move (can be toggled off to explore the map freely)

---

### 🔥 Safety Heatmap Tab — See the City's Risk Landscape

The heatmap tab gives you a **bird's-eye intelligence view** of the entire region's safety landscape — rendered as glowing density maps on a dark Mapbox canvas.

**Data source:** `all_scores.csv` — a pre-computed dataset of hundreds of named locations across **Kolkata** and **Darjeeling**, each scored by our SafetyScore ML model across four dimensions:

| Layer | What it shows | Color Palette |
|---|---|---|
| 🛡️ **Safety Score** | Composite safety rating 0–100 | Red → Amber → Green |
| 🔴 **Crime Level** | Blended crime index 1–10 | Blue → Yellow → Red |
| 🚗 **Accident Risk** | Traffic accident likelihood 1–10 | Green → Yellow → Red |
| 🛣️ **Road Quality** | Surface & infrastructure rating 1–10 | Dark → Bright |

**Heatmap controls — fully interactive:**

- ✅ Toggle individual layers on/off
- 🎨 Switch between **3 color palette themes** per layer (e.g., "Ocean Fire", "Night Mode", "Vibrant")
- 🎚️ Adjust **opacity** with a live slider
- 📍 Adjust **radius** — how wide each data point's influence spreads

**Geofencing — The Safety Boundary System:**

Using the heatmap data as the intelligence backbone, Setuka draws **invisible safety boundaries** around areas. As you move:

```
Your GPS → Check against all active geofence zones
        ↓
  Entered DANGER zone?  →  🔴 Instant alert popup
  Entered SAFE zone?    →  ✅ Green confirmation
  Exited any zone?      →  📍 Zone exit notification
```

When a **danger zone** is triggered, a full-screen alert popup fires with three action buttons:

| Button | Action |
|---|---|
| 🛣️ Get Safe Route | Reroutes around the high-risk area |
| 🆘 Emergency SOS | Opens the SOS panic screen immediately |
| ✕ Dismiss | Closes the alert |

The geofencing demo in the heatmap tab animates a tourist moving through Kolkata (Park Street → Esplanade → Burrabazar), triggering a live danger alert at the high-crime section so you can see the system in action before being in a real situation.

---

### 🆘 Emergency SOS

A **one-tap panic button** accessible from anywhere in the app:

1. Captures your current GPS coordinates
2. Calls **Twilio** to send SMS alerts simultaneously to:
   - Your registered emergency contact
   - Local police emergency number
   - Destination emergency services
3. Message includes your name, Tourist ID, and exact coordinates
4. The SOS screen shows a large pulsing button with countdown confirmation to prevent accidental triggers

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 14 (App Router, TypeScript) |
| **Maps** | Mapbox GL JS (streets + dark mode) |
| **Directions** | Google Directions API + OSRM fallback |
| **Geocoding** | OpenCage Geocoding API |
| **Database** | MongoDB + Mongoose |
| **Auth** | Custom JWT sessions |
| **AI / LLM** | Groq API (Llama 3 / GPT-OSS 120B) |
| **Safety ML** | Custom regression model on Render.com |
| **SMS / Emergency** | Twilio |
| **Blockchain** | Solidity `^0.8.19`, Polygon Amoy, Hardhat, viem |
| **PWA** | Enhanced Service Worker + Web App Manifest |
| **Styling** | Tailwind CSS + shadcn/ui |
| **Analytics** | Vercel Analytics |

---

## 📁 Project Structure

```
tourist-app/
│
├── app/
│   ├── api/
│   │   ├── auth/              # Register / Login / Session (JWT)
│   │   ├── safety/calculate/  # ML score fetch + Groq AI enrichment
│   │   ├── directions/google/ # Google Directions + OSRM fallback
│   │   ├── destinations/      # AI itinerary destination extraction
│   │   ├── geocode/           # Address → coordinates (OpenCage)
│   │   ├── geofence/          # CRUD for custom geofence zones
│   │   ├── location/          # Live location push/pull
│   │   ├── heatmap/           # Pre-scored heatmap data endpoint
│   │   ├── trips/             # Full trip CRUD + digital ID generation
│   │   ├── sos/               # Twilio SMS emergency trigger
│   │   └── verify/            # Public blockchain ID verification
│   │
│   ├── dashboard/page.tsx     # Main app shell (Overview tab)
│   ├── landing/               # Public marketing page
│   ├── auth/                  # Login / Register page
│   └── verify/                # Public ID verification page
│
├── components/
│   ├── interactive-map.tsx    # Map tab (routes, live tracking, itinerary)
│   ├── safety-heatmap.tsx     # Heatmap tab (layers, geofencing demo)
│   ├── digital-id-card.tsx    # The blockchain ID card component
│   ├── emergency-sos.tsx      # SOS panic screen
│   ├── emergency-contacts.tsx # Contact management
│   ├── geofence-manager.tsx   # Custom zone creation UI
│   ├── trip-manager.tsx       # Trip planner + itinerary builder
│   ├── background-tracking-manager.tsx  # Background GPS sync
│   ├── profile-screen.tsx     # Tourist profile + medical details
│   └── notification-system.tsx
│
├── blockchain/
│   ├── TouristID.sol          # Solidity smart contract
│   ├── blockchain-viem.ts     # Contract interaction (viem)
│   ├── hardhat.config.js      # Hardhat + Polygon Amoy config
│   └── deploy.js              # Deployment script
│
├── lib/
│   ├── mongodb.ts             # MongoDB connection
│   ├── blockchain-service.ts  # Blockchain abstraction (live + mock)
│   ├── digital-id.ts          # ID generation + QR code creation
│   ├── session-context.tsx    # Auth session context
│   └── location-context.tsx   # GPS location context (shared state)
│
└── public/
    ├── all_scores.csv         # Pre-computed SafetyScore data (heatmap)
    ├── manifest.json          # PWA manifest
    └── sw-enhanced.js         # Service worker (offline + background sync)
```

---

##  Install as an App (PWA)

Setuka is fully installable — no app store needed.

| Platform | Steps |
|---|---|
| **Android** | Chrome → ⋮ menu → *Add to Home Screen* |
| **iOS** | Safari → Share → *Add to Home Screen* |
| **Desktop** | Click the install icon in the browser address bar |

Once installed, the service worker caches the Digital ID card and critical emergency data for **zero-internet access**.

---

## 🛠️ Hardware Companion

A physical IoT device was built in parallel to extend Setuka's reach to tourists without smartphones — featuring a panic button, GPS module, and LCD status display.

Build progress documented across 7 phases:
[Phase 1 Intro](https://drive.google.com/file/d/1VnkeeCInjYrDEUL4jFpamRaiFLerRPgX/view) ·
[Phase 2 Soldering](https://drive.google.com/file/d/1b2vqeabz94gTCZfi8Hm6EWkZa2rjnzUz/view) ·
[Phase 3](https://drive.google.com/file/d/1kSTUM0XYpxRSiPUYy_TWXeQFHxSSy0kD/view) ·
[Phase 4](https://drive.google.com/file/d/10kvi5AWGsX9VfxR6hK0uUPEY5kiXryyr/view) ·
[Phase 5](https://drive.google.com/file/d/1gYlIhCSvFkgH-xtFM2VueIqeMAfF9h8V/view) ·
[Phase 6 LCD](https://drive.google.com/file/d/19eB14-PkwdMil2ELKwpNS6mEzVEGu9nh/view) ·
[Phase 7](https://drive.google.com/file/d/1JruBp2iN_XdbTrv2WxwhL8rndfmJ1qUz/view)

---

<div align="center">

Built with ❤️ by **Team Setuka** &nbsp;·&nbsp; Hackathon 2026

*Because every journey should end safely.*

</div>
