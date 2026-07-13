import type { NextApiRequest, NextApiResponse } from 'next'
import { ok, error } from '@cbt/shared'

// POST — sessions are stateless JWTs, so logout is a client-side token discard.
// Endpoint exists for API symmetry and future token-revocation lists.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return error(res, 405, 'Method not allowed')
  return ok(res, { message: 'Logged out' })
}
