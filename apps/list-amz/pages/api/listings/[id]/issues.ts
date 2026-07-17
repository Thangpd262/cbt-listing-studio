import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'
import { getSellingAccountCredentials } from '../../../../lib/account-client'
import { getAccessToken } from '../../../../lib/lwa'
import { SpApiClient } from '../../../../lib/sp-api'
import { resolveOrCreateProduct } from '../../../../lib/product-resolve'

const DEFAULT_MARKETPLACE = 'ATVPDKIKX0DER' // Amazon US

// GET /api/listings/:id/issues — fetch a single listing's live SP-API issues
// (why it's inactive/hidden). Fetched on demand; the sync batch omits issues.
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
    const item = await client.getListingIssues(credentials.seller_id, sku)
    return ok(res, { issues: item.issues ?? [] })
  } catch (err) {
    return error(res, 502, err instanceof Error ? err.message : 'SP-API getListingIssues thất bại')
  }
})
