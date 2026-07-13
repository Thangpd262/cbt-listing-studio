import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'
import { executeJob } from '../../../lib/jobs'

type Item = { sku: string; price?: number; quantity?: number }

// POST — bulk price/quantity update.
// Body: { selling_account_id, items: [{ sku, price?, quantity? }] }
// One 'price_qty' job per item, each pushed to Walmart inline.
export default withAuth(async (req, res, auth) => {
  if (req.method !== 'POST') return error(res, 405, 'Method not allowed')

  const { selling_account_id, items } = req.body ?? {}
  if (!selling_account_id || !Array.isArray(items) || items.length === 0) {
    return error(res, 400, 'selling_account_id và items[] là bắt buộc')
  }

  const supabase = createSupabaseClient()
  const results: Array<Record<string, unknown>> = []

  for (const item of items as Item[]) {
    if (!item.sku) {
      results.push({ sku: item.sku, status: 'failed', error: 'Missing sku' })
      continue
    }

    const { data: product } = await supabase
      .from('wmt_products')
      .select('id')
      .eq('account_id', auth.account_id)
      .eq('selling_account_id', selling_account_id)
      .eq('sku', item.sku)
      .maybeSingle()
    if (!product) {
      results.push({ sku: item.sku, status: 'failed', error: 'Product not found' })
      continue
    }

    const { data: job } = await supabase
      .from('wmt_listing_jobs')
      .insert({
        account_id: auth.account_id,
        selling_account_id,
        product_id: product.id,
        action: 'price_qty',
        payload: { price: item.price, quantity: item.quantity },
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
