import type { NextApiRequest, NextApiResponse } from 'next'

export type AuthContext = {
  account_id: string
  user_id: string
  role: 'admin' | 'operator'
  selling_account_id?: string
  tier: 'free' | 'pro' | 'enterprise'
  permissions: Array<{ selling_account_id: string; role: string }>
}

// Allow browser calls from the hub (and other origins). Auth is via the
// X-API-Key header (not cookies), so reflecting the origin is safe and we
// don't set Allow-Credentials. Reflecting (vs '*') keeps it future-proof.
function setCorsHeaders(req: NextApiRequest, res: NextApiResponse) {
  const origin = (req.headers.origin as string) || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization, x-crawl-token')
  res.setHeader('Access-Control-Max-Age', '86400')
}

export function withAuth(
  handler: (req: NextApiRequest, res: NextApiResponse, auth: AuthContext) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    setCorsHeaders(req, res)

    // Handle CORS preflight — must return 2xx before auth check.
    if (req.method === 'OPTIONS') {
      res.status(204).end()
      return
    }

    const apiKey = req.headers['x-api-key'] as string

    if (!apiKey) {
      return res.status(401).json({ success: false, error: 'Missing X-API-Key header' })
    }

    const accountServiceUrl = process.env.ACCOUNT_SERVICE_URL
    if (!accountServiceUrl) {
      return res.status(500).json({ success: false, error: 'ACCOUNT_SERVICE_URL not configured' })
    }

    try {
      const response = await fetch(`${accountServiceUrl}/api/auth/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
      })

      if (!response.ok) {
        return res.status(401).json({ success: false, error: 'Invalid or expired API key' })
      }

      const auth: AuthContext = await response.json()
      return handler(req, res, auth)
    } catch (err) {
      return res.status(503).json({ success: false, error: 'Account service unavailable' })
    }
  }
}
