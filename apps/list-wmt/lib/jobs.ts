import { createSupabaseClient } from '@cbt/shared'
import { getSellingAccountCredentials } from './account-client'
import { getWalmartToken } from './wmt-auth'
import { WalmartApiClient, buildWalmartItemPayload, type WmtProduct } from './wmt-api'

type Supabase = ReturnType<typeof createSupabaseClient>

// Product status to set after a successful job, by action. Unlisted actions
// (create, update, price_qty) leave the product status unchanged.
const STATUS_BY_ACTION: Record<string, string> = {
  stage: 'staging',
  publish: 'published',
  delete: 'deleted',
}

async function getDefaultShippingNode(supabase: Supabase, sellingAccountId: string): Promise<string | undefined> {
  const { data } = await supabase
    .from('wmt_product_configs')
    .select('default_shipping_node')
    .eq('selling_account_id', sellingAccountId)
    .maybeSingle()
  return data?.default_shipping_node ?? undefined
}

// Execute a Walmart listing job and record the outcome on the job + product.
// Never throws — failures are captured on the job.
export async function executeJob(supabase: Supabase, jobId: string) {
  const { data: job } = await supabase.from('wmt_listing_jobs').select('*').eq('id', jobId).single()
  if (!job) throw new Error('Job not found')

  await supabase.from('wmt_listing_jobs').update({ status: 'processing', updated_at: new Date().toISOString() }).eq('id', jobId)

  try {
    const { data: product } = await supabase.from('wmt_products').select('*').eq('id', job.product_id).single()
    if (!product) throw new Error('Product not found')

    const credentials = await getSellingAccountCredentials(job.selling_account_id)
    const token = await getWalmartToken(job.selling_account_id, credentials)
    const client = new WalmartApiClient(token)

    let result: unknown
    if (['create', 'update', 'stage', 'publish'].includes(job.action)) {
      const shippingNode = product.shipping_node || (await getDefaultShippingNode(supabase, job.selling_account_id))
      const payload = buildWalmartItemPayload({ ...(product as WmtProduct), shipping_node: shippingNode })
      result = await client.submitItem(payload)
    } else if (job.action === 'delete') {
      result = await client.retireItem(product.sku)
    } else if (job.action === 'price_qty') {
      const out: unknown[] = []
      if (job.payload?.price != null) out.push(await client.updatePrice(product.sku, job.payload.price))
      if (job.payload?.quantity != null) out.push(await client.updateInventory(product.sku, job.payload.quantity))
      result = out
    } else {
      throw new Error(`Unknown action: ${job.action}`)
    }

    await supabase
      .from('wmt_listing_jobs')
      .update({ status: 'success', result, updated_at: new Date().toISOString() })
      .eq('id', jobId)

    const nextStatus = STATUS_BY_ACTION[job.action]
    const walmartItemId = (result as { itemId?: string; feedId?: string })?.itemId
    if (nextStatus || walmartItemId) {
      await supabase
        .from('wmt_products')
        .update({
          ...(nextStatus ? { status: nextStatus } : {}),
          ...(walmartItemId ? { walmart_item_id: walmartItemId } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.product_id)
    }

    return { status: 'success' as const, result }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Job failed'
    await supabase
      .from('wmt_listing_jobs')
      .update({ status: 'failed', error: message, retry_count: (job.retry_count ?? 0) + 1, updated_at: new Date().toISOString() })
      .eq('id', jobId)
    return { status: 'failed' as const, error: message }
  }
}
