import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'
import { executeJob } from '../../../lib/jobs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET    — product detail + its recent jobs
// PUT    — update product content, push an 'update' job to SP-API
// PATCH  — update price/quantity, push a lighter 'price_qty' job
// DELETE — push a 'delete' job to SP-API (marks product deleted)
//
// The [id] param resolves to an amz_products row by internal id (UUID) or by SKU
// — the Hub's listing table is a synced cache whose rows carry a SKU, not our id.
export default withAuth(async (req, res, auth) => {
  const supabase = createSupabaseClient()
  const idParam = req.query.id as string

  const lookup = supabase.from('amz_products').select('*').eq('account_id', auth.account_id)
  const { data: product, error: fetchError } = await (
    UUID_RE.test(idParam) ? lookup.eq('id', idParam) : lookup.eq('sku', idParam)
  ).single()
  if (fetchError || !product) {
    return error(res, 404, `Listing chưa liên kết product (${idParam}) — chưa hỗ trợ sửa listing này.`)
  }
  const productId = product.id as string

  if (req.method === 'GET') {
    const { data: jobs } = await supabase
      .from('amz_listing_jobs')
      .select('id, action, status, error, retry_count, created_at')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(10)
    return ok(res, { ...product, jobs: jobs ?? [] })
  }

  if (req.method === 'PUT') {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const f of ['title', 'description', 'bullet_points', 'images', 'price', 'quantity', 'product_type', 'attributes']) {
      if (req.body?.[f] !== undefined) patch[f] = req.body[f]
    }
    const { data: updated, error: updError } = await supabase
      .from('amz_products')
      .update(patch)
      .eq('id', productId)
      .eq('account_id', auth.account_id)
      .select('*')
      .single()
    if (updError || !updated) return error(res, 500, updError?.message ?? 'Update thất bại')

    const { data: job } = await supabase
      .from('amz_listing_jobs')
      .insert({
        account_id: auth.account_id,
        selling_account_id: updated.selling_account_id,
        product_id: productId,
        action: 'update',
        payload: {
          title: updated.title,
          description: updated.description,
          bullet_points: updated.bullet_points,
          images: updated.images,
          price: updated.price,
          quantity: updated.quantity,
          product_type: updated.product_type,
          attributes: updated.attributes,
        },
      })
      .select('id')
      .single()
    const outcome = job ? await executeJob(supabase, job.id) : { status: 'failed' as const, error: 'Job create failed' }
    return ok(res, { product_id: productId, job_id: job?.id, ...outcome })
  }

  if (req.method === 'PATCH') {
    const { price, quantity } = req.body ?? {}
    if (price == null && quantity == null) return error(res, 400, 'price or quantity required')

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (price != null) patch.price = price
    if (quantity != null) patch.quantity = quantity

    const { data: updated, error: updError } = await supabase
      .from('amz_products')
      .update(patch)
      .eq('id', productId)
      .eq('account_id', auth.account_id)
      .select('id, price, quantity')
      .single()
    if (updError || !updated) return error(res, 500, updError?.message ?? 'Update thất bại')

    const { data: job } = await supabase
      .from('amz_listing_jobs')
      .insert({
        account_id: auth.account_id,
        selling_account_id: product.selling_account_id,
        product_id: productId,
        action: 'price_qty',
        payload: { price, quantity },
      })
      .select('id')
      .single()

    const outcome = job
      ? await executeJob(supabase, job.id)
      : { status: 'failed' as const, error: 'Job create failed' }

    return ok(res, { product_id: productId, job_id: job?.id, ...outcome })
  }

  if (req.method === 'DELETE') {
    const { data: job } = await supabase
      .from('amz_listing_jobs')
      .insert({
        account_id: auth.account_id,
        selling_account_id: product.selling_account_id,
        product_id: productId,
        action: 'delete',
        payload: {},
      })
      .select('id')
      .single()
    const outcome = job ? await executeJob(supabase, job.id) : { status: 'failed' as const, error: 'Job create failed' }
    return ok(res, { product_id: productId, job_id: job?.id, ...outcome })
  }

  return error(res, 405, 'Method not allowed')
})
