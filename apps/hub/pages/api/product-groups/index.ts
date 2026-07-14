import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, ok, created, error, createSupabaseClient } from '@cbt/shared'

// GET  /api/product-groups[?platform=]  → list this account's product groups
// POST /api/product-groups               → create { name, platform }
export default withAuth(async (req: NextApiRequest, res: NextApiResponse, auth) => {
  const supabase = createSupabaseClient()

  if (req.method === 'GET') {
    let query = supabase
      .from('product_groups')
      .select('*')
      .eq('account_id', auth.account_id)
      .order('name', { ascending: true })
    const platform = req.query.platform as string | undefined
    if (platform) query = query.eq('platform', platform)
    const { data, error: dbErr } = await query
    if (dbErr) return error(res, 500, dbErr.message)
    return ok(res, data)
  }

  if (req.method === 'POST') {
    const { name, platform } = (req.body ?? {}) as { name?: string; platform?: string }
    if (!name) return error(res, 400, 'name là bắt buộc')

    const { data, error: dbErr } = await supabase
      .from('product_groups')
      .insert({ account_id: auth.account_id, name, platform: platform ?? 'amazon' })
      .select()
      .single()
    if (dbErr) return error(res, 500, dbErr.message)
    return created(res, data)
  }

  return error(res, 405, 'Method not allowed')
})
