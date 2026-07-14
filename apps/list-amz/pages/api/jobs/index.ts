import { withAuth, createSupabaseClient, error, paginated } from '@cbt/shared'

// GET — paginated list of listing jobs (filter by status / selling_account_id).
// Embeds the linked product's SKU + title via the product_id FK so the UI can
// show a real SKU instead of digging through the job payload.
export default withAuth(async (req, res, auth) => {
  if (req.method !== 'GET') return error(res, 405, 'Method not allowed')

  const supabase = createSupabaseClient()
  const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? '20', 10) || 20))
  const from = (page - 1) * limit

  let query = supabase
    .from('amz_listing_jobs')
    .select('*, product:amz_products(sku, title)', { count: 'exact' })
    .eq('account_id', auth.account_id)
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1)
  if (req.query.status) query = query.eq('status', req.query.status as string)
  if (req.query.selling_account_id) query = query.eq('selling_account_id', req.query.selling_account_id as string)

  const { data, error: dbError, count } = await query
  if (dbError) return error(res, 500, dbError.message)

  // Flatten the embedded product onto the job + expose sku / created_by_email.
  // created_by_email is null until amz_listing_jobs carries a creator column.
  const rows = (data ?? []).map((row) => {
    const { product, ...job } = row as typeof row & {
      product: { sku: string; title: string } | null
    }
    return {
      ...job,
      sku: product?.sku ?? null,
      product_title: product?.title ?? null,
      created_by_email: null as string | null,
    }
  })

  return paginated(res, rows, count ?? 0, page, limit)
})
