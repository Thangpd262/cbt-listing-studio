import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Adds CORS headers to every /api/* response so the Hub (a different origin)
// can call the Account API directly from the browser. Preflight OPTIONS
// requests are answered here with 204.
const ALLOW_ORIGIN = process.env.NEXT_PUBLIC_HUB_URL || '*'
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': ALLOW_ORIGIN,
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-Internal-Secret',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
}

export function middleware(req: NextRequest) {
  // Preflight: short-circuit with the CORS headers.
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
  }

  const res = NextResponse.next()
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.headers.set(key, value)
  }
  return res
}

export const config = {
  matcher: '/api/:path*',
}
