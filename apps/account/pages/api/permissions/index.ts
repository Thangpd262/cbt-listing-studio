import type { NextApiRequest, NextApiResponse } from 'next'
import { createSupabaseClient, ok, created, error, ROLES } from '@cbt/shared'
import { withSession } from '../../../middleware/withSession'

// GET  — list per-selling-account permissions for the account
// POST — grant a user access to a selling account with a role
export default withSession(async (req: NextApiRequest, res: NextApiResponse, ctx) => {
  const supabase = createSupabaseClient()

  if (req.method === 'GET') {
    const { data, error: dbError } = await supabase
      .from('user_selling_permissions')
      .select('id, user_id, selling_account_id, role, granted_at')
      .eq('account_id', ctx.account_id)
    if (dbError) return error(res, 500, dbError.message)
    return ok(res, data)
  }

  if (req.method === 'POST') {
    if (ctx.role !== 'admin') return error(res, 403, 'Chỉ admin được cấp quyền')
    const { user_id, selling_account_id, role } = req.body ?? {}
    if (!user_id || !selling_account_id || !role) {
      return error(res, 400, 'user_id, selling_account_id and role are required')
    }
    if (!ROLES.includes(role)) return error(res, 400, `role must be one of: ${ROLES.join(', ')}`)

    const { data, error: dbError } = await supabase
      .from('user_selling_permissions')
      .insert({ account_id: ctx.account_id, user_id, selling_account_id, role })
      .select('id, user_id, selling_account_id, role, granted_at')
      .single()
    if (dbError || !data) return error(res, 500, dbError?.message ?? 'Failed to grant permission')

    return created(res, data)
  }

  return error(res, 405, 'Method not allowed')
})
