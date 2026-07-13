import { GoogleGenerativeAI } from '@google/generative-ai'

export type SceneAnalysis = {
  mood: string
  palette: string[]
  objects: string[]
  quote?: string
  style: string
  niche: string
}

export type ListingInput = {
  title: string
  images: string[]
  tags: string[]
  platform: string
}

function client() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY')
  return new GoogleGenerativeAI(apiKey)
}

// Analyze a product listing's aesthetic scene with Gemini Flash.
// Uses JSON response mode; falls back to stripping markdown fences if needed.
export async function analyzeScene(listing: ListingInput): Promise<{ scene: SceneAnalysis; raw: unknown }> {
  const model = client().getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  })

  const prompt = `Analyze this product listing and return a JSON object with:
- mood: overall emotional tone (1-3 words)
- palette: array of 3-5 dominant colors (hex or descriptive)
- objects: array of main objects/elements visible
- quote: a short evocative phrase capturing the listing's feel
- style: visual style (e.g. "minimalist", "rustic", "vibrant")
- niche: product niche/category (e.g. "home decor", "graphic tee")

Listing title: ${listing.title}
Tags: ${listing.tags.join(', ')}
Platform: ${listing.platform}
Image URLs: ${listing.images.slice(0, 3).join(', ')}

Return ONLY valid JSON, no markdown.`

  const result = await model.generateContent(prompt)
  const text = result.response.text()
  const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim()) as SceneAnalysis

  return {
    scene: {
      mood: parsed.mood ?? '',
      palette: Array.isArray(parsed.palette) ? parsed.palette : [],
      objects: Array.isArray(parsed.objects) ? parsed.objects : [],
      quote: parsed.quote,
      style: parsed.style ?? '',
      niche: parsed.niche ?? '',
    },
    raw: parsed,
  }
}
