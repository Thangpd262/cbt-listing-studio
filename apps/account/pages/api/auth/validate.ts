import type { NextApiRequest, NextApiResponse } from 'next'
import { createSupabaseClient } from '@cbt/shared'
import { hashApiKey } from '../../../lib/auth'

// POST — header: X-API-Key
// The endpoint every other service's `withAuth` calls. It resolves an API key
// into an AuthContext. IMPORTANT: the response body IS the AuthContext (raw JSON,
// not wrapped in { success, data }) because withAuth does `await response.json()`.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const apiKey = req.headers['x-api-key'] as string | undefined
  if (!apiKey) {
    return res.status(401).json({ success: false, error: 'Missing X-API-Key header' })
  }

  const supabase = createSupabaseClient()
  const keyHash = hashApiKey(apiKey)

  const { data: key, error: keyError } = await supabase
    .from('api_keys')
    .select('id, account_id')
    .eq('key_hash', keyHash)
    .is('revoked_at', null)
    .single()
  if (keyError || !key) {
    return res.status(401).json({ success: false, error: 'Invalid or revoked API key' })
  }

  // Record usage (best-effort, don't block validation on it).
  await supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', key.id)

  // Account tier.
  const { data: account } = await supabase
    .from('accounts')
    .select('tier')
    .eq('id', key.account_id)
    .single()

  // Resolve user identity: if the caller forwarded X-User-ID, look up that
  // specific user (must belong to this account). Falls back to the account
  // owner (earliest active user) for backward compatibility.
  const requestedUserId = req.headers['x-user-id'] as string | undefined
  let user: { id: string; role: string | null } | null = null

  if (requestedUserId) {
    const { data } = await supabase
      .from('app_users')
      .select('id, role')
      .eq('id', requestedUserId)
      .eq('account_id', key.account_id)
      .eq('status', 'active')
      .maybeSingle()
    user = data ?? null
  }

  if (!user) {
    // Fall back to account owner (first active user by created_at).
    const { data } = await supabase
      .from('app_users')
      .select('id, role')
      .eq('account_id', key.account_id)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    user = data ?? null
  }

  // Per-selling-account permissions for the account.
  const { data: perms } = await supabase
    .from('user_selling_permissions')
    .select('selling_account_id, role')
    .eq('account_id', key.account_id)

  return res.status(200).json({
    account_id: key.account_id,
    user_id: user?.id ?? null,
    role: user?.role ?? 'admin',
    tier: account?.tier ?? 'free',
    permissions: perms ?? [],
  })
}
