import { withAuth, createSupabaseClient, error, paginated } from '@cbt/shared'

// GET — paginated list of listing jobs (filter by status / selling_account_id).
// Embeds the linked product (SKU + title via product_id FK) and the creating
// user's email (via created_by FK) so the UI shows real SKU + author.
export default withAuth(async (req, res, auth) => {
  if (req.method !== 'GET') return error(res, 405, 'Method not allowed')

  const supabase = createSupabaseClient()
  const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? '20', 10) || 20))
  const from = (page - 1) * limit

  // Explicit column list (no SELECT *) + a planned (estimated) count instead of
  // an exact one: the exact count forced a full scan of the account's jobs on
  // every request, and the UI does not display a total. payload/result are kept
  // because the job detail view renders them. Served by
  // idx_amz_listing_jobs_account_created (account_id, created_at DESC).
  let query = supabase
    .from('amz_listing_jobs')
    .select(
      'id, selling_account_id, product_id, action, status, payload, result, error, retry_count, created_at, updated_at, product:amz_products(sku, title), creator:app_users!created_by(email)',
      { count: 'planned' }
    )
    .eq('account_id', auth.account_id)
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1)
  if (req.query.status) query = query.eq('status', req.query.status as string)
  if (req.query.selling_account_id) query = query.eq('selling_account_id', req.query.selling_account_id as string)

  const { data, error: dbError, count } = await query
  if (dbError) return error(res, 500, dbError.message)

  // Flatten the embedded product + creator onto the job (sku / created_by_email).
  const rows = (data ?? []).map((row) => {
    const { product, creator, ...job } = row as typeof row & {
      product: { sku: string; title: string } | null
      creator: { email: string } | null
    }
    return {
      ...job,
      sku: product?.sku ?? null,
      product_title: product?.title ?? null,
      created_by_email: creator?.email ?? null,
    }
  })

  return paginated(res, rows, count ?? 0, page, limit)
})
