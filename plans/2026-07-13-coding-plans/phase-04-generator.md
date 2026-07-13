# Phase 4 — apps/generator

**Service:** `cbt-generator` | Port 3003  
**Vercel project:** `cbt-generator`  
**Tables:** prompt_templates, gen_jobs, gen_assets, ai_spend_records  
**maxDuration:** 60s

## Context

Generator nhận `listing_id` + `platform`, chạy pipeline:
1. Lấy scene_analysis từ Crawl service
2. Dùng Gemini để tạo title + description
3. Dùng Gemini Imagen (hoặc Replicate) để gen ảnh mockup
4. Upload ảnh lên Supabase Storage
5. Lưu gen_assets, ghi ai_spend_records

**Amazon path:** 1 set ảnh nền trắng  
**Walmart path:** 10 variants × mỗi variant 1 set ảnh

## Dependencies

```env
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
ACCOUNT_SERVICE_URL=https://cbt-account.vercel.app
GEMINI_API_KEY=
CRAWL_SERVICE_URL=https://cbt-crawl.vercel.app
SUPABASE_STORAGE_BUCKET=gen-assets
```

## Files to create

```
apps/generator/
├── pages/api/
│   ├── health.ts
│   ├── generate/
│   │   ├── index.ts           # POST — queue gen job
│   │   └── [jobId].ts         # GET — poll status + result
│   ├── listings/
│   │   └── [id]/
│   │       └── assets.ts      # GET — lấy assets của listing
│   ├── prompts/
│   │   ├── index.ts           # GET list / POST create
│   │   └── [id].ts            # PUT / DELETE
│   └── spend/
│       ├── index.ts           # GET spend summary
│       └── [listingId].ts     # GET spend per listing
└── lib/
    ├── supabase.ts
    ├── gemini.ts              # generateContent() + generateImage()
    ├── pipeline.ts            # runGenerationPipeline(job) — core logic
    ├── storage.ts             # uploadToStorage(buffer, path) → URL
    └── crawl-client.ts        # getSceneAnalysis(listingId, apiKey)
```

## Implementation Steps

### 1. Cài dependencies

```bash
cd apps/generator
pnpm add @google/generative-ai @supabase/supabase-js
```

### 2. `lib/crawl-client.ts`

```typescript
// Lấy scene analysis từ Crawl service
export async function getSceneAnalysis(listingId: string, apiKey: string) {
  const res = await fetch(`${process.env.CRAWL_SERVICE_URL}/api/listings/${listingId}/scene`, {
    headers: { 'X-API-Key': apiKey }
  })
  if (!res.ok) throw new Error('Scene analysis not found — run analyze first')
  return res.json()
}

export async function getListing(listingId: string, apiKey: string) {
  const res = await fetch(`${process.env.CRAWL_SERVICE_URL}/api/listings/${listingId}`, {
    headers: { 'X-API-Key': apiKey }
  })
  if (!res.ok) throw new Error('Listing not found')
  return res.json()
}
```

### 3. `lib/gemini.ts`

```typescript
// generateTitle(scene, platform) → string
// generateDescription(scene, platform) → string
// generateImagePrompt(scene, platform, variant?) → string
// generateImage(prompt) → Buffer  (Imagen API hoặc Replicate)

export async function generateTitle(scene: SceneAnalysis, platform: 'amazon' | 'walmart'): Promise<string> {
  // Platform-specific title format:
  // Amazon: keyword-rich, max 200 chars
  // Walmart: clear, max 75 chars
}

export async function generateDescription(scene: SceneAnalysis, platform: string): Promise<string> { ... }

export async function generateImagePrompt(scene: SceneAnalysis, platform: string, variant?: { color: string }): Promise<string> {
  // Tạo prompt cho image generation dựa trên scene analysis
  // Amazon: white background product shot
  // Walmart: lifestyle shot per variant color
}
```

### 4. `lib/storage.ts`

```typescript
import { createSupabaseClient } from '@cbt/shared'

export async function uploadToStorage(
  buffer: Buffer,
  path: string  // e.g. "gen-assets/account_id/job_id/main.jpg"
): Promise<string> {
  const supabase = createSupabaseClient()
  const { data, error } = await supabase.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET!)
    .upload(path, buffer, { contentType: 'image/jpeg', upsert: true })
  if (error) throw error
  const { data: { publicUrl } } = supabase.storage.from(process.env.SUPABASE_STORAGE_BUCKET!).getPublicUrl(path)
  return publicUrl
}
```

### 5. `lib/pipeline.ts` — Core generation logic

