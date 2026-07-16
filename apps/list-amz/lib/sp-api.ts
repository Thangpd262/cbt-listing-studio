// Minimal Amazon SP-API (Listings Items 2021-08-01) client + body builders.

const SP_API_BASE = process.env.SP_API_BASE || 'https://sellingpartnerapi-na.amazon.com'

export type ListingPayload = {
  title: string
  description?: string
  bullet_points?: string[]
  images?: string[]
  price?: number
  quantity?: number
  product_type?: string
  attributes?: Record<string, unknown>
}

// Shape of the searchListingsItems response we consume (partial).
export type SearchListingsItem = {
  sku?: string
  summaries?: Array<{
    asin?: string
    itemName?: string
    productType?: string
    status?: string[] | string
    createdDate?: string // ISO 8601 — when the listing was created on Amazon
    mainImage?: { link?: string }
  }>
  offers?: Array<{ price?: { amount?: number } }>
  fulfillmentAvailability?: Array<{ quantity?: number }>
}
export type SearchListingsResponse = {
  numberOfResults?: number
  pagination?: { nextToken?: string }
  items?: SearchListingsItem[]
}

export class SpApiClient {
  constructor(private accessToken: string, private marketplaceId: string) {}

  putListing(sellerId: string, sku: string, body: object) {
    return this.request('PUT', this.itemPath(sellerId, sku), body)
  }

  deleteListing(sellerId: string, sku: string) {
    return this.request('DELETE', this.itemPath(sellerId, sku))
  }

  patchListing(sellerId: string, sku: string, patches: object[]) {
    return this.request('PATCH', this.itemPath(sellerId, sku), { productType: 'PRODUCT', patches })
  }

  // searchListingsItems — all listings for a seller in this marketplace, one
  // page (max pageSize 20). Paginate via the returned pagination.nextToken.
  searchListings(sellerId: string, pageToken?: string) {
    const params = new URLSearchParams({
      marketplaceIds: this.marketplaceId,
      includedData: 'summaries,offers,fulfillmentAvailability',
      pageSize: '20',
    })
    if (pageToken) params.set('pageToken', pageToken)
    return this.request('GET', `/listings/2021-08-01/items/${sellerId}?${params}`) as Promise<SearchListingsResponse>
  }

  private itemPath(sellerId: string, sku: string) {
    return `/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(sku)}?marketplaceIds=${this.marketplaceId}`
  }

  private async request(method: string, path: string, body?: object) {
    const res = await fetch(SP_API_BASE + path, {
      method,
      headers: {
        'x-amz-access-token': this.accessToken,
        'Content-Type': 'application/json',
        'User-Agent': 'CBT-Listing-Studio/1.0 (Language=TypeScript)',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`SP-API error (${res.status}): ${text}`)
    return text ? JSON.parse(text) : {}
  }
}

// Build a Listings Items PUT body from our product payload.
export function buildListingBody(payload: ListingPayload, marketplaceId: string) {
  const attr = (value: string) => [{ value, language_tag: 'en_US', marketplace_id: marketplaceId }]

  const attributes: Record<string, unknown> = {
    item_name: attr(payload.title),
    ...(payload.description ? { product_description: attr(payload.description) } : {}),
    ...(payload.bullet_points?.length
      ? { bullet_point: payload.bullet_points.map((bp) => ({ value: bp, language_tag: 'en_US', marketplace_id: marketplaceId })) }
      : {}),
    ...(payload.images?.[0]
      ? { main_product_image_locator: [{ media_location: payload.images[0], marketplace_id: marketplaceId }] }
      : {}),
    ...(payload.price != null
      ? { list_price: [{ value: payload.price, currency: 'USD', marketplace_id: marketplaceId }] }
      : {}),
    ...(payload.quantity != null
      ? {
          fulfillment_availability: [
            { fulfillment_channel_code: 'DEFAULT', quantity: payload.quantity, marketplace_id: marketplaceId },
          ],
        }
      : {}),
    ...(payload.attributes ?? {}),
  }

  // Extra image slots (other_product_image_locator_1..N).
  ;(payload.images ?? []).slice(1, 9).forEach((url, i) => {
    attributes[`other_product_image_locator_${i + 1}`] = [{ media_location: url, marketplace_id: marketplaceId }]
  })

  return { productType: payload.product_type || 'PRODUCT', requirements: 'LISTING', attributes }
}

// PATCH patches for a price / quantity bulk update.
export function buildPriceQtyPatches(
  payload: { price?: number; quantity?: number },
  marketplaceId: string
): object[] {
  const patches: object[] = []
  if (payload.price != null) {
    patches.push({
      op: 'replace',
      path: '/attributes/list_price',
      value: [{ value: payload.price, currency: 'USD', marketplace_id: marketplaceId }],
    })
  }
  if (payload.quantity != null) {
    patches.push({
      op: 'replace',
      path: '/attributes/fulfillment_availability',
      value: [{ fulfillment_channel_code: 'DEFAULT', quantity: payload.quantity, marketplace_id: marketplaceId }],
    })
  }
  return patches
}
