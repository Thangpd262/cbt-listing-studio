import { createSupabaseClient } from '@cbt/shared'

type Supabase = ReturnType<typeof createSupabaseClient>
type ProductRow = Record<string, unknown>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Resolve an amz_products row by internal id (UUID) or SKU. When the listing was
// synced from Amazon it lives only in amz_listings_cache (there is no amz_products
// row yet) — in that case hydrate a matching amz_products row from the cache so
// edits have something to update. Returns the row, or a { status, message } error.
export async function resolveOrCreateProduct(
  supabase: Supabase,
  accountId: string,
  idParam: string
): Promise<{ product?: ProductRow; error?: { status: number; message: string } }> {
  const byUuid = UUID_RE.test(idParam)

  const lookup = supabase.from('amz_products').select('*').eq('account_id', accountId)
  const { data: existing } = await (byUuid ? lookup.eq('id', idParam) : lookup.eq('sku', idParam)).maybeSingle()
  if (existing) return { product: existing as ProductRow }

  // Fall back to the synced cache. A cache UUID matches the cache row id; a
  // non-UUID param matches the SKU.
  const cacheQ = supabase
    .from('amz_listings_cache')
    .select('asin, sku, title, product_type, price, quantity, raw, marketplace_id')
    .eq('account_id', accountId)
  const { data: cached } = await (byUuid ? cacheQ.eq('id', idParam) : cacheQ.eq('sku', idParam)).maybeSingle()
  if (!cached) return { error: { status: 404, message: `Không tìm thấy listing (${idParam})` } }
  if (!cached.sku) {
    return { error: { status: 400, message: `Listing (${cached.asin}) chưa có SKU — không thể sửa.` } }
  }

  // The cache carries no selling account; use the account's active Amazon one.
  const { data: sellingAcct } = await supabase
    .from('selling_accounts')
    .select('id')
    .eq('account_id', accountId)
    .eq('platform', 'amazon')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  if (!sellingAcct) {
    return { error: { status: 400, message: 'Không tìm thấy selling account Amazon đang hoạt động' } }
  }

  const attributes = (cached.raw as { attributes?: Record<string, unknown> })?.attributes ?? {}
  const { data: created, error: insErr } = await supabase
    .from('amz_products')
    .insert({
      account_id: accountId,
      selling_account_id: sellingAcct.id,
      sku: cached.sku,
      asin: cached.asin || null,
      title: cached.title || cached.sku, // title is NOT NULL — fall back to SKU
      product_type: cached.product_type,
      price: cached.price,
      quantity: cached.quantity ?? 0,
      bullet_points: [],
      images: [],
      attributes,
      status: 'active',
    })
    .select('*')
    .single()
  if (insErr || !created) {
    return { error: { status: 500, message: insErr?.message ?? 'Không thể tạo product từ cache' } }
  }
  return { product: created as ProductRow }
}
