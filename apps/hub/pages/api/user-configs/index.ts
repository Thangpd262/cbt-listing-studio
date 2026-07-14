import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, ok, created, error, createSupabaseClient } from '@cbt/shared'

// GET  /api/user-configs        → list this account's cloned configs
// POST /api/user-configs        → create a clone { name, based_on, overrides? }
export default withAuth(async (req: NextApiRequest, res: NextApiResponse, auth) => {
  const supabase = createSupabaseClient()

  if (req.method === 'GET') {
    const { data, error: dbErr } = await supabase
      .from('user_product_configs')
      .select('*')
      .eq('account_id', auth.account_id)
      .order('created_at', { ascending: false })
    if (dbErr) return error(res, 500, dbErr.message)
    return ok(res, data)
  }

  if (req.method === 'POST') {
    const { name, based_on, overrides } = (req.body ?? {}) as {
      name?: string
      based_on?: string
      overrides?: Record<string, unknown>
    }
    if (!name || !based_on) return error(res, 400, 'name và based_on là bắt buộc')

    const { data, error: dbErr } = await supabase
      .from('user_product_configs')
      .insert({ account_id: auth.account_id, name, based_on, overrides: overrides ?? {} })
      .select()
      .single()
    if (dbErr) return error(res, 500, dbErr.message)
    return created(res, data)
  }

  return error(res, 405, 'Method not allowed')
})
