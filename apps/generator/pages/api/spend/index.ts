import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'

type Row = { cost_usd: number; model: string; created_at: string }

// GET — spend summary for the last 30 days: total, by day, by model.
// Aggregation is done in JS (Supabase JS has no GROUP BY).
export default withAuth(async (req, res, auth) => {
  if (req.method !== 'GET') return error(res, 405, 'Method not allowed')

  const supabase = createSupabaseClient()
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error: dbError } = await supabase
    .from('ai_spend_records')
    .select('cost_usd, model, created_at')
    .eq('account_id', auth.account_id)
    .gte('created_at', since)
  if (dbError) return error(res, 500, dbError.message)

  const rows = (data ?? []) as Row[]
  const byDayMap: Record<string, number> = {}
  const byModelMap: Record<string, number> = {}
  let total = 0

  for (const r of rows) {
    const cost = Number(r.cost_usd) || 0
    total += cost
    const day = r.created_at.slice(0, 10)
    byDayMap[day] = (byDayMap[day] ?? 0) + cost
    byModelMap[r.model] = (byModelMap[r.model] ?? 0) + cost
  }

  return ok(res, {
    total_usd: Number(total.toFixed(6)),
    by_day: Object.entries(byDayMap)
      .map(([date, usd]) => ({ date, usd: Number(usd.toFixed(6)) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    by_model: Object.entries(byModelMap).map(([model, usd]) => ({ model, usd: Number(usd.toFixed(6)) })),
  })
})
