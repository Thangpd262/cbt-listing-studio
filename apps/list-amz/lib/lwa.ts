import { createSupabaseClient } from '@cbt/shared'
import type { AmzCredentials } from './account-client'

// Login with Amazon: exchange a refresh_token for a short-lived access_token,
// cached per selling account in sp_api_tokens until ~1 minute before expiry.
export async function getAccessToken(
  credentials: AmzCredentials,
  sellingAccountId: string
): Promise<string> {
  const { lwa_client_id, lwa_client_secret, refresh_token } = credentials
  if (!lwa_client_id || !lwa_client_secret || !refresh_token) {
    throw new Error('Missing LWA credentials (lwa_client_id / lwa_client_secret / refresh_token)')
  }

  const supabase = createSupabaseClient()

  // Reuse a cached token if it is still valid for at least 60s.
  const { data: cached } = await supabase
    .from('sp_api_tokens')
    .select('access_token, expires_at')
    .eq('selling_account_id', sellingAccountId)
    .maybeSingle()
  if (cached && new Date(cached.expires_at).getTime() > Date.now() + 60_000) {
    return cached.access_token
  }

  // Exchange refresh_token → access_token.
  const res = await fetch('https://api.amazon.com/auth/o2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token,
      client_id: lwa_client_id,
      client_secret: lwa_client_secret,
    }),
  })
  if (!res.ok) throw new Error(`LWA token exchange failed (${res.status}): ${await res.text()}`)
  const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number }
  if (!access_token) throw new Error('LWA returned no access_token')

  await supabase.from('sp_api_tokens').upsert(
    {
      selling_account_id: sellingAccountId,
      access_token,
      expires_at: new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString(),
    },
    { onConflict: 'selling_account_id' }
  )

  return access_token
}
