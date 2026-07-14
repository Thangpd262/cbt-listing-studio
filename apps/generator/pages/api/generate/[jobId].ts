import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'

// GET — poll a job's status + result + its generated assets.
export default withAuth(async (req, res, auth) => {
  if (req.method !== 'GET') return error(res, 405, 'Method not allowed')

  const supabase = createSupabaseClient()
  const jobId = req.query.jobId as string

  const { data: job, error: jobError } = await supabase
    .from('gen_jobs')
    .select('id, listing_id, platform, status, result, error, created_at, updated_at')
    .eq('id', jobId)
    .eq('account_id', auth.account_id)
    .single()
  if (jobError || !job) return error(res, 404, 'Job not found')

  const { data: assets } = await supabase
    .from('gen_assets')
    .select('id, asset_type, storage_path, content, variant_id, platform, expires_at')
    .eq('job_id', jobId)

  return ok(res, { job_id: job.id, ...job, assets: assets ?? [] })
})
