import { GoogleGenerativeAI } from '@google/generative-ai'
import type { SceneAnalysis } from './crawl-client'

export const GEMINI_TEXT_MODEL = 'gemini-1.5-flash'
export const IMAGEN_MODEL = 'imagen-3.0-generate-002'

export type TextResult = { text: string; inputTokens: number; outputTokens: number }

function textModel() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY')
  return new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: GEMINI_TEXT_MODEL })
}

async function genText(prompt: string): Promise<TextResult> {
  const result = await textModel().generateContent(prompt)
  const usage = result.response.usageMetadata
  return {
    text: result.response.text().trim(),
    inputTokens: usage?.promptTokenCount ?? 0,
    outputTokens: usage?.candidatesTokenCount ?? 0,
  }
}

const sceneSummary = (s: SceneAnalysis) =>
  `Mood: ${s.mood}. Style: ${s.style}. Niche: ${s.niche}. Objects: ${s.objects.join(', ')}. Palette: ${s.palette.join(', ')}.`

// Platform-specific title. Amazon: keyword-rich ≤200 chars. Walmart: clear ≤75 chars.
export async function generateTitle(scene: SceneAnalysis, platform: 'amazon' | 'walmart'): Promise<TextResult> {
  const rule =
    platform === 'amazon'
      ? 'a keyword-rich Amazon product title, max 200 characters'
      : 'a clear, concise Walmart product title, max 75 characters'
  return genText(
    `Write ${rule}. Return ONLY the title text, no quotes or extra words.\n\n${sceneSummary(scene)}`
  )
}

export async function generateDescription(scene: SceneAnalysis, platform: string): Promise<TextResult> {
  return genText(
    `Write a compelling ${platform} product description (2-4 short paragraphs, no markdown). Return ONLY the description.\n\n${sceneSummary(scene)}`
  )
}

// Image-generation prompt tuned per platform (Amazon: white-bg product shot;
// Walmart: lifestyle shot in the given variant color).
export async function generateImagePrompt(
  scene: SceneAnalysis,
  platform: string,
  variant?: { color: string }
): Promise<TextResult> {
  const framing =
    platform === 'amazon'
      ? 'a clean product shot on a pure white background, studio lighting, e-commerce hero image'
      : `a lifestyle product shot featuring the color "${variant?.color ?? 'natural'}", realistic setting`
  return genText(
    `Write a concise text-to-image prompt for ${framing}. Return ONLY the prompt.\n\n${sceneSummary(scene)}`
  )
}

// Imagen 3 via the Generative Language REST API (uses GEMINI_API_KEY).
export async function generateImageImagen(prompt: string): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY')
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:predict?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1 } }),
    }
  )
  if (!res.ok) throw new Error(`Imagen failed (${res.status}): ${await res.text()}`)
  const json = await res.json()
  const b64 = json?.predictions?.[0]?.bytesBase64Encoded
  if (!b64) throw new Error('Imagen returned no image')
  return Buffer.from(b64, 'base64')
}
