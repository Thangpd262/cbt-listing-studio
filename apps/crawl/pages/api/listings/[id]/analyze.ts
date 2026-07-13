import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'
import { analyzeScene } from '../../../../lib/gemini'

// POST — run LLM scene analysis for a listing (owner-scoped).
// Marks status analyzing -> analyzed (or failed), upserts scene_analysis.
export default withAuth(async (req, res, auth) => {
  if (req.method !== 'POST') return error(res, 405, 'Method not allowed')

  const supabase = createSupabaseClient()
  const id = req.query.id as string

  // 1. Load + ownership check.
  const { data: listing, error: fetchError } = await supabase
    .from('crawl_listings')
    .select('id, title, images, tags, platform, status')
    .eq('id', id)
    .eq('account_id', auth.account_id)
    .single()
  if (fetchError || !listing) return error(res, 404, 'Listing not found')
  if (listing.status === 'analyzing') return error(res, 409, 'Listing đang được phân tích')

  // 2. Mark analyzing.
  await supabase
    .from('crawl_listings')
    .update({ status: 'analyzing', updated_at: new Date().toISOString() })
    .eq('id', id)

  try {
    // 3. Call Gemini.
    const { scene, raw } = await analyzeScene({
      title: listing.title ?? '',
      images: Array.isArray(listing.images) ? (listing.images as string[]) : [],
      tags: Array.isArray(listing.tags) ? (listing.tags as string[]) : [],
      platform: listing.platform,
    })

    // 4. Upsert scene analysis.
    const analyzedAt = new Date().toISOString()
    const { error: upsertError } = await supabase.from('listing_scene_analysis').upsert(
      {
        account_id: auth.account_id,
        listing_id: id,
        mood: scene.mood,
        palette: scene.palette,
        objects: scene.objects,
        quote: scene.quote ?? null,
        style: scene.style,
        niche: scene.niche,
        raw_response: raw,
        analyzed_at: analyzedAt,
      },
      { onConflict: 'listing_id' }
    )
    if (upsertError) throw new Error(upsertError.message)

    // 5. Mark analyzed.
    await supabase
      .from('crawl_listings')
      .update({ status: 'analyzed', updated_at: analyzedAt })
      .eq('id', id)

    return ok(res, { listing_id: id, ...scene, analyzed_at: analyzedAt })
  } catch (err) {
    await supabase
      .from('crawl_listings')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', id)
    return error(res, 500, err instanceof Error ? err.message : 'Scene analysis thất bại')
  }
})
