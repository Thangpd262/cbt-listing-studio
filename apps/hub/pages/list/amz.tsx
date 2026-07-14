import { useCallback, useEffect, useMemo, useState } from 'react'
import { CloudDownload, RefreshCw } from 'lucide-react'
import Layout from '../../components/Layout'
import { SkeletonRows } from '../../components/Skeleton'
import { useAuth } from '../../lib/auth-context'
import { listAmzApi, serviceConfigured, type AmzProduct } from '../../lib/api'

// Sample Amazon listings — shown only in local dev (list-amz not wired).
const SAMPLE: AmzProduct[] = [
  {
    id: 's1',
    sku: 'SHIRT-042',
    title: 'Boho Floral Women Tee Cotton Soft Unisex',
    asin: 'B0CXXX001',
    status: 'active',
    product_type: 'SHIRT',
    created_at: '',
  },
  {
    id: 's2',
    sku: 'MUG-007',
    title: 'Rose Ceramic Mug 11oz Boho Flower Gift',
    asin: null,
    status: 'inactive',
    product_type: 'MUG',
    created_at: '',
  },
]

const USE_SAMPLE = !serviceConfigured.listAmz

export default function ListAmzPage() {
  const { apiKey } = useAuth()
  const [rows, setRows] = useState<AmzProduct[]>(USE_SAMPLE ? SAMPLE : [])
  const [loaded, setLoaded] = useState(USE_SAMPLE)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')

  const load = useCallback(async () => {
    if (USE_SAMPLE || !apiKey) {
      setRows(SAMPLE)
      setLoaded(true)
      return
    }
    setLoading(true)
    setErrorMsg(null)
    try {
      setRows(await listAmzApi.getProducts(apiKey))
    } catch (e) {
      setRows([])
      setErrorMsg(e instanceof Error ? e.message : 'Không tải được sản phẩm')
    } finally {
      setLoaded(true)
      setLoading(false)
    }
  }, [apiKey])

  useEffect(() => {
    load()
  }, [load])

  const types = useMemo(
    () => Array.from(new Set(rows.map((r) => r.product_type).filter(Boolean))) as string[],
    [rows]
  )
  const shown = rows.filter((r) => {
    if (type && r.product_type !== type) return false
    if (search && !`${r.sku} ${r.title} ${r.asin ?? ''}`.toLowerCase().includes(search.toLowerCase()))
      return false
    return true
  })
  const showSkeleton = !loaded && !USE_SAMPLE

  return (
    <Layout title="Listing trên Amazon">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="SKU / tiêu đề / ASIN…"
          className="field flex-1"
        />
        <select value={type} onChange={(e) => setType(e.target.value)} className="field">
          <option value="">Tất cả type</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button className="btn">
          <CloudDownload size={13} /> Đồng bộ ngay
        </button>
        <button onClick={load} disabled={loading} className="btn">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {USE_SAMPLE && (
        <div className="mb-2.5 rounded-md border border-line bg-panel2 px-3 py-2 text-[11px] text-muted">
          Dữ liệu mẫu — kết nối list-amz service + API key để xem sản phẩm thật.
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
            {['', 'SKU', 'Tiêu đề', 'ASIN', 'Type', 'Trạng thái', 'Hành động'].map((h, i) => (
              <th key={i} className="border-b border-line px-2 py-1.5 text-left font-normal">
                {i === 0 ? <input type="checkbox" /> : h}
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
                  <input type="checkbox" />
                </td>
                <td className="border-b border-line px-2 py-1.5 font-mono text-[11px]">{r.sku}</td>
                <td className="max-w-[200px] truncate border-b border-line px-2 py-1.5">{r.title}</td>
                <td
                  className={`border-b border-line px-2 py-1.5 font-mono text-[11px] ${
                    r.asin ? 'text-brand' : 'text-muted'
                  }`}
                >
                  {r.asin ?? '—'}
                </td>
                <td className="border-b border-line px-2 py-1.5">
                  <span className="badge b-mu">{r.product_type ?? '—'}</span>
                </td>
                <td className="border-b border-line px-2 py-1.5">
                  <span className={`badge ${r.status === 'active' ? 'b-ok' : 'b-er'}`}>{r.status}</span>
                </td>
                <td className="whitespace-nowrap border-b border-line px-2 py-1.5">
                  <button className="btn !text-[11px]">Sửa</button>{' '}
                  <button className="btn btn-danger !text-[11px]">Xoá</button>
                </td>
              </tr>
            ))}
          {!showSkeleton && shown.length === 0 && !errorMsg && (
            <tr>
              <td colSpan={7} className="px-2 py-10 text-center text-xs text-muted">
                {rows.length === 0 ? 'Chưa có sản phẩm nào.' : 'Không có sản phẩm khớp bộ lọc.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Layout>
  )
}
