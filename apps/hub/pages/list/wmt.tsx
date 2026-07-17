import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, RotateCw, Loader2 } from 'lucide-react'
import Layout from '../../components/Layout'
import { SkeletonRows } from '../../components/Skeleton'
import { useAuth } from '../../lib/auth-context'
import { listWmtApi, serviceConfigured, type WmtCachedListing } from '../../lib/api'

// Sample listings — shown only in local dev (no API key).
const SAMPLE: WmtCachedListing[] = [
  {
    id: 's1',
    sku: 'SHIRT-042',
    wpid: 'WPID10001',
    title: 'Boho Floral Women Tee Cotton Soft Unisex',
    status: 'PUBLISHED',
    price: 21.99,
    quantity: 120,
    image_url: null,
    synced_at: '',
  },
  {
    id: 's2',
    sku: 'MUG-007',
    wpid: 'WPID10002',
    title: 'Rose Ceramic Mug 11oz Boho Flower Gift',
    status: 'UNPUBLISHED',
    price: 14.5,
    quantity: 0,
    image_url: null,
    synced_at: '',
  },
]

// "lúc 14:05 · 14/07/2026" from an ISO timestamp.
function syncedLabel(iso: string | null): string {
  if (!iso) return 'chưa đồng bộ'
  const d = new Date(iso)
  const t = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  return `lúc ${t} · ${d.toLocaleDateString('vi-VN')}`
}

export default function ListWmtPage() {
  const { apiKey } = useAuth()
  const useSample = !apiKey
  const canSync = serviceConfigured.listWmt && !!apiKey

  const [rows, setRows] = useState<WmtCachedListing[]>(useSample ? SAMPLE : [])
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(useSample)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (useSample) {
      setRows(SAMPLE)
      setLoaded(true)
      return
    }
    setLoading(true)
    setErrorMsg(null)
    try {
      const { listings, last_synced_at } = await listWmtApi.getCachedListings(apiKey!)
      setRows(listings)
      setSyncedAt(last_synced_at)
    } catch (e) {
      setRows([])
      setErrorMsg(e instanceof Error ? e.message : 'Không tải được listing')
    } finally {
      setLoaded(true)
      setLoading(false)
    }
  }, [apiKey, useSample])

  useEffect(() => {
    load()
  }, [load])

  async function sync() {
    if (!canSync) return
    setSyncing(true)
    setSyncMsg(null)
    setErrorMsg(null)
    try {
      const r = await listWmtApi.syncListings(apiKey!)
      await load()
      const errNote = r.errors.length ? ` · ${r.errors.length} tài khoản lỗi` : ''
      setSyncMsg(`Đã đồng bộ ${r.synced} listing${errNote}`)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Đồng bộ thất bại')
    } finally {
      setSyncing(false)
    }
  }

  const shown = useMemo(
    () =>
      rows.filter((r) =>
        search
          ? `${r.sku} ${r.title ?? ''} ${r.wpid ?? ''}`.toLowerCase().includes(search.toLowerCase())
          : true
      ),
    [rows, search]
  )
  const showSkeleton = !loaded && !useSample

  return (
    <Layout title="Listing trên Walmart">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="SKU / tiêu đề / WPID…"
          className="field flex-1"
        />
        <button onClick={sync} disabled={!canSync || syncing} className="btn btn-cyan" title="Đồng bộ từ Walmart">
          {syncing ? <Loader2 size={13} className="animate-spin" /> : <RotateCw size={13} />} Đồng bộ
        </button>
        <button onClick={load} disabled={loading} className="btn" title="Tải lại từ cache">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="mb-2.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
        <span>
          {rows.length} listing · đồng bộ {syncedLabel(syncedAt)}
        </span>
        {syncMsg && <span className="text-ok">✓ {syncMsg}</span>}
      </div>

      {useSample && (
        <div className="mb-2.5 rounded-md border border-line bg-panel2 px-3 py-2 text-[11px] text-muted">
          Dữ liệu mẫu — đăng nhập + đồng bộ để xem listing thật.
        </div>
      )}
      {!useSample && !serviceConfigured.listWmt && (
        <div className="mb-2.5 rounded-md border border-line bg-panel2 px-3 py-2 text-[11px] text-muted">
          Chưa cấu hình list-wmt service (NEXT_PUBLIC_LIST_WMT_URL) — nút Đồng bộ bị tắt.
        </div>
      )}
      {errorMsg && (
        <div className="mb-2.5 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[11px] text-danger">
          {errorMsg}
        </div>
      )}

      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted">
            {['', 'SKU', 'Tiêu đề', 'WPID', 'Giá', 'Tồn', 'Trạng thái'].map((h, i) => (
              <th key={i} className="border-b border-line px-2 py-1.5 text-left font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {showSkeleton && <SkeletonRows rows={6} cols={7} />}
          {!showSkeleton &&
            shown.map((r) => (
              <tr key={r.id} className="hover:bg-panel2">
                <td className="border-b border-line px-2 py-1.5">
                  {r.image_url ? (
                    <img src={r.image_url} alt="" className="h-8 w-8 rounded object-cover" />
                  ) : (
                    <div className="h-8 w-8 rounded bg-panel2" />
                  )}
                </td>
                <td className="border-b border-line px-2 py-1.5 font-mono text-[11px]">{r.sku}</td>
                <td className="max-w-[220px] truncate border-b border-line px-2 py-1.5">{r.title ?? '—'}</td>
                <td className="border-b border-line px-2 py-1.5 font-mono text-[11px] text-brand">
                  {r.wpid ?? '—'}
                </td>
                <td className="border-b border-line px-2 py-1.5">{r.price != null ? `$${r.price}` : '—'}</td>
                <td className={`border-b border-line px-2 py-1.5 ${r.quantity === 0 ? 'text-danger' : ''}`}>
                  {r.quantity ?? '—'}
                </td>
                <td className="border-b border-line px-2 py-1.5">
                  <span className="badge b-mu">{r.status ?? '—'}</span>
                </td>
              </tr>
            ))}
          {!showSkeleton && shown.length === 0 && !errorMsg && (
            <tr>
              <td colSpan={7} className="px-2 py-10 text-center text-xs text-muted">
                {rows.length === 0 ? 'Chưa có listing nào — bấm Đồng bộ để tải từ Walmart.' : 'Không khớp bộ lọc.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Layout>
  )
}
