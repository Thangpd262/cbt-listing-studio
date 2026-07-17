import { withAuth, createSupabaseClient, paginated, error } from '@cbt/shared'

// GET — paginated ai_gen_logs for the account.
// Query: page=1, limit=20, listing_id, user_id, model.
// Operators are restricted to their own logs; admins see all (optional user_id filter).
export default withAuth(async (req, res, auth) => {
  if (req.method !== 'GET') return error(res, 405, 'Method not allowed')

  const supabase = createSupabaseClient()
  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10) || 20))
  const from = (page - 1) * limit
  const to = from + limit - 1

  const isAdmin = auth.role === 'admin'
  const userFilter = isAdmin ? (req.query.user_id as string | undefined) : auth.user_id

  let query = supabase
    .from('ai_gen_logs')
    .select('*', { count: 'exact' })
    .eq('account_id', auth.account_id)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (userFilter) query = query.eq('user_id', userFilter)
  if (req.query.listing_id) query = query.eq('listing_id', req.query.listing_id as string)
  if (req.query.model) query = query.eq('model', req.query.model as string)

  const { data, error: dbError, count } = await query
  if (dbError) return error(res, 500, dbError.message)

  return paginated(res, data ?? [], count ?? 0, page, limit)
})
