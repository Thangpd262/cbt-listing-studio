import { getModelById, type ModelProvider } from '@cbt/shared'

// Text pricing (USD per token) for models not in the shared IMAGE_MODELS list
// (text models used by the pipeline).
const TEXT_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-1.5-flash': { input: 0.075 / 1_000_000, output: 0.3 / 1_000_000 },
}

// Fallback image pricing for wired legacy models that aren't in IMAGE_MODELS.
const IMAGE_PRICING_FALLBACK: Record<string, number> = {
  'dall-e-3': 0.04,
  'imagen-3.0-generate-002': 0.03,
}

// Provider for legacy/text model ids not present in IMAGE_MODELS.
const PROVIDER_FALLBACK: Record<string, ModelProvider> = {
  'dall-e-3': 'openai',
  'gpt-image-1': 'openai',
  'imagen-3.0-generate-002': 'google',
  'gemini-1.5-flash': 'google',
}

export function textCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = TEXT_PRICING[model]
  if (!p) return 0
  return inputTokens * p.input + outputTokens * p.output
}

// Prefer the shared constant (single source of truth); fall back for legacy models.
export function imageCost(model: string): number {
  return getModelById(model)?.cost_per_image_usd ?? IMAGE_PRICING_FALLBACK[model] ?? 0
}

// Resolve a provider string for a model id (constant first, then fallbacks).
export function providerForModel(model: string): string {
  return getModelById(model)?.provider ?? PROVIDER_FALLBACK[model] ?? 'unknown'
}
