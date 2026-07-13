import type { NextApiRequest, NextApiResponse } from 'next'
import { createSupabaseClient, created, error } from '@cbt/shared'

// POST { email, password, name }
// Single-tenant signup: creates a Supabase Auth user and a pending app_user
// attached to the one account. No token is returned — an admin must approve
// (assign a role + activate) before the user can log in.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return error(res, 405, 'Method not allowed')

  const { email, password, name } = req.body ?? {}
  if (!email || !password) return error(res, 400, 'email and password are required')

  const supabase = createSupabaseClient()

  // Single tenant: attach every signup to the one existing account (seeded).
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (accountError) return error(res, 500, accountError.message)
  if (!account) return error(res, 503, 'System not initialized — run the admin seed migration')

  // Create the auth identity (password lives in Supabase Auth).
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  })
  if (authError || !authData.user) {
    return error(res, 400, authError?.message ?? 'Failed to create auth user')
  }

  // Pending app_user, no role yet (assigned on approval).
  const { data: user, error: userError } = await supabase
    .from('app_users')
    .insert({ account_id: account.id, auth_user_id: authData.user.id, email, name, status: 'pending' })
    .select('id')
    .single()
  if (userError || !user) {
    await supabase.auth.admin.deleteUser(authData.user.id)
    return error(res, 500, userError?.message ?? 'Failed to create user')
  }

  return created(res, {
    user_id: user.id,
    status: 'pending',
    message: 'Đăng ký thành công. Tài khoản đang chờ admin duyệt.',
  })
}
