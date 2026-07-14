import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'

// GET /api/listings/sync/status — cache freshness: newest synced_at + row count.
export default withAuth(async (req, res, auth) => {
  if (req.method !== 'GET') return error(res, 405, 'Method not allowed')

  const supabase = createSupabaseClient()

  const { count, error: countErr } = await supabase
    .from('amz_listings_cache')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', auth.account_id)
  if (countErr) return error(res, 500, countErr.message)

  const { data: latest, error: latestErr } = await supabase
    .from('amz_listings_cache')
    .select('synced_at')
    .eq('account_id', auth.account_id)
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (latestErr) return error(res, 500, latestErr.message)

  return ok(res, { last_synced_at: latest?.synced_at ?? null, total_count: count ?? 0 })
})
