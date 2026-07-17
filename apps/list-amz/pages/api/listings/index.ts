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
      // Source crawl listing (for dedup + traceability)
      listing_id,
      // Config-based mode
      config_key, field_values,
      // Legacy flat mode
      title, description, bullet_points, images, price, quantity, product_type, attributes,
      // Optional: have the generator write the description instead of the config default
      ai_description,
    } = req.body ?? {}

    if (!selling_account_id || !sku) {
      return error(res, 400, 'selling_account_id và sku là bắt buộc')
    }
    const isConfigMode = !!(config_key && field_values && typeof field_values === 'object')
    if (!isConfigMode && !title) {
      return error(res, 400, 'title là bắt buộc (hoặc dùng config_key + field_values)')
    }

    // Block a second live ASIN for the same source listing (idempotency guard).
    if (listing_id) {
      const { data: existing } = await supabase
        .from('amz_products')
        .select('id, sku, asin')
        .eq('account_id', auth.account_id)
        .eq('listing_id', listing_id)
        .not('asin', 'is', null)
        .maybeSingle()
      if (existing) {
        return error(res, 409, `Listing này đã có ASIN ${existing.asin} (SKU: ${existing.sku}). Không thể tạo lần 2.`)
      }
    }

    // Working copy of the config values so we can inject an AI description.
    const fieldValues: Record<string, string> = isConfigMode ? { ...(field_values as Record<string, string>) } : {}

    // Derive display title for the product row.
    const displayTitle = isConfigMode
      ? (fieldValues['item_name'] ?? config_key)
      : (title as string)

    // AI viết mô tả: ask the generator for a description from the title.
    // Best-effort — on any failure we fall back to the config default.
    if (isConfigMode && ai_description) {
      const genUrl = process.env.GENERATOR_SERVICE_URL
      const apiKey = req.headers['x-api-key'] as string
      if (genUrl && apiKey) {
        try {
          const r = await fetch(`${genUrl}/api/generate-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
            body: JSON.stringify({ kind: 'description', title: displayTitle, platform: 'amazon' }),
          })
          const body = await r.json().catch(() => null)
          if (r.ok && body?.success && body.data?.text) {
            fieldValues['product_description'] = body.data.text as string
          }
        } catch {
          // ignore — keep the config's default description
        }
      }
    }

    // 1. Product row (draft).
    const { data: product, error: prodError } = await supabase
      .from('amz_products')
      .insert({
        account_id: auth.account_id,
        selling_account_id,
        listing_id: listing_id ?? null,
        sku,
        title: displayTitle,
        description: isConfigMode ? null : (description ?? null),
        bullet_points: isConfigMode ? [] : (Array.isArray(bullet_points) ? bullet_points : []),
        images: isConfigMode ? [] : (Array.isArray(images) ? images : []),
        price: isConfigMode ? null : (price ?? null),
        quantity: isConfigMode ? 0 : (quantity ?? 0),
        product_type: isConfigMode ? (config_key as string) : (product_type ?? null),
        attributes: isConfigMode ? fieldValues : (attributes ?? {}),
        status: 'draft',
      })
      .select('id')
      .single()
    if (prodError || !product) return error(res, 500, prodError?.message ?? 'Tạo product thất bại')

    // 2. Create job — payload differs by mode.
    const jobPayload = isConfigMode
      ? { config_key, field_values: fieldValues }
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
