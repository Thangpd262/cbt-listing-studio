import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'

// PUT    — update a prompt template (name/content/is_default/platform)
// DELETE — remove a prompt template
export default withAuth(async (req, res, auth) => {
  const supabase = createSupabaseClient()
  const id = req.query.id as string

  if (req.method === 'PUT') {
    const { name, content, is_default, platform, model } = req.body ?? {}
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (name !== undefined) patch.name = name
    if (content !== undefined) patch.content = content
    if (is_default !== undefined) patch.is_default = !!is_default
    if (platform !== undefined) patch.platform = platform
    if (model !== undefined) patch.model = model

    const { data, error: dbError } = await supabase
      .from('prompt_templates')
      .update(patch)
      .eq('id', id)
      .eq('account_id', auth.account_id)
      .select('*')
      .single()
    if (dbError || !data) return error(res, 404, 'Template not found')
    return ok(res, data)
  }

  if (req.method === 'DELETE') {
    const { data, error: dbError } = await supabase
      .from('prompt_templates')
      .delete()
      .eq('id', id)
      .eq('account_id', auth.account_id)
      .select('id')
      .single()
    if (dbError || !data) return error(res, 404, 'Template not found')
    return ok(res, { id: data.id, deleted: true })
  }

  return error(res, 405, 'Method not allowed')
})
