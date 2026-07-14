import { withAuth, createSupabaseClient, error, ok } from '@cbt/shared'

// GET — Amazon products for the current account (for the "Listing trên Amazon"
// page). Newest first; optional ?status= filter.
export default withAuth(async (req, res, auth) => {
  if (req.method !== 'GET') return error(res, 405, 'Method not allowed')

  const supabase = createSupabaseClient()
  let query = supabase
    .from('amz_products')
    .select('id, sku, asin, title, status, product_type, created_at')
    .eq('account_id', auth.account_id)
    .order('created_at', { ascending: false })
    .limit(200)
  if (req.query.status) query = query.eq('status', req.query.status as string)

  const { data, error: dbError } = await query
  if (dbError) return error(res, 500, dbError.message)
  return ok(res, data ?? [])
})
