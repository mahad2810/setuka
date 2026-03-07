import os
import requests
import streamlit as st
from dotenv import load_dotenv

load_dotenv()

class UniversalGeocoder:
    def __init__(self):
        self.api_key = os.getenv('OPENCAGE_API_KEY', 'mock')
        self.cache = {}
        
    def get_address(self, lat, lon):
        key = f"{lat:.4f},{lon:.4f}"
        if key in self.cache:
            return self.cache[key]
            
        if not self.api_key or self.api_key.startswith('mock'):
            # Mock behavior
            addr = f"Address for {lat:.2f}, {lon:.2f} (Mocked)"
            self.cache[key] = addr
            return addr
            
        try:
            url = f"https://api.opencagedata.com/geocode/v1/json?q={lat}+{lon}&key={self.api_key}"
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                results = response.json().get('results', [])
                if results:
                    addr = results[0]['formatted']
                    self.cache[key] = addr
                    return addr
        except:
            pass
            
        addr = f"{lat:.4f}, {lon:.4f}"
        self.cache[key] = addr
        return addr

    def add_addresses_to_dataframe(self, df, lat_col='latitude', lon_col='longitude', address_col='address'):
        addresses = []
        for _, row in df.iterrows():
            addresses.append(self.get_address(row[lat_col], row[lon_col]))
        df[address_col] = addresses
        return df

    def get_coordinates(self, address):
        if not self.api_key or self.api_key.startswith('mock'):
            # Return arbitrary coordinate near Guwahati for mock testing
            return (26.14, 91.73)
            
        try:
            url = f"https://api.opencagedata.com/geocode/v1/json?q={address}&key={self.api_key}"
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                results = response.json().get('results', [])
                if results:
                    return (results[0]['geometry']['lat'], results[0]['geometry']['lng'])
        except:
            pass
        return None

@st.cache_resource
def get_geocoder():
    return UniversalGeocoder()
