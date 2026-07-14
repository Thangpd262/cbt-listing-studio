import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, ok, error, createSupabaseClient } from '@cbt/shared'

// PATCH  /api/user-configs/:id → update { name?, overrides? }
// DELETE /api/user-configs/:id → remove one of this account's cloned configs
export default withAuth(async (req: NextApiRequest, res: NextApiResponse, auth) => {
  const id = req.query.id as string
  const supabase = createSupabaseClient()

  if (req.method === 'PATCH') {
    const { name, overrides } = (req.body ?? {}) as {
      name?: string
      overrides?: Record<string, unknown>
    }
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof name === 'string') patch.name = name
    if (overrides && typeof overrides === 'object') patch.overrides = overrides
    if (Object.keys(patch).length === 1) return error(res, 400, 'Không có gì để cập nhật')

    const { data, error: dbErr } = await supabase
      .from('user_product_configs')
      .update(patch)
      .eq('id', id)
      .eq('account_id', auth.account_id)
      .select()
      .single()
    if (dbErr || !data) return error(res, dbErr ? 500 : 404, dbErr?.message ?? 'Config not found')
    return ok(res, data)
  }

  if (req.method === 'DELETE') {
    const { error: dbErr } = await supabase
      .from('user_product_configs')
      .delete()
      .eq('id', id)
      .eq('account_id', auth.account_id)
    if (dbErr) return error(res, 500, dbErr.message)
    return ok(res, { id, deleted: true })
  }

  return error(res, 405, 'Method not allowed')
})
