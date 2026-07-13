import type { NextApiRequest, NextApiResponse } from 'next'
import { createSupabaseClient, ok, created, error, ROLES } from '@cbt/shared'
import { withSession } from '../../../middleware/withSession'

// GET  — list team members
// POST — invite a member by email; admin assigns the role and the member is
//        created active (they set their password via the Supabase invite email).
export default withSession(async (req: NextApiRequest, res: NextApiResponse, ctx) => {
  const supabase = createSupabaseClient()

  if (req.method === 'GET') {
    const { data, error: dbError } = await supabase
      .from('app_users')
      .select('id, email, name, role, status, created_at')
      .eq('account_id', ctx.account_id)
      .order('created_at', { ascending: true })
    if (dbError) return error(res, 500, dbError.message)
    return ok(res, data)
  }

  if (req.method === 'POST') {
    if (ctx.role !== 'admin') return error(res, 403, 'Chỉ admin được mời thành viên')

    const { email, name, role } = req.body ?? {}
    if (!email) return error(res, 400, 'email is required')
    const assignedRole = role ?? 'operator'
    if (!ROLES.includes(assignedRole)) return error(res, 400, `role phải là một trong: ${ROLES.join(', ')}`)

    // Send a Supabase Auth invite (member sets their own password via the link).
    const { data: invite, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email)
    if (inviteError || !invite.user) {
      return error(res, 400, inviteError?.message ?? 'Failed to invite user')
    }

    const { data: user, error: userError } = await supabase
      .from('app_users')
      .insert({
        account_id: ctx.account_id,
        auth_user_id: invite.user.id,
        email,
        name,
        role: assignedRole,
        status: 'active',
      })
      .select('id, email, name, role, status, created_at')
      .single()
    if (userError || !user) {
      await supabase.auth.admin.deleteUser(invite.user.id)
      return error(res, 500, userError?.message ?? 'Failed to add member')
    }

    return created(res, user)
  }

  return error(res, 405, 'Method not allowed')
})
