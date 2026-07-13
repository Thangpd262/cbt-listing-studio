import type { NextApiRequest, NextApiResponse } from 'next'
import { createSupabaseClient, ok, error } from '@cbt/shared'
import { withSession } from '../../../middleware/withSession'
import { encryptCredentials } from '../../../lib/encryption'

// GET / PUT / DELETE a single selling account, scoped to the current account.
export default withSession(async (req: NextApiRequest, res: NextApiResponse, ctx) => {
  const supabase = createSupabaseClient()
  const id = req.query.id as string

  if (req.method === 'GET') {
    const { data, error: dbError } = await supabase
      .from('selling_accounts')
      .select('id, platform, region, name, is_active, created_at')
      .eq('id', id)
      .eq('account_id', ctx.account_id)
      .single()
    if (dbError || !data) return error(res, 404, 'Selling account not found')
    return ok(res, data)
  }

  if (req.method === 'PUT') {
    const { name, region, is_active, credentials } = req.body ?? {}
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (name !== undefined) patch.name = name
    if (region !== undefined) patch.region = region
    if (is_active !== undefined) patch.is_active = is_active

    const { data, error: dbError } = await supabase
      .from('selling_accounts')
      .update(patch)
      .eq('id', id)
      .eq('account_id', ctx.account_id)
      .select('id, platform, region, name, is_active, created_at')
      .single()
    if (dbError || !data) return error(res, 404, 'Selling account not found')

    // Optionally rotate stored credentials (upsert on the unique selling_account_id).
    if (credentials) {
      const { error: credError } = await supabase
        .from('account_credentials')
        .upsert(
          {
            selling_account_id: id,
            credentials_encrypted: encryptCredentials(credentials),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'selling_account_id' }
        )
      if (credError) return error(res, 500, credError.message)
    }

    return ok(res, data)
  }

  if (req.method === 'DELETE') {
    const { data, error: dbError } = await supabase
      .from('selling_accounts')
      .delete()
      .eq('id', id)
      .eq('account_id', ctx.account_id)
      .select('id')
      .single()
    if (dbError || !data) return error(res, 404, 'Selling account not found')
    return ok(res, { id: data.id, deleted: true })
  }

  return error(res, 405, 'Method not allowed')
})
