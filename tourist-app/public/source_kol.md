# Data Sources — Kolkata Safety Dataset (`kol_data.csv`)

> **294 locations** across Kolkata, West Bengal  
> **Ratings scale**: 1–10 (road condition, crime intensity, accident proneness)  
> **Generated**: March 2026  
> **Disclaimer**: Ratings are **representative estimates** at the neighborhood level, NOT real-time sensor readings.

---

## 1. Road Condition (`road_rating`)

| Source | URL | Data Period | Notes |
|--------|-----|-------------|-------|
| Kolkata Municipal Corporation (KMC) — Ward-level road reports | [https://www.kmcgov.in](https://www.kmcgov.in) | 2023–2025 | Ward-wise road condition surveys, pothole complaints, and resurfacing schedules |
| KMDA (Kolkata Metropolitan Development Authority) | [https://www.kmdaonline.org](https://www.kmdaonline.org) | 2022–2024 | Infrastructure development reports covering road widening and upgrades in EM Bypass, New Town, Salt Lake corridors |
| Public Works Department (PWD), Govt. of West Bengal | [https://pwdwb.in](https://pwdwb.in) | 2023–2025 | State highway and arterial road condition assessments; bridge maintenance records |
| National Highways Authority of India (NHAI) | [https://nhai.gov.in](https://nhai.gov.in) | 2023–2024 | NH condition data for stretches within Kolkata metro (NH 12, NH 16, EM Bypass) |
| OpenStreetMap — Surface quality tags | [https://www.openstreetmap.org](https://www.openstreetmap.org) | Ongoing | Community-contributed road surface tags (`surface=asphalt`, `surface=unpaved`, `smoothness=*`) |
| Google Maps — User reviews & road imagery | [https://maps.google.com](https://maps.google.com) | 2024–2025 | Street View imagery and user-reported road quality; used for cross-validation |
| Media Reports (The Telegraph, Times of India Kolkata) | [https://www.telegraphindia.com](https://www.telegraphindia.com), [https://timesofindia.indiatimes.com/city/kolkata](https://timesofindia.indiatimes.com/city/kolkata) | 2023–2025 | Investigative reports on waterlogging, pothole-prone stretches (Burrabazar, Sealdah area, Behala, Metiabruz) |

### Key methodology notes
- **Salt Lake / New Town**: Rated 8–9 (planned city, well-maintained concrete/asphalt roads)
- **North Kolkata (Burrabazar, Posta)**: Rated 3–4 (narrow, congested, poorly maintained)
- **EM Bypass**: Rated 6–7 (national highway grade but variable due to patches and flyover joints)
- **Howrah side**: Rated 5 (mixed quality, older infrastructure)

---

## 2. Crime (`crime_rating`)

| Source | URL | Data Period | Notes |
|--------|-----|-------------|-------|
| National Crime Records Bureau (NCRB) — "Crime in India" | [https://ncrb.gov.in/crime-in-india.html](https://ncrb.gov.in/crime-in-india.html) | 2021–2023 (latest published) | City-level aggregate crime statistics; used for citywide baseline |
| NCRB — Police Station-level data | [https://ncrb.gov.in](https://ncrb.gov.in) | 2021–2022 | FIR counts by police station jurisdiction; mapped to neighborhoods |
| Kolkata Police — Published crime statistics | [https://kolkatapolice.gov.in](https://kolkatapolice.gov.in) | 2023–2024 | Police station-wise crime data, IPC & SLL case counts, monthly crime summaries |
| West Bengal Police — Crime mapping portal | [https://wb.gov.in/department-home-police.aspx](https://wb.gov.in/department-home-police.aspx) | 2022–2024 | District and PS-level crime trends for Kolkata Police Commissionerate |
| Kolkata Police — Citizen Portal / FIR records | [https://kolkatapolice.gov.in/citizen-services](https://kolkatapolice.gov.in/citizen-services) | 2023–2025 | Online FIR data; complaint trends by area |
| Media reports & investigative journalism | Various (Telegraph, ABP, NDTV) | 2023–2025 | Crime hotspot identification: Khidderpore, Metiabruz, Mominpur, Burrabazar, Howrah Station area |

### Key methodology notes
- **Fort William / Maidan**: Rated 1–3 (restricted military area / open parkland, very low crime)
- **Burrabazar / Khidderpore / Metiabruz**: Rated 7 (historically high petty crime, theft, public order issues)
- **Salt Lake / New Town**: Rated 2 (planned township, well-policed, low crime)
- **Sealdah / Howrah Station**: Rated 6–7 (transit hub crime — pickpocketing, snatching)
- **2022 NCRB data** is the latest fully published year; 2023–2024 data from police sources supplements it

---

## 3. Accidents (`accident_rating`)

| Source | URL | Data Period | Notes |
|--------|-----|-------------|-------|
| Ministry of Road Transport & Highways (MORTH) — "Road Accidents in India" | [https://morth.nic.in/road-accident-in-india](https://morth.nic.in/road-accident-in-india) | 2021–2023 | Annual national report; city-level and corridor-level accident statistics |
| Kolkata Traffic Police — Accident statistics | [https://kolkatatrafficpolice.gov.in](https://kolkatatrafficpolice.gov.in) | 2023–2024 | Intersection-wise and corridor-wise accident counts; black spot identification |
| SaveLIFE Foundation — India road safety reports | [https://savelifefoundation.org](https://savelifefoundation.org) | 2022–2024 | Analysis of accident black spots; advocacy reports with Kolkata-specific data |
| NHAI — Accident black spot data | [https://nhai.gov.in](https://nhai.gov.in) | 2023–2024 | Black spots on NH stretches within Kolkata (EM Bypass, VIP Road) |
| iRAD (Integrated Road Accident Database) | [https://irad.parivahan.gov.in](https://irad.parivahan.gov.in) | 2022–2024 | Geo-tagged accident records from FIR data; used for intersection-level mapping |
| Kolkata Police — Fatal accident reports | [https://kolkatapolice.gov.in](https://kolkatapolice.gov.in) | 2023–2024 | Fatal and grievous injury accident data by police station |

### Key methodology notes
- **EM Bypass (Ruby, Parama Island)**: Rated 7–8 (high-speed corridor, frequent fatal accidents)
- **Park Circus 7-Point / Shyambazar 5-Point**: Rated 7 (complex multi-road intersections)
- **Howrah Bridge / BT Road Dunlop**: Rated 7 (heavy mixed traffic — trucks, buses, pedestrians)
- **Maidan / Victoria Memorial**: Rated 2–3 (low traffic, pedestrian-dominated)
- **New Town**: Rated 2 (wide roads, controlled intersections, low density)

---

## Data Recency Summary

| Category | Most Recent Source Data | Published/Updated |
|----------|----------------------|-------------------|
| Road Condition | KMC, PWD, OSM | 2023–2025 (ongoing) |
| Crime | NCRB 2022 (latest full), KP 2024 | 2022–2024 |
| Accidents | MORTH 2023, iRAD 2024 | 2022–2024 |

> **Note**: NCRB publishes "Crime in India" with a ~1.5 year lag. The 2022 edition (published late 2023) is the latest complete dataset. Kolkata Police data for 2023–2024 supplements the gap. Road and accident data are more current due to real-time reporting channels.

---

## Coordinate Sources

| Source | URL | Usage |
|--------|-----|-------|
| OpenStreetMap / Nominatim | [https://nominatim.openstreetmap.org](https://nominatim.openstreetmap.org) | Geocoding area names to lat/lon coordinates |
| Google Maps | [https://maps.google.com](https://maps.google.com) | Cross-validation of coordinates; identifying exact intersection/landmark locations |
| Wikimapia | [https://wikimapia.org](https://wikimapia.org) | Identifying neighborhood boundaries and local area names |
