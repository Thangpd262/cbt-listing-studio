import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'

// GET    — job detail.
// DELETE — remove a job record (does NOT touch the live Amazon listing).
export default withAuth(async (req, res, auth) => {
  const supabase = createSupabaseClient()
  const id = req.query.id as string

  if (req.method === 'GET') {
    const { data, error: dbError } = await supabase
      .from('amz_listing_jobs')
      .select('*')
      .eq('id', id)
      .eq('account_id', auth.account_id)
      .single()
    if (dbError || !data) return error(res, 404, 'Job not found')
    return ok(res, data)
  }

  if (req.method === 'DELETE') {
    const { data, error: dbError } = await supabase
      .from('amz_listing_jobs')
      .delete()
      .eq('id', id)
      .eq('account_id', auth.account_id)
      .select('id')
      .single()
    if (dbError || !data) return error(res, 404, 'Job not found')
    return ok(res, { id: data.id, deleted: true })
  }

  return error(res, 405, 'Method not allowed')
})
