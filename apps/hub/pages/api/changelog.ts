import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'

// GET /api/changelog?limit=5 — the latest changelog entries ("Có gì mới").
// Global (not account-scoped); read state is tracked client-side via localStorage.
export default withAuth(async (req, res, _auth) => {
  if (req.method !== 'GET') return error(res, 405, 'Method not allowed')

  const limit = Math.min(10, parseInt(req.query.limit as string) || 5)
  const supabase = createSupabaseClient()

  const { data, error: dbErr } = await supabase
    .from('changelogs')
    .select('id, version, summary, published_at')
    .order('published_at', { ascending: false })
    .limit(limit)

  if (dbErr) return error(res, 500, dbErr.message)
  return ok(res, { changelogs: data ?? [] })
})
