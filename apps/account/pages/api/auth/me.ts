import type { NextApiRequest, NextApiResponse } from 'next'
import { createSupabaseClient, ok, error } from '@cbt/shared'
import { withSession } from '../../../middleware/withSession'

// GET — return the logged-in user's profile + account, resolved from the session JWT.
export default withSession(async (req: NextApiRequest, res: NextApiResponse, ctx) => {
  if (req.method !== 'GET') return error(res, 405, 'Method not allowed')

  const supabase = createSupabaseClient()

  const { data: user, error: userError } = await supabase
    .from('app_users')
    .select('id, email, name, account_id, role, status, created_at')
    .eq('id', ctx.user_id)
    .single()
  if (userError || !user) return error(res, 404, 'User not found')

  const { data: account } = await supabase
    .from('accounts')
    .select('id, email, name, tier, created_at')
    .eq('id', ctx.account_id)
    .single()

  return ok(res, { user, account, role: ctx.role })
})
