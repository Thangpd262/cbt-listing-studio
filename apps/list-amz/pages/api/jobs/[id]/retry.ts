import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'
import { executeJob } from '../../../../lib/jobs'

// POST — re-execute a failed job (owner-scoped).
export default withAuth(async (req, res, auth) => {
  if (req.method !== 'POST') return error(res, 405, 'Method not allowed')

  const supabase = createSupabaseClient()
  const id = req.query.id as string

  const { data: job } = await supabase
    .from('amz_listing_jobs')
    .select('id, status')
    .eq('id', id)
    .eq('account_id', auth.account_id)
    .single()
  if (!job) return error(res, 404, 'Job not found')
  if (job.status === 'processing') return error(res, 409, 'Job đang chạy')

  const outcome = await executeJob(supabase, id)
  return ok(res, { job_id: id, ...outcome })
})
