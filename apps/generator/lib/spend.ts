import { createSupabaseClient } from '@cbt/shared'

type Supabase = ReturnType<typeof createSupabaseClient>

// Text pricing (USD per token). Image pricing (USD per image).
const TEXT_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-1.5-flash': { input: 0.075 / 1_000_000, output: 0.3 / 1_000_000 },
}
const IMAGE_PRICING: Record<string, number> = {
  'dall-e-3': 0.04,
  'imagen-3.0-generate-002': 0.03,
}

export function textCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = TEXT_PRICING[model]
  if (!p) return 0
  return inputTokens * p.input + outputTokens * p.output
}

export function imageCost(model: string): number {
  return IMAGE_PRICING[model] ?? 0
}

export type SpendRow = {
  account_id: string
  job_id: string
  listing_id: string
  step: string
  model: string
  input_tokens?: number
  output_tokens?: number
  cost_usd: number
}

// Insert one spend record (best-effort — never blocks the pipeline).
export async function recordSpend(supabase: Supabase, row: SpendRow): Promise<void> {
  await supabase.from('ai_spend_records').insert({
    account_id: row.account_id,
    job_id: row.job_id,
    listing_id: row.listing_id,
    step: row.step,
    model: row.model,
    input_tokens: row.input_tokens ?? 0,
    output_tokens: row.output_tokens ?? 0,
    cost_usd: row.cost_usd,
  })
}
