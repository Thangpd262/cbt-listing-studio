import type { NextApiRequest, NextApiResponse } from 'next'
import { createSupabaseClient, ok, error } from '@cbt/shared'
import { objectPath, BUCKET } from '../../lib/storage'

// Daily Vercel Cron. Deletes crawl_uploaded_images rows whose expires_at has
// passed — removes both the storage file and the DB record.
// Protected by CRON_SECRET when set (Vercel sends it as Authorization: Bearer).

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return error(res, 401, 'Unauthorized')
  }

  const supabase = createSupabaseClient()
  const nowIso = new Date().toISOString()

  const { data: expired, error: selErr } = await supabase
    .from('crawl_uploaded_images')
    .select('id, storage_path')
    .lt('expires_at', nowIso)
  if (selErr) return error(res, 500, selErr.message)

  if (!expired || expired.length === 0) {
    return ok(res, { deleted_records: 0, deleted_files: 0 })
  }

  const paths = expired
    .map((r) => objectPath(r.storage_path as string))
    .filter((p): p is string => !!p)

  let deletedFiles = 0
  if (paths.length) {
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove(paths)
    if (rmErr) return error(res, 500, `Storage cleanup failed: ${rmErr.message}`)
    deletedFiles = paths.length
  }

  const { error: delErr, count } = await supabase
    .from('crawl_uploaded_images')
    .delete({ count: 'exact' })
    .lt('expires_at', nowIso)
  if (delErr) return error(res, 500, delErr.message)

  return ok(res, { deleted_records: count ?? expired.length, deleted_files: deletedFiles })
}
