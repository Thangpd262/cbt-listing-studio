import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'

// GET    — listing detail + its scene analysis (if any)
// PUT    — update editable fields (currently just title)
// DELETE — remove listing (scene_analysis cascades)
export default withAuth(async (req, res, auth) => {
  const supabase = createSupabaseClient()
  const id = req.query.id as string

  if (req.method === 'PUT') {
    // Editable fields: title and/or the AI-generated image list. Both optional
    // so callers can patch just one.
    const { title, ai_images } = req.body ?? {}
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (title !== undefined) {
      if (typeof title !== 'string') return error(res, 400, 'title phải là chuỗi')
      patch.title = title
    }
    if (ai_images !== undefined) {
      if (!Array.isArray(ai_images) || ai_images.some((u) => typeof u !== 'string')) {
        return error(res, 400, 'ai_images phải là mảng URL')
      }
      patch.ai_images = ai_images
    }
    if (patch.title === undefined && patch.ai_images === undefined) {
      return error(res, 400, 'Cần title hoặc ai_images')
    }
    const { data, error: dbError } = await supabase
      .from('crawl_listings')
      .update(patch)
      .eq('id', id)
      .eq('account_id', auth.account_id)
      .select('id, title, ai_images')
      .single()
    if (dbError || !data) return error(res, 404, 'Listing not found')
    return ok(res, data)
  }

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
