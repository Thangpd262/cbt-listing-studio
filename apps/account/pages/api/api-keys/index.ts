import type { NextApiRequest, NextApiResponse } from 'next'
import { createSupabaseClient, ok, created, error } from '@cbt/shared'
import { withSession } from '../../../middleware/withSession'
import { generateApiKey } from '../../../lib/auth'

// GET  — list active API keys (metadata only, never the raw key)
// POST — mint a new API key; the raw key is returned ONCE and only the hash is stored
export default withSession(async (req: NextApiRequest, res: NextApiResponse, ctx) => {
  const supabase = createSupabaseClient()

  if (req.method === 'GET') {
    const { data, error: dbError } = await supabase
      .from('api_keys')
      .select('id, name, last_used_at, created_at')
      .eq('account_id', ctx.account_id)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
    if (dbError) return error(res, 500, dbError.message)
    return ok(res, data)
  }

  if (req.method === 'POST') {
    const { name } = req.body ?? {}
    const { key, hash } = generateApiKey()

    const { data, error: dbError } = await supabase
      .from('api_keys')
      .insert({ account_id: ctx.account_id, name: name ?? 'default', key_hash: hash })
      .select('id, name, created_at')
      .single()
    if (dbError || !data) return error(res, 500, dbError?.message ?? 'Failed to create API key')

    // Raw key shown exactly once — the client must store it now.
    return created(res, { ...data, key })
  }

  return error(res, 405, 'Method not allowed')
})
