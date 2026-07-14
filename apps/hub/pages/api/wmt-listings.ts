import { withAuth, ok, error, createSupabaseClient } from '@cbt/shared'

// GET /api/wmt-listings — the cached Walmart listings for the account (populated
// by list-wmt's /api/listings/sync). Returns rows + cache freshness.
export default withAuth(async (req, res, auth) => {
  if (req.method !== 'GET') return error(res, 405, 'Method not allowed')

  const supabase = createSupabaseClient()
  const { data, error: dbErr } = await supabase
    .from('wmt_listings_cache')
    .select('id, sku, wpid, title, status, price, quantity, image_url, synced_at')
    .eq('account_id', auth.account_id)
    .order('synced_at', { ascending: false })
    .limit(1000)
  if (dbErr) return error(res, 500, dbErr.message)

  const listings = data ?? []
  const lastSyncedAt = listings.reduce<string | null>(
    (max, r) => (!max || r.synced_at > max ? r.synced_at : max),
    null
  )
  return ok(res, { listings, last_synced_at: lastSyncedAt, total_count: listings.length })
})
