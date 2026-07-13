import type { NextApiRequest, NextApiResponse } from 'next'
import { verifyJWT } from '../lib/auth'

// Session context injected into user-facing routes (me, selling-accounts, team...).
export type AccountContext = {
  account_id: string
  user_id: string
  role: string
}

// Verify a Bearer session JWT and inject AccountContext.
// Used by every route that requires a logged-in user (not X-API-Key).
export function withSession(
  handler: (req: NextApiRequest, res: NextApiResponse, ctx: AccountContext) => Promise<void> | void
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Missing token' })
    }
    try {
      const ctx = verifyJWT(auth.slice(7))
      return await handler(req, res, ctx)
    } catch {
      return res.status(401).json({ success: false, error: 'Invalid token' })
    }
  }
}
