import type { NextApiRequest, NextApiResponse } from 'next'
import { createSupabaseClient, ok, error } from '@cbt/shared'

// Daily Vercel Cron (see vercel.json). Deletes gen_assets whose expires_at has
// passed — both the storage files and the DB rows.
//
// Not withAuth: cron invocations carry no API key. When CRON_SECRET is set,
// Vercel sends `Authorization: Bearer <CRON_SECRET>`; we require it to match.

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'generated-assets'

// Public URL → object path inside the bucket, for storage.remove().
// Format: {SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}
function objectPath(publicUrl: string): string | null {
  const marker = `/object/public/${BUCKET}/`
  const i = publicUrl.indexOf(marker)
  if (i === -1) return null
  return decodeURIComponent(publicUrl.slice(i + marker.length))
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return error(res, 401, 'Unauthorized')
  }

  const supabase = createSupabaseClient()
  const nowIso = new Date().toISOString()

  // 1. Find expired assets (need storage_path of images to remove files).
  const { data: expired, error: selErr } = await supabase
    .from('gen_assets')
    .select('id, asset_type, storage_path')
    .lt('expires_at', nowIso)
  if (selErr) return error(res, 500, selErr.message)

  if (!expired || expired.length === 0) {
    return ok(res, { deleted_records: 0, deleted_files: 0 })
  }

  // 2. Remove image files from storage.
  const paths = expired
    .filter((a) => a.asset_type === 'image' && a.storage_path)
    .map((a) => objectPath(a.storage_path as string))
    .filter((p): p is string => !!p)

  let deletedFiles = 0
  if (paths.length) {
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove(paths)
    // Storage failure shouldn't block DB cleanup, but surface it.
    if (rmErr) return error(res, 500, `Storage cleanup failed: ${rmErr.message}`)
    deletedFiles = paths.length
  }

  // 3. Delete expired rows.
  const { error: delErr, count } = await supabase
    .from('gen_assets')
    .delete({ count: 'exact' })
    .lt('expires_at', nowIso)
  if (delErr) return error(res, 500, delErr.message)

  return ok(res, { deleted_records: count ?? expired.length, deleted_files: deletedFiles })
}
