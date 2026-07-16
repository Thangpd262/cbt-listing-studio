import type { NextApiRequest, NextApiResponse } from 'next'

// Keep-warm fan-out. A Vercel Cron (see vercel.json) pings this every 5 min.
// Invoking it warms the hub lambda; the parallel fetches below warm the other
// cold-start-prone services so the first real user request each interval hits
// an already-warm lambda.
//
// The list-amz /api/jobs ping additionally exercises the slowest DB query path
// (keeps the pooled connection + query plan warm). That route is behind
// withAuth, so it only reaches the query when KEEP_WARM_API_KEY is set; without
// a key it 401s and just the lambda is warmed.
//
// Cron can only call a path on its own project, so one fan-out endpoint keeps
// every deployment warm from a single cron entry.

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL || 'https://cbt-hub-tau.vercel.app'
const LIST_AMZ_URL = process.env.NEXT_PUBLIC_LIST_AMZ_URL || 'https://cbt-list-amz.vercel.app'
const GENERATOR_URL = process.env.NEXT_PUBLIC_GENERATOR_URL || 'https://cbt-listing-studio-generator.vercel.app'
const KEEP_WARM_API_KEY = process.env.KEEP_WARM_API_KEY

const trim = (u: string) => u.replace(/\/$/, '')

type Check = { name: string; url: string; headers?: Record<string, string> }

const CHECKS: Check[] = [
  { name: 'hub', url: `${trim(HUB_URL)}/api/health` },
  { name: 'list-amz', url: `${trim(LIST_AMZ_URL)}/api/health` },
  { name: 'generator', url: `${trim(GENERATOR_URL)}/api/health` },
  // Warm the list-amz jobs query (DB path), authenticated when a key is present.
  {
    name: 'list-amz-jobs',
    url: `${trim(LIST_AMZ_URL)}/api/jobs?limit=1`,
    headers: KEEP_WARM_API_KEY ? { 'X-API-Key': KEEP_WARM_API_KEY } : undefined,
  },
]

async function ping(check: Check): Promise<{ name: string; ok: boolean; ms: number; status?: number; error?: string }> {
  const started = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(check.url, {
      signal: controller.signal,
      headers: check.headers,
      // Never serve a cached response — we want to actually hit the lambda.
      cache: 'no-store',
    })
    // <500 means the lambda responded (a 401 still means it's warm); 5xx is a
    // real problem worth flagging.
    return { name: check.name, ok: res.status < 500, ms: Date.now() - started, status: res.status }
  } catch (e) {
    return { name: check.name, ok: false, ms: Date.now() - started, error: e instanceof Error ? e.message : 'fetch failed' }
  } finally {
    clearTimeout(timeout)
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // If a cron secret is configured, require it (Vercel Cron sends it as a
  // Bearer token). Without a secret set, the endpoint stays open — pinging
  // public health routes is harmless.
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ status: 'unauthorized' })
  }

  const services = await Promise.all(CHECKS.map(ping))
  const allOk = services.every((s) => s.ok)

  res.status(allOk ? 200 : 207).json({ status: allOk ? 'ok' : 'degraded', services })
}
