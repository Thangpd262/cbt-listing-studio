// Fetches decrypted Walmart selling-account credentials from the Account
// service via the internal (X-Internal-Secret) endpoint. type = 'walmart'.

export type WmtCredentials = {
  type?: string
  api_key?: string
  api_secret?: string
  partner_id?: string
}

export async function getSellingAccountCredentials(sellingAccountId: string): Promise<WmtCredentials> {
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
  return credentials as WmtCredentials
}
