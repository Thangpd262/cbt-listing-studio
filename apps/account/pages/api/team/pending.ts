import type { NextApiRequest, NextApiResponse } from 'next'
import { createSupabaseClient, ok, error } from '@cbt/shared'
import { withSession } from '../../../middleware/withSession'

// GET — list users awaiting approval (admin only).
export default withSession(async (req: NextApiRequest, res: NextApiResponse, ctx) => {
  if (req.method !== 'GET') return error(res, 405, 'Method not allowed')
  if (ctx.role !== 'admin') return error(res, 403, 'Chỉ admin được xem danh sách chờ duyệt')

  const supabase = createSupabaseClient()
  const { data, error: dbError } = await supabase
    .from('app_users')
    .select('id, email, name, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (dbError) return error(res, 500, dbError.message)
  return ok(res, data)
})
