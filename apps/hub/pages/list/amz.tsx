import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  RefreshCw,
  RotateCw,
  Loader2,
  Pencil,
  Trash2,
  X,
  Plus,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Info,
} from 'lucide-react'
import Layout from '../../components/Layout'
import { SkeletonRows } from '../../components/Skeleton'
import { useAuth } from '../../lib/auth-context'
import { listAmzApi, productGroupApi, serviceConfigured, type AmzCachedListing } from '../../lib/api'

// Sample listings — shown only in local dev (no API key).
const SAMPLE: AmzCachedListing[] = [
  {
    id: 's1',
    marketplace_id: 'ATVPDKIKX0DER',
    asin: 'B0CXXX001',
    sku: 'SHIRT-042',
    title: 'Boho Floral Women Tee Cotton Soft Unisex',
    status: 'BUYABLE,DISCOVERABLE',
    price: 21.99,
    quantity: 120,
    image_url: null,
    product_type: 'SHIRT',
    niche: 'Boho',
    created_at: '2026-07-01T09:12:00Z',
    updated_at: '2026-07-16T10:00:00Z',
    amz_listed_at: '2026-06-15T08:00:00Z',
    synced_at: '2026-07-14T07:05:00Z',
    bullet_points: ['100% soft combed cotton', 'Unisex fit', 'Boho floral print', 'Machine washable', 'Printed in the USA'],
    description: 'A soft, breathable boho floral tee for everyday wear.',
    images: ['https://picsum.photos/seed/amz1a/400', 'https://picsum.photos/seed/amz1b/400'],
    attributes: { condition_type: [{ value: 'new_new' }], generic_keyword: [{ value: 'boho tee floral women cotton' }] },
  },
  {
    id: 's2',
    marketplace_id: 'ATVPDKIKX0DER',
    asin: 'B0CXXX002',
    sku: 'MUG-007',
    title: 'Rose Ceramic Mug 11oz Boho Flower Gift',
    status: 'DISCOVERABLE',
    price: 14.5,
    quantity: 0,
    image_url: null,
    product_type: 'MUG',
    niche: 'Gift',
    created_at: '2026-07-03T11:40:00Z',
    updated_at: '2026-07-12T10:00:00Z',
    amz_listed_at: '2026-06-20T08:00:00Z',
    synced_at: '2026-07-14T07:05:00Z',
    bullet_points: ['11oz ceramic mug', 'Rose flower design', 'Dishwasher safe', 'Great boho gift'],
    description: 'Ceramic 11oz mug with a rose boho design — a thoughtful gift.',
    images: ['https://picsum.photos/seed/amz2a/400'],
    attributes: { condition_type: [{ value: 'new_new' }] },
  },
]

// Amazon status string(s) → a compact badge. Fallback shows the raw value.
const STATUS_MAP: Record<string, { label: string; badge: string; dot: string }> = {
  'BUYABLE,DISCOVERABLE': { label: 'live', badge: 'b-ok', dot: 'bg-ok' },
  BUYABLE: { label: 'live', badge: 'b-ok', dot: 'bg-ok' },
  DISCOVERABLE: { label: 'inactive', badge: 'b-wn', dot: 'bg-warn' },
  NOT_DISCOVERABLE: { label: 'hidden', badge: 'b-mu', dot: 'bg-muted' },
}
function statusStyle(raw: string | null) {
  if (!raw) return { label: '—', badge: 'b-mu', dot: 'bg-muted' }
  // Normalize order (sync sorts too, but old cache rows may be unsorted).
  const key = raw.split(',').sort().join(',')
  return STATUS_MAP[key] ?? { label: raw, badge: 'b-mu', dot: 'bg-muted' }
}

// "lúc 14:05 · 14/07/2026" from an ISO timestamp (sync freshness line).
function syncedLabel(iso: string | null): string {
  if (!iso) return 'chưa đồng bộ'
  const d = new Date(iso)
  const t = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  return `lúc ${t} · ${d.toLocaleDateString('vi-VN')}`
}

// "DD/MM/YYYY HH:mm" for the Ngày tạo column.
function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// A page-number window: up to 5 pages around the current one, with 1/last + ellipsis.
function pageWindow(page: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const out: (number | '…')[] = [1]
  const start = Math.max(2, page - 2)
  const end = Math.min(totalPages - 1, page + 2)
  if (start > 2) out.push('…')
  for (let i = start; i <= end; i++) out.push(i)
  if (end < totalPages - 1) out.push('…')
  out.push(totalPages)
  return out
}

const AMZ_DP = 'https://www.amazon.com/dp/'
const COLSPAN = 11

