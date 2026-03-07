import pandas as pd
import geopandas as gpd
from shapely.geometry import Point
import ast
from datetime import datetime

def calculate_risk_score(gdf):
    """
    Composite risk formula:
    risk_score = 0.40 * crime_rate + 0.20 * (1 - lighting_level) +
                 0.15 * (accident_count / max(accident_count)) +
                 0.15 * landslide_risk + 0.10 * flood_risk
    Flood risk is heuristically generated.
    """
    max_accidents = gdf['accident_count'].max() if 'accident_count' in gdf and gdf['accident_count'].max() > 0 else 1
    
    # Synthetic flood risk for Brahmaputra basin (24.0-27.5N, 89-95E)
    def flood_risk(row):
        if 24.0 <= row['latitude'] <= 27.5 and 89.0 <= row['longitude'] <= 95.0:
            return 0.8
        return 0.1

    gdf['flood_risk'] = gdf.apply(flood_risk, axis=1)

    gdf['risk_score'] = (
        0.40 * gdf['crime_rate'] +
        0.20 * (1 - gdf['lighting_level']) +
        0.15 * (gdf['accident_count'] / max_accidents) +
        0.15 * gdf['landslide_risk'] +
        0.10 * gdf['flood_risk']
    )
    
    gdf['risk_score'] = gdf['risk_score'].clip(0, 1)
    return gdf

def load_spatial_data(csv_path, geojson_path=None):
    df = pd.read_csv(csv_path)
    
    # Handle missing columns if we are using actual_gps.csv instead of spatial_dataset.csv
    if 'lighting_condition' not in df.columns: df['lighting_condition'] = 'good'
    if 'crime_rate' not in df.columns: df['crime_rate'] = 0.5
    if 'car_accident_rate' not in df.columns: df['car_accident_rate'] = 1
    if 'landslide_rate' not in df.columns: df['landslide_rate'] = 0
    if 'people_count' not in df.columns: df['people_count'] = 15
    
    # Normalizing
    lighting_map = {'good': 0.8, 'dim': 0.5, 'poor': 0.2}
    df['lighting_level'] = df['lighting_condition'].map(lighting_map).fillna(0.5)
    
    if df['crime_rate'].max() > 1.0:
        df['crime_rate'] = df['crime_rate'] / 100.0
        
    df['accident_count'] = df['car_accident_rate']
    df['landslide_risk'] = df['landslide_rate']
    
    # Geometry
    geometry = [Point(xy) for xy in zip(df['longitude'], df['latitude'])]
    gdf = gpd.GeoDataFrame(df, geometry=geometry, crs="EPSG:4326")
    
    gdf['timestamp'] = pd.to_datetime(gdf['timestamp'])
    
    gdf = calculate_risk_score(gdf)
    return gdf

def load_tourist_data(csv_path, network_path=None):
    df = pd.read_csv(csv_path)
    
    # If it's the new actual_gps.csv format, it already has latitude and longitude
    if 'latitude' not in df.columns or 'longitude' not in df.columns:
        def parse_coord(coord_str, idx):
            try:
                import ast
                val = ast.literal_eval(coord_str)
                return val[idx]
            except:
                return 0.0
                
        if 'start_coord' in df.columns:
            df['latitude'] = df['start_coord'].apply(lambda x: parse_coord(x, 0))
            df['longitude'] = df['start_coord'].apply(lambda x: parse_coord(x, 1))

    if 'name' not in df.columns:
        df['name'] = df['tourist_id'].astype(str) if 'tourist_id' in df.columns else 'Tourist'
        
    if 'itinerary_points' not in df.columns:
        df['itinerary_points'] = 3
        
    if 'travel_date' in df.columns:
        df['timestamp'] = pd.to_datetime(df['travel_date'])
    elif 'timestamp' in df.columns:
        df['timestamp'] = pd.to_datetime(df['timestamp'])
    
    geometry = [Point(xy) for xy in zip(df['longitude'], df['latitude'])]
    gdf = gpd.GeoDataFrame(df, geometry=geometry, crs="EPSG:4326")
    
    return gdf

def load_police_data(csv_path):
    df = pd.read_csv(csv_path)
    
    df.rename(columns={'lat': 'latitude', 'lon': 'longitude', 'name': 'officer_name', 'assigned_zone': 'zone'}, inplace=True)
    df['vehicle_id'] = 'V' + df['staff_id'].astype(str)
    
    geometry = [Point(xy) for xy in zip(df['longitude'], df['latitude'])]
    gdf = gpd.GeoDataFrame(df, geometry=geometry, crs="EPSG:4326")
    
    # Synthetic timestamp
    gdf['timestamp'] = pd.to_datetime(df['shift_start'])
    
    return gdf

def filter_by_time(gdf, hours_back=24):
    if 'timestamp' not in gdf.columns:
        return gdf
    cutoff = datetime.now() - pd.Timedelta(hours=hours_back)
    return gdf[gdf['timestamp'] >= cutoff]
