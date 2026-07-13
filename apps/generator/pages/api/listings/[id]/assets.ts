import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'

// GET — all generated assets for a listing (owner-scoped).
export default withAuth(async (req, res, auth) => {
  if (req.method !== 'GET') return error(res, 405, 'Method not allowed')

  const supabase = createSupabaseClient()
  const listingId = req.query.id as string

  const { data, error: dbError } = await supabase
    .from('gen_assets')
    .select('id, job_id, asset_type, storage_path, content, variant_id, platform, created_at')
    .eq('account_id', auth.account_id)
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false })
  if (dbError) return error(res, 500, dbError.message)

  return ok(res, data)
})
