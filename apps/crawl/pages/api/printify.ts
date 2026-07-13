import type { NextApiRequest, NextApiResponse } from 'next'
import { createSupabaseClient, created, error } from '@cbt/shared'

// POST /api/printify?action=ingest
// Called by the Chrome extension with x-crawl-token = CBT API key.
// Body: array of { trend_id, image_url, title, category, source_url }

async function resolveAccount(token: string): Promise<{ account_id: string } | null> {
  const accountUrl = process.env.ACCOUNT_SERVICE_URL
  if (!accountUrl || !token) return null
  try {
    const res = await fetch(`${accountUrl}/api/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': token },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return error(res, 405, 'Method not allowed')

  const action = req.query.action as string
  if (action !== 'ingest') return error(res, 400, 'action=ingest required')

  const token = (req.headers['x-crawl-token'] ?? req.headers['x-api-key'] ?? '') as string
  const auth = await resolveAccount(token)
  if (!auth) return error(res, 401, 'Invalid crawl token')

  // Extension sends an array
  const items: Array<{ trend_id?: string; image_url?: string; title?: string; category?: string; source_url?: string }> =
    Array.isArray(req.body) ? req.body : [req.body]

  if (items.length === 0) return error(res, 400, 'Payload rỗng')

  const supabase = createSupabaseClient()
  const rows = items
    .filter((it) => it.image_url)
    .map((it) => ({
      account_id: auth.account_id,
      platform: 'printify' as const,
      source_url: it.source_url ?? null,
      title: it.title ?? it.category ?? it.trend_id ?? null,
      images: [it.image_url as string],
      tags: it.category ? [it.category] : [],
      crawl_purpose: 'normal',
      status: 'ingested' as const,
    }))

  if (rows.length === 0) return error(res, 400, 'Không có image_url hợp lệ')

  const { data, error: dbError } = await supabase
    .from('crawl_listings')
    .insert(rows)
    .select('id')

  if (dbError || !data) return error(res, 500, dbError?.message ?? 'Ingest thất bại')

  return created(res, { inserted: data.length, ids: data.map((r) => r.id) })
}
