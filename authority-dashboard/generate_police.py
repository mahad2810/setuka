import pandas as pd
import numpy as np
import random
from datetime import datetime, timedelta

def generate_darjeeling_police():
    # Darjeeling Town and surrounding stations
    stations = [
        {"name": "Darjeeling Sadar PS", "lat": 27.0425, "lon": 88.2635, "zone": "Darjeeling Core"},
        {"name": "Ghoom Jorebunglow PS", "lat": 27.0118, "lon": 88.2560, "zone": "Ghoom/Tiger Hill"},
        {"name": "Kurseong PS", "lat": 26.8785, "lon": 88.2778, "zone": "Kurseong Valley"},
        {"name": "Kalimpong PS", "lat": 27.0594, "lon": 88.4695, "zone": "Kalimpong East"}
    ]
    
    data = []
    now = datetime.now()
    
    for i in range(1, 41):  # 40 officers
        station = random.choice(stations)
        
        # Officers are patrolling near their station (within ~2km)
        lat = station["lat"] + random.uniform(-0.015, 0.015)
        lon = station["lon"] + random.uniform(-0.015, 0.015)
        
        shift_start = now.replace(hour=8, minute=0, second=0)
        if random.random() < 0.5:
            shift_start = now.replace(hour=20, minute=0, second=0)
            
        data.append({
            'staff_id': i,
            'name': f"Officer_{i}",
            'rank': random.choice(['Constable', 'ASI', 'SI']),
            'assigned_zone': station["zone"],
            'station': station["name"],
            'shift_start': shift_start.isoformat(),
            'shift_end': (shift_start + timedelta(hours=12)).isoformat(),
            'lat': lat,
            'lon': lon
        })
        
    df = pd.DataFrame(data)
    df.to_csv('police_patrol_dataset.csv', index=False)
    print("Generated Darjeeling police_patrol_dataset.csv with 40 officers across 4 stations.")

if __name__ == "__main__":
    generate_darjeeling_police()
