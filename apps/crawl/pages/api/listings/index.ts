import { withAuth, createSupabaseClient, created, error, paginated, PLATFORMS } from '@cbt/shared'

// GET  — paginated list of the account's crawled listings
// POST — ingest a raw listing from the browser extension / manual capture
export default withAuth(async (req, res, auth) => {
  const supabase = createSupabaseClient()

  if (req.method === 'GET') {
    const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? '20', 10) || 20))
    const from = (page - 1) * limit

    let query = supabase
      .from('crawl_listings')
      .select('*', { count: 'exact' })
      .eq('account_id', auth.account_id)
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1)

    if (req.query.platform) query = query.eq('platform', req.query.platform as string)
    if (req.query.status) query = query.eq('status', req.query.status as string)

    const { data, error: dbError, count } = await query
    if (dbError) return error(res, 500, dbError.message)
    return paginated(res, data, count ?? 0, page, limit)
  }

  if (req.method === 'POST') {
    const { platform, url, title, images, price, tags, raw_html } = req.body ?? {}
    if (!platform || !PLATFORMS.includes(platform)) {
      return error(res, 400, `platform phải là một trong: ${PLATFORMS.join(', ')}`)
    }
    if (!Array.isArray(images) || images.length === 0) {
      return error(res, 400, 'images phải có tối thiểu 1 URL')
    }

    const { data, error: dbError } = await supabase
      .from('crawl_listings')
      .insert({
        account_id: auth.account_id,
        platform,
        source_url: url ?? null,
        title: title ?? null,
        images,
        price: price ?? null,
        tags: Array.isArray(tags) ? tags : [],
        raw_html: raw_html ?? null,
        status: 'ingested',
      })
      .select('id')
      .single()
    if (dbError || !data) return error(res, 500, dbError?.message ?? 'Ingest thất bại')

    return created(res, { listing_id: data.id, status: 'ingested' })
  }

  return error(res, 405, 'Method not allowed')
})
