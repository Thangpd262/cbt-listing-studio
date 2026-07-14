import { withAuth, ok, error, createSupabaseClient } from '@cbt/shared'

// GET /api/dashboard/metrics — real dashboard numbers for the current account,
// queried directly from Supabase with the service key (bypasses RLS).
//
// Window: last 30 days. Returns stat cards, a per-employee bar-chart dataset
// (today / 7d / 30d), and a 4-week productivity line-chart dataset.

const DAY_MS = 24 * 60 * 60 * 1000
const LINE_COLORS = ['#5b9bf5', '#35c97a', '#e89940', '#e05252', '#a06ff5', '#48c9d0']

type JobRow = {
  id: string
  action: string
  status: string
  created_at: string
  payload: { field_values?: { item_name?: string } } | null
  product: { sku: string | null } | null
  creator: { email: string | null } | null
}

// Short display name from an email (before "@"), fallback "—".
function displayName(email: string | null | undefined): string {
  if (!email) return '—'
  return email.split('@')[0]
}

export default withAuth(async (req, res, auth) => {
  if (req.method !== 'GET') return error(res, 405, 'Method not allowed')

  const supabase = createSupabaseClient()
  const now = Date.now()
  const since30 = new Date(now - 30 * DAY_MS).toISOString()

  // Jobs in the last 30 days (status + created_at + creator email via FK).
  const { data: jobsData, error: jobsErr } = await supabase
    .from('amz_listing_jobs')
    .select(
      'id, action, status, created_at, payload, product:amz_products(sku), creator:app_users!created_by(email)'
    )
    .eq('account_id', auth.account_id)
    .gte('created_at', since30)
    .order('created_at', { ascending: false })
    .limit(5000)
  if (jobsErr) return error(res, 500, jobsErr.message)
  const jobs = (jobsData ?? []) as unknown as JobRow[]

  // Active employees on this account.
  const { count: activeUsers, error: usersErr } = await supabase
    .from('app_users')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', auth.account_id)
    .eq('status', 'active')
  if (usersErr) return error(res, 500, usersErr.message)

  // --- Stat cards ---
  const totalJobs = jobs.length
  const successCount = jobs.filter((j) => j.status === 'success').length
  const failedJobs = jobs.filter((j) => j.status === 'failed').length
  const doneCount = successCount + failedJobs
  const successRate = doneCount ? Math.round((successCount / doneCount) * 100) : 0

  // --- Per-employee counts, bucketed by period (today / 7d / 30d) ---
  const cutoffs = { today: now - DAY_MS, '7d': now - 7 * DAY_MS, '30d': now - 30 * DAY_MS }
  const perUser: Record<'today' | '7d' | '30d', Record<string, number>> = {
    today: {},
    '7d': {},
    '30d': {},
  }
  for (const j of jobs) {
    const t = new Date(j.created_at).getTime()
    const name = displayName(j.creator?.email)
    for (const key of ['today', '7d', '30d'] as const) {
      if (t >= cutoffs[key]) perUser[key][name] = (perUser[key][name] ?? 0) + 1
    }
  }
  const toSorted = (m: Record<string, number>) =>
    Object.entries(m)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  const byUserByPeriod = {
    today: toSorted(perUser.today),
    '7d': toSorted(perUser['7d']),
    '30d': toSorted(perUser['30d']),
  }

  // --- 4-week productivity growth for the top employees (30d) ---
  const weekStart = (i: number) => now - (4 - i) * 7 * DAY_MS // start of week i (0..3)
  const topUsers = byUserByPeriod['30d'].slice(0, 4).map((u) => u.label)
  const weekLabels = ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4']
  const series = topUsers.map((name, idx) => {
    const points = [0, 1, 2, 3].map((w) => {
      const lo = weekStart(w)
      const hi = w === 3 ? now + 1 : weekStart(w + 1)
      return jobs.filter((j) => {
        if (displayName(j.creator?.email) !== name) return false
        const t = new Date(j.created_at).getTime()
        return t >= lo && t < hi
      }).length
    })
    return { name, color: LINE_COLORS[idx % LINE_COLORS.length], points }
  })

  // --- Recent jobs (latest 8) ---
  const recent = jobs.slice(0, 8).map((j) => ({
    sku: j.product?.sku ?? (j.payload?.field_values?.item_name?.slice(0, 20) || '—'),
    action: j.action,
    user: displayName(j.creator?.email),
    status: j.status,
    created_at: j.created_at,
  }))

  return ok(res, {
    stats: { totalJobs, successRate, successCount, doneCount, activeUsers: activeUsers ?? 0, failedJobs },
    byUserByPeriod,
    growth: { labels: weekLabels, series },
    recent,
  })
})
