import type { NextApiRequest, NextApiResponse } from 'next'
import { createSupabaseClient, ok, error } from '@cbt/shared'
import { signJWT } from '../../../lib/auth'

// POST { email, password }
// Verifies the password against Supabase Auth, then issues our own session JWT.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return error(res, 405, 'Method not allowed')

  const { email, password } = req.body ?? {}
  if (!email || !password) return error(res, 400, 'email and password are required')

  // Use a fresh service-key client for DB queries so the session from
  // signInWithPassword never replaces the service-key credentials.
  const authClient = createSupabaseClient()
  const dbClient = createSupabaseClient()

  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
    email,
    password,
  })
  if (authError || !authData.user) {
    return error(res, 401, 'Invalid email or password')
  }

  const { data: user, error: userError } = await dbClient
    .from('app_users')
    .select('id, account_id, role, status')
    .eq('auth_user_id', authData.user.id)
    .single()
  if (userError || !user) {
    return error(res, 401, 'No account linked to this user')
  }

  // Approval gate: only active users may log in.
  if (user.status !== 'active') {
    return error(res, 403, 'Chờ admin duyệt')
  }

  const role = user.role ?? 'operator'
  const token = signJWT({ account_id: user.account_id, user_id: user.id, role })
  return ok(res, { token, account_id: user.account_id, user_id: user.id, role })
}
