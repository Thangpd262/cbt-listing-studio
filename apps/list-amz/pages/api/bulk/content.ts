import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'
import { executeJob } from '../../../lib/jobs'
import { resolveOrCreateProduct } from '../../../lib/product-resolve'

type Item = { sku: string; bullet_points?: string[]; description?: string }

// buildListingBody rebuilds content attributes (item_name / bullet_point /
// product_description) from the top-level payload fields, then spreads the stored
// `attributes` last — so a stale copy there would override the new value. We strip
// a content key only when its field is actually being replaced this call; every
// untouched key (and all image locators) is preserved so nothing is silently lost.
//
// POST /api/bulk/content — bulk update bullet_points / description across SKUs.
// Body: { items: [{ sku, bullet_points?, description? }] }
// A field left absent is preserved (not cleared). One 'update' job per SKU,
// each pushed to SP-API inline. Listings that exist only in the synced cache are
// hydrated into amz_products first (see resolveOrCreateProduct).
export default withAuth(async (req, res, auth) => {
  if (req.method !== 'POST') return error(res, 405, 'Method not allowed')

  const { items } = req.body ?? {}
  if (!Array.isArray(items) || items.length === 0) {
    return error(res, 400, 'items[] là bắt buộc')
  }

  const supabase = createSupabaseClient()
  const results: Array<Record<string, unknown>> = []

  for (const item of items as Item[]) {
    if (!item.sku) {
      results.push({ sku: item.sku, status: 'failed', error: 'Missing sku' })
      continue
    }
    const setBullets = Array.isArray(item.bullet_points)
    const setDesc = typeof item.description === 'string'
    if (!setBullets && !setDesc) {
      results.push({ sku: item.sku, status: 'skipped', error: 'Không có nội dung để cập nhật' })
      continue
    }

    const { product, error: resolveErr } = await resolveOrCreateProduct(supabase, auth.account_id, item.sku)
    if (resolveErr || !product) {
      results.push({ sku: item.sku, status: 'failed', error: resolveErr?.message ?? 'Product not found' })
      continue
    }

    // Persist the edited fields on the product row.
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (setBullets) patch.bullet_points = item.bullet_points
    if (setDesc) patch.description = item.description
    const { data: updated } = await supabase
      .from('amz_products')
      .update(patch)
      .eq('id', product.id as string)
      .eq('account_id', auth.account_id)
      .select('*')
      .single()
    const row = (updated ?? product) as Record<string, unknown>

    // Keep every stored attribute except item_name (always rebuilt from title)
    // and the content keys whose fields we're replacing this call.
    const rawAttrs = (row.attributes as Record<string, unknown>) ?? {}
    const attributes: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(rawAttrs)) {
      if (k === 'item_name') continue
      if (k === 'bullet_point' && setBullets) continue
      if (k === 'product_description' && setDesc) continue
      attributes[k] = v
    }

    const images = row.images
    const { data: job } = await supabase
      .from('amz_listing_jobs')
      .insert({
        account_id: auth.account_id,
        selling_account_id: row.selling_account_id as string,
        product_id: row.id as string,
        action: 'update',
        payload: {
          title: row.title,
          ...(setBullets ? { bullet_points: item.bullet_points } : {}),
          ...(setDesc ? { description: item.description } : {}),
          ...(Array.isArray(images) && images.length ? { images } : {}),
          price: row.price,
          quantity: row.quantity,
          product_type: row.product_type,
          attributes,
        },
        created_by: auth.user_id,
      })
      .select('id')
      .single()
    if (!job) {
      results.push({ sku: item.sku, status: 'failed', error: 'Job create failed' })
      continue
    }

    const outcome = await executeJob(supabase, job.id)
    results.push({ sku: item.sku, job_id: job.id, ...outcome })
  }

  return ok(res, { count: results.length, results })
})
