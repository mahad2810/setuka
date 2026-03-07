import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
})

const SCORE_API_URL = process.env.SCORE_API_URL || 'https://safetyscore-regression.onrender.com'

interface Coordinates {
  lat: number
  lng: number
}

// Label → riskLevel mapping
function labelToRisk(label: string): 'low' | 'medium' | 'high' {
  if (label === 'Very Safe' || label === 'Safe') return 'low'
  if (label === 'Moderate') return 'medium'
  return 'high' // Caution | High Risk
}

// Normalize SafetyScore API score (3.0–8.7) to 0–100 for dashboard badge thresholds
function normalizeScore(raw: number): number {
  return Math.round(raw * 10 * 10) / 10
}

async function fetchSafetyScore(coordinates: Coordinates) {
  const url = `${SCORE_API_URL}/score?lat=${coordinates.lat}&lon=${coordinates.lng}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`SafetyScore API error: ${res.status}`)
  return res.json()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { coordinates, routeCoordinates } = body

    if (!coordinates && !routeCoordinates) {
      return NextResponse.json(
        { error: 'Coordinates or routeCoordinates are required' },
        { status: 400 }
      )
    }

    if (coordinates && (typeof coordinates.lat !== 'number' || typeof coordinates.lng !== 'number')) {
      return NextResponse.json(
        { error: 'Invalid coordinates format. lat and lng must be numbers' },
        { status: 400 }
      )
    }

    const results: any = {}

    // ── Single-location safety ────────────────────────────────────────────────
    if (coordinates?.lat && coordinates?.lng) {
      try {
        const apiData = await fetchSafetyScore(coordinates)

        if (apiData.outsideCoverage) {
          results.location = {
            score: 50,
            rawScore: null,
            label: 'Outside Coverage',
            crime: null,
            accident: null,
            road: null,
            analysis: 'This location is outside the covered regions (Kolkata and Darjeeling). Safety data is not available.',
            riskLevel: 'medium',
            recommendations: [
              'Location is outside covered safety zones',
              'Exercise standard travel precautions',
              'Check local sources for area-specific safety information',
            ],
            outsideCoverage: true,
          }
        } else {
          const score = normalizeScore(apiData.score)
          const risk = labelToRisk(apiData.label)

          let analysis = `${apiData.label} area near ${apiData.nearestPlace}. Crime: ${apiData.crime}/10, Road quality: ${apiData.road}/10, Accident risk: ${apiData.accident}/10. Confidence: ${apiData.confidence}.`
          let recommendations = [
            'Stay alert and aware of surroundings',
            'Travel during well-lit hours when possible',
            'Keep emergency contacts accessible',
          ]

          // Enrich with Groq AI analysis
          try {
            if (process.env.GROQ_API_KEY) {
              const aiResponse = await groq.chat.completions.create({
                model: 'openai/gpt-oss-120b',
                messages: [
                  {
                    role: 'system',
                    content:
                      'You are a safety analyst. Reply in plain text only — no markdown, no asterisks, no bullet symbols. ' +
                      'Format your reply EXACTLY as two sections:\n' +
                      'ANALYSIS: <2-3 sentence analysis>\n' +
                      'RECOMMENDATIONS: <rec1> | <rec2> | <rec3>',
                  },
                  {
                    role: 'user',
                    content: `Analyze safety for location (${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}) in ${apiData.region} near "${apiData.nearestPlace}":\n- Safety label: ${apiData.label} (score ${apiData.score}/10)\n- Crime level: ${apiData.crime}/10\n- Road quality: ${apiData.road}/10\n- Accident risk: ${apiData.accident}/10\n- Confidence: ${apiData.confidence}`,
                  },
                ],
                max_tokens: 220,
                temperature: 0.5,
              })

              const aiText = aiResponse.choices[0]?.message?.content?.trim()
              if (aiText) {
                // Parse structured response (split on section headers)
                const parts       = aiText.split(/RECOMMENDATIONS:/i)
                const rawAnalysis = parts[0].replace(/ANALYSIS:/i, '').trim()
                const rawRecs     = (parts[1] || '').trim()

                if (rawAnalysis) analysis = rawAnalysis
                if (rawRecs) {
                  recommendations = rawRecs
                    .split('|')
                    .map((r: string) => r.trim())
                    .filter((r: string) => r.length > 5)
                    .slice(0, 3)
                }
              }
            } else {
              console.warn('Groq API key not found, using default analysis')
            }
          } catch (aiError) {
            console.error('Groq API error:', aiError)
          }

          results.location = {
            score,
            rawScore: apiData.score,
            label: apiData.label,
            crime: apiData.crime,
            accident: apiData.accident,
            road: apiData.road,
            nearestPlace: apiData.nearestPlace,
            nearestDist: apiData.nearestDist,
            confidence: apiData.confidence,
            region: apiData.region,
            model: apiData.model,
            outsideCoverage: false,
            analysis: analysis,
            riskLevel: risk,
            recommendations,
          }
        }
      } catch (err) {
        console.error('SafetyScore API error:', err)
        results.location = {
          score: 50,
          analysis: 'Safety data temporarily unavailable.',
          riskLevel: 'medium',
          recommendations: ['Exercise standard travel precautions'],
        }
      }
    }

    // ── Route safety (parallel batches of 5) ─────────────────────────────────
    if (routeCoordinates && Array.isArray(routeCoordinates)) {
      const chunkSize = 5
      const routeResults: any[] = []

      for (let i = 0; i < routeCoordinates.length; i += chunkSize) {
        const chunk = routeCoordinates.slice(i, i + chunkSize)
        const chunkResults = await Promise.all(
          chunk.map(async (coord: Coordinates) => {
            try {
              const apiData = await fetchSafetyScore(coord)
              if (apiData.outsideCoverage) {
                return { coordinates: coord, score: 50, riskLevel: 'medium', outsideCoverage: true }
              }
              return {
                coordinates: coord,
                score: normalizeScore(apiData.score),
                rawScore: apiData.score,
                label: apiData.label,
                crime: apiData.crime,
                accident: apiData.accident,
                road: apiData.road,
                riskLevel: labelToRisk(apiData.label),
                outsideCoverage: false,
              }
            } catch {
              return { coordinates: coord, score: 50, riskLevel: 'medium', error: true }
            }
          })
        )
        routeResults.push(...chunkResults)
      }

      results.route = routeResults

      if (routeResults.length > 0) {
        const avgScore = routeResults.reduce((sum: number, p: any) => sum + p.score, 0) / routeResults.length
        results.routeSafety = {
          averageScore: Math.round(avgScore * 10) / 10,
          riskLevel: avgScore >= 70 ? 'low' : avgScore >= 40 ? 'medium' : 'high',
          riskySections: routeResults.filter((p: any) => p.score < 40).length,
          totalPoints: routeResults.length,
        }
      }
    }

    return NextResponse.json(results)

  } catch (error) {
    console.error('Safety calculation error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate safety scores' },
      { status: 500 }
    )
  }
}
