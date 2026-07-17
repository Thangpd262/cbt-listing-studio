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
      .select('id, sku, listing_id')
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
      const payload = job.payload as ListingPayload
      if (job.payload?.config_key && job.payload?.field_values) {
        // Config-based path (create/update): build + PUT the full listing body.
        const { data: config } = await supabase
          .from('product_configs')
          .select('key, product_type, variation_theme, fields')
          .eq('key', job.payload.config_key)
          .single()
        if (!config) throw new Error(`product_config not found: ${job.payload.config_key}`)
        // Prepend the source listing's crawl images ahead of the config's default
        // set (config-builder merges them into the `images` field's other-image slots).
        let crawlImages = ''
        if (product.listing_id) {
          const { data: crawl } = await supabase
            .from('crawl_listings')
            .select('images')
            .eq('id', product.listing_id)
            .maybeSingle()
          if (Array.isArray(crawl?.images)) crawlImages = (crawl!.images as string[]).join('\n')
        }
        const fieldValues = {
          ...(job.payload.field_values as Record<string, string>),
          __crawl_images__: crawlImages,
        }
        const listingBody = buildListingBodyFromConfig(config as ProductConfig, fieldValues, marketplaceId)
        result = await client.putListing(sellerId, product.sku, listingBody)
      } else if (job.action === 'update') {
        // Edit-modal update: PATCH only the changed content fields so attributes
        // not touched here are preserved on the live listing. productType must be
        // the SP-API-confirmed value (via getListingItem).
        if (!payload.product_type) {
          throw new Error('product_type không xác định — không thể update listing này.')
        }
        const lang = 'en_US'
        const patches: object[] = []
        if (payload.title) {
          patches.push({
            op: 'replace',
            path: '/attributes/item_name',
            value: [{ value: payload.title, language_tag: lang, marketplace_id: marketplaceId }],
          })
        }
        if (payload.description) {
          patches.push({
            op: 'replace',
            path: '/attributes/product_description',
            value: [{ value: payload.description, language_tag: lang, marketplace_id: marketplaceId }],
          })
        }
        if (payload.bullet_points?.length) {
          patches.push({
            op: 'replace',
            path: '/attributes/bullet_point',
            value: payload.bullet_points.map((bp) => ({ value: bp, language_tag: lang, marketplace_id: marketplaceId })),
          })
        }
        if (payload.images?.[0]) {
          patches.push({
            op: 'replace',
            path: '/attributes/main_product_image_locator',
            value: [{ media_location: payload.images[0], marketplace_id: marketplaceId }],
          })
        }
        ;(payload.images ?? []).slice(1).forEach((url, i) => {
          patches.push({
            op: 'replace',
            path: `/attributes/other_product_image_locator_${i + 1}`,
            value: [{ media_location: url, marketplace_id: marketplaceId }],
          })
        })
        result = await client.patchListing(sellerId, product.sku, patches, payload.product_type)
      } else {
        // Non-config create → full PUT.
        if (!payload.product_type) {
          throw new Error('product_type không xác định — không thể update listing này.')
        }
        const listingBody = buildListingBody(payload, marketplaceId)
        result = await client.putListing(sellerId, product.sku, listingBody)
      }
      // SP-API returns HTTP 200 even for INVALID submissions -- surface as failure.
      // severity='WARNING' (e.g. 90000900 inapplicable attribute) means Amazon still
      // processed the listing — only treat ERROR-level issues as a hard failure.
      const spResult = result as { status?: string; issues?: { code: string; message: string; severity?: string }[] }
      const hardErrors = spResult.issues?.filter((i) => i.severity === 'ERROR' || i.severity == null && spResult.status === 'INVALID') ?? []
      if (spResult.status === 'INVALID' || hardErrors.length) {
        const msgs = hardErrors.length
          ? hardErrors.map((i) => i.code + ': ' + i.message).join(' | ')
          : 'Submission rejected by Amazon'
        throw new Error(msgs)
      }
      // Attach warnings to result so they're visible in job.result but don't block success.
      const warnings = spResult.issues?.filter((i) => i.severity !== 'ERROR') ?? []
      if (warnings.length) {
        result = { ...(result as object), warnings: warnings.map((i) => i.code + ': ' + i.message) }
      }
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
