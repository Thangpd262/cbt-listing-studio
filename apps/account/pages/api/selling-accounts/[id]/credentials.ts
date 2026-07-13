import type { NextApiRequest, NextApiResponse } from 'next'
import { createSupabaseClient } from '@cbt/shared'
import { decryptCredentials } from '../../../../lib/encryption'

// GET — INTERNAL ONLY. Returns decrypted selling-account credentials.
// Called server-to-server by list-amz / list-wmt to obtain SP-API / Walmart creds.
// Auth: X-Internal-Secret header must match INTERNAL_SECRET (no user session).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const provided = req.headers['x-internal-secret'] as string | undefined
  const expected = process.env.INTERNAL_SECRET
  if (!expected || provided !== expected) {
    return res.status(401).json({ success: false, error: 'Invalid internal secret' })
  }

  const sellingAccountId = req.query.id as string
  const supabase = createSupabaseClient()

  const { data, error: dbError } = await supabase
    .from('account_credentials')
    .select('credentials_encrypted')
    .eq('selling_account_id', sellingAccountId)
    .single()
  if (dbError || !data) {
    return res.status(404).json({ success: false, error: 'Credentials not found' })
  }

  try {
    const credentials = decryptCredentials(data.credentials_encrypted)
    return res.status(200).json({ success: true, data: { selling_account_id: sellingAccountId, credentials } })
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to decrypt credentials' })
  }
}
