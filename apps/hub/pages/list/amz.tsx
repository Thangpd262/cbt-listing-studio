import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  RefreshCw,
  RotateCw,
  Loader2,
  Pencil,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
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
    synced_at: '2026-07-14T07:05:00Z',
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
    synced_at: '2026-07-14T07:05:00Z',
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
  return STATUS_MAP[raw] ?? { label: raw, badge: 'b-mu', dot: 'bg-muted' }
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
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  // Groups (niche) options + row-level UI state.
  const [groups, setGroups] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<AmzCachedListing | null>(null)
  const [editNiche, setEditNiche] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; sku: string } | null>(null)
  const [bulkConfirm, setBulkConfirm] = useState(false)

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
  }, [apiKey, useSample, page, limit, search, filterType, filterNiche])

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
  }, [page, limit, search, filterType, filterNiche])

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

  // Sample mode filters/pages locally over the editable `rows`.
  const sampleView = useMemo(() => {
    if (!useSample) return null
    let f = rows
    if (search) {
      const q = search.toLowerCase()
      f = f.filter((r) => `${r.sku ?? ''} ${r.title ?? ''} ${r.asin}`.toLowerCase().includes(q))
    }
    if (filterType) f = f.filter((r) => r.product_type === filterType)
    if (filterNiche) f = f.filter((r) => r.niche === filterNiche)
    return f
  }, [useSample, rows, search, filterType, filterNiche])

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
    setEditNiche(row.niche ?? '')
  }

  async function saveEdit() {
    if (!editTarget) return
    const value = editNiche.trim()
    setRows((rs) => rs.map((x) => (x.id === editTarget.id ? { ...x, niche: value || null } : x)))
    setEditTarget(null)
    if (useSample) return
    try {
      await listAmzApi.updateNiche(apiKey!, editTarget.id, value)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Không lưu được')
      load()
    }
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
          <button onClick={() => setBulkConfirm(true)} className="btn btn-danger !py-0.5 !text-[11px]">
            <Trash2 size={12} /> Xoá đã chọn ({selected.size})
          </button>
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
                      <span className={`badge ${st.badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
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
                      {fmtDateTime(r.created_at)}
                    </td>
                    <td className="border-b border-line px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(r)}
                          className="btn !px-1.5 !py-0.5 !text-[10px]"
                          title="Sửa nhóm"
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

      {/* Edit (niche) modal */}
      {editTarget && (
        <Overlay onClose={() => setEditTarget(null)}>
          <div className="w-[360px] max-w-full rounded-lg border border-line bg-panel p-4">
            <div className="mb-1 text-sm font-medium">Sửa nhóm</div>
            <div className="mb-3 truncate text-[11px] text-muted" title={editTarget.title ?? ''}>
              {editTarget.sku ?? editTarget.asin} · {editTarget.title ?? '—'}
            </div>
            <label className="mb-1 block text-[11px] text-muted">Nhóm (niche)</label>
            <input
              value={editNiche}
              onChange={(e) => setEditNiche(e.target.value)}
              list="niche-options"
              placeholder="Chọn hoặc nhập nhóm mới…"
              className="field mb-3 w-full"
              autoFocus
            />
            <datalist id="niche-options">
              {nicheOptions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditTarget(null)} className="btn">
                Huỷ
              </button>
              <button onClick={saveEdit} className="btn btn-acc">
                Lưu
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
