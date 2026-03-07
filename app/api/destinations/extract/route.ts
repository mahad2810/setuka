import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Groq-compatible client via OpenAI SDK
type TripActivity = {
  id: string
  title: string
  location: string
  time: string
  type: "hotel" | "attraction" | "restaurant" | "transport" | "other"
  description?: string
  duration?: string
}

type ExtractResponse = {
  destinations: {
    name: string
    originalActivity: TripActivity
    extractedLocation: string
    confidence: number
  }[]
}

export async function POST(req: NextRequest) {
  try {
    const { activities } = await req.json()
    if (!activities || !Array.isArray(activities)) {
      return NextResponse.json({ error: 'Missing or invalid activities array' }, { status: 400 })
    }

    const apiKey = process.env.GROQ_API_KEY

    // Fallback extraction: use activity location and title
    const fallbackExtract = (activities: TripActivity[]) => {
      return activities.map(activity => ({
        name: activity.location || activity.title,
        originalActivity: activity,
        extractedLocation: activity.location || activity.title,
        confidence: activity.location ? 0.8 : 0.5
      })).filter(dest => dest.name && dest.name.trim().length > 0)
    }

    if (!apiKey) {
      return NextResponse.json<ExtractResponse>({ 
        destinations: fallbackExtract(activities) 
      })
    }

    const openai = new OpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' })

    // Enhanced prompt for extracting destinations from activities
    const activitiesText = activities.map((activity, index) => 
      `${index + 1}. ${activity.time} - ${activity.title} at ${activity.location}${activity.description ? ` (${activity.description})` : ''}`
    ).join('\n')

    const prompt = `You are a travel assistant. Extract precise, geocodable location names from these itinerary activities.\n\n` +
      `For each activity, identify the most specific location that can be geocoded (address, landmark, business name, or area).\n` +
      `- Prioritize specific venues/landmarks over generic descriptions\n` +
      `- Include city/area context if the location seems ambiguous\n` +
      `- If location is vague, try to infer from the activity title\n` +
      `- Assign confidence score (0.0-1.0) based on how specific the location is\n\n` +
      `Activities:\n${activitiesText}\n\n` +
      `Return JSON: {\n` +
      `  "destinations": [\n` +
      `    {\n` +
      `      "name": "Most specific geocodable location name",\n` +
      `      "extractedLocation": "Cleaned/enhanced location string",\n` +
      `      "confidence": 0.95,\n` +
      `      "activityIndex": 0\n` +
      `    }\n` +
      `  ]\n` +
      `}\n\nJSON only:`

    let destinations: any[] = []
    
    try {
      const resp = await openai.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: 'You extract and enhance location names from travel activities for geocoding. Focus on precision and specificity.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 1500
      })
      
      const content = resp.choices?.[0]?.message?.content?.trim() || ''
      const jsonStart = content.indexOf('{')
      const jsonEnd = content.lastIndexOf('}')
      
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1))
        if (Array.isArray(parsed.destinations)) {
          destinations = parsed.destinations.map((dest: any) => {
            const activityIndex = dest.activityIndex || 0
            const originalActivity = activities[activityIndex] || activities[0]
            return {
              name: dest.name || dest.extractedLocation,
              originalActivity,
              extractedLocation: dest.extractedLocation || dest.name,
              confidence: Math.min(Math.max(dest.confidence || 0.5, 0), 1)
            }
          }).filter((dest: any) => dest.name && dest.name.trim().length > 0)
        }
      }
    } catch (error) {
      console.error('Groq extraction failed:', error)
      destinations = fallbackExtract(activities)
    }

    // If Groq extraction failed or returned empty, use fallback
    if (!destinations.length) {
      destinations = fallbackExtract(activities)
    }

    return NextResponse.json<ExtractResponse>({ destinations })
    
  } catch (err) {
    console.error('Destination extraction error:', err)
    return NextResponse.json({ error: 'Failed to extract destinations' }, { status: 500 })
  }
}