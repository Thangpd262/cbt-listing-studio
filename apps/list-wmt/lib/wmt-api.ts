import { randomUUID } from 'crypto'

const WMT_BASE = process.env.WMT_API_BASE || 'https://marketplace.walmartapis.com/v3'

export type WmtVariant = {
  variant_id: string
  color?: string
  price?: number
  quantity?: number
  images?: string[]
}

export type WmtProduct = {
  sku: string
  title: string
  description?: string
  variants: WmtVariant[]
  attributes?: Record<string, unknown>
  shipping_node?: string
}

// Shape of the getAllItems response we consume (partial).
export type WmtItem = {
  sku?: string
  wpid?: string
  productName?: string
  publishedStatus?: string
  lifecycleStatus?: string
  price?: { amount?: number }
  primaryImageUrl?: string
}
export type GetAllItemsResponse = {
  ItemResponse?: WmtItem[]
  nextCursor?: string
  totalItems?: number
}

export class WalmartApiClient {
  constructor(private token: string) {}

  private headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      'WM_SEC.ACCESS_TOKEN': this.token,
      'WM_SVC.NAME': 'CBT Listing Studio',
      'WM_QOS.CORRELATION_ID': randomUUID(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
  }

  submitItem(itemPayload: object) {
    return this.request('POST', '/items', itemPayload)
  }

  getItemStatus(sku: string) {
    return this.request('GET', `/items/${encodeURIComponent(sku)}`)
  }

  // getAllItems — one page of the seller's items. Paginate via the returned
  // nextCursor (start with '*'). Walmart may return nextCursor as an opaque
  // token or as a full query fragment beginning with '?'; support both.
  getAllItems(nextCursor?: string) {
    const path = nextCursor?.startsWith('?')
      ? `/items${nextCursor}`
      : `/items?${new URLSearchParams({ limit: '50', nextCursor: nextCursor ?? '*' })}`
    return this.request('GET', path) as Promise<GetAllItemsResponse>
  }

  retireItem(sku: string) {
    return this.request('DELETE', `/items/${encodeURIComponent(sku)}`)
  }

  // Direct per-SKU price + inventory updates (simpler than Walmart feeds; no
  // feed-status polling required for a single item).
  updatePrice(sku: string, price: number) {
    return this.request('PUT', '/price', {
      sku,
      pricing: [{ currentPriceType: 'BASE', currentPrice: { currency: 'USD', amount: price } }],
    })
  }

  updateInventory(sku: string, quantity: number) {
    return this.request('PUT', `/inventory?sku=${encodeURIComponent(sku)}`, {
      sku,
      quantity: { unit: 'EACH', amount: quantity },
    })
  }

  private async request(method: string, path: string, body?: object) {
    const res = await fetch(WMT_BASE + path, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`Walmart API error (${res.status}): ${text}`)
    return text ? JSON.parse(text) : {}
  }
}

// Build a Walmart MPItem payload with variants from our product row.
export function buildWalmartItemPayload(product: WmtProduct) {
  const primary = product.variants[0]
  return {
    MPItem: {
      Item: {
        sku: product.sku,
        productName: product.title,
        shortDescription: product.description ?? product.title,
        price: { currency: 'USD', amount: primary?.price ?? 0 },
        ShippingWeight: { value: 0.5, unit: 'LB' },
        ...(product.shipping_node ? { shippingNode: product.shipping_node } : {}),
        variantGroupId: product.sku,
        variantAttributeNames: { variantAttributeName: ['Color'] },
        variants: {
          Variant: product.variants.map((v) => ({
            sku: `${product.sku}-${v.variant_id}`,
            variantAttributeValue: [{ name: 'Color', value: v.color ?? '' }],
            primaryImageUrl: v.images?.[0],
            additionalImageUrls: { additionalImageUrl: v.images?.slice(1) ?? [] },
            price: { currency: 'USD', amount: v.price ?? 0 },
            quantity: { amount: v.quantity ?? 0, unit: 'EACH' },
          })),
        },
        ...(product.attributes ?? {}),
      },
    },
  }
}
