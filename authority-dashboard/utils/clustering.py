from sklearn.cluster import DBSCAN
import numpy as np
import pandas as pd

def create_crowd_clusters(gdf, eps=0.001, min_samples=300, weight_col='people_count'):
    """Identifies high-density crowd zones"""
    if gdf.empty:
        return gdf, pd.DataFrame()
        
    coords = np.radians(gdf[['latitude', 'longitude']].values)
    
    db = DBSCAN(eps=np.radians(eps), min_samples=min_samples, metric='haversine').fit(coords, sample_weight=gdf[weight_col])
    gdf['crowd_cluster'] = db.labels_
    
    # Calculate stats
    clusters = []
    for lbl in gdf['crowd_cluster'].unique():
        if lbl == -1:
            continue
        cluster_pts = gdf[gdf['crowd_cluster'] == lbl]
        total_people = cluster_pts[weight_col].sum()
        clusters.append({
            'cluster_id': lbl,
            'cluster_size': len(cluster_pts),
            'cluster_centroid_lat': cluster_pts['latitude'].mean(),
            'cluster_centroid_lon': cluster_pts['longitude'].mean(),
            'cluster_total_count': total_people,
            'cluster_avg_count': cluster_pts[weight_col].mean()
        })
        
    cluster_df = pd.DataFrame(clusters)
    if not cluster_df.empty:
        Q1, Q3 = cluster_df['cluster_total_count'].quantile(0.25), cluster_df['cluster_total_count'].quantile(0.75)
        def get_severity(x):
            if x >= Q3: return 'high'
            if x >= Q1: return 'moderate'
            return 'low'
        cluster_df['cluster_severity'] = cluster_df['cluster_total_count'].apply(get_severity)
        
    return gdf, cluster_df

def create_risk_clusters(gdf, eps=0.003, min_samples=10):
    """Groups geographic areas by combined environmental risk"""
    if gdf.empty:
        return gdf, pd.DataFrame()
        
    coords = np.radians(gdf[['latitude', 'longitude']].values)
    db = DBSCAN(eps=np.radians(eps), min_samples=min_samples, metric='haversine').fit(coords)
    gdf['risk_cluster'] = db.labels_
    
    clusters = []
    for lbl in gdf['risk_cluster'].unique():
        if lbl == -1:
            continue
        cluster_pts = gdf[gdf['risk_cluster'] == lbl]
        clusters.append({
            'cluster_id': lbl,
            'cluster_size': len(cluster_pts),
            'centroid_lat': cluster_pts['latitude'].mean(),
            'centroid_lon': cluster_pts['longitude'].mean(),
            'avg_risk': cluster_pts['risk_score'].mean()
        })
    return gdf, pd.DataFrame(clusters)

def create_tourist_hotspot_clusters(gdf, eps=0.005, min_samples=5):
    if gdf.empty:
        return gdf, pd.DataFrame()
        
    coords = np.radians(gdf[['latitude', 'longitude']].values)
    db = DBSCAN(eps=np.radians(eps), min_samples=min_samples, metric='haversine').fit(coords)
    gdf['tourist_cluster'] = db.labels_
    
    clusters = []
    for lbl in gdf['tourist_cluster'].unique():
        if lbl == -1:
            continue
        cluster_pts = gdf[gdf['tourist_cluster'] == lbl]
        clusters.append({
            'cluster_id': lbl,
            'cluster_size': len(cluster_pts),
            'centroid_lat': cluster_pts['latitude'].mean(),
            'centroid_lon': cluster_pts['longitude'].mean()
        })
    return gdf, pd.DataFrame(clusters)
