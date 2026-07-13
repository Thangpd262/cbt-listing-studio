import type { NextApiRequest, NextApiResponse } from 'next'

export type AuthContext = {
  account_id: string
  user_id: string
  role: 'admin' | 'operator'
  selling_account_id?: string
  tier: 'free' | 'pro' | 'enterprise'
  permissions: Array<{ selling_account_id: string; role: string }>
}

export function withAuth(
  handler: (req: NextApiRequest, res: NextApiResponse, auth: AuthContext) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
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
