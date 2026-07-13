import jwt from 'jsonwebtoken'
import crypto from 'crypto'

const JWT_SECRET = process.env.JWT_SECRET

function secret(): string {
  if (!JWT_SECRET) throw new Error('Missing JWT_SECRET')
  return JWT_SECRET
}

// Session payload carried inside the login JWT (Bearer token for user routes).
export type SessionPayload = {
  account_id: string
  user_id: string
  role: string
}

// Sign a 7-day session JWT for login/me.
export function signJWT(payload: SessionPayload): string {
  return jwt.sign(payload, secret(), { expiresIn: '7d' })
}

export function verifyJWT(token: string): SessionPayload {
  return jwt.verify(token, secret()) as SessionPayload
}

// API key: random 32 bytes -> "cbt_" + hex. Stored only as a SHA-256 hash.
// The raw key is shown to the caller once and never persisted.
export function generateApiKey(): { key: string; hash: string } {
  const key = 'cbt_' + crypto.randomBytes(32).toString('hex')
  const hash = hashApiKey(key)
  return { key, hash }
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}
