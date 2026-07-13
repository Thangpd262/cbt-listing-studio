import { randomUUID } from 'crypto'
import { createSupabaseClient } from '@cbt/shared'
import type { WmtCredentials } from './account-client'

const WMT_BASE = process.env.WMT_API_BASE || 'https://marketplace.walmartapis.com/v3'

// Walmart OAuth: Basic(api_key:api_secret) → access_token (client_credentials),
// cached per selling account in wmt_api_tokens until ~1 minute before expiry.
export async function getWalmartToken(
  sellingAccountId: string,
  credentials: WmtCredentials
): Promise<string> {
  const { api_key, api_secret } = credentials
  if (!api_key || !api_secret) throw new Error('Missing Walmart credentials (api_key / api_secret)')

  const supabase = createSupabaseClient()

  const { data: cached } = await supabase
    .from('wmt_api_tokens')
    .select('access_token, expires_at')
    .eq('selling_account_id', sellingAccountId)
    .maybeSingle()
  if (cached && new Date(cached.expires_at).getTime() > Date.now() + 60_000) {
    return cached.access_token
  }

  const encoded = Buffer.from(`${api_key}:${api_secret}`).toString('base64')
  const res = await fetch(`${WMT_BASE}/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${encoded}`,
      'WM_SVC.NAME': 'Walmart Marketplace',
      'WM_QOS.CORRELATION_ID': randomUUID(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new Error(`Walmart token request failed (${res.status}): ${await res.text()}`)
  const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number }
  if (!access_token) throw new Error('Walmart returned no access_token')

  await supabase.from('wmt_api_tokens').upsert(
    {
      selling_account_id: sellingAccountId,
      access_token,
      expires_at: new Date(Date.now() + (expires_in ?? 900) * 1000).toISOString(),
    },
    { onConflict: 'selling_account_id' }
  )

  return access_token
}
