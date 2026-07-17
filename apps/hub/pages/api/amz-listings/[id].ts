import { withAuth, ok, error, createSupabaseClient } from '@cbt/shared'

// PATCH  /api/amz-listings/[id]  { niche }  → set this listing's product group.
// DELETE /api/amz-listings/[id]             → drop the cached row.
//
// Both operate on amz_listings_cache only (account-scoped). niche is hub-owned
// and survives future syncs. DELETE removes the row from the cache view; a full
// re-sync will re-add the listing if it still exists on Amazon (not an SP-API
// takedown — that belongs to the list-amz service's delete job).
export default withAuth(async (req, res, auth) => {
  const supabase = createSupabaseClient()
  const id = req.query.id as string
  if (!id) return error(res, 400, 'id là bắt buộc')

  if (req.method === 'PATCH') {
    const { niche } = (req.body ?? {}) as { niche?: string }
    // Bump updated_at on every user edit so the "Mới update" sort reflects it.
    const { data, error: dbErr } = await supabase
      .from('amz_listings_cache')
      .update({ niche: niche?.trim() || null, updated_at: new Date().toISOString() })
      .eq('account_id', auth.account_id)
      .eq('id', id)
      .select('id, niche')
      .single()
    if (dbErr) return error(res, 500, dbErr.message)
    if (!data) return error(res, 404, 'Không tìm thấy listing')
    return ok(res, data)
  }

  if (req.method === 'DELETE') {
    const { error: dbErr } = await supabase
      .from('amz_listings_cache')
      .delete()
      .eq('account_id', auth.account_id)
      .eq('id', id)
    if (dbErr) return error(res, 500, dbErr.message)
    return ok(res, { id, deleted: true })
  }

  return error(res, 405, 'Method not allowed')
})
