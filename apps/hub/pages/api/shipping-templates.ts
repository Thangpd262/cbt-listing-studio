import type { NextApiRequest, NextApiResponse } from 'next'

// Proxy → list-amz /api/shipping-templates
// GET  ?selling_account_id=xxx  → cached list
// POST { selling_account_id, force? } → sync từ SP-API Reports
const LIST_AMZ_URL = process.env.NEXT_PUBLIC_LIST_AMZ_URL ?? ''

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (!LIST_AMZ_URL) {
    return res.status(503).json({ success: false, error: 'LIST_AMZ_URL chưa được cấu hình' })
  }

  const apiKey = req.headers['x-api-key']
  if (!apiKey) {
    return res.status(401).json({ success: false, error: 'Missing X-API-Key' })
  }

  const upstreamUrl =
    req.method === 'GET'
      ? `${LIST_AMZ_URL}/api/shipping-templates?selling_account_id=${encodeURIComponent(
          (req.query.selling_account_id as string) ?? ''
        )}`
      : `${LIST_AMZ_URL}/api/shipping-templates`

  try {
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey as string,
      },
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined,
    })
    const body = await upstream.json()
    return res.status(upstream.status).json(body)
  } catch {
    return res.status(502).json({ success: false, error: 'Không thể kết nối list-amz service' })
  }
}
