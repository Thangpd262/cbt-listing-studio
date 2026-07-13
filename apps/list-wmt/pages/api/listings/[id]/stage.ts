import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'
import { executeJob } from '../../../../lib/jobs'
import { getSellingAccountCredentials } from '../../../../lib/account-client'
import { getWalmartToken } from '../../../../lib/wmt-auth'
import { WalmartApiClient } from '../../../../lib/wmt-api'

// POST — submit the item to Walmart for review (product -> 'staging').
// GET  — fetch the live Walmart item status for the product's SKU.
export default withAuth(async (req, res, auth) => {
  const supabase = createSupabaseClient()
  const id = req.query.id as string

  const { data: product } = await supabase
    .from('wmt_products')
    .select('id, sku, selling_account_id')
    .eq('id', id)
    .eq('account_id', auth.account_id)
    .single()
  if (!product) return error(res, 404, 'Product not found')

  if (req.method === 'POST') {
    const { data: job } = await supabase
      .from('wmt_listing_jobs')
      .insert({
        account_id: auth.account_id,
        selling_account_id: product.selling_account_id,
        product_id: id,
        action: 'stage',
        payload: {},
      })
      .select('id')
      .single()
    const outcome = job ? await executeJob(supabase, job.id) : { status: 'failed' as const, error: 'Job create failed' }
    return ok(res, { product_id: id, job_id: job?.id, ...outcome })
  }

  if (req.method === 'GET') {
    try {
      const credentials = await getSellingAccountCredentials(product.selling_account_id)
      const token = await getWalmartToken(product.selling_account_id, credentials)
      const status = await new WalmartApiClient(token).getItemStatus(product.sku)
      return ok(res, { sku: product.sku, walmart_status: status })
    } catch (err) {
      return error(res, 502, err instanceof Error ? err.message : 'Không lấy được trạng thái Walmart')
    }
  }

  return error(res, 405, 'Method not allowed')
})
