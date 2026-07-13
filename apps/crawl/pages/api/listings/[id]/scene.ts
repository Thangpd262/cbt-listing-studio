import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'

// GET — the scene analysis for a listing (owner-scoped). 404 if not analyzed yet.
export default withAuth(async (req, res, auth) => {
  if (req.method !== 'GET') return error(res, 405, 'Method not allowed')

  const supabase = createSupabaseClient()
  const id = req.query.id as string

  // Ownership check via the parent listing.
  const { data: listing } = await supabase
    .from('crawl_listings')
    .select('id')
    .eq('id', id)
    .eq('account_id', auth.account_id)
    .single()
  if (!listing) return error(res, 404, 'Listing not found')

  const { data: scene } = await supabase
    .from('listing_scene_analysis')
    .select('listing_id, mood, palette, objects, quote, style, niche, analyzed_at')
    .eq('listing_id', id)
    .maybeSingle()
  if (!scene) return error(res, 404, 'Chưa có scene analysis — hãy chạy /analyze trước')

  return ok(res, scene)
})
