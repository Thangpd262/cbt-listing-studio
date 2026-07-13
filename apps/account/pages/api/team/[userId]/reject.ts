import type { NextApiRequest, NextApiResponse } from 'next'
import { createSupabaseClient, ok, error } from '@cbt/shared'
import { withSession } from '../../../../middleware/withSession'

// POST — reject a user: set status 'suspended' (admin only).
export default withSession(async (req: NextApiRequest, res: NextApiResponse, ctx) => {
  if (req.method !== 'POST') return error(res, 405, 'Method not allowed')
  if (ctx.role !== 'admin') return error(res, 403, 'Chỉ admin được từ chối user')

  const userId = req.query.userId as string
  if (userId === ctx.user_id) return error(res, 400, 'Không thể tự từ chối chính mình')

  const supabase = createSupabaseClient()
  const { data, error: dbError } = await supabase
    .from('app_users')
    .update({ status: 'suspended' })
    .eq('id', userId)
    .select('id, email, status')
    .single()
  if (dbError || !data) return error(res, 404, 'Không tìm thấy user')

  return ok(res, data)
})
