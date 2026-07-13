# Phase 5 — apps/list-amz

**Service:** `cbt-list-amz` | Port 3004  
**Vercel project:** `cbt-list-amz`  
**Tables:** amz_products, amz_listing_jobs, sp_api_tokens, amz_product_configs  
**maxDuration:** 30s

## Context

List-AMZ giao tiếp với Amazon SP-API để tạo/cập nhật listings. Credentials (LWA client_id, client_secret, refresh_token) được lưu mã hoá bên Account service. List-AMZ lấy credentials qua internal call, exchange lấy access_token, rồi gọi SP-API.

## Dependencies

```env
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
ACCOUNT_SERVICE_URL=https://cbt-account.vercel.app
INTERNAL_SECRET=             # phải match với Account service
```

## Files to create

```
apps/list-amz/
├── pages/api/
│   ├── health.ts
│   ├── listings/
│   │   ├── index.ts           # GET list / POST create
│   │   └── [id].ts            # GET / PUT / DELETE
│   ├── jobs/
│   │   ├── index.ts           # GET list jobs
│   │   ├── [id].ts            # GET job detail
│   │   └── [id]/
│   │       └── retry.ts       # POST retry failed job
│   ├── bulk/
│   │   └── price-qty.ts       # POST bulk update price+qty
│   ├── configs/
│   │   └── index.ts           # GET / PUT config per selling_account
│   └── shipping-templates/
│       ├── index.ts           # GET list / POST create
│       └── [id].ts            # PUT / DELETE
└── lib/
    ├── supabase.ts
    ├── sp-api.ts              # SP-API client
    ├── lwa.ts                 # Login with Amazon — exchange refresh_token → access_token
    └── account-client.ts      # getSellingAccountCredentials(selling_account_id)
```

## Implementation Steps

### 1. `lib/account-client.ts` — lấy credentials từ Account service

```typescript
export async function getSellingAccountCredentials(sellingAccountId: string): Promise<{
  lwa_client_id: string
  lwa_client_secret: string
  refresh_token: string
}> {
  const res = await fetch(
    `${process.env.ACCOUNT_SERVICE_URL}/api/selling-accounts/${sellingAccountId}/credentials`,
    { headers: { 'X-Internal-Secret': process.env.INTERNAL_SECRET! } }
  )
  if (!res.ok) throw new Error('Failed to get credentials')
  return res.json()
}
```

### 2. `lib/lwa.ts` — Login with Amazon token exchange

```typescript
export async function getAccessToken(credentials: {
  lwa_client_id: string
  lwa_client_secret: string
  refresh_token: string
}): Promise<string> {
  // Check cache (sp_api_tokens) trước
  const supabase = createSupabaseClient()
  const { data: cached } = await supabase
    .from('sp_api_tokens')
    .select('access_token, expires_at')
    .eq('selling_account_id', sellingAccountId)
    .single()
  
  if (cached && new Date(cached.expires_at) > new Date(Date.now() + 60000)) {
    return cached.access_token
  }
  
  // Exchange refresh_token
  const res = await fetch('https://api.amazon.com/auth/o2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: credentials.refresh_token,
      client_id: credentials.lwa_client_id,
      client_secret: credentials.lwa_client_secret,
    })
  })
  const { access_token, expires_in } = await res.json()
  
  // Cache token
  await supabase.from('sp_api_tokens').upsert({
    selling_account_id: sellingAccountId,
    access_token,
    expires_at: new Date(Date.now() + expires_in * 1000).toISOString()
  })
  
  return access_token
}
```

### 3. `lib/sp-api.ts` — SP-API client

```typescript
const SP_API_BASE = 'https://sellingpartnerapi-na.amazon.com'  // NA endpoint

export class SpApiClient {
  constructor(private accessToken: string, private marketplaceId: string) {}
  
  // Tạo/cập nhật listing via Listings Items API
  async putListing(sellerId: string, sku: string, body: object) {
    return this.request('PUT', `/listings/2021-08-01/items/${sellerId}/${sku}?marketplaceIds=${this.marketplaceId}`, body)
  }
  
  // Xoá listing
  async deleteListing(sellerId: string, sku: string) {
    return this.request('DELETE', `/listings/2021-08-01/items/${sellerId}/${sku}?marketplaceIds=${this.marketplaceId}`)
  }
  
  // Price + Qty
  async patchListing(sellerId: string, sku: string, patches: object[]) {
    return this.request('PATCH', `/listings/2021-08-01/items/${sellerId}/${sku}?marketplaceIds=${this.marketplaceId}`, { patches })
  }

  private async request(method: string, path: string, body?: object) {
    const res = await fetch(SP_API_BASE + path, {
      method,
      headers: {
        'x-amz-access-token': this.accessToken,
        'Content-Type': 'application/json',
        'User-Agent': 'CBT-Listing-Studio/1.0'
      },
      body: body ? JSON.stringify(body) : undefined
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(`SP-API error: ${JSON.stringify(err)}`)
    }
    return res.json()
  }
}
```

