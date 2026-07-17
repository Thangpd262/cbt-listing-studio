// Single source of truth for image models: used by the Generator API (validation,
// pricing, /api/models) and the Hub UI (grouped dropdown, cost display).
//
// Only 'openai' and 'google' are wired to real generation code today; the others
// are listed for selection/costing and become callable once their client + API
// key are added.

export type ModelProvider = 'openai' | 'google' | 'blackforestlabs' | 'recraft' | 'stability'

export interface ImageModel {
  id: string
  label: string
  provider: ModelProvider
  cost_per_image_usd: number    // estimate, for display + cost tracking
  supports_multi_image: boolean // n > 1 in a single request
  max_images_per_request: number
  notes?: string
}

export const IMAGE_MODELS: ImageModel[] = [
  // OpenAI
  {
    id: 'gpt-image-2',
    label: 'GPT Image 2',
    provider: 'openai',
    cost_per_image_usd: 0.04,
    supports_multi_image: true,
    max_images_per_request: 10,
  },
  {
    id: 'gpt-image-1.5',
    label: 'GPT Image 1.5',
    provider: 'openai',
    cost_per_image_usd: 0.04,
    supports_multi_image: true,
    max_images_per_request: 10,
  },
  {
    id: 'gpt-image-1',
    label: 'GPT Image 1',
    provider: 'openai',
    cost_per_image_usd: 0.04,
    supports_multi_image: true,
    max_images_per_request: 10,
  },
  {
    id: 'gpt-image-1-mini',
    label: 'GPT Image 1 Mini',
    provider: 'openai',
    cost_per_image_usd: 0.02,
    supports_multi_image: true,
    max_images_per_request: 10,
    notes: 'Cheaper, suited to bulk gen',
  },
  // Google
  {
    id: 'gemini-2.5-flash-image',
    label: 'Gemini 2.5 Flash Image',
    provider: 'google',
    cost_per_image_usd: 0.039,
    supports_multi_image: false, // unstable multi-image → system parallelises calls
    max_images_per_request: 1,
    notes: 'Multi-image unstable — system parallelises calls',
  },
  {
    id: 'gemini-3.1-flash-image',
    label: 'Gemini 3.1 Flash Image',
    provider: 'google',
    cost_per_image_usd: 0.02,
    supports_multi_image: false,
    max_images_per_request: 1,
  },
  {
    id: 'imagen-4',
    label: 'Imagen 4 (Nano Banana Pro)',
    provider: 'google',
    cost_per_image_usd: 0.06,
    supports_multi_image: false,
    max_images_per_request: 1,
    notes: 'Studio quality',
  },
  // Black Forest Labs
  {
    id: 'flux-2-pro',
    label: 'FLUX.2 Pro',
    provider: 'blackforestlabs',
    cost_per_image_usd: 0.05,
    supports_multi_image: false,
    max_images_per_request: 1,
  },
  // Recraft
  {
    id: 'recraft-v4',
    label: 'Recraft V4',
    provider: 'recraft',
    cost_per_image_usd: 0.04,
    supports_multi_image: false,
    max_images_per_request: 1,
    notes: 'Good for design/branding',
  },
]

export function getModelById(id: string): ImageModel | undefined {
  return IMAGE_MODELS.find((m) => m.id === id)
}

export const IMAGE_MODELS_BY_PROVIDER = IMAGE_MODELS.reduce<Record<ModelProvider, ImageModel[]>>(
  (acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = []
    acc[m.provider].push(m)
    return acc
  },
  {} as Record<ModelProvider, ImageModel[]>
)
