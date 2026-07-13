import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'

// GET    — listing detail + its scene analysis (if any)
// DELETE — remove listing (scene_analysis cascades)
export default withAuth(async (req, res, auth) => {
  const supabase = createSupabaseClient()
  const id = req.query.id as string

  if (req.method === 'GET') {
    const { data: listing, error: dbError } = await supabase
      .from('crawl_listings')
      .select('*')
      .eq('id', id)
      .eq('account_id', auth.account_id)
      .single()
    if (dbError || !listing) return error(res, 404, 'Listing not found')

    const { data: scene } = await supabase
      .from('listing_scene_analysis')
      .select('*')
      .eq('listing_id', id)
      .maybeSingle()

    return ok(res, { ...listing, scene_analysis: scene ?? null })
  }

  if (req.method === 'DELETE') {
    const { data, error: dbError } = await supabase
      .from('crawl_listings')
      .delete()
      .eq('id', id)
      .eq('account_id', auth.account_id)
      .select('id')
      .single()
    if (dbError || !data) return error(res, 404, 'Listing not found')
    return ok(res, { id: data.id, deleted: true })
  }

  return error(res, 405, 'Method not allowed')
})
