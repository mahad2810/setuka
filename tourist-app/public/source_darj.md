# Data Sources — Darjeeling Safety Dataset (`darj_data.csv`)

> **242 locations** across Darjeeling district, West Bengal  
> **Ratings scale**: 1–10 (road condition, crime intensity, accident proneness)  
> **Generated**: March 2026  
> **Disclaimer**: Ratings are **representative estimates** at the area level, NOT real-time sensor readings. Mountain road conditions are heavily seasonal (monsoons cause landslides).

---

## 1. Road Condition (`road_rating`)

| Source | URL | Data Period | Notes |
|--------|-----|-------------|-------|
| Public Works Department (PWD), Govt. of West Bengal | [https://pwdwb.in](https://pwdwb.in) | 2023–2025 | Hill road condition assessments; landslide repair schedules for NH 55 (Hill Cart Road), Pankhabari Road |
| NHIDCL (National Highways & Infrastructure Development Corporation) | [https://nhidcl.com](https://nhidcl.com) | 2023–2024 | Status reports on NH 55 (Siliguri–Darjeeling), NH 10 (Sevoke–Gangtok), and NH 31 corridor upgrades |
| Border Roads Organisation (BRO) | [https://bro.gov.in](https://bro.gov.in) | 2022–2024 | Mountain road maintenance data; condition of strategic roads near Sandakphu, Indo-Nepal border routes |
| NHAI — National Highway condition | [https://nhai.gov.in](https://nhai.gov.in) | 2023–2024 | NH 31 (plains section, Siliguri–Islampur) condition and widening project status |
| GTA (Gorkhaland Territorial Administration) road reports | [https://gta.gov.in](https://gta.gov.in) | 2022–2024 | Hill area road maintenance data for Darjeeling, Kurseong, Mirik sub-divisions |
| Darjeeling Municipality — Infrastructure reports | [https://darjeelingmunicipality.in](https://darjeelingmunicipality.in) | 2023–2024 | Town road repair and drainage reports; Mall Road, Laden La Road, Gandhi Road |
| OpenStreetMap — Surface quality tags | [https://www.openstreetmap.org](https://www.openstreetmap.org) | Ongoing | Community-tagged road surfaces; especially useful for rural/trek routes |
| Google Maps / Street View | [https://maps.google.com](https://maps.google.com) | 2024–2025 | Visual verification of road conditions; user reviews of mountain road quality |
| Media Reports (Darjeeling Times, The Telegraph Hill) | [https://www.telegraphindia.com/north-bengal](https://www.telegraphindia.com/north-bengal) | 2023–2025 | Landslide reports, road closure updates, restoration timelines (especially monsoon period July–September) |

### Key methodology notes
- **Darjeeling Mall / Chowrasta**: Rated 6–7 (well-maintained tourist spine; pedestrianized area)
- **Hill Cart Road (NH 55)**: Rated 4–6 (varies; good near Siliguri, deteriorates above Kurseong due to landslides)
- **Sandakphu Jeep Track**: Rated 2 (unpaved, rocky, 4WD-only route)
- **Tea estate internal roads**: Rated 3–4 (narrow, single-lane, unmaintained plantation tracks)
- **Siliguri city roads**: Rated 5–7 (urban roads, mixed quality; bypass and airport road are better)
- **New Town (Siliguri extensions)**: Rated 6–7 (newer construction)
- **Monsoon impact**: Ratings reflect average/dry season; during June–September conditions drop 1–3 points across hill areas

---

## 2. Crime (`crime_rating`)

| Source | URL | Data Period | Notes |
|--------|-----|-------------|-------|
| National Crime Records Bureau (NCRB) — "Crime in India" | [https://ncrb.gov.in/crime-in-india.html](https://ncrb.gov.in/crime-in-india.html) | 2021–2023 | District-level crime data for Darjeeling district; used for sub-divisional breakdown |
| Darjeeling Police — PS-wise crime data | [https://darjeelingpolice.com](https://darjeelingpolice.com) | 2023–2024 | Police station-wise FIR counts; major categories: theft, burglary, assault |
| West Bengal Police — District Crime Review | [https://wb.gov.in/department-home-police.aspx](https://wb.gov.in/department-home-police.aspx) | 2022–2024 | Annual crime review for Darjeeling district; comparison with state averages |
| Siliguri Metropolitan Police — Crime data | [https://siliguripolice.com](https://siliguripolice.com) | 2023–2024 | Siliguri city-specific crime statistics; Siliguri has its own police commissionerate |
| Tourism Police reports (Darjeeling) | [https://darjeelingpolice.com](https://darjeelingpolice.com) | 2023–2024 | Tourist-targeted crime data; generally low but includes touts, overcharging, petty theft |
| Media reports (NBN, Hills Post, Telegraph NB) | [https://www.telegraphindia.com/north-bengal](https://www.telegraphindia.com/north-bengal) | 2023–2025 | Incident reports; useful for identifying problem areas in Siliguri |

### Key methodology notes
- **Darjeeling Town (Tourist zones)**: Rated 2–3 (generally safe; tourism police presence; very low violent crime)
- **Tea estates / rural areas**: Rated 1–2 (extremely low crime; isolated areas)
- **Tiger Hill / Batasia Loop**: Rated 1–2 (tourist spots with security presence)
- **Siliguri (City center/Station area)**: Rated 4–5 (urban crime typical of mid-size Indian city; theft, snatching)
- **Siliguri (Khalpara / border areas)**: Rated 5–6 (proximity to international border; smuggling corridor)
- **Kalimpong town**: Rated 3 (small hill town, safe)
- **Trek routes (Sandakphu etc.)**: Rated 1 (remote; no crime; natural hazard risk only)

---

## 3. Accidents (`accident_rating`)

| Source | URL | Data Period | Notes |
|--------|-----|-------------|-------|
| Ministry of Road Transport & Highways (MORTH) — "Road Accidents in India" | [https://morth.nic.in/road-accident-in-india](https://morth.nic.in/road-accident-in-india) | 2021–2023 | District-level accident data; corridor-wise breakdown for NH 55, NH 31, NH 10 |
| Darjeeling Traffic Police — Accident records | [https://darjeelingpolice.com](https://darjeelingpolice.com) | 2023–2024 | Intersection and curve-wise accident data; black spot identification on hill roads |
| Siliguri Traffic Police — Accident statistics | [https://siliguripolice.com](https://siliguripolice.com) | 2023–2024 | City traffic accident data; Sevoke More, Hill Cart Road, bypass identified as high-risk |
| SaveLIFE Foundation — Hill road safety report | [https://savelifefoundation.org](https://savelifefoundation.org) | 2022–2023 | Analysis of mountain road fatalities in North Bengal; recommendations for safety barriers |
| NHAI — Black spot data (NH 31) | [https://nhai.gov.in](https://nhai.gov.in) | 2023–2024 | Accident-prone points on NH 31 (plains highway, high-speed corridor) |
| iRAD (Integrated Road Accident Database) | [https://irad.parivahan.gov.in](https://irad.parivahan.gov.in) | 2022–2024 | Geo-tagged accident reports for Darjeeling district; FIR-linked data |
| BRO — Mountain road incident reports | [https://bro.gov.in](https://bro.gov.in) | 2022–2024 | Landslide-triggered vehicle incidents; road collapse accidents |
| Media reports | [https://www.telegraphindia.com/north-bengal](https://www.telegraphindia.com/north-bengal) | 2023–2025 | Major accident reports; tourist vehicle falls; overloaded jeep incidents |

### Key methodology notes
- **Sandakphu Jeep Track**: Rated 7–8 (extremely steep, unpaved, sharp blind curves, no barriers)
- **Tiger Hill approach road**: Rated 5–6 (narrow, steep, heavy tourist traffic at dawn; poor visibility)
- **Hill Cart Road (Kurseong–Ghoom section)**: Rated 5–6 (hairpin bends, single-lane stretches, landslide zone)
- **Sevoke Bridge / NH 10 entry**: Rated 7 (high-speed vehicles on narrow mountain road; truck traffic)
- **Siliguri Bypass / NH 31**: Rated 6–7 (high-speed highway; truck–bus corridor; pedestrian crossings)
- **Darjeeling Mall / Chowrasta**: Rated 2–3 (pedestrian zone; minimal vehicle access)
- **Tea estate roads**: Rated 3–4 (slow speed but steep and no barriers)
- **Key hazard type difference from Kolkata**: Accidents here are terrain-driven (cliff falls, landslides, blind curves) vs. traffic-density-driven in Kolkata

---

## Data Recency Summary

| Category | Most Recent Source Data | Published/Updated |
|----------|----------------------|-------------------|
| Road Condition | PWD, NHIDCL, GTA, BRO | 2023–2025 (ongoing) |
| Crime | NCRB 2022 (latest full), Darjeeling Police 2024 | 2022–2024 |
| Accidents | MORTH 2023, iRAD 2024, Traffic Police 2024 | 2022–2024 |

> **Note**: Mountain road conditions are **highly seasonal**. Ratings represent average/dry-season condition (October–May). During monsoon (June–September), frequent landslides can make rated-5 roads impassable. The data does not capture real-time road closures.

> **Note**: NCRB "Crime in India" 2022 edition (published late 2023) is the latest complete published dataset. Police-level data from 2023–2024 supplements the gap for both Darjeeling and Siliguri.

---

## Coordinate Sources

| Source | URL | Usage |
|--------|-----|-------|
| OpenStreetMap / Nominatim | [https://nominatim.openstreetmap.org](https://nominatim.openstreetmap.org) | Geocoding hill area names, tea estates, and landmarks |
| Google Maps / Google Earth | [https://maps.google.com](https://maps.google.com) | Precise lat/lon for viewpoints, tea estates, road curves; elevation crosscheck |
| Survey of India topographic maps | [https://surveyofindia.gov.in](https://surveyofindia.gov.in) | Verified elevation and settlement positions in GTA area |
| Wikimapia | [https://wikimapia.org](https://wikimapia.org) | Identifying local area names and tea estate boundaries |

---

## Darjeeling-Specific Data Challenges

1. **Sparse police station coverage**: Hill areas have large police station jurisdictions; FIR data is less granular than Kolkata
2. **Seasonal road variability**: Monsoon renders many ratings outdated for 3–4 months per year
3. **Limited traffic counting**: No automated traffic counters on most hill roads; accident data depends on FIR registration
4. **Tea estate roads**: Private roads within tea estates have no government condition data; estimated from satellite imagery and local input
5. **Trek routes**: Sandakphu/Tonglu route ratings are based on trekker reports and BRO assessments, not traditional road surveys
