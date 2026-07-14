import { generateImageImagen, IMAGEN_MODEL } from './gemini'
import { generateImageDalle, editImageDalle, DALLE_MODEL } from './openai'

export type ImageProvider = 'dalle' | 'imagen'

export type GeneratedImage = { buffer: Buffer; model: string; provider: ImageProvider }

// Resolve the concrete OpenAI model from the UI/prompt model string.
function openaiModel(model?: string | null): string {
  return model === 'gpt-image-1' ? 'gpt-image-1' : DALLE_MODEL
}

// Text-to-image. Default provider is DALL-E; 'imagen' uses Gemini Imagen 3.
// `model` selects the concrete OpenAI model when provider is dalle.
export async function generateImage(
  prompt: string,
  provider: ImageProvider = 'dalle',
  model?: string | null
): Promise<GeneratedImage> {
  if (provider === 'imagen') {
    return { buffer: await generateImageImagen(prompt), model: IMAGEN_MODEL, provider }
  }
  const m = openaiModel(model)
  return { buffer: await generateImageDalle(prompt, m), model: m, provider: 'dalle' }
}

// Image-to-image (style reference) — OpenAI gpt-image-1 edit.
export async function generateImageFromReference(prompt: string, referenceUrl: string): Promise<GeneratedImage> {
  return { buffer: await editImageDalle(prompt, referenceUrl), model: 'gpt-image-1', provider: 'dalle' }
}
