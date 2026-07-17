import { withAuth, createSupabaseClient, ok, error, getModelById } from '@cbt/shared'

type Row = {
  user_id: string
  model: string
  step: string
  total_images: number
  total_cost_usd: number
}

// Resolve the period filter to an inclusive start date (YYYY-MM-DD).
function sinceDate(period: string): string {
  const now = new Date()
  const days = period === 'today' ? 0 : period === '30d' ? 29 : period === '7d' ? 6 : 29
  now.setUTCDate(now.getUTCDate() - days)
  return now.toISOString().slice(0, 10)
}

const round = (n: number) => Number(n.toFixed(6))

// GET — AI spend summary from the user_ai_spend daily rollup.
// Query: period=today|7d|30d (default 30d), user_id=<id> (admin only).
export default withAuth(async (req, res, auth) => {
  if (req.method !== 'GET') return error(res, 405, 'Method not allowed')

  const supabase = createSupabaseClient()
  const period = (req.query.period as string) || '30d'
  const isAdmin = auth.role === 'admin'
  // Operators only ever see their own spend; admins see all (optionally filtered).
  const userFilter = isAdmin ? (req.query.user_id as string | undefined) : auth.user_id

  let query = supabase
    .from('user_ai_spend')
    .select('user_id, model, step, total_images, total_cost_usd')
    .eq('account_id', auth.account_id)
    .gte('period_date', sinceDate(period))
  if (userFilter) query = query.eq('user_id', userFilter)

  const { data, error: dbError } = await query
  if (dbError) return error(res, 500, dbError.message)

  const rows = (data ?? []) as Row[]
  const byModel: Record<string, { cost: number; images: number }> = {}
  const byStep: Record<string, number> = {}
  const byUser: Record<string, { cost: number; images: number }> = {}
  let totalCost = 0
  let totalImages = 0

  for (const r of rows) {
    const cost = Number(r.total_cost_usd) || 0
    const images = Number(r.total_images) || 0
    totalCost += cost
    totalImages += images
    byModel[r.model] = { cost: (byModel[r.model]?.cost ?? 0) + cost, images: (byModel[r.model]?.images ?? 0) + images }
    byStep[r.step] = (byStep[r.step] ?? 0) + cost
    byUser[r.user_id] = { cost: (byUser[r.user_id]?.cost ?? 0) + cost, images: (byUser[r.user_id]?.images ?? 0) + images }
  }

  // Emails for the by_user breakdown (admins only; operators see just themselves).
  const userIds = Object.keys(byUser)
  const emailById: Record<string, string> = {}
  if (userIds.length) {
    const { data: users } = await supabase.from('app_users').select('id, email').in('id', userIds)
    for (const u of users ?? []) emailById[u.id as string] = u.email as string
  }

  return ok(res, {
    period,
    total_cost_usd: round(totalCost),
    total_images: totalImages,
    by_model: Object.entries(byModel).map(([model, v]) => ({
      model,
      label: getModelById(model)?.label ?? model,
      total_cost_usd: round(v.cost),
      total_images: v.images,
    })),
    by_step: Object.entries(byStep).map(([step, cost]) => ({ step, total_cost_usd: round(cost) })),
    by_user: Object.entries(byUser).map(([user_id, v]) => ({
      user_id,
      email: emailById[user_id] ?? null,
      total_cost_usd: round(v.cost),
      total_images: v.images,
    })),
  })
})
