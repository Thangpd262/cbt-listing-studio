import type { NextApiRequest, NextApiResponse } from 'next'
import { createSupabaseClient, ok, created, error } from '@cbt/shared'
import { withSession } from '../../../middleware/withSession'
import { encryptCredentials } from '../../../lib/encryption'

// GET  — list selling accounts for the current account
// POST — create a selling account + store its encrypted platform credentials
export default withSession(async (req: NextApiRequest, res: NextApiResponse, ctx) => {
  const supabase = createSupabaseClient()

  if (req.method === 'GET') {
    const { data, error: dbError } = await supabase
      .from('selling_accounts')
      .select('id, platform, region, name, is_active, created_at')
      .eq('account_id', ctx.account_id)
      .order('created_at', { ascending: false })
    if (dbError) return error(res, 500, dbError.message)
    return ok(res, data)
  }

  if (req.method === 'POST') {
    const { platform, region, name, credentials } = req.body ?? {}
    if (!platform || !name) return error(res, 400, 'platform and name are required')

    const { data: selling, error: insertError } = await supabase
      .from('selling_accounts')
      .insert({ account_id: ctx.account_id, platform, region: region ?? 'US', name })
      .select('id, platform, region, name, is_active, created_at')
      .single()
    if (insertError || !selling) return error(res, 500, insertError?.message ?? 'Failed to create selling account')

    if (credentials) {
      const { error: credError } = await supabase
        .from('account_credentials')
        .insert({ selling_account_id: selling.id, credentials_encrypted: encryptCredentials(credentials) })
      if (credError) {
        await supabase.from('selling_accounts').delete().eq('id', selling.id)
        return error(res, 500, credError.message)
      }
    }

    return created(res, selling)
  }

  return error(res, 405, 'Method not allowed')
})
