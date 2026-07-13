// Client for the Crawl service. Crawl responses use the { success, data } envelope.

export type SceneAnalysis = {
  listing_id: string
  mood: string
  palette: string[]
  objects: string[]
  quote?: string
  style: string
  niche: string
  analyzed_at?: string
}

export type Listing = {
  id: string
  platform: string
  title: string | null
  images: string[]
  tags: string[]
}

const CRAWL_URL = process.env.CRAWL_SERVICE_URL ?? ''

async function unwrap<T>(res: Response, notFoundMsg: string): Promise<T> {
  if (!res.ok) throw new Error(notFoundMsg)
  const body = await res.json()
  if (!body?.success) throw new Error(body?.error ?? notFoundMsg)
  return body.data as T
}

export async function getSceneAnalysis(listingId: string, apiKey: string): Promise<SceneAnalysis> {
  const res = await fetch(`${CRAWL_URL}/api/listings/${listingId}/scene`, {
    headers: { 'X-API-Key': apiKey },
  })
  return unwrap<SceneAnalysis>(res, 'Scene analysis not found — run analyze first')
}

export async function getListing(listingId: string, apiKey: string): Promise<Listing> {
  const res = await fetch(`${CRAWL_URL}/api/listings/${listingId}`, {
    headers: { 'X-API-Key': apiKey },
  })
  return unwrap<Listing>(res, 'Listing not found')
}
