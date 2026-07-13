# Phase 3 — apps/crawl

**Service:** `cbt-crawl` | Port 3002  
**Vercel project:** `cbt-crawl`  
**Tables:** crawl_listings, listing_scene_analysis  
**maxDuration:** 60s (LLM analyze có thể chậm)

## Context

Crawl nhận listing thô từ browser extension (hoặc manual), lưu vào DB, rồi gọi Gemini để phân tích scene (mood, palette, objects, style, niche). Tất cả endpoints dùng `withAuth` từ shared package.

## Dependencies

```env
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
ACCOUNT_SERVICE_URL=https://cbt-account.vercel.app
GEMINI_API_KEY=
```

## Files to create

```
apps/crawl/
├── pages/api/
│   ├── health.ts                # đã có
│   └── listings/
│       ├── index.ts             # GET list / POST ingest
│       ├── [id].ts              # GET / DELETE
│       ├── [id]/
│       │   ├── analyze.ts       # POST — trigger LLM analysis
│       │   └── scene.ts         # GET — lấy scene_analysis
└── lib/
    ├── supabase.ts              # createSupabaseClient()
    └── gemini.ts                # analyzeScene(listing) → SceneAnalysis
```

## Implementation Steps

### 1. Cài dependencies

```bash
cd apps/crawl
pnpm add @google/generative-ai
```

### 2. `lib/gemini.ts` — LLM scene analysis

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

export async function analyzeScene(listing: {
  title: string
  images: string[]
  tags: string[]
  platform: string
}): Promise<SceneAnalysis> {
  const prompt = `Analyze this product listing and return a JSON object with:
- mood: overall emotional tone (1-3 words)
- palette: array of 3-5 dominant colors (hex or descriptive)
- objects: array of main objects/elements visible
- quote: a short evocative phrase capturing the listing's feel
- style: visual style (e.g. "minimalist", "rustic", "vibrant")
- niche: product niche/category (e.g. "home decor", "graphic tee")

Listing title: ${listing.title}
Tags: ${listing.tags.join(', ')}
Platform: ${listing.platform}
Image URLs: ${listing.images.slice(0, 3).join(', ')}

Return ONLY valid JSON, no markdown.`

  const result = await model.generateContent(prompt)
  const text = result.response.text()
  return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
}
```

### 3. `pages/api/listings/index.ts`

```typescript
// GET (withAuth) — list listings
// Query params: platform, status, page, limit (default 20)
// → SELECT crawl_listings WHERE account_id = auth.account_id
// → ORDER BY created_at DESC
// → trả paginated()

// POST (withAuth) — ingest listing
// Body: { platform, url, title, images, price, tags, raw_html? }
// Validate: platform in ['amazon','walmart','etsy','printify']
// → INSERT crawl_listings
// → trả created(res, { listing_id, status: 'ingested' })
```

### 4. `pages/api/listings/[id].ts`

```typescript
// GET (withAuth) — lấy listing detail + scene_analysis (nếu có)
// DELETE (withAuth) — xoá listing (cascade xoá scene_analysis)
// Validate: listing.account_id === auth.account_id
```

### 5. `pages/api/listings/[id]/analyze.ts`

```typescript
// POST (withAuth)
// 1. Lấy listing → validate ownership + status !== 'analyzing'
// 2. UPDATE status = 'analyzing'
// 3. Gọi gemini.analyzeScene(listing) — có thể mất 5-15s
// 4. INSERT listing_scene_analysis (ON CONFLICT UPDATE)
// 5. UPDATE crawl_listings SET status = 'analyzed'
// 6. Trả scene analysis

// Error handling: nếu Gemini fail → UPDATE status = 'failed'
```

### 6. `pages/api/listings/[id]/scene.ts`

```typescript
// GET (withAuth)
// → SELECT listing_scene_analysis WHERE listing_id = id
// → JOIN crawl_listings để verify ownership
// → 404 nếu chưa analyze
```

## Data shapes

```typescript
// POST /api/listings/ingest — Input
{
  platform: 'amazon' | 'walmart' | 'etsy' | 'printify'
  url: string
  title: string
  images: string[]        // image URLs (tối thiểu 1)
  price?: number
  tags?: string[]
  raw_html?: string
}

// Response
{ listing_id: string, status: 'ingested' }

// GET /api/listings — Response
{
  success: true,
  data: Listing[],
  meta: { total, page, limit }
}

// GET /api/listings/[id]/scene — Response
{
  listing_id: string
  mood: string
  palette: string[]
  objects: string[]
  quote?: string
  style: string
  niche: string
  analyzed_at: string
}
```

## Verification

```bash
# Ingest listing
curl -X POST https://cbt-crawl.vercel.app/api/listings \
  -H "X-API-Key: <key>" \
  -H "Content-Type: application/json" \
  -d '{"platform":"amazon","url":"https://amazon.com/...","title":"Test Product","images":["https://..."]}'

# Analyze → nhận scene
curl -X POST https://cbt-crawl.vercel.app/api/listings/<id>/analyze \
  -H "X-API-Key: <key>"

# Lấy scene
curl https://cbt-crawl.vercel.app/api/listings/<id>/scene \
  -H "X-API-Key: <key>"
```

## Notes

- Gemini 1.5 Flash đủ nhanh và rẻ cho scene analysis
- `maxDuration: 60` đã set trong vercel.json
- Nếu cần async (analyze chạy background), dùng Vercel Edge Function hoặc queue — nhưng với 60s limit là đủ cho Gemini Flash
- Images trong listing là URLs từ nơi crawl về, Gemini chỉ đọc title/tags (không fetch ảnh trực tiếp trong prompt text — nhưng có thể pass URLs nếu dùng multimodal)
