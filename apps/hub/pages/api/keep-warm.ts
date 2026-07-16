import type { NextApiRequest, NextApiResponse } from 'next'

// Keep-warm fan-out. A Vercel Cron (see vercel.json) pings this every 5 min.
// Invoking it warms the hub function itself; the parallel health fetches below
// warm the two other cold-start-prone services (list-amz, generator) so the
// first real user request each interval hits an already-warm lambda.
//
// Cron can only call a path on its own project, so a single endpoint that
// fans out is how we keep all three deployments warm from one cron entry.

// Production defaults; overridable via env for preview/staging deployments.
const TARGETS: Record<string, string> = {
  hub: process.env.NEXT_PUBLIC_HUB_URL || 'https://cbt-hub-tau.vercel.app',
  'list-amz': process.env.NEXT_PUBLIC_LIST_AMZ_URL || 'https://cbt-list-amz.vercel.app',
  generator: process.env.NEXT_PUBLIC_GENERATOR_URL || 'https://cbt-listing-studio-generator.vercel.app',
}

async function ping(baseUrl: string): Promise<{ ok: boolean; ms: number; status?: number; error?: string }> {
  const started = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/health`, {
      signal: controller.signal,
      // Never serve a cached response — we want to actually hit the lambda.
      cache: 'no-store',
    })
    return { ok: res.ok, ms: Date.now() - started, status: res.status }
  } catch (e) {
    return { ok: false, ms: Date.now() - started, error: e instanceof Error ? e.message : 'fetch failed' }
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

  const entries = Object.entries(TARGETS)
  const results = await Promise.all(entries.map(([, url]) => ping(url)))
  const services = entries.map(([name], i) => ({ name, ...results[i] }))
  const allOk = services.every((s) => s.ok)

  res.status(allOk ? 200 : 207).json({ status: allOk ? 'ok' : 'degraded', services })
}
