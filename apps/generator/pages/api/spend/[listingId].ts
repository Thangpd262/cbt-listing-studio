import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'

// GET — spend records + total for a single listing.
export default withAuth(async (req, res, auth) => {
  if (req.method !== 'GET') return error(res, 405, 'Method not allowed')

  const supabase = createSupabaseClient()
  const listingId = req.query.listingId as string

  const { data, error: dbError } = await supabase
    .from('ai_spend_records')
    .select('id, job_id, step, model, input_tokens, output_tokens, cost_usd, created_at')
    .eq('account_id', auth.account_id)
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false })
  if (dbError) return error(res, 500, dbError.message)

  const total = (data ?? []).reduce((sum, r) => sum + (Number(r.cost_usd) || 0), 0)

  return ok(res, { listing_id: listingId, total_usd: Number(total.toFixed(6)), records: data ?? [] })
})
