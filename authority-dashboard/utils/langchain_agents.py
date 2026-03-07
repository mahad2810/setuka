import os
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import ChatPromptTemplate
from langchain.schema.output_parser import StrOutputParser
import asyncio

class DataIngestor:
    def get_summary_context(spatial_df, patrol_df, tourist_df):
        top_risk = spatial_df.nlargest(5, 'risk_score')[['latitude', 'longitude', 'risk_score', 'people_count']].to_dict('records')
        top_crowds = spatial_df.nlargest(5, 'people_count')[['latitude', 'longitude', 'people_count']].to_dict('records')
        
        return (f"Context: Analyzing {len(spatial_df)} locations in Darjeeling. "
                f"Top 5 Safey Risk Zones: {top_risk}. "
                f"Most Crowded Zones: {top_crowds}. "
                f"Active Police Patrols: {len(patrol_df)}. "
                f"Monitored Tourists: {len(tourist_df)}. "
                f"Do NOT give generic advice. Provide specific deployment shifts and route changes based on the coordinates.")

class IntegratedLangChainManager:
    def __init__(self):
        self.groq_key = os.getenv("GROQ_API_KEY", "")
        self.google_key = os.getenv("GOOGLE_API_KEY", "")
        
        # Determine if we need to mock
        self.mock_groq = not self.groq_key or self.groq_key.startswith("mock")
        self.mock_google = not self.google_key or self.google_key.startswith("mock")

    async def _run_all_agents(self, context):
        async def run_police():
            if self.mock_groq:
                return "MOCKED RESPONSE: Move Unit 2 to northeast zone. Reinforce city square."
            try:
                llm = ChatGroq(model_name="llama-3.3-70b-versatile", groq_api_key=self.groq_key)
                prompt = ChatPromptTemplate.from_template("You are Darjeeling Police Command. Give 2 immediate, specific patrol reallocation orders transferring units to the risk areas defined in this context: {context}\nOutput only the orders.")
                chain = prompt | llm | StrOutputParser()
                return await chain.ainvoke({"context": context})
            except Exception as e:
                return f"Failed: {str(e)}"
                
        async def run_tourist():
            if self.mock_google:
                return "MOCKED RESPONSE: Divert incoming bus tours to alternate western viewing point."
            try:
                llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=self.google_key)
                prompt = ChatPromptTemplate.from_template("You are Darjeeling Tourist Control. Provide 2 specific traffic diversion or crowd management directives based purely on this context: {context}\nMake it sound like an urgent dispatch, not a generic guide.")
                chain = prompt | llm | StrOutputParser()
                return await chain.ainvoke({"context": context})
            except Exception as e:
                return f"Failed: {str(e)}"
                
        async def run_low_crowd():
            if self.mock_google:
                return "MOCKED RESPONSE: Recommend visiting Botanical Gardens, currently under 10% capacity."
            try:
                llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=self.google_key)
                prompt = ChatPromptTemplate.from_template("Identify one specific low-crowd alternative space from this data for tourists to visit. Be direct: {context}")
                chain = prompt | llm | StrOutputParser()
                return await chain.ainvoke({"context": context})
            except Exception as e:
                return f"Failed: {str(e)}"

        police_res, tourist_res, low_crowd_res = await asyncio.gather(
            run_police(), run_tourist(), run_low_crowd()
        )
        return {
            'police_allocation': police_res,
            'tourist_management': tourist_res,
            'low_crowd_recommendations': low_crowd_res
        }

    def run_multi_agent_analysis(self, spatial_df, patrol_df, tourist_df):
        context = DataIngestor.get_summary_context(spatial_df, patrol_df, tourist_df)
        return asyncio.run(self._run_all_agents(context))
