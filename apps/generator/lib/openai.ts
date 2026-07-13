import OpenAI from 'openai'

export const DALLE_MODEL = 'dall-e-3'

// DALL-E 3 image generation → JPEG/PNG Buffer (b64_json).
export async function generateImageDalle(prompt: string): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY')
  const client = new OpenAI({ apiKey })

  const res = await client.images.generate({
    model: DALLE_MODEL,
    prompt,
    n: 1,
    size: '1024x1024',
    response_format: 'b64_json',
  })
  const b64 = res.data?.[0]?.b64_json
  if (!b64) throw new Error('DALL-E returned no image')
  return Buffer.from(b64, 'base64')
}
