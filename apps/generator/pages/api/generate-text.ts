import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'
import { generateDescriptionFromTitle, GEMINI_TEXT_MODEL } from '../../lib/gemini'
import { textCost, providerForModel } from '../../lib/spend'
import { logAiCall } from '../../lib/logAiCall'

// POST — generate marketing text from a title. Currently supports
// kind='description'. Called server-to-server by list-amz for the
// "AI viết mô tả" flag. Body: { kind, title, platform?, listing_id? }
export default withAuth(async (req, res, auth) => {
  if (req.method !== 'POST') return error(res, 405, 'Method not allowed')

  const { kind, title, platform, listing_id } = req.body ?? {}
  if (kind !== 'description') return error(res, 400, "kind='description' required")
  if (!title || typeof title !== 'string') return error(res, 400, 'title là bắt buộc')

  const supabase = createSupabaseClient()

  try {
    const r = await generateDescriptionFromTitle(title, platform === 'walmart' ? 'walmart' : 'amazon')
    await logAiCall(supabase, {
      account_id: auth.account_id,
      user_id: auth.user_id,
      listing_id: typeof listing_id === 'string' ? listing_id : null,
      model: GEMINI_TEXT_MODEL,
      provider: providerForModel(GEMINI_TEXT_MODEL),
      step: 'desc_gen',
      images_requested: 0,
      images_received: 0,
      input_tokens: r.inputTokens,
      output_tokens: r.outputTokens,
      cost_usd: textCost(GEMINI_TEXT_MODEL, r.inputTokens, r.outputTokens),
    })
    return ok(res, { text: r.text })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gen mô tả thất bại'
    await logAiCall(supabase, {
      account_id: auth.account_id,
      user_id: auth.user_id,
      listing_id: typeof listing_id === 'string' ? listing_id : null,
      model: GEMINI_TEXT_MODEL,
      provider: providerForModel(GEMINI_TEXT_MODEL),
      step: 'desc_gen',
      images_requested: 0,
      images_received: 0,
      cost_usd: 0,
      status: 'failed',
      error_message: message,
    })
    return error(res, 500, message)
  }
})
