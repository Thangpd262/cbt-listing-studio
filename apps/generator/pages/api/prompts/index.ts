import { withAuth, createSupabaseClient, ok, created, error, PLATFORMS } from '@cbt/shared'

const PROMPT_TYPES = ['image', 'title', 'description']

// GET  — list prompt templates for the account
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
    return ok(res, data)
  }

  if (req.method === 'POST') {
    const { name, platform, prompt_type, content, is_default, model } = req.body ?? {}
    if (!name || !prompt_type || !content) {
      return error(res, 400, 'name, prompt_type và content là bắt buộc')
    }
    if (!PROMPT_TYPES.includes(prompt_type)) {
      return error(res, 400, `prompt_type phải là: ${PROMPT_TYPES.join(', ')}`)
    }
    if (platform && !PLATFORMS.includes(platform)) {
      return error(res, 400, `platform phải là: ${PLATFORMS.join(', ')}`)
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
        model: model ?? null,
      })
      .select('*')
      .single()
    if (dbError || !data) return error(res, 500, dbError?.message ?? 'Tạo template thất bại')
    return created(res, data)
  }

  return error(res, 405, 'Method not allowed')
})
