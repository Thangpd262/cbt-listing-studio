import type { NextApiRequest, NextApiResponse } from 'next'
import { createSupabaseClient, ok, error } from '@cbt/shared'
import { withSession } from '../../../middleware/withSession'

// DELETE — remove a team member from the account (and their auth identity).
export default withSession(async (req: NextApiRequest, res: NextApiResponse, ctx) => {
  if (req.method !== 'DELETE') return error(res, 405, 'Method not allowed')
  if (ctx.role !== 'admin') return error(res, 403, 'Chỉ admin được xoá thành viên')

  const userId = req.query.userId as string
  if (userId === ctx.user_id) return error(res, 400, 'Cannot remove yourself')

  const supabase = createSupabaseClient()

  const { data: member, error: findError } = await supabase
    .from('app_users')
    .select('id, auth_user_id')
    .eq('id', userId)
    .eq('account_id', ctx.account_id)
    .single()
  if (findError || !member) return error(res, 404, 'Member not found')

  await supabase.from('app_users').delete().eq('id', userId).eq('account_id', ctx.account_id)
  // Best-effort cleanup of the auth identity.
  await supabase.auth.admin.deleteUser(member.auth_user_id)

  return ok(res, { id: userId, removed: true })
})
