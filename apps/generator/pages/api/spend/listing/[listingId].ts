import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'

type LogRow = {
  step: string
  model: string
  images_requested: number
  images_received: number
  cost_usd: number
  created_at: string
}

const round = (n: number) => Number(n.toFixed(6))

// GET — AI cost + per-call breakdown for a single listing (from ai_gen_logs).
export default withAuth(async (req, res, auth) => {
  if (req.method !== 'GET') return error(res, 405, 'Method not allowed')

  const supabase = createSupabaseClient()
  const listingId = req.query.listingId as string

  const { data, error: dbError } = await supabase
    .from('ai_gen_logs')
    .select('step, model, images_requested, images_received, cost_usd, created_at')
    .eq('account_id', auth.account_id)
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false })
  if (dbError) return error(res, 500, dbError.message)

  const rows = (data ?? []) as LogRow[]
  const total = rows.reduce((sum, r) => sum + (Number(r.cost_usd) || 0), 0)
  const totalImages = rows.reduce((sum, r) => sum + (Number(r.images_received) || 0), 0)

  return ok(res, {
    listing_id: listingId,
    total_cost_usd: round(total),
    total_images: totalImages,
    breakdown: rows,
  })
})
