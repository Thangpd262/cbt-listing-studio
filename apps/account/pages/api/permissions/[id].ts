import type { NextApiRequest, NextApiResponse } from 'next'
import { createSupabaseClient, ok, error, ROLES } from '@cbt/shared'
import { withSession } from '../../../middleware/withSession'

// PUT    — update the role of an existing permission grant
// DELETE — revoke a permission grant
export default withSession(async (req: NextApiRequest, res: NextApiResponse, ctx) => {
  if (ctx.role !== 'admin') return error(res, 403, 'Chỉ admin được sửa quyền')

  const supabase = createSupabaseClient()
  const id = req.query.id as string

  if (req.method === 'PUT') {
    const { role } = req.body ?? {}
    if (!role || !ROLES.includes(role)) {
      return error(res, 400, `role must be one of: ${ROLES.join(', ')}`)
    }
    const { data, error: dbError } = await supabase
      .from('user_selling_permissions')
      .update({ role })
      .eq('id', id)
      .eq('account_id', ctx.account_id)
      .select('id, user_id, selling_account_id, role, granted_at')
      .single()
    if (dbError || !data) return error(res, 404, 'Permission not found')
    return ok(res, data)
  }

  if (req.method === 'DELETE') {
    const { data, error: dbError } = await supabase
      .from('user_selling_permissions')
      .delete()
      .eq('id', id)
      .eq('account_id', ctx.account_id)
      .select('id')
      .single()
    if (dbError || !data) return error(res, 404, 'Permission not found')
    return ok(res, { id: data.id, revoked: true })
  }

  return error(res, 405, 'Method not allowed')
})
