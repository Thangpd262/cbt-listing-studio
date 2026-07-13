# Phase 6 — apps/list-wmt

**Service:** `cbt-list-wmt` | Port 3005  
**Vercel project:** `cbt-list-wmt`  
**Tables:** wmt_products, wmt_listing_jobs, wmt_api_tokens, wmt_product_configs  
**maxDuration:** 30s

## Context

List-WMT giao tiếp với Walmart Marketplace API. Walmart có flow 2 bước: stage (submit để review) → publish (sau khi Walmart approve). Walmart dùng OAuth 2.0 với API Key + Secret.

Khác với Amazon (1 ảnh/listing), Walmart listing có **variants** — mỗi color/size là 1 variant, mỗi variant có set ảnh riêng.

## Dependencies

```env
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
ACCOUNT_SERVICE_URL=https://cbt-account.vercel.app
INTERNAL_SECRET=             # phải match với Account service
```

## Files to create

```
apps/list-wmt/
├── pages/api/
│   ├── health.ts
│   ├── listings/
│   │   ├── index.ts           # GET list / POST create
│   │   ├── [id].ts            # GET / PUT / DELETE
│   │   └── [id]/
│   │       ├── stage.ts       # POST stage / GET stage status
│   │       └── publish.ts     # POST publish
│   ├── jobs/
│   │   ├── index.ts
│   │   ├── [id].ts
│   │   └── [id]/
│   │       └── retry.ts
│   ├── bulk/
│   │   └── price-qty.ts
│   └── configs/
│       └── index.ts           # GET / PUT
└── lib/
    ├── supabase.ts
    ├── wmt-api.ts             # Walmart Marketplace API client
    ├── wmt-auth.ts            # OAuth token management
    └── account-client.ts      # getSellingAccountCredentials()
```

## Implementation Steps

### 1. `lib/wmt-auth.ts` — Walmart OAuth

```typescript
// Walmart dùng Basic Auth để lấy token: Base64(clientId:clientSecret)
export async function getWalmartToken(
  sellingAccountId: string,
  credentials: { api_key: string; api_secret: string }
): Promise<string> {
  const supabase = createSupabaseClient()
  
  // Check cache
  const { data: cached } = await supabase
    .from('wmt_api_tokens')
    .select('access_token, expires_at')
    .eq('selling_account_id', sellingAccountId)
    .single()
  
  if (cached && new Date(cached.expires_at) > new Date(Date.now() + 60000)) {
    return cached.access_token
  }
  
  // Request new token
  const encoded = Buffer.from(`${credentials.api_key}:${credentials.api_secret}`).toString('base64')
  const res = await fetch('https://marketplace.walmartapis.com/v3/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${encoded}`,
      'WM_SVC.NAME': 'Walmart Marketplace',
      'WM_QOS.CORRELATION_ID': crypto.randomUUID(),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  })
  
  const { access_token, expires_in } = await res.json()
  
  await supabase.from('wmt_api_tokens').upsert({
    selling_account_id: sellingAccountId,
    access_token,
    expires_at: new Date(Date.now() + expires_in * 1000).toISOString()
  })
  
  return access_token
}
```

### 2. `lib/wmt-api.ts` — Walmart API client

```typescript
const WMT_BASE = 'https://marketplace.walmartapis.com/v3'

export class WalmartApiClient {
  constructor(private token: string) {}
  
  private headers() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'WM_SEC.ACCESS_TOKEN': this.token,
      'WM_SVC.NAME': 'CBT Listing Studio',
      'WM_QOS.CORRELATION_ID': crypto.randomUUID(),
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  }
  
  // Submit item (create/update)
  async submitItem(itemPayload: object) {
    return this.request('POST', '/items', itemPayload)
  }
  
  // Get item status
  async getItemStatus(sku: string) {
    return this.request('GET', `/items/${sku}`)
  }
  
  // Retire (delete) item
  async retireItem(sku: string) {
    return this.request('DELETE', `/items/${sku}`)
  }
  
  // Bulk price + qty
  async updatePriceQty(items: Array<{ sku: string; price?: number; qty?: number }>) {
    // Walmart có riêng Price API và Inventory API
    const priceItems = items.filter(i => i.price !== undefined)
    const qtyItems = items.filter(i => i.qty !== undefined)
    
    const results = await Promise.allSettled([
      priceItems.length > 0 ? this.request('POST', '/prices/feeds', buildPriceFeed(priceItems)) : null,
      qtyItems.length > 0 ? this.request('POST', '/inventory/feeds', buildInventoryFeed(qtyItems)) : null,
    ])
    return results
  }
  
  private async request(method: string, path: string, body?: object) {
    const res = await fetch(WMT_BASE + path, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(`Walmart API error ${res.status}: ${JSON.stringify(err)}`)
    }
    return method === 'DELETE' ? {} : res.json()
  }
}
```

### 3. `pages/api/listings/index.ts` — POST create

```typescript
// POST (withAuth)
// Body: { selling_account_id, sku, title, description, variants, attributes, shipping_node }
// 1. INSERT wmt_products (status: draft)
// 2. INSERT wmt_listing_jobs (action: 'create', status: 'pending')
// 3. Gọi wmt-api.submitItem() với payload đúng format Walmart
// 4. Cập nhật job status

