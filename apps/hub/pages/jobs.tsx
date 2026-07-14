import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Trash2, RotateCcw, Loader2 } from 'lucide-react'
import Layout from '../components/Layout'
import { useAuth } from '../lib/auth-context'
import { listAmzApi, type AmzJob } from '../lib/api'
import { timeAgo } from '../lib/format'
import { SAMPLE_JOBS } from '../lib/sample-data'

const STATUS_BADGE: Record<string, string> = {
  success: 'b-ok',
  failed: 'b-er',
  processing: 'b-wn',
  pending: 'b-mu',
}

// Unified row shape for both real (AmzJob) and sample jobs.
type Row = {
  id: string
  sku: string
  action: string
  user: string
  status: string
  time: string
  retry_count?: number
  error?: string | null
}

const SAMPLE_ROWS: Row[] = SAMPLE_JOBS.map((j) => ({ ...j }))

// The jobs endpoint returns amz_listing_jobs (no product join) — SKU/user live
// on the product, so we surface item_name from the payload when present.
function toRow(j: AmzJob): Row {
  const fv = (j.payload?.field_values ?? {}) as Record<string, string>
  return {
    id: j.id,
    sku: j.sku ?? (fv.item_name ? fv.item_name.slice(0, 24) : '—'),
    action: j.action,
    user: j.created_by_email ?? '—',
    status: j.status,
    time: timeAgo(j.created_at),
    retry_count: j.retry_count,
    error: j.error,
  }
}

export default function JobsPage() {
  const { apiKey } = useAuth()
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState<Row[]>(SAMPLE_ROWS)
  const [usingSample, setUsingSample] = useState(true)
  const [loading, setLoading] = useState(false)
  const [retrying, setRetrying] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!apiKey) {
      setRows(SAMPLE_ROWS)
      setUsingSample(true)
      return
    }
    setLoading(true)
    try {
      const { data } = await listAmzApi.getJobs(apiKey, { status: status || undefined, limit: 50 })
      setRows(data.map(toRow))
      setUsingSample(false)
    } catch {
      setRows(SAMPLE_ROWS)
      setUsingSample(true)
    } finally {
      setLoading(false)
    }
  }, [apiKey, status])

  useEffect(() => {
    load()
  }, [load])

  async function retry(id: string) {
    if (!apiKey || usingSample) return
    setRetrying(id)
    try {
      await listAmzApi.retryJob(apiKey, id)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Retry thất bại')
    } finally {
      setRetrying(null)
    }
  }

  const shown = usingSample ? rows.filter((r) => !status || r.status === status) : rows

  return (
    <Layout title="Jobs">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="field">
          <option value="">Tất cả trạng thái</option>
          <option value="pending">pending</option>
          <option value="processing">processing</option>
          <option value="success">success</option>
          <option value="failed">failed</option>
        </select>
        <button className="btn btn-danger">
          <Trash2 size={13} /> Xoá lỗi/chờ
        </button>
        <button onClick={load} disabled={loading} className="btn ml-auto">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {usingSample && (
        <div className="mb-2.5 rounded-md border border-line bg-panel2 px-3 py-2 text-[11px] text-muted">
          Dữ liệu mẫu — kết nối list-amz service + API key để xem job thật.
        </div>
      )}

      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted">
            {['Job ID', 'SKU / tên', 'Hành động', 'Nhân viên', 'Trạng thái', 'Thời gian', ''].map((h, i) => (
              <th key={i} className="border-b border-line px-2 py-1.5 text-left font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((j) => (
            <tr key={j.id} className="hover:bg-panel2" title={j.error ?? undefined}>
              <td className="border-b border-line px-2 py-1.5 font-mono text-[10px] text-muted">
                {j.id.slice(0, 8)}
              </td>
              <td className="border-b border-line px-2 py-1.5">{j.sku}</td>
              <td className="border-b border-line px-2 py-1.5">{j.action}</td>
              <td className="border-b border-line px-2 py-1.5">{j.user}</td>
              <td className="border-b border-line px-2 py-1.5">
                <span className={`badge ${STATUS_BADGE[j.status] ?? 'b-mu'}`}>{j.status}</span>
                {(j.retry_count ?? 0) > 0 && (
                  <span className="ml-1 text-[10px] text-muted">×{j.retry_count}</span>
                )}
              </td>
              <td className="border-b border-line px-2 py-1.5 text-muted">{j.time}</td>
              <td className="border-b border-line px-2 py-1.5">
                {j.status === 'failed' && !usingSample ? (
                  <button
                    onClick={() => retry(j.id)}
                    disabled={retrying === j.id}
                    className="btn btn-danger !text-[11px]"
                  >
                    {retrying === j.id ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                    Retry
                  </button>
                ) : (
                  <button className="btn !text-[11px]">Xem</button>
                )}
              </td>
            </tr>
          ))}
          {shown.length === 0 && (
            <tr>
              <td colSpan={7} className="px-2 py-10 text-center text-xs text-muted">
                {loading ? 'Đang tải…' : 'Chưa có job nào.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Layout>
  )
}
