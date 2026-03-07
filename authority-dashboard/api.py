from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import json
import os
import threading
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Tourist Tracker Backend")

# Allow CORS so the tourist app can send requests from any browser / device
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Location(BaseModel):
    latitude: float
    longitude: float
    tourist_id: str = "Unknown"
    timestamp: str = None

# ── Storage: one JSON file, dict keyed by tourist_id ──────────────────────────
LOCATION_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "live_location.json")
_file_lock = threading.Lock()   # thread-safe file writes


def _read_all() -> dict:
    """Return the full dict of all tourist locations."""
    if os.path.exists(LOCATION_FILE):
        with open(LOCATION_FILE, "r") as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                pass
    return {}


def _write_all(data: dict):
    """Overwrite the file with the updated dict."""
    with open(LOCATION_FILE, "w") as f:
        json.dump(data, f, indent=2)


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.post("/api/location")
def update_location(loc: Location):
    """Receive a tourist's live location and persist it (keyed by tourist_id)."""
    with _file_lock:
        all_locs = _read_all()
        all_locs[loc.tourist_id] = loc.dict()
        _write_all(all_locs)
    return {"status": "success", "active_tourists": len(all_locs), "data": loc.dict()}


@app.get("/api/location")
def get_all_locations():
    """Return live locations of ALL tourists currently tracked."""
    return _read_all()


@app.get("/api/location/{tourist_id}")
def get_tourist_location(tourist_id: str):
    """Return the latest location for a specific tourist."""
    all_locs = _read_all()
    if tourist_id not in all_locs:
        raise HTTPException(status_code=404, detail=f"Tourist '{tourist_id}' not found.")
    return all_locs[tourist_id]


@app.delete("/api/location/{tourist_id}")
def remove_tourist(tourist_id: str):
    """Remove a tourist from the live tracking map (e.g. when they log out)."""
    with _file_lock:
        all_locs = _read_all()
        if tourist_id not in all_locs:
            raise HTTPException(status_code=404, detail=f"Tourist '{tourist_id}' not found.")
        del all_locs[tourist_id]
        _write_all(all_locs)
    return {"status": "removed", "tourist_id": tourist_id, "remaining": len(all_locs)}


@app.delete("/api/location")
def clear_all():
    """Clear ALL live tourist locations."""
    with _file_lock:
        _write_all({})
    return {"status": "cleared"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
