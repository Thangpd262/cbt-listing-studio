import OpenAI, { toFile } from 'openai'

export const DALLE_MODEL = 'dall-e-3'

function client() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY')
  return new OpenAI({ apiKey })
}

// Text-to-image → base64 Buffer.
// gpt-image-1 always returns b64_json and rejects response_format, so only
// dall-e-2 / dall-e-3 receive that param.
export async function generateImageDalle(prompt: string, model: string = DALLE_MODEL): Promise<Buffer> {
  const res = await client().images.generate({
    model,
    prompt,
    n: 1,
    size: '1024x1024',
    // gpt-image-1 rejects response_format; dall-e-* accept b64_json.
    ...(model.startsWith('dall-e') ? { response_format: 'b64_json' as const } : {}),
  })
  const b64 = res.data?.[0]?.b64_json
  if (!b64) throw new Error('OpenAI returned no image')
  return Buffer.from(b64, 'base64')
}

// Image-to-image: generate in the style of a reference image (gpt-image-1 edit).
export async function editImageDalle(prompt: string, referenceUrl: string): Promise<Buffer> {
  const imgRes = await fetch(referenceUrl)
  if (!imgRes.ok) throw new Error(`Không tải được ảnh tham chiếu (${imgRes.status})`)
  const file = await toFile(Buffer.from(await imgRes.arrayBuffer()), 'reference.png', { type: 'image/png' })

  const res = await client().images.edit({ model: 'gpt-image-1', image: file, prompt, n: 1, size: '1024x1024' })
  const b64 = res.data?.[0]?.b64_json
  if (!b64) throw new Error('OpenAI edit returned no image')
  return Buffer.from(b64, 'base64')
}
