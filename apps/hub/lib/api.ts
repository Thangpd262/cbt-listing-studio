// Fetch helpers for each backend service.
// Account is live (Phase 1). Crawl/Generator/List are wired here but their
// services arrive in later phases — calls fail gracefully until then.

const ACCOUNT_URL = process.env.NEXT_PUBLIC_ACCOUNT_URL ?? ''
const CRAWL_URL = process.env.NEXT_PUBLIC_CRAWL_URL ?? ''
const GENERATOR_URL = process.env.NEXT_PUBLIC_GENERATOR_URL ?? ''
const LIST_AMZ_URL = process.env.NEXT_PUBLIC_LIST_AMZ_URL ?? ''
const LIST_WMT_URL = process.env.NEXT_PUBLIC_LIST_WMT_URL ?? ''

// Whether each backend is wired via env. Pages use this to decide between real
// data (skeleton while loading) and local sample data (dev, no env vars set).
export const serviceConfigured = {
  account: !!ACCOUNT_URL,
  crawl: !!CRAWL_URL,
  generator: !!GENERATOR_URL,
  listAmz: !!LIST_AMZ_URL,
  listWmt: !!LIST_WMT_URL,
}

export type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

// Unwrap the { success, data } envelope; throw a readable error otherwise.
async function unwrap<T>(res: Response): Promise<T> {
  let body: ApiEnvelope<T> | null = null
  try {
    body = (await res.json()) as ApiEnvelope<T>
  } catch {
    // non-JSON response
  }
  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? `Request failed (${res.status})`)
  }
  return body.data as T
}

