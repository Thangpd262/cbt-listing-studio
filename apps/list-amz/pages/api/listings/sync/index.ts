import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'
import { syncAmazonListings } from '../../../../lib/sync'

// POST /api/listings/sync — pull all live Amazon listings (every active selling
// account) from SP-API into amz_listings_cache. Returns { synced, duration_ms }.
export default withAuth(async (req, res, auth) => {
  if (req.method !== 'POST') return error(res, 405, 'Method not allowed')

  const supabase = createSupabaseClient()
  try {
    const result = await syncAmazonListings(supabase, auth.account_id)
    return ok(res, result)
  } catch (err) {
    return error(res, 500, err instanceof Error ? err.message : 'Sync failed')
  }
})
