import os
import json
from groq import Groq
import google.generativeai as genai
import os
from .geocoding_utils import get_geocoder

class PoliceRecommendationAgent:
    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY")
        self.is_mock = not self.api_key or self.api_key.startswith("mock")
        self.client = Groq(api_key=self.api_key) if self.api_key and not self.api_key.startswith("mock") else None
        self.geocoder = get_geocoder()

    def analyze_patrol_coverage(self, spatial_df, patrol_df):
        if self.is_mock:
            return {
                "success": True,
                "domain_reallocation": "Move 5 extra officers to Sector 4 and 2 to Sector 1 due to high density readings.",
                "resource_needs": "Require additional 3 riot-gear units for deployment near the central plaza.",
                "priority_actions": "1. Dispatch immediate reconnaissance to identified hotspots. 2. Establish checkpoints.",
                "risk_mitigation": "Install temporary lighting to address the poor lighting condition.",
                "mock_warning": "(Mocked Response: Valid Groq key missing)"
            }

        top_risk = spatial_df.nlargest(5, 'risk_score')[['latitude', 'longitude', 'risk_score', 'people_count']].to_dict('records')
        context = f"Analyzing {len(patrol_df)} active patrol officers against top 5 risk points: {top_risk}."
        
        try:
            response = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are a senior police strategist for Darjeeling district. Provide highly actionable, concise reallocation orders. Do not write fluff. Give precise instructions like 'Move 2 units from X to Y to cover risk.'"},
                    {"role": "user", "content": context}
                ],
                max_tokens=500
            )
            return {"success": True, "analysis": response.choices[0].message.content}
        except Exception as e:
            return {"success": False, "error": str(e)}

class TouristSafetyAgent:
    def __init__(self):
        self.api_key = os.getenv("GOOGLE_API_KEY")
        self.is_mock = not self.api_key or self.api_key.startswith("mock")
        if not self.is_mock:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel('gemini-2.5-flash')

    def analyze_tourist_safety(self, tourist_df, spatial_df):
        if self.is_mock:
            return {
                "success": True,
                "safe_routes": "Avoid National Highway 37 between 6 PM to 10 PM. Stick to newly paved paths near the lake.",
                "emergency_protocols": "Contact dial 112. Emergency shelter available 500m north of destination A.",
                "mock_warning": "(Mocked Response: Valid Google API key missing)"
            }
            
        top_risk = spatial_df.nlargest(5, 'risk_score')[['latitude', 'longitude', 'risk_score', 'people_count']].to_dict('records')
        
        context = f"Analyzing {len(tourist_df)} tourist itineraries near Darjeeling. Top 5 risk areas: {top_risk}."
        prompt = f"Act as Darjeeling Tourist Police. Based on this geospatial data: {context}\nProvide 3 hyper-specific, actionable safe route recommendations or emergency protocols. Keep it brief and focused on actual locations mentioned."
        try:
            response = self.model.generate_content(prompt)
            return {"success": True, "recommendations": response.text}
        except Exception as e:
            return {"success": False, "error": str(e)}

class IntegratedAIManager:
    def __init__(self):
        self.police_agent = PoliceRecommendationAgent()
        self.tourist_agent = TouristSafetyAgent()
        
    def generate_comprehensive_report(self, spatial_df, patrol_df, tourist_df):
        report = {}
        report['police'] = self.police_agent.analyze_patrol_coverage(spatial_df, patrol_df)
        report['tourist'] = self.tourist_agent.analyze_tourist_safety(tourist_df, spatial_df)
        
        # Check critical alerts
        critical_zones = spatial_df[spatial_df['risk_score'] > 0.8]
        report['critical_alerts'] = [
            f"Location ({row['latitude']:.2f}, {row['longitude']:.2f}): IMMEDIATE PATROL DEPLOYMENT"
            for _, row in critical_zones.iterrows()
        ]
        return report
