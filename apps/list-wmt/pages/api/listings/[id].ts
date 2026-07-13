import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'
import { executeJob } from '../../../lib/jobs'

// GET    — product detail + recent jobs
// PUT    — update product fields, push an 'update' job to Walmart
// DELETE — push a 'delete' (retire) job to Walmart
export default withAuth(async (req, res, auth) => {
  const supabase = createSupabaseClient()
  const id = req.query.id as string

  const { data: product, error: fetchError } = await supabase
    .from('wmt_products')
    .select('*')
    .eq('id', id)
    .eq('account_id', auth.account_id)
    .single()
  if (fetchError || !product) return error(res, 404, 'Product not found')

  if (req.method === 'GET') {
    const { data: jobs } = await supabase
      .from('wmt_listing_jobs')
      .select('id, action, status, error, retry_count, created_at')
      .eq('product_id', id)
      .order('created_at', { ascending: false })
      .limit(10)
    return ok(res, { ...product, jobs: jobs ?? [] })
  }

  if (req.method === 'PUT') {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const f of ['title', 'description', 'variants', 'attributes', 'shipping_node']) {
      if (req.body?.[f] !== undefined) patch[f] = req.body[f]
    }
    const { data: updated, error: updError } = await supabase
      .from('wmt_products')
      .update(patch)
      .eq('id', id)
      .eq('account_id', auth.account_id)
      .select('*')
      .single()
    if (updError || !updated) return error(res, 500, updError?.message ?? 'Update thất bại')

    const { data: job } = await supabase
      .from('wmt_listing_jobs')
      .insert({
        account_id: auth.account_id,
        selling_account_id: updated.selling_account_id,
        product_id: id,
        action: 'update',
        payload: {
          sku: updated.sku,
          title: updated.title,
          description: updated.description,
          variants: updated.variants,
          attributes: updated.attributes,
          shipping_node: updated.shipping_node,
        },
      })
      .select('id')
      .single()
    const outcome = job ? await executeJob(supabase, job.id) : { status: 'failed' as const, error: 'Job create failed' }
    return ok(res, { product_id: id, job_id: job?.id, ...outcome })
  }

  if (req.method === 'DELETE') {
    const { data: job } = await supabase
      .from('wmt_listing_jobs')
      .insert({
        account_id: auth.account_id,
        selling_account_id: product.selling_account_id,
        product_id: id,
        action: 'delete',
        payload: {},
      })
      .select('id')
      .single()
    const outcome = job ? await executeJob(supabase, job.id) : { status: 'failed' as const, error: 'Job create failed' }
    return ok(res, { product_id: id, job_id: job?.id, ...outcome })
  }

  return error(res, 405, 'Method not allowed')
})
