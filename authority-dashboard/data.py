import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
import json
import os

def generate_spatial_data(num_points=5000):
    cities = [
        (26.1445, 91.7362), # Guwahati
        (25.5369, 91.2987), # Shillong
        (27.1004, 93.6167), # Itanagar
        (23.1645, 92.9376), # Aizawl
        (25.6751, 94.1086)  # Kohima
    ]
    
    data = []
    now = datetime.now()
    
    for _ in range(num_points):
        if random.random() < 0.7:
            city_lat, city_lon = random.choice(cities)
            lat = city_lat + random.uniform(-0.1, 0.1)
            lon = city_lon + random.uniform(-0.1, 0.1)
        else:
            lat = random.uniform(22.0, 29.0)
            lon = random.uniform(89.0, 97.0)
            
        crime_rate = random.uniform(0, 100)
        lighting_condition = random.choice(['good', 'dim', 'poor'])
        car_accident_rate = np.random.poisson(2)
        
        # Himalayan zones
        if lat > 26 and lon > 92:
            landslide_rate = 1 if random.random() < 0.6 else 0
        else:
            landslide_rate = 1 if random.random() < 0.1 else 0
            
        people_count = int(np.random.exponential(50))
        if random.random() < 0.05:
            people_count += random.randint(300, 1000)
            
        timestamp = now - timedelta(hours=random.uniform(0, 72))
        
        data.append({
            'latitude': lat,
            'longitude': lon,
            'crime_rate': crime_rate,
            'lighting_condition': lighting_condition,
            'car_accident_rate': car_accident_rate,
            'landslide_rate': landslide_rate,
            'people_count': people_count,
            'timestamp': timestamp.isoformat()
        })
        
    df = pd.DataFrame(data)
    df.to_csv('spatial_dataset.csv', index=False)
    print("Generated spatial_dataset.csv")

def generate_tourist_data(num_tourists=1000):
    data = []
    now = datetime.now()
    dests = [
        (27.5860, 91.8654), # Tawang
        (25.2702, 91.7323), # Cherrapunji
        (26.9500, 94.1667), # Majuli
        (27.3314, 88.6138)  # Gangtok
    ]
    
    for i in range(1, num_tourists + 1):
        start = random.choice(dests)
        end = random.choice(dests)
        
        start = (start[0] + random.uniform(-0.02, 0.02), start[1] + random.uniform(-0.02, 0.02))
        end = (end[0] + random.uniform(-0.02, 0.02), end[1] + random.uniform(-0.02, 0.02))
        
        travel_date = (now - timedelta(days=random.randint(0, 3))).date()
        
        data.append({
            'tourist_id': i,
            'name': f"Tourist_{i}",
            'age': random.randint(18, 70),
            'itinerary_points': random.randint(2, 8),
            'start_coord': str(start),
            'end_coord': str(end),
            'travel_date': travel_date.isoformat()
        })
        
    df = pd.DataFrame(data)
    df.to_csv('tourist_dataset.csv', index=False)
    print("Generated tourist_dataset.csv")

def generate_police_data(num_officers=200):
    data = []
    now = datetime.now()
    
    for i in range(1, num_officers + 1):
        lat = random.uniform(22.0, 29.0)
        lon = random.uniform(89.0, 97.0)
        
        shift_start = now.replace(hour=8, minute=0, second=0)
        if random.random() < 0.5:
            shift_start = now.replace(hour=20, minute=0, second=0)
            
        data.append({
            'staff_id': i,
            'name': f"Officer_{i}",
            'rank': random.choice(['Constable', 'ASI', 'SI', 'Inspector']),
            'assigned_zone': f"Zone_{random.randint(1, 20)}",
            'shift_start': shift_start.isoformat(),
            'shift_end': (shift_start + timedelta(hours=12)).isoformat(),
            'lat': lat,
            'lon': lon
        })
        
    df = pd.DataFrame(data)
    df.to_csv('police_patrol_dataset.csv', index=False)
    print("Generated police_patrol_dataset.csv")

def generate_ancillary_data():
    geojson = {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "properties": {"name": "NE India Region"},
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [89.0, 22.0], [97.0, 22.0], [97.0, 29.0], [89.0, 29.0], [89.0, 22.0]
              ]
            ]
          }
        }
      ]
    }
    with open('spatial_data.geojson', 'w') as f:
        json.dump(geojson, f)
    
    network = {
        "nodes": [
            {"id": "tawang", "lat": 27.5860, "lon": 91.8654},
            {"id": "cherrapunji", "lat": 25.2702, "lon": 91.7323}
        ],
        "edges": [
            {"source": "tawang", "target": "cherrapunji", "distance": 500}
        ]
    }
    with open('tourist_network.json', 'w') as f:
        json.dump(network, f)
    print("Generated geojson and network json files.")

if __name__ == "__main__":
    generate_spatial_data()
    generate_tourist_data()
    generate_police_data()
    generate_ancillary_data()
    print("Data generation complete.")
