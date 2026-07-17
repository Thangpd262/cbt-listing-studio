import { createSupabaseClient } from '@cbt/shared'

type Supabase = ReturnType<typeof createSupabaseClient>

// Canonical steps for AI attribution. The DB column is free TEXT, but callers
// should stick to this set so /api/spend by_step aggregates cleanly.
export type AiStep = 'image_gen' | 'scene_analysis' | 'title_gen' | 'desc_gen'

export type LogAiCallParams = {
  account_id: string
  user_id?: string | null
  listing_id?: string | null
  prompt_template_id?: string | null
  model: string
  provider: string
  step: AiStep
  images_requested?: number
  images_received?: number
  input_tokens?: number
  output_tokens?: number
  cost_usd: number
  status?: 'success' | 'failed'
  error_message?: string
}

// Record one ai_gen_logs row and accumulate the daily user_ai_spend rollup.
// Best-effort: never throws — logging must not break generation.
export async function logAiCall(supabase: Supabase, p: LogAiCallParams): Promise<void> {
  // user_id is NOT NULL in ai_gen_logs; without an identity the call can't be
  // attributed, so skip logging rather than fail the insert.
  if (!p.user_id) return

  const images_requested = p.images_requested ?? 1
  const images_received = p.images_received ?? 0
  const status = p.status ?? 'success'

  try {
    await supabase.from('ai_gen_logs').insert({
      account_id: p.account_id,
      user_id: p.user_id,
      listing_id: p.listing_id ?? null,
      prompt_template_id: p.prompt_template_id ?? null,
      model: p.model,
      provider: p.provider,
      step: p.step,
      images_requested,
      images_received,
      input_tokens: p.input_tokens ?? 0,
      output_tokens: p.output_tokens ?? 0,
      cost_usd: p.cost_usd,
      status,
      error_message: p.error_message ?? null,
    })

    // Only successful calls contribute to the spend rollup.
    if (status === 'success') {
      await supabase.rpc('record_ai_spend', {
        p_account_id: p.account_id,
        p_user_id: p.user_id,
        p_model: p.model,
        p_provider: p.provider,
        p_step: p.step,
        p_images: images_received,
        p_cost_usd: p.cost_usd,
      })
    }
  } catch {
    // swallow — never block the pipeline
  }
}
