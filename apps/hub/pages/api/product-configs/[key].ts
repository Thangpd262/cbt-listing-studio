import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, ok, error, createSupabaseClient } from '@cbt/shared'

// GET /api/product-configs/:key → a system default config incl. its fields[]
// schema. Read-only; used by the override editor to render each field.
export default withAuth(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') return error(res, 405, 'Method not allowed')

  const key = req.query.key as string
  const supabase = createSupabaseClient()
  const { data, error: dbErr } = await supabase
    .from('product_configs')
    .select('key, label, platform, product_type, variation_theme, fields')
    .eq('key', key)
    .single()
  if (dbErr || !data) return error(res, 404, 'Config mặc định không tồn tại')
  return ok(res, data)
})