export default function ListAmzPage() {
  const { apiKey } = useAuth()
  const useSample = !apiKey
  const canSync = serviceConfigured.listAmz && !!apiKey

  const [rows, setRows] = useState<AmzCachedListing[]>(useSample ? SAMPLE : [])
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  const [total, setTotal] = useState(useSample ? SAMPLE.length : 0)
  const [loaded, setLoaded] = useState(useSample)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  // Filters + pagination (server-side; sample mode filters/pages client-side).
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterNiche, setFilterNiche] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  // Sort is independent of the filters — changing a filter must not reset it.
  const [sort, setSort] = useState<'newest' | 'oldest' | 'updated'>('newest')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  // Groups (niche) options + row-level UI state.
  const [groups, setGroups] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  // Status-reason popover: lazily-fetched issues per SKU, cached across opens.
  type ListingIssue = { code: string; message: string; severity: string; attributeNames?: string[] }
  const [issuesMap, setIssuesMap] = useState<Record<string, ListingIssue[]>>({})
  const [issuesOpenSku, setIssuesOpenSku] = useState<string | null>(null)
  const [issuesLoadingSku, setIssuesLoadingSku] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<AmzCachedListing | null>(null)
  const [editTab, setEditTab] = useState<'content' | 'price' | 'images' | 'attrs'>('content')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // Live attributes are fetched on modal open (not carried in the sync batch).
  const [editAttrsLoading, setEditAttrsLoading] = useState(false)
  // Authoritative productType from SP-API (cache copy may be null / wrong format).
  const [editProductType, setEditProductType] = useState<string | null>(null)
  // Tab 1 — Nội dung
  const [editItemName, setEditItemName] = useState('')
  const [editBullets, setEditBullets] = useState<string[]>(['', '', '', '', ''])
  const [editDescription, setEditDescription] = useState('')
  const [editKeywords, setEditKeywords] = useState('')
  // Tab 2 — Giá & Kho
  const [editPrice, setEditPrice] = useState('')
  const [editQty, setEditQty] = useState('')
  // Tab 3 — Ảnh
  const [editImages, setEditImages] = useState<string[]>([])
  const [newImageUrl, setNewImageUrl] = useState('')
  // Tab 4 — Attributes (extra, non-content attributes as JSON strings)
  const [editAttrs, setEditAttrs] = useState<Record<string, string>>({})
  const [attrErrors, setAttrErrors] = useState<Record<string, string>>({})
  const [newAttrKey, setNewAttrKey] = useState('')
  const [newAttrValue, setNewAttrValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; sku: string } | null>(null)
  const [bulkConfirm, setBulkConfirm] = useState(false)
  // Bulk content edit (bullet points + description) across the selected rows.
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [bulkBullets, setBulkBullets] = useState('')
  const [bulkDescription, setBulkDescription] = useState('')
  const [bulkEditLoading, setBulkEditLoading] = useState(false)
  const [bulkEditError, setBulkEditError] = useState<string | null>(null)

  // Content attribute keys managed by the dedicated tabs (excluded from Tab 4).
  const CONTENT_ATTR_KEYS = new Set([
    'item_name', 'bullet_point', 'product_description', 'generic_keyword',
    'main_product_image_locator', 'purchasable_offer', 'list_price',
    'fulfillment_availability', 'condition_type', 'parentage_level', 'child_parent_sku_relationship',
  ])

  // Debounce the search box into the query value; reset to page 1 on change.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const load = useCallback(async () => {
    if (useSample) {
      setLoaded(true)
      return
    }
    setLoading(true)
    setErrorMsg(null)
    try {
      const r = await listAmzApi.getCachedListings(apiKey!, {
        page,
        limit,
        search,
        type: filterType,
        niche: filterNiche,
        status: filterStatus,
        sort,
      })
      setRows(r.listings)
      setTotal(r.total)
      setSyncedAt(r.last_synced_at)
    } catch (e) {
      setRows([])
      setTotal(0)
      setErrorMsg(e instanceof Error ? e.message : 'Không tải được listing')
    } finally {
      setLoaded(true)
      setLoading(false)
    }
  }, [apiKey, useSample, page, limit, search, filterType, filterNiche, filterStatus, sort])

  useEffect(() => {
    load()
  }, [load])

  // Group options for the niche dropdowns.
  useEffect(() => {
    if (!apiKey) return
    productGroupApi
      .list(apiKey, 'amazon')
      .then((gs) => setGroups(gs.map((g) => g.name)))
      .catch(() => {})
  }, [apiKey])

  // Clear bulk selection whenever the visible set changes.
  useEffect(() => {
    setSelected(new Set())
  }, [page, limit, search, filterType, filterNiche, filterStatus, sort])

  async function sync() {
    if (!canSync) return
    setSyncing(true)
    setSyncMsg(null)
    setErrorMsg(null)
    try {
      const r = await listAmzApi.syncListings(apiKey!)
      await load()
      const errNote = r.errors.length ? ` · ${r.errors.length} tài khoản lỗi` : ''
      setSyncMsg(`Đã đồng bộ ${r.synced} listing${errNote}`)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Đồng bộ thất bại')
    } finally {
      setSyncing(false)
    }
  }

  // Toggle the status-reason popover for a SKU; fetch + cache its issues on first open.
  async function loadIssues(sku: string | null) {
    if (!sku) return
    if (issuesOpenSku === sku) {
      setIssuesOpenSku(null)
      return
    }
    setIssuesOpenSku(sku)
    if (issuesMap[sku] || useSample || !apiKey) return
    setIssuesLoadingSku(sku)
    try {
      const r = await listAmzApi.getListingIssues(apiKey, sku)
      setIssuesMap((m) => ({ ...m, [sku]: r.issues ?? [] }))
    } catch {
      setIssuesMap((m) => ({ ...m, [sku]: [] })) // cache empty → shows "no reason", avoids refetch loop
    } finally {
      setIssuesLoadingSku(null)
    }
  }

  // Sample mode filters/sorts/pages locally over the editable `rows`.
  const sampleView = useMemo(() => {
    if (!useSample) return null
    let f = rows
    if (search) {
      const q = search.toLowerCase()
      f = f.filter((r) => `${r.sku ?? ''} ${r.title ?? ''} ${r.asin}`.toLowerCase().includes(q))
    }
    if (filterType) f = f.filter((r) => r.product_type === filterType)
    if (filterNiche) f = f.filter((r) => r.niche === filterNiche)
    if (filterStatus) f = f.filter((r) => r.status === filterStatus)
    const col = sort === 'updated' ? 'updated_at' : 'amz_listed_at'
    f = [...f].sort((a, b) => {
      const diff = new Date(b[col] ?? 0).getTime() - new Date(a[col] ?? 0).getTime()
      return sort === 'oldest' ? -diff : diff
    })
    return f
  }, [useSample, rows, search, filterType, filterNiche, filterStatus, sort])

  const totalCount = useSample ? sampleView!.length : total
  const totalPages = limit === 0 ? 1 : Math.max(1, Math.ceil(totalCount / limit))
  const display = useSample
    ? limit === 0
      ? sampleView!
      : sampleView!.slice((page - 1) * limit, (page - 1) * limit + limit)
    : rows

  // Niche options = configured groups ∪ any niche already present on the rows.
  const nicheOptions = useMemo(
    () => Array.from(new Set([...groups, ...rows.map((r) => r.niche).filter(Boolean) as string[]])).sort(),
    [groups, rows]
  )
  // Type filter options — best-effort from what's currently loaded.
  const typeOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.product_type).filter(Boolean) as string[])).sort(),
    [rows]
  )

  async function changeNiche(row: AmzCachedListing, value: string) {
    setRows((rs) => rs.map((x) => (x.id === row.id ? { ...x, niche: value || null } : x)))
    if (useSample) return
    try {
      await listAmzApi.updateNiche(apiKey!, row.id, value)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Không lưu được nhóm')
      load()
    }
  }

  function openEdit(row: AmzCachedListing) {
    setEditTarget(row)
    setEditTab('content')
    setSaveError(null)
    setSaving(false)
    setEditItemName(row.title ?? '')
    const bp = Array.isArray(row.bullet_points) ? row.bullet_points : []
    setEditBullets([bp[0] ?? '', bp[1] ?? '', bp[2] ?? '', bp[3] ?? '', bp[4] ?? ''])
    setEditDescription(row.description ?? '')
    const gk = (row.attributes as Record<string, { value?: string }[]> | undefined)?.generic_keyword
    setEditKeywords(Array.isArray(gk) ? gk[0]?.value ?? '' : '')
    setEditPrice(row.price != null ? String(row.price) : '')
    setEditQty(row.quantity != null ? String(row.quantity) : '')
    setEditImages(Array.isArray(row.images) && row.images.length ? row.images : row.image_url ? [row.image_url] : [])
    setNewImageUrl('')
    // Tab 4 shows only extra (non-content) attributes as editable JSON.
    const raw = (row.attributes as Record<string, unknown>) ?? {}
    const mapped: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw)) {
      if (CONTENT_ATTR_KEYS.has(k) || k.startsWith('other_product_image_locator')) continue
      mapped[k] = JSON.stringify(v, null, 2)
    }
    setEditAttrs(mapped)
    setAttrErrors({})
    setNewAttrKey('')
    setNewAttrValue('')
    setEditProductType(row.product_type ?? null) // baseline; refined by the fetch below

    // The cache omits attributes, so bullets/description/images above come from a
    // (usually empty) cache copy. Pull the live values from SP-API on open; on any
    // failure keep whatever the cache gave us.
    if (!useSample && apiKey && (row.sku || row.id)) {
      setEditAttrsLoading(true)
      listAmzApi
        .getListingAttributes(apiKey, row.sku ?? row.id)
        .then((d) => {
          if (d.bullet_points?.length) {
            const bp = d.bullet_points
            setEditBullets([bp[0] ?? '', bp[1] ?? '', bp[2] ?? '', bp[3] ?? '', bp[4] ?? ''])
          }
          if (d.description) setEditDescription(d.description)
          if (d.images?.length) setEditImages(d.images)
          if (d.product_type) setEditProductType(d.product_type)
        })
        .catch(() => {})
        .finally(() => setEditAttrsLoading(false))
    } else {
      setEditAttrsLoading(false)
    }
  }

  const editMarketplace = () => editTarget?.marketplace_id ?? 'ATVPDKIKX0DER'
  const attrVal = (value: string) => [{ value, language_tag: 'en_US', marketplace_id: editMarketplace() }]

  // Parse Tab-4 custom attribute JSON. Returns per-key errors when invalid.
  function parseExtras(): { ok: boolean; values: Record<string, unknown>; errors: Record<string, string> } {
    const values: Record<string, unknown> = {}
    const errors: Record<string, string> = {}
    for (const [k, rawStr] of Object.entries(editAttrs)) {
      if (!rawStr.trim()) continue
      try {
        values[k] = JSON.parse(rawStr)
      } catch {
        errors[k] = 'JSON không hợp lệ'
      }
    }
    return { ok: Object.keys(errors).length === 0, values, errors }
  }

  // Attributes to push: preserve non-content raw attrs, set generic_keyword,
  // merge custom extras. Content keys are rebuilt from top-level fields server-side.
  function buildAttributes(extras: Record<string, unknown>): Record<string, unknown> {
    const base: Record<string, unknown> = {}
    const raw = (editTarget?.attributes as Record<string, unknown>) ?? {}
    for (const [k, v] of Object.entries(raw)) {
      if (CONTENT_ATTR_KEYS.has(k) || k.startsWith('other_product_image_locator')) continue
      base[k] = v
    }
    if (editKeywords.trim()) base.generic_keyword = attrVal(editKeywords.trim())
    return { ...base, ...extras }
  }

  // Full content payload — sent whole on every content/images/attrs save so the
  // server's listing rebuild never drops an unedited field (destructive-update guard).
  function contentBody(extras: Record<string, unknown>) {
    // Use the SP-API-confirmed productType (lazy-loaded); omit when unknown rather
    // than overwriting the stored value with null.
    const productType = editProductType ?? editTarget?.product_type ?? undefined
    return {
      title: editItemName,
      bullet_points: editBullets.filter((b) => b.trim()),
      description: editDescription || undefined,
      images: editImages,
      ...(productType ? { product_type: productType } : {}),
      attributes: buildAttributes(extras),
    }
  }

  // Guard: sample mode / no key → surface a message, don't call the API (AC #8).
  function requireKey(): string | null {
    if (useSample || !apiKey) {
      setSaveError('Cần API key để lưu — đăng nhập và đồng bộ trước.')
      return null
    }
    return apiKey
  }

  async function runSave(fn: () => Promise<void>) {
    setSaving(true)
    setSaveError(null)
    try {
      await fn()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  // Content, Images, Attributes tabs all push a full 'update' job via PUT.
  async function saveViaUpdate(after: () => void) {
    const key = requireKey()
    if (!key || !editTarget) return
    const { ok: pOk, values, errors } = parseExtras()
    if (!pOk) {
      setAttrErrors(errors)
      setEditTab('attrs')
      return
    }
    setAttrErrors({})
    await runSave(async () => {
      const idOrSku = editTarget.sku ?? editTarget.id
      const r = await listAmzApi.updateListing(key, idOrSku, contentBody(values))
      if (r.status === 'failed') throw new Error(r.error ?? 'SP-API từ chối cập nhật')
      after()
      setEditTarget(null)
    })
  }

  function saveContent() {
    saveViaUpdate(() =>
      setRows((rs) => rs.map((x) => (x.id === editTarget!.id ? { ...x, title: editItemName } : x)))
    )
  }

  function saveImages() {
    saveViaUpdate(() =>
      setRows((rs) => rs.map((x) => (x.id === editTarget!.id ? { ...x, image_url: editImages[0] ?? x.image_url } : x)))
    )
  }

  function saveAttrs() {
    saveViaUpdate(() => {})
  }

  async function savePriceQty() {
    const key = requireKey()
    if (!key || !editTarget) return
    await runSave(async () => {
      const idOrSku = editTarget.sku ?? editTarget.id
      const price = parseFloat(editPrice)
      const quantity = parseInt(editQty, 10)
      const r = await listAmzApi.updatePriceQty(key, idOrSku, {
        price: Number.isFinite(price) ? price : undefined,
        quantity: Number.isFinite(quantity) ? quantity : undefined,
      })
      if (r.status === 'failed') throw new Error(r.error ?? 'SP-API từ chối cập nhật')
      setRows((rs) =>
        rs.map((x) =>
          x.id === editTarget.id
            ? {
                ...x,
                price: Number.isFinite(price) ? price : x.price,
                quantity: Number.isFinite(quantity) ? quantity : x.quantity,
              }
            : x
        )
      )
      setEditTarget(null)
    })
  }

  // Dispatch the correct save handler for the active tab.
  function saveActiveTab() {
    if (editTab === 'content') saveContent()
    else if (editTab === 'price') savePriceQty()
    else if (editTab === 'images') saveImages()
    else saveAttrs()
  }

  // Tab 3 helpers.
  function moveImage(i: number, dir: -1 | 1) {
    setEditImages((imgs) => {
      const j = i + dir
      if (j < 0 || j >= imgs.length) return imgs
      const next = [...imgs]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }
  function addImage() {
    const u = newImageUrl.trim()
    if (!u) return
    setEditImages((imgs) => [...imgs, u])
    setNewImageUrl('')
  }
  function addAttr() {
    const k = newAttrKey.trim()
    if (!k) return
    setEditAttrs((a) => ({ ...a, [k]: newAttrValue.trim() || '""' }))
    setNewAttrKey('')
    setNewAttrValue('')
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteTarget(null)
    if (useSample) {
      setRows((rs) => rs.filter((r) => r.id !== id))
      setTotal((t) => Math.max(0, t - 1))
      return
    }
    try {
      await listAmzApi.deleteCached(apiKey!, id)
      await load()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Xoá thất bại')
    }
  }

  async function confirmBulkDelete() {
    const ids = Array.from(selected)
    setBulkConfirm(false)
    if (useSample) {
      setRows((rs) => rs.filter((r) => !selected.has(r.id)))
      setTotal((t) => Math.max(0, t - ids.length))
      setSelected(new Set())
      return
    }
    try {
      await Promise.all(ids.map((id) => listAmzApi.deleteCached(apiKey!, id)))
      await load()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Xoá hàng loạt thất bại')
    }
  }

  // Apply bullet points / description to every selected listing. Empty fields are
  // omitted so they keep their current value server-side.
  async function confirmBulkEditContent() {
    if (useSample || !apiKey) {
      setBulkEditError('Cần API key để lưu — đăng nhập và đồng bộ trước.')
      return
    }
    const skus = rows.filter((r) => selected.has(r.id)).map((r) => r.sku).filter(Boolean) as string[]
    if (skus.length === 0) {
      setBulkEditError('Các listing đã chọn chưa có SKU — không thể cập nhật.')
      return
    }
    const bullets = bulkBullets.split('\n').map((s) => s.trim()).filter(Boolean)
    const description = bulkDescription.trim()
    if (bullets.length === 0 && !description) {
      setBulkEditError('Nhập bullet points hoặc mô tả để áp dụng.')
      return
    }
    setBulkEditLoading(true)
    setBulkEditError(null)
    try {
      const items = skus.map((sku) => ({
        sku,
        ...(bullets.length ? { bullet_points: bullets } : {}),
        ...(description ? { description } : {}),
      }))
      const r = await listAmzApi.bulkEditContent(apiKey, items)
      const failed = r.results.filter((x) => x.status === 'failed').length
      setBulkEditOpen(false)
      setBulkBullets('')
      setBulkDescription('')
      setSelected(new Set())
      await load()
      const note = failed ? ` · ${failed} lỗi` : ''
      setSyncMsg(`Đã cập nhật nội dung ${r.results.length - failed}/${r.results.length} listing${note}`)
    } catch (e) {
      setBulkEditError(e instanceof Error ? e.message : 'Cập nhật hàng loạt thất bại')
    } finally {
      setBulkEditLoading(false)
    }
  }

  function toggleRow(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const allOnPageSelected = display.length > 0 && display.every((r) => selected.has(r.id))
  function toggleAll() {
    setSelected((s) => {
      const next = new Set(s)
      if (allOnPageSelected) display.forEach((r) => next.delete(r.id))
      else display.forEach((r) => next.add(r.id))
      return next
    })
  }

  const showSkeleton = !loaded && !useSample
  const fromIdx = totalCount === 0 ? 0 : (page - 1) * (limit || totalCount) + 1
  const toIdx = limit === 0 ? totalCount : Math.min(totalCount, page * limit)

  return (
    <Layout title="Listing trên Amazon">
      {/* Toolbar */}
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="SKU / tiêu đề / ASIN…"
          className="field min-w-[180px] flex-1"
        />
        <select
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value)
            setPage(1)
          }}
          className="field"
          title="Lọc theo Type"
        >
          <option value="">Type: tất cả</option>
          {typeOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={filterNiche}
          onChange={(e) => {
            setFilterNiche(e.target.value)
            setPage(1)
          }}
          className="field"
          title="Lọc theo Nhóm"
        >
          <option value="">Nhóm: tất cả</option>
          {nicheOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value)
            setPage(1)
          }}
          className="field"
          title="Lọc theo Trạng thái"
        >
          <option value="">Trạng thái: tất cả</option>
          <option value="BUYABLE,DISCOVERABLE">Live</option>
          <option value="DISCOVERABLE">Inactive</option>
          <option value="NOT_DISCOVERABLE">Hidden</option>
          <option value="BUYABLE">Buyable only</option>
        </select>
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as 'newest' | 'oldest' | 'updated')
            setPage(1)
          }}
          className="field"
          title="Sắp xếp"
        >
          <option value="newest">Sắp xếp: Mới nhất</option>
          <option value="oldest">Sắp xếp: Cũ nhất</option>
          <option value="updated">Sắp xếp: Mới update</option>
        </select>
        <button onClick={sync} disabled={!canSync || syncing} className="btn btn-cyan" title="Đồng bộ từ Amazon">
          {syncing ? <Loader2 size={13} className="animate-spin" /> : <RotateCw size={13} />} Đồng bộ
        </button>
        <button onClick={load} disabled={loading} className="btn" title="Tải lại từ cache">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Sync freshness + bulk actions */}
      <div className="mb-2.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
        <span>
          {totalCount} listing · đồng bộ {syncedLabel(syncedAt)}
        </span>
        {syncMsg && <span className="text-ok">✓ {syncMsg}</span>}
        {selected.size > 0 && (
          <>
            <button
              onClick={() => {
                setBulkEditError(null)
                setBulkEditOpen(true)
              }}
              className="btn !py-0.5 !text-[11px]"
            >
              <Pencil size={12} /> Sửa nội dung ({selected.size})
            </button>
            <button onClick={() => setBulkConfirm(true)} className="btn btn-danger !py-0.5 !text-[11px]">
              <Trash2 size={12} /> Xoá đã chọn ({selected.size})
            </button>
          </>
        )}
      </div>

      {useSample && (
        <div className="mb-2.5 rounded-md border border-line bg-panel2 px-3 py-2 text-[11px] text-muted">
          Dữ liệu mẫu — đăng nhập + đồng bộ để xem listing thật.
        </div>
      )}
      {!useSample && !serviceConfigured.listAmz && (
        <div className="mb-2.5 rounded-md border border-line bg-panel2 px-3 py-2 text-[11px] text-muted">
          Chưa cấu hình list-amz service (NEXT_PUBLIC_LIST_AMZ_URL) — nút Đồng bộ bị tắt.
        </div>
      )}
      {errorMsg && (
        <div className="mb-2.5 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[11px] text-danger">
          {errorMsg}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted">
              <th className="w-8 border-b border-line px-2 py-1.5 text-left font-normal">
                <input type="checkbox" checked={allOnPageSelected} onChange={toggleAll} aria-label="Chọn tất cả" />
              </th>
              <th className="w-[72px] border-b border-line px-2 py-1.5 text-left font-normal">Ảnh</th>
              <th className="w-[150px] border-b border-line px-2 py-1.5 text-left font-normal">SKU</th>
              <th className="w-[110px] border-b border-line px-2 py-1.5 text-left font-normal">ASIN</th>
              <th className="border-b border-line px-2 py-1.5 text-left font-normal">Tên</th>
              <th className="w-[80px] border-b border-line px-2 py-1.5 text-left font-normal">Type</th>
              <th className="w-[70px] border-b border-line px-2 py-1.5 text-left font-normal">Giá</th>
              <th className="w-[110px] border-b border-line px-2 py-1.5 text-left font-normal">Trạng thái</th>
              <th className="w-[110px] border-b border-line px-2 py-1.5 text-left font-normal">Nhóm</th>
              <th className="w-[115px] border-b border-line px-2 py-1.5 text-left font-normal">Ngày tạo</th>
              <th className="w-[90px] border-b border-line px-2 py-1.5 text-left font-normal">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {showSkeleton && <SkeletonRows rows={6} cols={COLSPAN} />}
            {!showSkeleton &&
              display.map((r) => {
                const st = statusStyle(r.status)
                return (
                  <tr key={r.id} className="hover:bg-panel2">
                    <td className="border-b border-line px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleRow(r.id)}
                        aria-label={`Chọn ${r.sku ?? r.asin}`}
                      />
                    </td>
                    <td className="border-b border-line px-2 py-1.5">
                      {r.image_url ? (
                        <img
                          src={r.image_url}
                          alt=""
                          onClick={() => setLightboxSrc(r.image_url)}
                          className="h-14 w-14 cursor-pointer rounded object-cover"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded bg-panel2" />
                      )}
                    </td>
                    <td className="max-w-[150px] truncate border-b border-line px-2 py-1.5 font-mono text-[11px]">
                      {r.sku ?? '—'}
                    </td>
                    <td className="border-b border-line px-2 py-1.5 font-mono text-[11px]">
                      <a
                        href={`${AMZ_DP}${r.asin}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-brand hover:underline"
                      >
                        {r.asin}
                        <ExternalLink size={10} />
                      </a>
                    </td>
                    <td className="max-w-[240px] truncate border-b border-line px-2 py-1.5" title={r.title ?? ''}>
                      {r.title ?? '—'}
                    </td>
                    <td className="border-b border-line px-2 py-1.5">
                      {r.product_type ? <span className="badge b-mu">{r.product_type}</span> : '—'}
                    </td>
                    <td className="border-b border-line px-2 py-1.5">
                      {r.price != null ? `$${r.price.toFixed(2)}` : '—'}
                    </td>
                    <td className="border-b border-line px-2 py-1.5">
                      {st.label === 'inactive' || st.label === 'hidden' ? (
                        <div className="relative inline-block">
                          <button
                            onClick={() => loadIssues(r.sku ?? r.id)}
                            className={`badge ${st.badge} cursor-pointer`}
                            title="Xem lý do"
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                            {st.label}
                            <Info size={10} />
                          </button>
                          {issuesOpenSku === (r.sku ?? r.id) && (
                            <div className="absolute left-0 top-full z-20 mt-1 max-h-56 w-64 overflow-y-auto rounded-md border border-line bg-panel p-2 text-[11px] shadow-lg">
                              {issuesLoadingSku === (r.sku ?? r.id) ? (
                                <div className="flex items-center gap-1.5 text-muted">
                                  <Loader2 size={11} className="animate-spin" /> Đang tải…
                                </div>
                              ) : (issuesMap[r.sku ?? r.id]?.length ?? 0) === 0 ? (
                                <div className="text-muted">Không có lý do cụ thể từ Amazon.</div>
                              ) : (
                                <div className="space-y-1.5">
                                  {issuesMap[r.sku ?? r.id].map((issue, i) => (
                                    <div
                                      key={`${issue.code}-${i}`}
                                      className={issue.severity === 'ERROR' ? 'text-danger' : 'text-warn'}
                                    >
                                      {issue.message}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className={`badge ${st.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                      )}
                    </td>
                    <td className="border-b border-line px-2 py-1.5">
                      <select
                        value={r.niche ?? ''}
                        onChange={(e) => changeNiche(r, e.target.value)}
                        className="field w-full !px-1 !py-0.5 text-[11px]"
                        title="Đổi nhóm"
                      >
                        <option value="">— nhóm —</option>
                        {nicheOptions.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border-b border-line px-2 py-1.5 text-[11px] text-muted">
                      {fmtDateTime(r.amz_listed_at ?? r.created_at)}
                    </td>
                    <td className="border-b border-line px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(r)}
                          className="btn !px-1.5 !py-0.5 !text-[10px]"
                          title="Sửa listing"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ id: r.id, sku: r.sku ?? r.asin })}
                          className="btn btn-danger !px-1.5 !py-0.5 !text-[10px]"
                          title="Xoá"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            {!showSkeleton && display.length === 0 && !errorMsg && (
              <tr>
                <td colSpan={COLSPAN} className="px-2 py-10 text-center text-xs text-muted">
                  {totalCount === 0 ? 'Chưa có listing nào — bấm Đồng bộ để tải từ Amazon.' : 'Không khớp bộ lọc.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination bar */}
      {totalCount > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
          <div className="flex items-center gap-2">
            <span>
              {fromIdx}–{toIdx} / {totalCount}
            </span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value))
                setPage(1)
              }}
              className="field !py-0.5"
              title="Số dòng mỗi trang"
            >
              <option value={20}>20 / trang</option>
              <option value={50}>50 / trang</option>
              <option value={100}>100 / trang</option>
              <option value={0}>Tất cả</option>
            </select>
          </div>

          {limit !== 0 && totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn !px-1.5 !py-0.5"
                title="Trước"
              >
                <ChevronLeft size={13} />
              </button>
              {pageWindow(page, totalPages).map((p, i) =>
                p === '…' ? (
                  <span key={`e${i}`} className="px-1">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`btn !px-2 !py-0.5 ${p === page ? 'btn-acc' : ''}`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="btn !px-1.5 !py-0.5"
                title="Sau"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Image lightbox */}
      {lightboxSrc && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => setLightboxSrc(null)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
            <img
              src={lightboxSrc}
              alt=""
              style={{ width: 500, height: 500, objectFit: 'cover', borderRadius: 8 }}
            />
            <button
              onClick={() => setLightboxSrc(null)}
              className="btn"
              style={{ position: 'absolute', top: 8, right: 8 }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Edit listing modal (4 tabs) */}
      {editTarget && (
        <Overlay onClose={() => (saving ? null : setEditTarget(null))}>
          <div className="flex max-h-[90vh] w-[720px] max-w-[95vw] flex-col rounded-lg border border-line bg-panel">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-line p-4">
              <div className="min-w-0">
                <div className="text-sm font-medium">Sửa listing</div>
                <div className="mt-0.5 truncate text-[11px] text-muted" title={editTarget.title ?? ''}>
                  <span className="font-mono">{editTarget.sku ?? editTarget.asin}</span> · {editTarget.title ?? '—'}
                </div>
              </div>
              <button onClick={() => setEditTarget(null)} className="btn !px-1.5 !py-0.5" title="Đóng">
                <X size={14} />
              </button>
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-line px-4">
              {([
                { v: 'content', label: 'Nội dung' },
                { v: 'price', label: 'Giá & Kho' },
                { v: 'images', label: 'Ảnh' },
                { v: 'attrs', label: 'Attributes' },
              ] as const).map((t) => (
                <button
                  key={t.v}
                  onClick={() => setEditTab(t.v)}
                  className={`px-3 py-2 text-xs font-medium transition ${
                    editTab === t.v ? 'border-b-2 border-acc text-acc' : 'text-muted hover:text-fg'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {editTab === 'content' && (
                <div className="space-y-3">
                  {editAttrsLoading && (
                    <div className="flex items-center gap-2 text-[11px] text-muted">
                      <Loader2 size={12} className="animate-spin" /> Đang tải nội dung mới nhất từ Amazon…
                    </div>
                  )}
                  <div>
                    <label className="mb-1 block text-[11px] text-muted">
                      Tên sản phẩm (item_name){' '}
                      <span className={editItemName.length > 200 ? 'text-danger' : editItemName.length > 150 ? 'text-warn' : 'text-faint'}>
                        {editItemName.length}/200
                      </span>
                    </label>
                    <input value={editItemName} onChange={(e) => setEditItemName(e.target.value)} className="field w-full" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-muted">Gạch đầu dòng 1–5 (bullet_point)</label>
                    <div className="space-y-1.5">
                      {editBullets.map((b, i) => (
                        <textarea
                          key={i}
                          value={b}
                          maxLength={500}
                          onChange={(e) => setEditBullets((bs) => bs.map((x, j) => (j === i ? e.target.value : x)))}
                          placeholder={`Gạch đầu dòng ${i + 1}`}
                          className="field min-h-[38px] w-full resize-y text-xs"
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-muted">
                      Mô tả (product_description){' '}
                      <span className={editDescription.length > 2000 ? 'text-danger' : 'text-faint'}>{editDescription.length}/2000</span>
                    </label>
                    <textarea rows={5} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="field w-full resize-y" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-muted">Từ khoá (generic_keyword)</label>
                    <input value={editKeywords} onChange={(e) => setEditKeywords(e.target.value)} placeholder="kw1, kw2, kw3" className="field w-full" />
                  </div>
                </div>
              )}

              {editTab === 'price' && (
                <div className="grid max-w-sm grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] text-muted">Giá (USD)</label>
                    <input type="number" step="0.01" min="0" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="field w-full" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-muted">Số lượng</label>
                    <input type="number" step="1" min="0" value={editQty} onChange={(e) => setEditQty(e.target.value)} className="field w-full" />
                  </div>
                </div>
              )}

              {editTab === 'images' && (
                <div className="space-y-3">
                  {editImages.length === 0 && <div className="text-[12px] text-faint">Chưa có ảnh — thêm URL bên dưới.</div>}
                  <div className="grid grid-cols-3 gap-2">
                    {editImages.map((url, i) => (
                      <div key={`${url}-${i}`} className="group relative">
                        <img src={url} alt="" className="aspect-square w-full rounded border border-line object-cover" />
                        <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[9px] font-medium text-white">
                          {i === 0 ? 'Chính' : `Phụ ${i}`}
                        </span>
                        <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition group-hover:opacity-100">
                          <div className="flex gap-0.5">
                            <button onClick={() => moveImage(i, -1)} disabled={i === 0} className="rounded bg-black/70 px-1 text-white disabled:opacity-30" title="Sang trái">
                              <ChevronLeft size={12} />
                            </button>
                            <button onClick={() => moveImage(i, 1)} disabled={i === editImages.length - 1} className="rounded bg-black/70 px-1 text-white disabled:opacity-30" title="Sang phải">
                              <ChevronRight size={12} />
                            </button>
                          </div>
                          <button onClick={() => setEditImages((imgs) => imgs.filter((_, j) => j !== i))} className="rounded bg-danger px-1 text-white" title="Xoá ảnh">
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addImage()}
                      placeholder="https://…/image.jpg"
                      className="field flex-1"
                    />
                    <button onClick={addImage} className="btn">
                      <Plus size={13} /> Thêm
                    </button>
                  </div>
                </div>
              )}

              {editTab === 'attrs' && (
                <div className="space-y-3">
                  {Object.keys(editAttrs).length === 0 && (
                    <div className="text-[12px] text-faint">Không có attribute tuỳ chỉnh. Thêm bên dưới nếu cần.</div>
                  )}
                  {Object.entries(editAttrs).map(([k, v]) => (
                    <div key={k}>
                      <div className="mb-1 flex items-center justify-between">
                        <label className="font-mono text-[11px] text-muted">{k}</label>
                        <button
                          onClick={() => setEditAttrs((a) => { const n = { ...a }; delete n[k]; return n })}
                          className="text-[11px] text-danger hover:underline"
                        >
                          xoá
                        </button>
                      </div>
                      <textarea
                        rows={3}
                        value={v}
                        onChange={(e) => setEditAttrs((a) => ({ ...a, [k]: e.target.value }))}
                        className={`field w-full resize-y font-mono text-[11px] ${attrErrors[k] ? 'border-danger' : ''}`}
                      />
                      {attrErrors[k] && <div className="mt-0.5 text-[11px] text-danger">{attrErrors[k]}</div>}
                    </div>
                  ))}
                  <div className="rounded-md border border-dashed border-line p-2">
                    <div className="mb-1.5 text-[11px] font-medium text-muted">+ Thêm attribute</div>
                    <input value={newAttrKey} onChange={(e) => setNewAttrKey(e.target.value)} placeholder="attribute_key" className="field mb-1.5 w-full font-mono text-[11px]" />
                    <textarea
                      rows={2}
                      value={newAttrValue}
                      onChange={(e) => setNewAttrValue(e.target.value)}
                      placeholder='[{"value": "..."}]'
                      className="field mb-1.5 w-full resize-y font-mono text-[11px]"
                    />
                    <button onClick={addAttr} className="btn !text-[11px]">
                      <Plus size={12} /> Thêm attribute
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 border-t border-line p-4">
              {saveError && <div className="mr-auto text-[11px] text-danger">{saveError}</div>}
              <button onClick={() => setEditTarget(null)} disabled={saving} className={`btn ${saveError ? '' : 'ml-auto'}`}>
                Huỷ
              </button>
              <button onClick={saveActiveTab} disabled={saving} className="btn btn-acc">
                {saving ? <Loader2 size={13} className="animate-spin" /> : null} Lưu &amp; Đồng bộ
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {/* Single delete confirmation */}
      {deleteTarget && (
        <Overlay onClose={() => setDeleteTarget(null)}>
          <div className="w-[360px] max-w-full rounded-lg border border-line bg-panel p-4">
            <div className="mb-2 text-sm font-medium">Xoá listing</div>
            <p className="mb-4 text-[12px] text-muted">
              Xoá <span className="font-mono text-fg">{deleteTarget.sku}</span> khỏi danh sách cache? Listing sẽ
              xuất hiện lại ở lần đồng bộ sau nếu vẫn còn trên Amazon.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="btn">
                Huỷ
              </button>
              <button onClick={confirmDelete} className="btn btn-danger">
                Xoá
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {/* Bulk delete confirmation */}
      {bulkConfirm && (
        <Overlay onClose={() => setBulkConfirm(false)}>
          <div className="w-[360px] max-w-full rounded-lg border border-line bg-panel p-4">
            <div className="mb-2 text-sm font-medium">Xoá {selected.size} listing</div>
            <p className="mb-4 text-[12px] text-muted">
              Xoá {selected.size} listing đã chọn khỏi danh sách cache? Chúng sẽ xuất hiện lại ở lần đồng bộ sau
              nếu vẫn còn trên Amazon.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setBulkConfirm(false)} className="btn">
                Huỷ
              </button>
              <button onClick={confirmBulkDelete} className="btn btn-danger">
                Xoá đã chọn
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {/* Bulk content edit */}
      {bulkEditOpen && (
        <Overlay onClose={() => (bulkEditLoading ? null : setBulkEditOpen(false))}>
          <div className="w-[480px] max-w-[95vw] rounded-lg border border-line bg-panel p-4">
            <div className="mb-1 text-sm font-medium">Sửa nội dung {selected.size} listing</div>
            <p className="mb-3 text-[11px] text-muted">Trường để trống sẽ giữ nguyên giá trị cũ.</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] text-muted">Gạch đầu dòng (bullet_point)</label>
                <textarea
                  rows={5}
                  value={bulkBullets}
                  onChange={(e) => setBulkBullets(e.target.value)}
                  placeholder="Mỗi dòng 1 bullet point"
                  className="field w-full resize-y text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-muted">Mô tả (product_description)</label>
                <textarea
                  rows={4}
                  value={bulkDescription}
                  onChange={(e) => setBulkDescription(e.target.value)}
                  className="field w-full resize-y text-xs"
                />
              </div>
            </div>
            {bulkEditError && <div className="mt-2 text-[11px] text-danger">{bulkEditError}</div>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setBulkEditOpen(false)} disabled={bulkEditLoading} className="btn">
                Huỷ
              </button>
              <button onClick={confirmBulkEditContent} disabled={bulkEditLoading} className="btn btn-acc">
                {bulkEditLoading ? <Loader2 size={13} className="animate-spin" /> : null} Áp dụng
              </button>
            </div>
          </div>
        </Overlay>
      )}
    </Layout>
  )
}

// Centered modal backdrop; click outside closes.
function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  )
}
