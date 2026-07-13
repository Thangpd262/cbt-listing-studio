import { generateImageImagen, IMAGEN_MODEL } from './gemini'
import { generateImageDalle, DALLE_MODEL } from './openai'

export type ImageProvider = 'dalle' | 'imagen'

export type GeneratedImage = { buffer: Buffer; model: string; provider: ImageProvider }

// Dispatch image generation. Default provider is DALL-E 3; 'imagen' uses Gemini Imagen 3.
export async function generateImage(prompt: string, provider: ImageProvider = 'dalle'): Promise<GeneratedImage> {
  if (provider === 'imagen') {
    return { buffer: await generateImageImagen(prompt), model: IMAGEN_MODEL, provider }
  }
  return { buffer: await generateImageDalle(prompt), model: DALLE_MODEL, provider: 'dalle' }
}
