import { createSupabaseClient } from '@cbt/shared'
import { getSellingAccountCredentials } from './account-client'
import { getAccessToken } from './lwa'
import { SpApiClient, buildListingBody, buildPriceQtyPatches, type ListingPayload } from './sp-api'
import { buildListingBodyFromConfig, type ProductConfig } from './config-builder'

type Supabase = ReturnType<typeof createSupabaseClient>

const DEFAULT_MARKETPLACE = 'ATVPDKIKX0DER' // Amazon US

// Resolve the marketplace for a selling account (config override or US default).
async function getMarketplaceId(supabase: Supabase, sellingAccountId: string): Promise<string> {
  const { data } = await supabase
    .from('amz_product_configs')
    .select('marketplace_id')
    .eq('selling_account_id', sellingAccountId)
    .maybeSingle()
  return data?.marketplace_id || DEFAULT_MARKETPLACE
}

// Execute a listing job against SP-API and record the outcome on the job +
// product rows. Never throws — failures are captured on the job.
export async function executeJob(supabase: Supabase, jobId: string) {
  const { data: job } = await supabase.from('amz_listing_jobs').select('*').eq('id', jobId).single()
  if (!job) throw new Error('Job not found')

  await supabase.from('amz_listing_jobs').update({ status: 'processing', updated_at: new Date().toISOString() }).eq('id', jobId)

  try {
    const { data: product } = await supabase
      .from('amz_products')
      .select('id, sku')
      .eq('id', job.product_id)
      .single()
    if (!product) throw new Error('Product not found')

    const credentials = await getSellingAccountCredentials(job.selling_account_id)
    if (!credentials.seller_id) throw new Error('Missing seller_id in credentials')

    const accessToken = await getAccessToken(credentials, job.selling_account_id)
    const marketplaceId = await getMarketplaceId(supabase, job.selling_account_id)
    const client = new SpApiClient(accessToken, marketplaceId)
    const sellerId = credentials.seller_id

    let result: unknown
    if (job.action === 'create' || job.action === 'update') {
      // Config-based path: payload has config_key + field_values
      let listingBody: object
      if (job.payload?.config_key && job.payload?.field_values) {
        const { data: config } = await supabase
          .from('product_configs')
          .select('key, product_type, variation_theme, fields')
          .eq('key', job.payload.config_key)
          .single()
        if (!config) throw new Error(`product_config not found: ${job.payload.config_key}`)
        listingBody = buildListingBodyFromConfig(config as ProductConfig, job.payload.field_values as Record<string, string>, marketplaceId)
      } else {
        listingBody = buildListingBody(job.payload as ListingPayload, marketplaceId)
      }
      result = await client.putListing(sellerId, product.sku, listingBody)
    } else if (job.action === 'delete') {
      result = await client.deleteListing(sellerId, product.sku)
    } else if (job.action === 'price_qty') {
      result = await client.patchListing(sellerId, product.sku, buildPriceQtyPatches(job.payload, marketplaceId))
    } else {
      throw new Error(`Unknown action: ${job.action}`)
    }

    await supabase
      .from('amz_listing_jobs')
      .update({ status: 'success', result, updated_at: new Date().toISOString() })
      .eq('id', jobId)

    // Reflect the action on the product row.
    const productStatus = job.action === 'delete' ? 'deleted' : 'active'
    const asin = (result as { asin?: string })?.asin
    await supabase
      .from('amz_products')
      .update({ status: productStatus, ...(asin ? { asin } : {}), updated_at: new Date().toISOString() })
      .eq('id', job.product_id)

    return { status: 'success' as const, result }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Job failed'
    await supabase
      .from('amz_listing_jobs')
      .update({ status: 'failed', error: message, retry_count: (job.retry_count ?? 0) + 1, updated_at: new Date().toISOString() })
      .eq('id', jobId)
    return { status: 'failed' as const, error: message }
  }
}
