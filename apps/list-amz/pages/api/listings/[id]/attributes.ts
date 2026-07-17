import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'
import { getSellingAccountCredentials } from '../../../../lib/account-client'
import { getAccessToken } from '../../../../lib/lwa'
import { SpApiClient } from '../../../../lib/sp-api'
import { resolveOrCreateProduct } from '../../../../lib/product-resolve'

const DEFAULT_MARKETPLACE = 'ATVPDKIKX0DER' // Amazon US

// SP-API attributes → editable fields (mirrors deriveEditFields in the hub's
// amz-listings route; kept local so the two services stay decoupled).
type AttrValue = { value?: string; media_location?: string }
function deriveEditFields(attributes: Record<string, AttrValue[] | undefined>) {
  const bullet_points = (attributes.bullet_point ?? []).map((b) => b?.value ?? '').filter(Boolean)
  const description = attributes.product_description?.[0]?.value ?? null
  const imageKeys = Object.keys(attributes)
    .filter((k) => k === 'main_product_image_locator' || k.startsWith('other_product_image_locator_'))
    .sort((a, b) => (a === 'main_product_image_locator' ? -1 : b === 'main_product_image_locator' ? 1 : a.localeCompare(b)))
  const images = imageKeys.map((k) => attributes[k]?.[0]?.media_location ?? '').filter(Boolean)
  return { bullet_points, description, images }
}

// GET /api/listings/:id/attributes — fetch a single listing's live attributes
// from SP-API on demand (the sync batch omits attributes to avoid timeouts).
// :id resolves to a SKU via amz_products / the synced cache.
export default withAuth(async (req, res, auth) => {
  if (req.method !== 'GET') return error(res, 405, 'Method not allowed')

  const supabase = createSupabaseClient()
  const idParam = req.query.id as string

  const { product, error: resolveErr } = await resolveOrCreateProduct(supabase, auth.account_id, idParam)
  if (resolveErr || !product) {
    return error(res, resolveErr?.status ?? 404, resolveErr?.message ?? `Không tìm thấy listing (${idParam})`)
  }
  const sku = product.sku as string
  const sellingAccountId = product.selling_account_id as string

  const credentials = await getSellingAccountCredentials(sellingAccountId)
  if (!credentials.seller_id) return error(res, 400, 'Missing seller_id in credentials')

  const { data: cfg } = await supabase
    .from('amz_product_configs')
    .select('marketplace_id')
    .eq('selling_account_id', sellingAccountId)
    .maybeSingle()
  const marketplaceId = cfg?.marketplace_id || DEFAULT_MARKETPLACE

  const accessToken = await getAccessToken(credentials, sellingAccountId)
  const client = new SpApiClient(accessToken, marketplaceId)

  try {
    const item = await client.getListingItem(credentials.seller_id, sku)
    const attributes = (item.attributes ?? {}) as Record<string, AttrValue[] | undefined>
    // Prefer SP-API's productType over the cache copy (authoritative + correct format).
    const product_type = item.summaries?.[0]?.productType ?? null
    return ok(res, { ...deriveEditFields(attributes), attributes, product_type })
  } catch (err) {
    return error(res, 502, err instanceof Error ? err.message : 'SP-API getListingItem thất bại')
  }
})
