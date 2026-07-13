import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'
import { executeJob } from '../../../../lib/jobs'

// POST — publish the item after Walmart approval (product -> 'published').
export default withAuth(async (req, res, auth) => {
  if (req.method !== 'POST') return error(res, 405, 'Method not allowed')

  const supabase = createSupabaseClient()
  const id = req.query.id as string

  const { data: product } = await supabase
    .from('wmt_products')
    .select('id, selling_account_id')
    .eq('id', id)
    .eq('account_id', auth.account_id)
    .single()
  if (!product) return error(res, 404, 'Product not found')

  const { data: job } = await supabase
    .from('wmt_listing_jobs')
    .insert({
      account_id: auth.account_id,
      selling_account_id: product.selling_account_id,
      product_id: id,
      action: 'publish',
      payload: {},
    })
    .select('id')
    .single()
  const outcome = job ? await executeJob(supabase, job.id) : { status: 'failed' as const, error: 'Job create failed' }
  return ok(res, { product_id: id, job_id: job?.id, ...outcome })
})
