import { withAuth, ok, error, createSupabaseClient } from '@cbt/shared'

// GET /api/amz-listings — the cached Amazon listings for the account (populated
// by list-amz's /api/listings/sync). Server-side paginated + filtered so the
// page loads one screen instead of the whole catalogue. Never calls SP-API.
//
// Query params: page, limit (0 = all), search, type (product_type), niche.
// Response data: { listings, last_synced_at, total, page, limit }.
const COLS =
  'id, marketplace_id, asin, sku, title, status, price, quantity, image_url, product_type, niche, created_at, updated_at, synced_at'

export default withAuth(async (req, res, auth) => {
  if (req.method !== 'GET') return error(res, 405, 'Method not allowed')

  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const rawLimit = parseInt(req.query.limit as string)
  const limit = Number.isFinite(rawLimit) && rawLimit >= 0 ? rawLimit : 20 // 0 = all
  const type = ((req.query.type as string) || '').trim()
  const niche = ((req.query.niche as string) || '').trim()
  // Sort: newest/oldest by first-seen (created_at); "updated" by last sync time
  // (synced_at) — the cache has no separate updated_at column.
  const sort = ((req.query.sort as string) || 'newest').trim()
  // Strip PostgREST filter metacharacters so free text can't break the .or() grammar.
  const search = ((req.query.search as string) || '').trim().replace(/[(),*]/g, ' ')

  const supabase = createSupabaseClient()

  let query = supabase
    .from('amz_listings_cache')
    .select(COLS, { count: 'exact' })
    .eq('account_id', auth.account_id)

  if (search) query = query.or(`sku.ilike.%${search}%,title.ilike.%${search}%,asin.ilike.%${search}%`)
  if (type) query = query.eq('product_type', type)
  if (niche) query = query.eq('niche', niche)

  // "updated" → last user edit (updated_at); newest/oldest → first-seen (created_at).
  // Rows never edited since the migration have a backfilled updated_at; brand-new
  // synced rows may be null, so keep nulls last for the "updated" sort.
  const orderCol = sort === 'updated' ? 'updated_at' : 'created_at'
  query = query.order(orderCol, { ascending: sort === 'oldest', nullsFirst: false })

  if (limit > 0) {
    const from = (page - 1) * limit
    query = query.range(from, from + limit - 1)
  }

  const { data, error: dbErr, count } = await query
  if (dbErr) return error(res, 500, dbErr.message)

  // Freshest sync time across the whole account (independent of the current page/filter).
  const { data: fresh } = await supabase
    .from('amz_listings_cache')
    .select('synced_at')
    .eq('account_id', auth.account_id)
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return ok(res, {
    listings: data ?? [],
    last_synced_at: fresh?.synced_at ?? null,
    total: count ?? (data ?? []).length,
    page,
    limit,
  })
})
