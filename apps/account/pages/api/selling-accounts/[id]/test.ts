import type { NextApiRequest, NextApiResponse } from 'next'
import { createSupabaseClient, ok, error } from '@cbt/shared'
import { withSession } from '../../../../middleware/withSession'
import { decryptCredentials } from '../../../../lib/encryption'
import { testAmazonConnection } from '../../../../lib/sp-api-test'

// POST /api/selling-accounts/:id/test — verify the stored platform credentials
// still authenticate against the marketplace API. Returns { ok, error? } so the
// UI can render a green/red badge. Scoped to the caller's account.
export default withSession(async (req: NextApiRequest, res: NextApiResponse, ctx) => {
  if (req.method !== 'POST') return error(res, 405, 'Method not allowed')

  const id = req.query.id as string
  const supabase = createSupabaseClient()

  // Confirm the account owns this selling account (and read its platform/region).
  const { data: account, error: acctErr } = await supabase
    .from('selling_accounts')
    .select('id, platform, region')
    .eq('id', id)
    .eq('account_id', ctx.account_id)
    .single()
  if (acctErr || !account) return error(res, 404, 'Selling account not found')

  if (account.platform !== 'amazon') {
    return ok(res, { ok: false, error: `Chưa hỗ trợ kiểm tra kết nối cho nền tảng "${account.platform}"` })
  }

  // Load + decrypt the stored credentials.
  const { data: cred, error: credErr } = await supabase
    .from('account_credentials')
    .select('credentials_encrypted')
    .eq('selling_account_id', id)
    .single()
  if (credErr || !cred) return ok(res, { ok: false, error: 'Chưa lưu thông tin đăng nhập cho tài khoản này' })

  let credentials: Record<string, unknown>
  try {
    credentials = decryptCredentials(cred.credentials_encrypted) as Record<string, unknown>
  } catch {
    return ok(res, { ok: false, error: 'Không giải mã được thông tin đăng nhập' })
  }

  const result = await testAmazonConnection(credentials, account.region)
  return ok(res, result)
})