```typescript
export async function runGenerationPipeline(job: GenJob, apiKey: string) {
  const supabase = createSupabaseClient()
  
  // 1. Lấy listing + scene
  const [listing, scene] = await Promise.all([
    getListing(job.listing_id, apiKey),
    getSceneAnalysis(job.listing_id, apiKey)
  ])

  if (job.platform === 'amazon') {
    return runAmazonPipeline(job, listing, scene, supabase)
  } else {
    return runWalmartPipeline(job, listing, scene, supabase)
  }
}

async function runAmazonPipeline(job, listing, scene, supabase) {
  const spendRecords = []
  
  // 1. Generate title + description
  const [title, description] = await Promise.all([
    generateTitle(scene, 'amazon'),
    generateDescription(scene, 'amazon')
  ])
  
  // 2. Generate image prompt → gen image → upload
  const imgPrompt = await generateImagePrompt(scene, 'amazon')
  const imageBuffer = await generateImage(imgPrompt)
  const imageUrl = await uploadToStorage(imageBuffer, `${job.account_id}/${job.id}/main.jpg`)
  
  // 3. Save assets
  await supabase.from('gen_assets').insert([
    { account_id: job.account_id, job_id: job.id, listing_id: job.listing_id,
      platform: 'amazon', asset_type: 'image', storage_path: imageUrl },
    { ..., asset_type: 'title', content: title },
    { ..., asset_type: 'description', content: description }
  ])
  
  // 4. Update job status
  await supabase.from('gen_jobs').update({
    status: 'completed',
    result: { images: [imageUrl], title, description }
  }).eq('id', job.id)
}

async function runWalmartPipeline(job, listing, scene, supabase) {
  // scene.palette hoặc predefined colors → 10 variants
  const colors = getWalmartVariants(scene)  // ['Red', 'Blue', ...]
  
  const variants = await Promise.all(colors.map(async (color, i) => {
    const imgPrompt = await generateImagePrompt(scene, 'walmart', { color })
    const imageBuffer = await generateImage(imgPrompt)
    const imageUrl = await uploadToStorage(imageBuffer, `${job.account_id}/${job.id}/variant-${i}.jpg`)
    return { variant_id: `v${i+1}`, color, images: [imageUrl] }
  }))
  
  // title + description shared across variants
  const [title, description] = await Promise.all([
    generateTitle(scene, 'walmart'),
    generateDescription(scene, 'walmart')
  ])
  
  // Save assets + update job
  ...
}
```

### 6. `pages/api/generate/index.ts`

```typescript
// POST (withAuth)
// Body: { listing_id, platform, mockup_set_id? }
// 1. INSERT gen_jobs (status: 'queued')
// 2. Trả ngay { job_id, status: 'queued' }
// 3. Kick off pipeline ASYNC (không await — fire and forget)
//    → dùng setImmediate hoặc edge runtime background task

// NOTE: Vercel serverless không hỗ trợ true background job.
// Workaround: chạy pipeline trong cùng request nhưng với 60s timeout.
// Nếu cần thật sự async → dùng Vercel Cron hoặc Queue.
// Approach đơn giản: chạy sync, trả kết quả trong cùng request.
// Client có thể poll /api/generate/[jobId] nếu muốn progress.
```

### 7. `pages/api/generate/[jobId].ts`

```typescript
// GET (withAuth)
// → SELECT gen_jobs WHERE id = jobId AND account_id = auth.account_id
// → JOIN gen_assets
// → Trả { job_id, status, platform, result, assets }
```

### 8. `pages/api/spend/index.ts`

```typescript
// GET (withAuth)
// → SELECT SUM(cost_usd), COUNT(*) FROM ai_spend_records WHERE account_id
// → GROUP BY DATE(created_at) cho last 30 days
// → Trả { total_usd, by_day: [...], by_model: [...] }
```

## Pipeline Flow Diagram

```
POST /api/generate
  │
  ├─ INSERT gen_jobs (queued)
  │
  ├─ [sync] runGenerationPipeline()
  │    ├─ getListing + getSceneAnalysis (từ Crawl)
  │    ├─ generateTitle + generateDescription (Gemini)
  │    ├─ generateImage (Imagen/Replicate)
  │    ├─ uploadToStorage (Supabase)
  │    ├─ INSERT gen_assets
  │    └─ UPDATE gen_jobs (completed + result)
  │
  └─ trả { job_id, status: 'completed', result: { images, title, description } }
```

## Supabase Storage Setup

Tạo bucket `gen-assets` với policy public read:
```sql
-- Chạy trong Supabase SQL Editor
INSERT INTO storage.buckets (id, name, public) VALUES ('gen-assets', 'gen-assets', true);
CREATE POLICY "public read gen-assets" ON storage.objects FOR SELECT USING (bucket_id = 'gen-assets');
CREATE POLICY "service role write gen-assets" ON storage.objects FOR ALL TO service_role USING (true);
```

## Verification

```bash
# Queue gen job (cần listing đã analyzed từ Crawl)
curl -X POST https://cbt-listing-studio-generator.vercel.app/api/generate \
  -H "X-API-Key: <key>" \
  -d '{"listing_id":"<id>","platform":"amazon"}'

# Poll result
curl https://cbt-listing-studio-generator.vercel.app/api/generate/<jobId> \
  -H "X-API-Key: <key>"
```

## Notes

- Walmart cần 10 variant colors — có thể hardcode 10 màu phổ biến nếu scene.palette < 10
- Gemini Imagen 3 là option tốt nhất; fallback là Imagen 2 hoặc Replicate (Flux)
- Spend tracking: ghi mỗi LLM call vào ai_spend_records với model + token count
- `CRAWL_SERVICE_URL` cần set trên Vercel sau khi crawl deployed
