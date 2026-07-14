import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, ok, error, createSupabaseClient } from '@cbt/shared'

// DELETE /api/product-groups/:id  → remove one of this account's groups
export default withAuth(async (req: NextApiRequest, res: NextApiResponse, auth) => {
  if (req.method !== 'DELETE') return error(res, 405, 'Method not allowed')

  const id = req.query.id as string
  const supabase = createSupabaseClient()
  const { error: dbErr } = await supabase
    .from('product_groups')
    .delete()
    .eq('id', id)
    .eq('account_id', auth.account_id)
  if (dbErr) return error(res, 500, dbErr.message)
  return ok(res, { id, deleted: true })
})
