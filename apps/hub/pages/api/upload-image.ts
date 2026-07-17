import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, ok, error, createSupabaseClient } from '@cbt/shared'
import { uploadToStorage } from '../../lib/storage'

// POST /api/upload-image
// Body: { base64: string, listing_id: string }
// Returns: { url: string }
//
// Accepts a base64-encoded image from the browser, uploads it to Supabase
// Storage, records it in crawl_uploaded_images (expires in 21 days), and
// returns the public URL.

export const config = { api: { bodyParser: { sizeLimit: '15mb' } } }

export default withAuth(async (req: NextApiRequest, res: NextApiResponse, auth) => {
  if (req.method !== 'POST') return error(res, 405, 'Method not allowed')

  const { base64, listing_id } = (req.body ?? {}) as { base64?: string; listing_id?: string }
  if (!base64 || typeof base64 !== 'string') return error(res, 400, 'base64 là bắt buộc')
  if (!listing_id || typeof listing_id !== 'string') return error(res, 400, 'listing_id là bắt buộc')

  // Verify listing belongs to this account.
  const supabase = createSupabaseClient()
  const { data: listing } = await supabase
    .from('crawl_listings')
    .select('id')
    .eq('id', listing_id)
    .eq('account_id', auth.account_id)
    .maybeSingle()
  if (!listing) return error(res, 404, 'Listing không tồn tại')

  // Decode base64 → Buffer and upload.
  let buffer: Buffer
  try {
    buffer = Buffer.from(base64, 'base64')
  } catch {
    return error(res, 400, 'base64 không hợp lệ')
  }

  const uid = Math.random().toString(36).slice(2, 10)
  const path = `crawl-uploads/${auth.account_id}/${listing_id}/${Date.now()}-${uid}`

  let url: string
  try {
    url = await uploadToStorage(buffer, path)
  } catch (e) {
    return error(res, 500, e instanceof Error ? e.message : 'Upload thất bại')
  }

  // Track the file so the cleanup cron can delete it after 21 days.
  await supabase
    .from('crawl_uploaded_images')
    .insert({ account_id: auth.account_id, listing_id, storage_path: url })

  return ok(res, { url })
})
