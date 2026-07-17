import { withAuth, createSupabaseClient, created, error } from '@cbt/shared'
import { runGenerationPipeline } from '../../../lib/pipeline'
import type { ImageProvider } from '../../../lib/image'

// POST — queue + run a generation job.
// Body: { listing_id, platform: 'amazon'|'walmart', provider?: 'dalle'|'imagen' }
// Vercel serverless has no true background jobs, so the pipeline runs inline
// within the 60s window and the completed result is returned in the response.
export default withAuth(async (req, res, auth) => {
  if (req.method !== 'POST') return error(res, 405, 'Method not allowed')

  const { listing_id, platform, provider } = req.body ?? {}
  if (!listing_id) return error(res, 400, 'listing_id is required')
  if (platform !== 'amazon' && platform !== 'walmart') {
    return error(res, 400, "platform phải là 'amazon' hoặc 'walmart'")
  }
  const imageProvider: ImageProvider = provider === 'imagen' ? 'imagen' : 'dalle'

  // The raw API key is needed to call the Crawl service server-to-server.
  const apiKey = req.headers['x-api-key'] as string

  const supabase = createSupabaseClient()

  // 1. Create job.
  const { data: job, error: jobError } = await supabase
    .from('gen_jobs')
    .insert({ account_id: auth.account_id, listing_id, platform, status: 'queued' })
    .select('id, account_id, listing_id, platform')
    .single()
  if (jobError || !job) return error(res, 500, jobError?.message ?? 'Không tạo được job')

  await supabase.from('gen_jobs').update({ status: 'processing' }).eq('id', job.id)

  // 2. Run pipeline inline.
  try {
    const result = await runGenerationPipeline(
      { id: job.id, account_id: job.account_id, user_id: auth.user_id, listing_id: job.listing_id, platform },
      apiKey,
      imageProvider
    )
    await supabase
      .from('gen_jobs')
      .update({ status: 'completed', result, updated_at: new Date().toISOString() })
      .eq('id', job.id)
    return created(res, { job_id: job.id, status: 'completed', result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed'
    await supabase
      .from('gen_jobs')
      .update({ status: 'failed', error: message, updated_at: new Date().toISOString() })
      .eq('id', job.id)
    return error(res, 500, message)
  }
})
