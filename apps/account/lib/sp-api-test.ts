// Lightweight Amazon SP-API connectivity check used by the "Kiểm tra kết nối"
// button. Unlike list-amz/lib, this does NOT cache tokens — a connection test
// just does one fresh LWA exchange + one GetMarketplaceParticipations call.

type AmzCredentials = {
  lwa_client_id?: string
  lwa_client_secret?: string
  refresh_token?: string
  seller_id?: string
}

// SP-API regional endpoints. GetMarketplaceParticipations is region-scoped, so
// the host must match where the seller registered. Map by selling-account region.
const NA = 'https://sellingpartnerapi-na.amazon.com'
const EU = 'https://sellingpartnerapi-eu.amazon.com'
const FE = 'https://sellingpartnerapi-fe.amazon.com'

const REGION_HOST: Record<string, string> = {
  US: NA, CA: NA, MX: NA, BR: NA,
  UK: EU, GB: EU, DE: EU, FR: EU, IT: EU, ES: EU, NL: EU, SE: EU, PL: EU,
  TR: EU, AE: EU, SA: EU, EG: EU, IN: EU,
  JP: FE, AU: FE, SG: FE,
}

function hostForRegion(region: string | null | undefined): string {
  return REGION_HOST[(region ?? 'US').toUpperCase()] ?? NA
}

// Exchange refresh_token → short-lived access_token (no caching for a test).
async function getAccessToken(c: AmzCredentials): Promise<string> {
  if (!c.lwa_client_id || !c.lwa_client_secret || !c.refresh_token) {
    throw new Error('Thiếu thông tin LWA (client id / secret / refresh token)')
  }
  const res = await fetch('https://api.amazon.com/auth/o2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: c.refresh_token,
      client_id: c.lwa_client_id,
      client_secret: c.lwa_client_secret,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    // Surface Amazon's own error description when present (e.g. invalid_grant).
    let detail = text
    try {
      const j = JSON.parse(text) as { error_description?: string; error?: string }
      detail = j.error_description ?? j.error ?? text
    } catch {
      // keep raw text
    }
    throw new Error(`LWA từ chối (${res.status}): ${detail}`)
  }
  const { access_token } = (await res.json()) as { access_token?: string }
  if (!access_token) throw new Error('LWA không trả về access_token')
  return access_token
}

// Runs a real SP-API call to prove the credentials work. Never throws — returns
// a structured { ok, error } result the API route can pass straight through.
export async function testAmazonConnection(
  credentials: AmzCredentials,
  region: string | null | undefined
): Promise<{ ok: boolean; error?: string }> {
  try {
    const accessToken = await getAccessToken(credentials)
    const res = await fetch(`${hostForRegion(region)}/sellers/v1/marketplaceParticipations`, {
      headers: {
        'x-amz-access-token': accessToken,
        'User-Agent': 'CBT-Listing-Studio/1.0 (Language=TypeScript)',
      },
    })
    if (!res.ok) {
      const text = await res.text()
      return { ok: false, error: `SP-API lỗi (${res.status}): ${text.slice(0, 300)}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Kiểm tra kết nối thất bại' }
  }
}
