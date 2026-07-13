// Fetches decrypted selling-account credentials from the Account service via
// the internal (X-Internal-Secret) endpoint.

export type AmzCredentials = {
  type?: 'private' | 'oauth'
  lwa_client_id?: string
  lwa_client_secret?: string
  refresh_token?: string
  seller_id?: string
}

export async function getSellingAccountCredentials(sellingAccountId: string): Promise<AmzCredentials> {
  const secret = process.env.INTERNAL_SECRET
  if (!secret) throw new Error('Missing INTERNAL_SECRET')

  const res = await fetch(
    `${process.env.ACCOUNT_SERVICE_URL}/api/selling-accounts/${sellingAccountId}/credentials`,
    { headers: { 'X-Internal-Secret': secret } }
  )
  if (!res.ok) throw new Error(`Failed to get credentials (${res.status})`)

  // Account returns { success, data: { selling_account_id, credentials } }.
  const body = await res.json()
  const credentials = body?.data?.credentials ?? body?.credentials
  if (!credentials) throw new Error('Credentials payload empty')
  return credentials as AmzCredentials
}
