import { withAuth, createSupabaseClient, ok, created, error, PLATFORMS, getModelById } from '@cbt/shared'

const PROMPT_TYPES = ['image', 'title', 'description']
const DEFAULT_MODEL = 'gpt-image-1'

// Enrich a stored prompt row with model metadata from the shared constant so the
// UI can render label/provider/cost without its own model table.
function enrich(row: Record<string, unknown>) {
  const model = (row.model as string) ?? null
  const info = model ? getModelById(model) : undefined
  return {
    ...row,
    model_label: info?.label ?? model ?? null,
    model_provider: info?.provider ?? null,
    cost_per_image_usd: info?.cost_per_image_usd ?? null,
  }
}

// GET  — list prompt templates for the account (enriched with model metadata)
// POST — create a prompt template
export default withAuth(async (req, res, auth) => {
  const supabase = createSupabaseClient()

  if (req.method === 'GET') {
    const { data, error: dbError } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('account_id', auth.account_id)
      .order('created_at', { ascending: false })
    if (dbError) return error(res, 500, dbError.message)
    return ok(res, (data ?? []).map(enrich))
  }

  if (req.method === 'POST') {
    const { name, platform, prompt_type, content, is_default, model, system_instruction } = req.body ?? {}
    if (!name || !prompt_type || !content) {
      return error(res, 400, 'name, prompt_type và content là bắt buộc')
    }
    if (!PROMPT_TYPES.includes(prompt_type)) {
      return error(res, 400, `prompt_type phải là: ${PROMPT_TYPES.join(', ')}`)
    }
    if (platform && !PLATFORMS.includes(platform)) {
      return error(res, 400, `platform phải là: ${PLATFORMS.join(', ')}`)
    }
    // model is required at the DB level (NOT NULL) — default it, and reject
    // any value that isn't a known model id.
    const modelId = typeof model === 'string' && model ? model : DEFAULT_MODEL
    if (!getModelById(modelId)) {
      return error(res, 400, `model không hợp lệ: ${modelId}`)
    }

    const { data, error: dbError } = await supabase
      .from('prompt_templates')
      .insert({
        account_id: auth.account_id,
        name,
        platform: platform ?? null,
        prompt_type,
        content,
        is_default: !!is_default,
        model: modelId,
        system_instruction: typeof system_instruction === 'string' ? system_instruction : null,
      })
      .select('*')
      .single()
    if (dbError || !data) return error(res, 500, dbError?.message ?? 'Tạo template thất bại')
    return created(res, enrich(data))
  }

  return error(res, 405, 'Method not allowed')
})
