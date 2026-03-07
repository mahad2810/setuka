import folium
from folium.plugins import HeatMap
import pandas as pd
import numpy as np

def create_base_map(center_lat=26.0, center_lon=92.0, zoom_start=7):
    m = folium.Map(location=[center_lat, center_lon], zoom_start=zoom_start, tiles=None)
    folium.TileLayer('OpenStreetMap', name='OpenStreetMap', control=True).add_to(m)
    folium.TileLayer('CartoDB positron', name='CartoDB Positron', control=True).add_to(m)
    folium.TileLayer('CartoDB dark_matter', name='CartoDB Dark Matter', control=True).add_to(m)
    return m

def add_heatmap_layer(m, gdf, value_col='people_count', name='Crowd Heatmap', show=True):
    if gdf.empty:
        return m
        
    heat_data = [[row['latitude'], row['longitude'], row[value_col]] for index, row in gdf.iterrows()]
    fg = folium.FeatureGroup(name=name, show=show)
    HeatMap(heat_data, gradient={0.2: 'blue', 0.4: 'lime', 0.6: 'yellow', 1.0: 'red'}).add_to(fg)
    fg.add_to(m)
    return m

def add_cluster_markers(m, cluster_df, name='Crowd Clusters', show=True):
    if cluster_df.empty:
        return m
        
    fg = folium.FeatureGroup(name=name, show=show)
    for _, row in cluster_df.iterrows():
        color = 'red' if row.get('cluster_severity') == 'high' else 'orange' if row.get('cluster_severity') == 'moderate' else 'green'
        
        popup_html = f"""
        <b>Cluster Info</b><br>
        Size: {int(row['cluster_size'])} points<br>
        Avg Density: {row.get('cluster_avg_count', 0):.1f}<br>
        Severity: {row.get('cluster_severity', 'N/A')}
        """
        folium.CircleMarker(
            location=[row['cluster_centroid_lat'], row['cluster_centroid_lon']],
            radius=10,
            color=color,
            fill=True,
            fill_opacity=0.6,
            popup=folium.Popup(popup_html, max_width=200)
        ).add_to(fg)
    fg.add_to(m)
    return m

def add_risk_zones(m, risk_df, name='Risk Zones', show=True):
    if risk_df.empty:
        return m
    fg = folium.FeatureGroup(name=name, show=show)
    for _, row in risk_df.iterrows():
        popup_html = f"<b>Risk Zone</b><br>Score: {row.get('avg_risk', 0):.2f}"
        folium.CircleMarker(
            location=[row['centroid_lat'], row['centroid_lon']],
            radius=15,
            color='purple',
            fill='purple',
            fill_opacity=0.4,
            popup=folium.Popup(popup_html, max_width=200)
        ).add_to(fg)
    fg.add_to(m)
    return m

def add_police_markers(m, police_df, name='Police Patrols', show=True):
    if police_df.empty:
        return m
    fg = folium.FeatureGroup(name=name, show=show)
    for _, row in police_df.iterrows():
        popup_html = f"<b>Officer:</b> {row['officer_name']}<br><b>Zone:</b> {row['zone']}"
        folium.Marker(
            location=[row['latitude'], row['longitude']],
            icon=folium.Icon(color='blue', icon='shield', prefix='fa'),
            popup=folium.Popup(popup_html, max_width=200)
        ).add_to(fg)
    fg.add_to(m)
    return m

def add_tourist_markers(m, tourist_df, name='Tourist Activity', show=True):
    if tourist_df.empty:
        return m
    fg = folium.FeatureGroup(name=name, show=show)
    for _, row in tourist_df.iterrows():
        popup_html = f"<b>Tourist:</b> {row['name']}<br><b>Points:</b> {row['itinerary_points']}"
        folium.Marker(
            location=[row['latitude'], row['longitude']],
            icon=folium.Icon(color='green', icon='user', prefix='fa'),
            popup=folium.Popup(popup_html, max_width=200)
        ).add_to(fg)
    fg.add_to(m)
    return m

def add_patrol_routes(m, routes, name='Patrol Routes', show=True):
    fg = folium.FeatureGroup(name=name, show=show)
    for route in routes:
        folium.PolyLine(route, color='blue', weight=2.5, opacity=0.8).add_to(fg)
    fg.add_to(m)
    return m

def haversine_distance(lat1, lon1, lat2, lon2):
    import numpy as np
    R = 6371.0  # Earth radius in kilometers
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = np.sin(dlat/2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon/2)**2
    c = 2 * np.arcsin(np.sqrt(a))
    return R * c

def create_reallocation_map(spatial_df, patrol_df):
    m = create_base_map(
        center_lat=spatial_df['latitude'].mean(), 
        center_lon=spatial_df['longitude'].mean(), 
        zoom_start=12
    )
    
    # Priority: 1.0 is max risk. Spatial DF from AI page already normalized risk.
    if 'priority' not in spatial_df:
        if 'risk_score' in spatial_df:
            spatial_df['priority'] = spatial_df['risk_score']
        else:
            spatial_df['priority'] = 0.5
            
    # Top 5 most critical hotspots needing police presence
    hotspots = spatial_df.sort_values(by='priority', ascending=False).head(5)
    
    fg = folium.FeatureGroup(name="Scientific Reallocation Plan", show=True)
    
    # Track available officers to prevent assigning one officer to multiple hotspots
    available_officers = list(range(len(patrol_df)))
    
    # Greedy Algorithm: For each hotspot (highest priority first), find the closest available officer
    officers_per_hotspot = 2
    for _, target in hotspots.iterrows():
        if not available_officers:
            break
            
        # Target Position (Red Circle) - Added once per hotspot
        folium.CircleMarker(
            [target['latitude'], target['longitude']],
            radius=10, color='red', fill=True, fill_opacity=0.6,
            popup=f"Priority Target<br>Risk: {target['priority']:.2f}"
        ).add_to(fg)
        
        for _ in range(officers_per_hotspot):
            if not available_officers:
                break
                
            best_dist = float('inf')
            best_officer_idx = -1
            
            for idx in available_officers:
                officer = patrol_df.iloc[idx]
                dist = haversine_distance(target['latitude'], target['longitude'], officer['latitude'], officer['longitude'])
                if dist < best_dist:
                    best_dist = dist
                    best_officer_idx = idx
                    
            # Assign best officer
            available_officers.remove(best_officer_idx)
            assigned_officer = patrol_df.iloc[best_officer_idx]
            
            # 1. Original Position (Gray Marker)
            folium.Marker(
                [assigned_officer['latitude'], assigned_officer['longitude']],
                popup=f"Original Pos: {assigned_officer['officer_name']}<br>Station: {assigned_officer['station']}",
                icon=folium.Icon(color='lightgray', icon='star')
            ).add_to(fg)
            
            # 2. Reallocation Path (Blue Dashed Line)
            folium.PolyLine(
                locations=[[assigned_officer['latitude'], assigned_officer['longitude']], 
                           [target['latitude'], target['longitude']]],
                color='blue', weight=4, dash_array='5, 10', opacity=0.7,
                tooltip=f"Move {assigned_officer['officer_name']} ({best_dist:.1f} km)"
            ).add_to(fg)
        
    fg.add_to(m)
    return m
