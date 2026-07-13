import type { NextApiRequest, NextApiResponse } from 'next'
import { createSupabaseClient, ok, error, ROLES } from '@cbt/shared'
import { withSession } from '../../../../middleware/withSession'

// POST { role } — approve a pending user: assign a role and activate (admin only).
export default withSession(async (req: NextApiRequest, res: NextApiResponse, ctx) => {
  if (req.method !== 'POST') return error(res, 405, 'Method not allowed')
  if (ctx.role !== 'admin') return error(res, 403, 'Chỉ admin được duyệt user')

  const userId = req.query.userId as string
  const { role } = req.body ?? {}
  if (!role || !ROLES.includes(role)) {
    return error(res, 400, `role phải là một trong: ${ROLES.join(', ')}`)
  }

  const supabase = createSupabaseClient()
  const { data, error: dbError } = await supabase
    .from('app_users')
    .update({ role, status: 'active' })
    .eq('id', userId)
    .eq('status', 'pending')
    .select('id, email, name, role, status')
    .single()
  if (dbError || !data) return error(res, 404, 'Không tìm thấy user đang chờ duyệt')

  return ok(res, data)
})
