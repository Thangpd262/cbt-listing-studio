import type { NextApiRequest, NextApiResponse } from 'next'
import { createSupabaseClient, ok, error } from '@cbt/shared'
import { withSession } from '../../../middleware/withSession'

// DELETE — revoke an API key (soft delete via revoked_at, so the hash stays unique).
export default withSession(async (req: NextApiRequest, res: NextApiResponse, ctx) => {
  if (req.method !== 'DELETE') return error(res, 405, 'Method not allowed')

  const supabase = createSupabaseClient()
  const id = req.query.id as string

  const { data, error: dbError } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('account_id', ctx.account_id)
    .is('revoked_at', null)
    .select('id')
    .single()
  if (dbError || !data) return error(res, 404, 'API key not found')

  return ok(res, { id: data.id, revoked: true })
})