### 4. Job processing pattern

Mỗi listing operation tạo 1 job record, rồi execute:

```typescript
// pages/api/listings/index.ts — POST
async function createListing(req, res, auth) {
  const { selling_account_id, sku, title, description, bullet_points, images, price, quantity, product_type, attributes } = req.body
  
  // 1. INSERT amz_products (status: draft)
  const { data: product } = await supabase.from('amz_products').insert({ ... }).select().single()
  
  // 2. INSERT amz_listing_jobs (action: 'create', status: 'pending')
  const { data: job } = await supabase.from('amz_listing_jobs').insert({
    account_id: auth.account_id,
    selling_account_id,
    product_id: product.id,
    action: 'create',
    payload: { title, description, bullet_points, images, price, quantity, product_type, attributes }
  }).select().single()
  
  // 3. Execute job synchronously (hoặc async nếu cần)
  await executeJob(job, auth)
  
  return ok(res, { job_id: job.id, status: 'processing' })
}

async function executeJob(job, auth) {
  const credentials = await getSellingAccountCredentials(job.selling_account_id)
  const accessToken = await getAccessToken(credentials, job.selling_account_id)
  const client = new SpApiClient(accessToken, marketplaceId)
  
  try {
    await supabase.from('amz_listing_jobs').update({ status: 'processing' }).eq('id', job.id)
    
    const result = await client.putListing(sellerId, sku, buildListingBody(job.payload))
    
    await supabase.from('amz_listing_jobs').update({
      status: 'success',
      result
    }).eq('id', job.id)
    
    await supabase.from('amz_products').update({ status: 'active', asin: result.asin }).eq('id', job.product_id)
  } catch (err) {
    await supabase.from('amz_listing_jobs').update({
      status: 'failed',
      error: err.message,
      retry_count: job.retry_count + 1
    }).eq('id', job.id)
  }
}
```

### 5. `pages/api/bulk/price-qty.ts`

```typescript
// POST (withAuth)
// Body: { selling_account_id, items: [{ sku, price?, quantity? }] }
// → Batch PATCH requests to SP-API
// → INSERT amz_listing_jobs per item (action: 'price_qty')
```

### 6. `pages/api/jobs/[id]/retry.ts`

```typescript
// POST (withAuth)
// → GET failed job → re-execute executeJob()
```

## SP-API Listing Body Builder

```typescript
function buildListingBody(payload: any) {
  return {
    productType: payload.product_type,
    requirements: 'LISTING',
    attributes: {
      item_name: [{ value: payload.title, language_tag: 'en_US', marketplace_id: MARKETPLACE_ID }],
      product_description: [{ value: payload.description, ... }],
      bullet_point: payload.bullet_points.map(bp => ({ value: bp, ... })),
      main_product_image_locator: [{ media_location: payload.images[0], marketplace_id: MARKETPLACE_ID }],
      other_product_image_locator_1: payload.images[1] ? [{ media_location: payload.images[1], ... }] : undefined,
      list_price: [{ value: payload.price, currency: 'USD', ... }],
      fulfillment_availability: [{ fulfillment_channel_code: 'DEFAULT', quantity: payload.quantity, ... }],
      ...payload.attributes
    }
  }
}
```

## Verification

```bash
# Tạo listing (cần selling_account có SP-API credentials)
curl -X POST https://cbt-list-amz.vercel.app/api/listings \
  -H "X-API-Key: <key>" \
  -d '{"selling_account_id":"...","sku":"TEST-001","title":"Test Product","description":"...","bullet_points":["Point 1"],"images":["https://..."],"price":19.99,"quantity":100,"product_type":"SHIRT","attributes":{}}'

# Check job status
curl https://cbt-list-amz.vercel.app/api/jobs/<jobId> \
  -H "X-API-Key: <key>"
```

## Notes

- SP-API cần đăng ký Selling Partner App trên Amazon Seller Central
- Dùng SP-API sandbox cho testing: `https://sandbox.sellingpartnerapi-na.amazon.com`
- `seller_id` lấy từ credentials hoặc config của selling_account
- Marketplace ID cho Amazon US: `ATVPDKIKX0DER` (đã set trong amz_product_configs default)
- Image URLs phải là HTTPS và accessible publicly
- Throttling: SP-API có rate limit, cần retry với exponential backoff