// Walmart item body:
function buildWalmartItemPayload(product: WmtProduct): object {
  return {
    MPItem: {
      Item: {
        sku: product.sku,
        productIdentifiers: { productIdType: 'GTIN', productId: '...' },
        productName: product.title,
        category: {
          ClothingCategory: {
            clothingCategory: 'Shirts',
            shortDescription: product.description,
            ...product.attributes
          }
        },
        price: { currency: 'USD', amount: product.variants[0]?.price ?? 0 },
        ShippingWeight: { value: 0.5, unit: 'LB' },
        // Variants
        variantGroupId: product.sku,
        variantAttributeNames: { variantAttributeName: ['Color'] },
        variants: {
          Variant: product.variants.map(v => ({
            sku: `${product.sku}-${v.variant_id}`,
            variantAttributeValue: [{ name: 'Color', value: v.color }],
            primaryImageUrl: v.images[0],
            additionalImageUrls: { additionalImageUrl: v.images.slice(1) },
            price: { currency: 'USD', amount: v.price },
            quantity: { amount: v.quantity, unit: 'EACH' }
          }))
        }
      }
    }
  }
}
```

### 4. `pages/api/listings/[id]/stage.ts`

```typescript
// POST (withAuth) — submit item lên Walmart để review
// Walmart "stage" = submit với status STAGING
// → INSERT wmt_listing_jobs (action: 'stage')
// → Gọi wmt-api.submitItem() với trạng thái STAGING
// → UPDATE wmt_products SET status = 'staging'

// GET (withAuth) — check stage status
// → wmt-api.getItemStatus(sku)
// → Trả current Walmart status
```

### 5. `pages/api/listings/[id]/publish.ts`

```typescript
// POST (withAuth) — publish sau khi Walmart approve
// → INSERT wmt_listing_jobs (action: 'publish')
// → Gọi wmt-api.submitItem() với status PUBLISHED
// → UPDATE wmt_products SET status = 'published'
```

### 6. `pages/api/bulk/price-qty.ts`

```typescript
// POST (withAuth)
// Body: { selling_account_id, items: [{ sku, price?, quantity? }] }
// → wmt-api.updatePriceQty(items)
```

## Walmart Listing Format Notes

Walmart Marketplace API (v3) dùng JSON. Key differences từ Amazon:
- Item phải qua "staging" → Walmart review → "published"
- Variants được submit trong cùng 1 item payload (không separate calls)
- Images phải có white background (1000x1000px min)
- SKU là unique identifier, không có ASIN equivalent
- Walmart assign `walmart_item_id` sau khi approve

## Verification

```bash
# Tạo listing với variants
curl -X POST https://cbt-list-wmt.vercel.app/api/listings \
  -H "X-API-Key: <key>" \
  -d '{
    "selling_account_id": "...",
    "sku": "TEST-WMT-001",
    "title": "Comfortable Graphic Tee",
    "description": "...",
    "variants": [
      {"variant_id":"v1","color":"Red","price":19.99,"quantity":50,"images":["https://..."]},
      {"variant_id":"v2","color":"Blue","price":19.99,"quantity":50,"images":["https://..."]}
    ],
    "attributes": {},
    "shipping_node": "1234567890"
  }'

# Stage
curl -X POST https://cbt-list-wmt.vercel.app/api/listings/<id>/stage \
  -H "X-API-Key: <key>"

# Publish
curl -X POST https://cbt-list-wmt.vercel.app/api/listings/<id>/publish \
  -H "X-API-Key: <key>"
```

## Notes

- Walmart Sandbox: `https://sandbox.walmartapis.com/v3` — dùng test credentials từ Walmart Seller Center
- `shipping_node` là ID của shipping node trong Walmart system — lấy từ configs
- Walmart review có thể mất vài phút đến vài giờ — client cần poll `/stage` để check
- Walmart có strict content requirements: title, description, category đúng format
- Nếu submit fail do validation → job status = 'failed', error chứa Walmart error details