function bearer(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

function apiKeyHeaders(apiKey: string) {
  return { 'X-API-Key': apiKey, 'Content-Type': 'application/json' }
}

// ---- Account (live) ----

export type SessionUser = { account_id: string; user_id: string; role: string }

export const accountApi = {
  async register(data: { email: string; password: string; name?: string }) {
    const res = await fetch(`${ACCOUNT_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return unwrap<{ user_id: string; status: string; message: string }>(res)
  },

  async login(data: { email: string; password: string }) {
    const res = await fetch(`${ACCOUNT_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return unwrap<{ token: string } & SessionUser>(res)
  },

  async me(token: string) {
    const res = await fetch(`${ACCOUNT_URL}/api/auth/me`, { headers: bearer(token) })
    return unwrap<{ user: Record<string, unknown>; account: Record<string, unknown>; role: string }>(res)
  },

  // API keys
  async getApiKeys(token: string) {
    const res = await fetch(`${ACCOUNT_URL}/api/api-keys`, { headers: bearer(token) })
    return unwrap<Array<{ id: string; name: string; last_used_at: string | null; created_at: string }>>(res)
  },
  async createApiKey(token: string, name?: string) {
    const res = await fetch(`${ACCOUNT_URL}/api/api-keys`, {
      method: 'POST',
      headers: bearer(token),
      body: JSON.stringify({ name }),
    })
    return unwrap<{ id: string; name: string; key: string; created_at: string }>(res)
  },
  async revokeApiKey(token: string, id: string) {
    const res = await fetch(`${ACCOUNT_URL}/api/api-keys/${id}`, { method: 'DELETE', headers: bearer(token) })
    return unwrap<{ id: string; revoked: boolean }>(res)
  },

  // Selling accounts
  async getSellingAccounts(token: string) {
    const res = await fetch(`${ACCOUNT_URL}/api/selling-accounts`, { headers: bearer(token) })
    return unwrap<Array<SellingAccount>>(res)
  },
  async createSellingAccount(token: string, data: Record<string, unknown>) {
    const res = await fetch(`${ACCOUNT_URL}/api/selling-accounts`, {
      method: 'POST',
      headers: bearer(token),
      body: JSON.stringify(data),
    })
    return unwrap<SellingAccount>(res)
  },
  async deleteSellingAccount(token: string, id: string) {
    const res = await fetch(`${ACCOUNT_URL}/api/selling-accounts/${id}`, { method: 'DELETE', headers: bearer(token) })
    return unwrap<{ id: string; deleted: boolean }>(res)
  },
  // Verify a selling account's stored credentials against the marketplace API.
  async testSellingAccount(token: string, id: string) {
    const res = await fetch(`${ACCOUNT_URL}/api/selling-accounts/${id}/test`, {
      method: 'POST',
      headers: bearer(token),
    })
    return unwrap<{ ok: boolean; error?: string }>(res)
  },

  // Team
  async getTeam(token: string) {
    const res = await fetch(`${ACCOUNT_URL}/api/team`, { headers: bearer(token) })
    return unwrap<Array<TeamMember>>(res)
  },
  async getPending(token: string) {
    const res = await fetch(`${ACCOUNT_URL}/api/team/pending`, { headers: bearer(token) })
    return unwrap<Array<TeamMember>>(res)
  },
  async approveUser(token: string, userId: string, role: string) {
    const res = await fetch(`${ACCOUNT_URL}/api/team/${userId}/approve`, {
      method: 'POST',
      headers: bearer(token),
      body: JSON.stringify({ role }),
    })
    return unwrap<TeamMember>(res)
  },
  async rejectUser(token: string, userId: string) {
    const res = await fetch(`${ACCOUNT_URL}/api/team/${userId}/reject`, { method: 'POST', headers: bearer(token) })
    return unwrap<{ id: string; status: string }>(res)
  },
}

export type SellingAccount = {
  id: string
  platform: string
  region: string
  name: string
  is_active: boolean
  created_at: string
}

export type TeamMember = {
  id: string
  email: string
  name: string | null
  role?: string | null
  status?: string
  created_at: string
}

// ---- Crawl / Generator / List (X-API-Key; services arrive in later phases) ----

export type CrawlListing = {
  id: string
  platform: 'etsy' | 'aliexpress' | 'printify' | 'amazon' | 'walmart'
  source_url: string | null
  title: string | null
  description: string | null
  shop_name: string | null
  images: string[]
  ai_images: string[]
  price: number | null
  tags: string[]
  crawl_purpose: 'normal' | 'tm'
  status: 'ingested' | 'analyzing' | 'analyzed' | 'failed'
  created_at: string
  created_by_email?: string | null
  // Scene-analysis mood, flattened by the crawl listings API (null until analyzed).
  mood?: string | null
}

export type PaginatedResponse<T> = {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export const crawlApi = {
  async getListings(
    apiKey: string,
    params: { page?: number; limit?: number; platform?: string; status?: string; user_id?: string } = {}
  ): Promise<PaginatedResponse<CrawlListing>> {
    const q = new URLSearchParams()
    if (params.page) q.set('page', String(params.page))
    if (params.limit) q.set('limit', String(params.limit))
    if (params.platform) q.set('platform', params.platform)
    if (params.status) q.set('status', params.status)
    if (params.user_id) q.set('user_id', params.user_id)
    const res = await fetch(`${CRAWL_URL}/api/listings?${q}`, { headers: apiKeyHeaders(apiKey) })
    const body = await res.json() as { success: boolean; data: CrawlListing[]; meta?: { total: number; page: number; limit: number; pages: number }; error?: string }
    if (!res.ok || !body.success) throw new Error(body.error ?? `Request failed (${res.status})`)
    return {
      data: body.data ?? [],
      total: body.meta?.total ?? body.data?.length ?? 0,
      page: body.meta?.page ?? 1,
      limit: body.meta?.limit ?? 24,
      totalPages: body.meta?.pages ?? 1,
    }
  },

  async analyzeListing(apiKey: string, id: string) {
    const res = await fetch(`${CRAWL_URL}/api/listings/${id}/analyze`, {
      method: 'POST',
      headers: apiKeyHeaders(apiKey),
    })
    return unwrap<Record<string, unknown>>(res)
  },

  async deleteListing(apiKey: string, id: string) {
    const res = await fetch(`${CRAWL_URL}/api/listings/${id}`, {
      method: 'DELETE',
      headers: apiKeyHeaders(apiKey),
    })
    return unwrap<{ id: string; deleted: boolean }>(res)
  },

  // Patch editable fields — title and/or the persisted AI image list.
  async updateListing(apiKey: string, id: string, body: { title?: string; ai_images?: string[]; images?: string[] }) {
    const res = await fetch(`${CRAWL_URL}/api/listings/${id}`, {
      method: 'PUT',
      headers: apiKeyHeaders(apiKey),
      body: JSON.stringify(body),
    })
    return unwrap<{ id: string; title: string; ai_images: string[] }>(res)
  },
}

export type PromptTemplate = {
  id: string
  name: string
  platform: string | null
  prompt_type: 'image' | 'title' | 'description'
  content: string
  model: string | null
  system_instruction: string | null
  // Enriched by GET /api/prompts from the shared IMAGE_MODELS constant.
  model_label?: string | null
  model_provider?: string | null
  cost_per_image_usd?: number | null
  is_default: boolean
  created_at: string
}

export type PromptInput = {
  name: string
  content: string
  prompt_type: string
  model?: string | null
  system_instruction?: string | null
}

export type ImageModel = {
  id: string
  label: string
  provider: string
  cost_per_image_usd: number
  supports_multi_image: boolean
  max_images_per_request: number
  notes?: string
}

export type SpendSummary = {
  period: string
  total_cost_usd: number
  total_images: number
  by_model: Array<{ model: string; label: string; total_cost_usd: number; total_images: number }>
  by_step: Array<{ step: string; total_cost_usd: number }>
  by_user: Array<{ user_id: string; email: string | null; total_cost_usd: number; total_images: number }>
}

export type ListingSpend = {
  listing_id: string
  total_cost_usd: number
  total_images: number
  breakdown: Array<{
    step: string
    model: string
    images_requested: number
    images_received: number
    cost_usd: number
    created_at: string
  }>
}

export type GenImage = { id: string | null; url: string; expires_at: string | null }

export const generatorApi = {
  async getJobs(apiKey: string) {
    const res = await fetch(`${GENERATOR_URL}/api/jobs`, { headers: apiKeyHeaders(apiKey) })
    return unwrap<Array<Record<string, unknown>>>(res)
  },
  async getPrompts(apiKey: string) {
    const res = await fetch(`${GENERATOR_URL}/api/prompts`, { headers: apiKeyHeaders(apiKey) })
    return unwrap<PromptTemplate[]>(res)
  },
  async createPrompt(apiKey: string, body: PromptInput) {
    const res = await fetch(`${GENERATOR_URL}/api/prompts`, {
      method: 'POST',
      headers: apiKeyHeaders(apiKey),
      body: JSON.stringify(body),
    })
    return unwrap<PromptTemplate>(res)
  },
  async updatePrompt(apiKey: string, id: string, body: Partial<PromptInput>) {
    const res = await fetch(`${GENERATOR_URL}/api/prompts/${id}`, {
      method: 'PUT',
      headers: apiKeyHeaders(apiKey),
      body: JSON.stringify(body),
    })
    return unwrap<PromptTemplate>(res)
  },
  async removePrompt(apiKey: string, id: string) {
    const res = await fetch(`${GENERATOR_URL}/api/prompts/${id}`, {
      method: 'DELETE',
      headers: apiKeyHeaders(apiKey),
    })
    return unwrap<{ id: string; deleted: boolean }>(res)
  },
  // Generate one image from a prompt template (append to the panel gallery).
  async generateImage(
    apiKey: string,
    body: {
      listing_id: string
      prompt_id: string
      platform?: string
      model?: string
      reference_image_url?: string
    }
  ) {
    const res = await fetch(`${GENERATOR_URL}/api/generate-image`, {
      method: 'POST',
      headers: apiKeyHeaders(apiKey),
      body: JSON.stringify(body),
    })
    return unwrap<GenImage>(res)
  },
  // Available image models (drives the prompt-form dropdown + cost display).
  async getModels(apiKey: string) {
    const res = await fetch(`${GENERATOR_URL}/api/models`, { headers: apiKeyHeaders(apiKey) })
    return unwrap<ImageModel[]>(res)
  },
  // AI spend summary. period = 'today' | '7d' | '30d'; user_id is admin-only.
  async getSpend(apiKey: string, params: { period?: string; user_id?: string } = {}) {
    const qs = new URLSearchParams()
    if (params.period) qs.set('period', params.period)
    if (params.user_id) qs.set('user_id', params.user_id)
    const res = await fetch(`${GENERATOR_URL}/api/spend?${qs.toString()}`, { headers: apiKeyHeaders(apiKey) })
    return unwrap<SpendSummary>(res)
  },
  // AI cost + breakdown for a single listing.
  async getListingSpend(apiKey: string, listingId: string) {
    const res = await fetch(`${GENERATOR_URL}/api/spend/listing/${listingId}`, { headers: apiKeyHeaders(apiKey) })
    return unwrap<ListingSpend>(res)
  },
}

// Unwrap the paginated { success, data, meta } envelope used by list services.
async function unwrapPaginated<T>(res: Response): Promise<{ data: T[]; total: number }> {
  const body = (await res.json().catch(() => null)) as
    | { success: boolean; data: T[]; meta?: { total: number }; error?: string }
    | null
  if (!res.ok || !body?.success) throw new Error(body?.error ?? `Request failed (${res.status})`)
  return { data: body.data ?? [], total: body.meta?.total ?? body.data?.length ?? 0 }
}

export type AmzJob = {
  id: string
  selling_account_id: string
  product_id: string | null
  action: 'create' | 'update' | 'delete' | 'price_qty'
  status: 'pending' | 'processing' | 'success' | 'failed'
  payload: Record<string, unknown>
  result: unknown
  error: string | null
  retry_count: number
  created_at: string
  updated_at: string
  // Added by the jobs endpoint (product join); optional for backward-compat.
  sku?: string | null
  product_title?: string | null
  created_by_email?: string | null
}

export type AmzProduct = {
  id: string
  sku: string
  asin: string | null
  title: string
  status: 'draft' | 'active' | 'inactive' | 'deleted'
  product_type: string | null
  created_at: string
}

// A cached live Amazon listing (from amz_listings_cache via the hub-local route).
export type AmzCachedListing = {
  id: string
  marketplace_id: string
  asin: string
  sku: string | null
  title: string | null
  status: string | null
  price: number | null
  quantity: number | null
  image_url: string | null
  product_type: string | null
  niche: string | null
  created_at: string
  updated_at: string | null
  amz_listed_at: string | null // Amazon listing-creation date (SP-API summaries.createdDate)
  synced_at: string
  // Edit-modal content, surfaced from the cached SP-API item (raw.attributes).
  // Absent on older cache rows until the next sync/list fetch.
  bullet_points?: string[]
  description?: string | null
  images?: string[]
  attributes?: Record<string, unknown>
}

// One page of cached listings (server-side pagination on the hub-local route).
export type CachedListingsPage<T> = {
  listings: T[]
  last_synced_at: string | null
  total: number
  page: number
  limit: number
}

// A cached live Walmart listing (from wmt_listings_cache).
export type WmtCachedListing = {
  id: string
  sku: string
  wpid: string | null
  title: string | null
  status: string | null
  price: number | null
  quantity: number | null
  image_url: string | null
  synced_at: string
}

export type CachedListings<T> = { listings: T[]; last_synced_at: string | null; total_count: number }
export type SyncResult = { synced: number; duration_ms: number; accounts: number; errors: string[] }

export const listAmzApi = {
  async getProducts(apiKey: string, params: { status?: string } = {}) {
    const q = params.status ? `?status=${encodeURIComponent(params.status)}` : ''
    const res = await fetch(`${LIST_AMZ_URL}/api/products${q}`, { headers: apiKeyHeaders(apiKey) })
    return unwrap<AmzProduct[]>(res)
  },
  // Cached live listings — read from Supabase via the hub-local route,
  // server-side paginated + filtered.
  async getCachedListings(
    apiKey: string,
    params: {
      page?: number
      limit?: number
      search?: string
      type?: string
      niche?: string
      sort?: 'newest' | 'oldest' | 'updated'
    } = {}
  ) {
    const q = new URLSearchParams()
    q.set('page', String(params.page ?? 1))
    q.set('limit', String(params.limit ?? 20))
    if (params.search) q.set('search', params.search)
    if (params.type) q.set('type', params.type)
    if (params.niche) q.set('niche', params.niche)
    if (params.sort) q.set('sort', params.sort)
    const res = await fetch(`/api/amz-listings?${q}`, { headers: apiKeyHeaders(apiKey) })
    return unwrap<CachedListingsPage<AmzCachedListing>>(res)
  },
  // Set a cached listing's product group (niche). Persists across syncs.
  async updateNiche(apiKey: string, id: string, niche: string) {
    const res = await fetch(`/api/amz-listings/${id}`, {
      method: 'PATCH',
      headers: apiKeyHeaders(apiKey),
      body: JSON.stringify({ niche }),
    })
    return unwrap<{ id: string; niche: string | null }>(res)
  },
  // Drop a listing from the cache view (re-added on next sync if still live).
  async deleteCached(apiKey: string, id: string) {
    const res = await fetch(`/api/amz-listings/${id}`, { method: 'DELETE', headers: apiKeyHeaders(apiKey) })
    return unwrap<{ id: string; deleted: boolean }>(res)
  },
  // Trigger a full SP-API → cache sync (list-amz service).
  async syncListings(apiKey: string) {
    const res = await fetch(`${LIST_AMZ_URL}/api/listings/sync`, {
      method: 'POST',
      headers: apiKeyHeaders(apiKey),
    })
    return unwrap<SyncResult>(res)
  },
  async getJobs(apiKey: string, params: { status?: string; page?: number; limit?: number } = {}) {
    const q = new URLSearchParams()
    if (params.status) q.set('status', params.status)
    if (params.page) q.set('page', String(params.page))
    if (params.limit) q.set('limit', String(params.limit))
    const res = await fetch(`${LIST_AMZ_URL}/api/jobs?${q}`, { headers: apiKeyHeaders(apiKey) })
    return unwrapPaginated<AmzJob>(res)
  },
  async retryJob(apiKey: string, id: string) {
    const res = await fetch(`${LIST_AMZ_URL}/api/jobs/${id}/retry`, {
      method: 'POST',
      headers: apiKeyHeaders(apiKey),
    })
    return unwrap<{ job_id: string; status: string; error?: string }>(res)
  },
  // Remove a job record (does not affect the live Amazon listing).
  async deleteJob(apiKey: string, id: string) {
    const res = await fetch(`${LIST_AMZ_URL}/api/jobs/${id}`, {
      method: 'DELETE',
      headers: apiKeyHeaders(apiKey),
    })
    return unwrap<{ id: string; deleted: boolean }>(res)
  },
  // Config mode: { selling_account_id, sku, config_key, field_values }
  async createListing(apiKey: string, body: Record<string, unknown>) {
    const res = await fetch(`${LIST_AMZ_URL}/api/listings`, {
      method: 'POST',
      headers: apiKeyHeaders(apiKey),
      body: JSON.stringify(body),
    })
    return unwrap<{ product_id: string; job_id: string; status: string; error?: string }>(res)
  },
  // Edit a listing's content (title/bullets/description/images/attributes) → PUT
  // pushes an SP-API 'update' job. `idOrSku` resolves to amz_products by id or SKU.
  async updateListing(
    apiKey: string,
    idOrSku: string,
    body: {
      title?: string
      bullet_points?: string[]
      description?: string
      images?: string[]
      attributes?: Record<string, unknown>
    }
  ) {
    const res = await fetch(`${LIST_AMZ_URL}/api/listings/${encodeURIComponent(idOrSku)}`, {
      method: 'PUT',
      headers: apiKeyHeaders(apiKey),
      body: JSON.stringify(body),
    })
    return unwrap<{ product_id: string; job_id?: string; status: string; error?: string }>(res)
  },
  // Edit price/quantity only → PATCH pushes a lighter SP-API 'price_qty' job.
  async updatePriceQty(apiKey: string, idOrSku: string, body: { price?: number; quantity?: number }) {
    const res = await fetch(`${LIST_AMZ_URL}/api/listings/${encodeURIComponent(idOrSku)}`, {
      method: 'PATCH',
      headers: apiKeyHeaders(apiKey),
      body: JSON.stringify(body),
    })
    return unwrap<{ product_id: string; job_id?: string; status: string; error?: string }>(res)
  },
  // Fetch a listing's live attributes (bullets/description/images) from SP-API on
  // demand — kept out of the sync batch, which times out on large catalogues once
  // attributes are included. `idOrSku` resolves the same way as the edit routes.
  async getListingAttributes(apiKey: string, idOrSku: string) {
    const res = await fetch(
      `${LIST_AMZ_URL}/api/listings/${encodeURIComponent(idOrSku)}/attributes`,
      { headers: apiKeyHeaders(apiKey) }
    )
    return unwrap<{
      bullet_points: string[]
      description: string | null
      images: string[]
      attributes: Record<string, unknown>
    }>(res)
  },
  // Bulk-update bullet points / description across SKUs → one 'update' job each.
  // An omitted field is preserved (not cleared). SKUs resolve to amz_products by
  // SKU, hydrating from the synced cache when no product row exists yet.
  async bulkEditContent(
    apiKey: string,
    items: { sku: string; bullet_points?: string[]; description?: string }[]
  ) {
    const res = await fetch(`${LIST_AMZ_URL}/api/bulk/content`, {
      method: 'POST',
      headers: apiKeyHeaders(apiKey),
      body: JSON.stringify({ items }),
    })
    return unwrap<{
      count: number
      results: { sku: string; job_id?: string; status: string; error?: string }[]
    }>(res)
  },
}

export const listWmtApi = {
  async getProducts(apiKey: string) {
    const res = await fetch(`${LIST_WMT_URL}/api/products`, { headers: apiKeyHeaders(apiKey) })
    return unwrap<Array<Record<string, unknown>>>(res)
  },
  async getCachedListings(apiKey: string) {
    const res = await fetch('/api/wmt-listings', { headers: apiKeyHeaders(apiKey) })
    return unwrap<CachedListings<WmtCachedListing>>(res)
  },
  async syncListings(apiKey: string) {
    const res = await fetch(`${LIST_WMT_URL}/api/listings/sync`, {
      method: 'POST',
      headers: apiKeyHeaders(apiKey),
    })
    return unwrap<SyncResult>(res)
  },
}

// ---- User configs + product groups (hub-local API routes, same origin) ----

export type UserConfig = {
  id: string
  account_id: string
  name: string
  based_on: string // product_configs.key
  product_type?: string | null // resolved from the base config
  overrides: Record<string, unknown>
  shipping_template_name?: string | null
  created_at: string
}

export type ProductGroup = {
  id: string
  account_id: string
  name: string
  platform: 'amazon' | 'walmart'
  created_at: string
}

// A single field definition inside a product_configs.fields[] schema.
export type ConfigField = {
  k: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'select'
  def: string
  options?: string // comma-separated for type=select
  attr?: string
  wrap?: string
  kind?: string
}

export type BaseConfig = {
  key: string
  label: string
  platform: string
  product_type: string
  variation_theme: string | null
  fields: ConfigField[]
}

export const userConfigApi = {
  async list(apiKey: string) {
    const res = await fetch('/api/user-configs', { headers: apiKeyHeaders(apiKey) })
    return unwrap<UserConfig[]>(res)
  },
  async create(apiKey: string, body: { name: string; based_on: string; overrides?: Record<string, unknown> }) {
    const res = await fetch('/api/user-configs', {
      method: 'POST',
      headers: apiKeyHeaders(apiKey),
      body: JSON.stringify(body),
    })
    return unwrap<UserConfig>(res)
  },
  async update(apiKey: string, id: string, body: { name?: string; overrides?: Record<string, unknown>; shipping_template_name?: string | null }) {
    const res = await fetch(`/api/user-configs/${id}`, {
      method: 'PATCH',
      headers: apiKeyHeaders(apiKey),
      body: JSON.stringify(body),
    })
    return unwrap<UserConfig>(res)
  },
  async remove(apiKey: string, id: string) {
    const res = await fetch(`/api/user-configs/${id}`, { method: 'DELETE', headers: apiKeyHeaders(apiKey) })
    return unwrap<{ id: string; deleted: boolean }>(res)
  },
}

export type ShippingTemplatesResponse = {
  status: 'ready' | 'syncing' | 'empty' | 'error'
  templates: string[]
  synced_at?: string | null
  error?: string
}

export const shippingTemplateApi = {
  async list(apiKey: string, sellingAccountId: string) {
    const res = await fetch(
      `/api/shipping-templates?selling_account_id=${encodeURIComponent(sellingAccountId)}`,
      { headers: apiKeyHeaders(apiKey) }
    )
    return unwrap<ShippingTemplatesResponse>(res)
  },
  async sync(apiKey: string, sellingAccountId: string, force = false) {
    const res = await fetch('/api/shipping-templates', {
      method: 'POST',
      headers: apiKeyHeaders(apiKey),
      body: JSON.stringify({ selling_account_id: sellingAccountId, force }),
    })
    return unwrap<ShippingTemplatesResponse>(res)
  },
}

export const productConfigApi = {
  async get(apiKey: string, key: string) {
    const res = await fetch(`/api/product-configs/${encodeURIComponent(key)}`, {
      headers: apiKeyHeaders(apiKey),
    })
    return unwrap<BaseConfig>(res)
  },
}

export type DashboardMetrics = {
  stats: {
    totalJobs: number
    successRate: number
    successCount: number
    doneCount: number
    activeUsers: number
    failedJobs: number
  }
  byUserByPeriod: {
    today: { label: string; value: number }[]
    '7d': { label: string; value: number }[]
    '30d': { label: string; value: number }[]
  }
  growth: { labels: string[]; series: { name: string; color: string; points: number[] }[] }
  recent: { sku: string; action: string; user: string; status: string; created_at: string }[]
}

// Hub-local route: real dashboard numbers straight from Supabase (service key).
export const dashboardApi = {
  async metrics(apiKey: string) {
    const res = await fetch('/api/dashboard/metrics', { headers: apiKeyHeaders(apiKey) })
    return unwrap<DashboardMetrics>(res)
  },
}

export const productGroupApi = {
  async list(apiKey: string, platform?: string) {
    const q = platform ? `?platform=${encodeURIComponent(platform)}` : ''
    const res = await fetch(`/api/product-groups${q}`, { headers: apiKeyHeaders(apiKey) })
    return unwrap<ProductGroup[]>(res)
  },
  async create(apiKey: string, body: { name: string; platform: string }) {
    const res = await fetch('/api/product-groups', {
      method: 'POST',
      headers: apiKeyHeaders(apiKey),
      body: JSON.stringify(body),
    })
    return unwrap<ProductGroup>(res)
  },
  async remove(apiKey: string, id: string) {
    const res = await fetch(`/api/product-groups/${id}`, { method: 'DELETE', headers: apiKeyHeaders(apiKey) })
    return unwrap<{ id: string; deleted: boolean }>(res)
  },
}
