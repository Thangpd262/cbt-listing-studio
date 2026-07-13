import { withAuth, createSupabaseClient, created, error, paginated } from '@cbt/shared'
import { executeJob } from '../../../lib/jobs'

// GET  — paginated list of Walmart products
// POST — create a product (draft, with variants) + a 'create' job, push to Walmart inline
export default withAuth(async (req, res, auth) => {
  const supabase = createSupabaseClient()

  if (req.method === 'GET') {
    const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? '20', 10) || 20))
    const from = (page - 1) * limit

    let query = supabase
      .from('wmt_products')
      .select('*', { count: 'exact' })
      .eq('account_id', auth.account_id)
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1)
    if (req.query.selling_account_id) query = query.eq('selling_account_id', req.query.selling_account_id as string)
    if (req.query.status) query = query.eq('status', req.query.status as string)

    const { data, error: dbError, count } = await query
    if (dbError) return error(res, 500, dbError.message)
    return paginated(res, data, count ?? 0, page, limit)
  }

  if (req.method === 'POST') {
    const { selling_account_id, sku, title, description, variants, attributes, shipping_node } = req.body ?? {}
    if (!selling_account_id || !sku || !title) {
      return error(res, 400, 'selling_account_id, sku và title là bắt buộc')
    }
    if (!Array.isArray(variants) || variants.length === 0) {
      return error(res, 400, 'variants phải có tối thiểu 1 phần tử')
    }

    const { data: product, error: prodError } = await supabase
      .from('wmt_products')
      .insert({
        account_id: auth.account_id,
        selling_account_id,
        sku,
        title,
        description: description ?? null,
        variants,
        attributes: attributes ?? {},
        shipping_node: shipping_node ?? null,
        status: 'draft',
      })
      .select('id')
      .single()
    if (prodError || !product) return error(res, 500, prodError?.message ?? 'Tạo product thất bại')

    const { data: job, error: jobError } = await supabase
      .from('wmt_listing_jobs')
      .insert({
        account_id: auth.account_id,
        selling_account_id,
        product_id: product.id,
        action: 'create',
        payload: { sku, title, description, variants, attributes, shipping_node },
      })
      .select('id')
      .single()
    if (jobError || !job) return error(res, 500, jobError?.message ?? 'Tạo job thất bại')

    const outcome = await executeJob(supabase, job.id)
    return created(res, { product_id: product.id, job_id: job.id, ...outcome })
  }

  return error(res, 405, 'Method not allowed')
})
