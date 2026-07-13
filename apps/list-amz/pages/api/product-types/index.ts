import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'

// GET /api/product-types?platform=amazon       → list all configs (key, label, product_type, variation_theme)
// GET /api/product-types?key=AMZ_TSHIRT        → full config including fields
export default withAuth(async (req, res, _auth) => {
  if (req.method !== 'GET') return error(res, 405, 'Method not allowed')

  const supabase = createSupabaseClient()
  const { key, platform } = req.query as Record<string, string>

  if (key) {
    const { data, error: dbError } = await supabase
      .from('product_configs')
      .select('*')
      .eq('key', key)
      .single()
    if (dbError || !data) return error(res, 404, 'Config not found')
    return ok(res, data)
  }

  const query = supabase
    .from('product_configs')
    .select('key, label, platform, product_type, variation_theme')
    .order('platform')
    .order('key')

  if (platform) query.eq('platform', platform)

  const { data, error: dbError } = await query
  if (dbError) return error(res, 500, dbError.message)
  return ok(res, data)
})
