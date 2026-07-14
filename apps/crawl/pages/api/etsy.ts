import type { NextApiRequest, NextApiResponse } from 'next'
import { createSupabaseClient, created, error } from '@cbt/shared'

// POST /api/etsy?action=ingest
// Called by the Chrome extension with x-crawl-token = CBT API key.
// Accepts Etsy OR AliExpress payload (auto-detected by payload shape).

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
  // CORS: the browser extension calls this cross-origin from etsy.com /
  // aliexpress.com. The x-crawl-token header forces a preflight, and this
  // route doesn't use withAuth — so set the headers + answer OPTIONS here.
  const origin = (req.headers.origin as string) || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-crawl-token, X-API-Key')
  res.setHeader('Access-Control-Max-Age', '86400')
  if (req.method === 'OPTIONS') return res.status(204).end()

  if (req.method !== 'POST') return error(res, 405, 'Method not allowed')

  const action = req.query.action as string
  if (action !== 'ingest') return error(res, 400, 'action=ingest required')

  // Accept x-crawl-token (extension) or x-api-key (direct)
  const token = (req.headers['x-crawl-token'] ?? req.headers['x-api-key'] ?? '') as string
  const auth = await resolveAccount(token)
  if (!auth) return error(res, 401, 'Invalid crawl token')

  const body = req.body ?? {}
  const {
    url, title, images, price, tags, description, shop_name,
    etsy_listing_id, aliexpress_product_id, source,
    crawl_purpose,
  } = body

  // Detect platform
  const platform: string = aliexpress_product_id || source === 'aliexpress'
    ? 'aliexpress'
    : 'etsy'

  if (!Array.isArray(images) || images.length === 0) {
    return error(res, 400, 'images phải có tối thiểu 1 URL')
  }

  // Parse price string → number
  let priceNum: number | null = null
  if (price != null) {
    const n = parseFloat(String(price).replace(/[^0-9.]/g, ''))
    if (!isNaN(n)) priceNum = n
  }

  const supabase = createSupabaseClient()
  const { data, error: dbError } = await supabase
    .from('crawl_listings')
    .insert({
      account_id: auth.account_id,
      platform,
      source_url: url ?? null,
      title: title ?? null,
      description: description ?? null,
      shop_name: shop_name ?? null,
      images: images.slice(0, 12),
      price: priceNum,
      tags: Array.isArray(tags) ? tags.slice(0, 20) : [],
      crawl_purpose: crawl_purpose === 'tm' ? 'tm' : 'normal',
      status: 'ingested',
    })
    .select('id')
    .single()

  if (dbError || !data) return error(res, 500, dbError?.message ?? 'Ingest thất bại')

  return created(res, {
    listing_id: data.id,
    platform,
    status: 'ingested',
    image_count: images.length,
  })
}
