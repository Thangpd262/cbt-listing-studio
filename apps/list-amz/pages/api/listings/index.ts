import { withAuth, createSupabaseClient, ok, created, error, paginated } from '@cbt/shared'
import { executeJob } from '../../../lib/jobs'

// GET  — paginated list of Amazon products for the account
// POST — create a product (draft) + a 'create' job, then push to SP-API inline
export default withAuth(async (req, res, auth) => {
  const supabase = createSupabaseClient()

  if (req.method === 'GET') {
    const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? '20', 10) || 20))
    const from = (page - 1) * limit

    let query = supabase
      .from('amz_products')
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
    const {
      selling_account_id, sku,
      // Config-based mode
      config_key, field_values,
      // Legacy flat mode
      title, description, bullet_points, images, price, quantity, product_type, attributes,
    } = req.body ?? {}

    if (!selling_account_id || !sku) {
      return error(res, 400, 'selling_account_id và sku là bắt buộc')
    }
    const isConfigMode = !!(config_key && field_values && typeof field_values === 'object')
    if (!isConfigMode && !title) {
      return error(res, 400, 'title là bắt buộc (hoặc dùng config_key + field_values)')
    }

    // Derive display title for the product row.
    const displayTitle = isConfigMode
      ? ((field_values as Record<string, string>)['item_name'] ?? config_key)
      : (title as string)

    // 1. Product row (draft).
    const { data: product, error: prodError } = await supabase
      .from('amz_products')
      .insert({
        account_id: auth.account_id,
        selling_account_id,
        sku,
        title: displayTitle,
        description: isConfigMode ? null : (description ?? null),
        bullet_points: isConfigMode ? [] : (Array.isArray(bullet_points) ? bullet_points : []),
        images: isConfigMode ? [] : (Array.isArray(images) ? images : []),
        price: isConfigMode ? null : (price ?? null),
        quantity: isConfigMode ? 0 : (quantity ?? 0),
        product_type: isConfigMode ? (config_key as string) : (product_type ?? null),
        attributes: isConfigMode ? (field_values ?? {}) : (attributes ?? {}),
        status: 'draft',
      })
      .select('id')
      .single()
    if (prodError || !product) return error(res, 500, prodError?.message ?? 'Tạo product thất bại')

    // 2. Create job — payload differs by mode.
    const jobPayload = isConfigMode
      ? { config_key, field_values }
      : { title, description, bullet_points, images, price, quantity, product_type, attributes }

    const { data: job, error: jobError } = await supabase
      .from('amz_listing_jobs')
      .insert({
        account_id: auth.account_id,
        selling_account_id,
        product_id: product.id,
        action: 'create',
        payload: jobPayload,
        created_by: auth.user_id,
      })
      .select('id')
      .single()
    if (jobError || !job) return error(res, 500, jobError?.message ?? 'Tạo job thất bại')

    // 3. Execute inline.
    const outcome = await executeJob(supabase, job.id)
    return created(res, { product_id: product.id, job_id: job.id, ...outcome })
  }

  return error(res, 405, 'Method not allowed')
})
