import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'

// GET — job detail.
export default withAuth(async (req, res, auth) => {
  if (req.method !== 'GET') return error(res, 405, 'Method not allowed')

  const supabase = createSupabaseClient()
  const id = req.query.id as string

  const { data, error: dbError } = await supabase
    .from('wmt_listing_jobs')
    .select('*')
    .eq('id', id)
    .eq('account_id', auth.account_id)
    .single()
  if (dbError || !data) return error(res, 404, 'Job not found')
  return ok(res, data)
})
