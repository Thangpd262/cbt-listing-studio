import { useState } from 'react'
import { RefreshCw, Trash2, Loader2 } from 'lucide-react'
import Layout from '../components/Layout'
import { SkeletonRows } from '../components/Skeleton'
import JobDetailModal, { StatusBadge, statusLabel, type JobDetail } from '../components/JobDetailModal'
import { useAuth } from '../lib/auth-context'
import { listAmzApi, serviceConfigured, type AmzJob } from '../lib/api'
import { useJobs } from '../lib/queries'
import { formatDateTime } from '../lib/format'
import { SAMPLE_JOBS } from '../lib/sample-data'

// Unified row shape for both real (AmzJob) and sample jobs. Carries everything
// the table + detail modal need (status is the raw DB value).
type Row = {
  id: string
  sku: string
  action: string
  status: string
  time: string
  attempts: number
  issues: number
  errorFull: string | null
  submissionId: string | null
  payload: unknown
  result: unknown
}

// Shape of the SP-API response we persist in amz_listing_jobs.result.
type SpResult = {
  submissionId?: string
  issues?: Array<{ code?: string; message?: string; severity?: string }>
}

const SAMPLE_ROWS: Row[] = SAMPLE_JOBS.map((j) => ({
  id: j.id,
  sku: j.sku,
  action: j.action,
  status: j.status,
  time: j.time,
  attempts: 0,
  issues: 0,
  errorFull: null,
  submissionId: null,
  payload: {},
  result: null,
}))

// Sample data only when list-amz isn't wired (local dev). Otherwise: real data
// with a skeleton loader, never sample.
const USE_SAMPLE = !serviceConfigured.listAmz

// Full error reason for a job: the stored exception message, else the
// aggregated ERROR-severity SP-API issues, else none.
function jobErrorText(j: AmzJob): string | null {
  if (j.error) return j.error
  const issues = (j.result as SpResult | null)?.issues ?? []
  const errs = issues.filter((i) => (i.severity ?? '').toUpperCase() === 'ERROR')
  if (errs.length) return errs.map((i) => `${i.code ? i.code + ': ' : ''}${i.message ?? ''}`.trim()).join('\n')
  return null
}

// The jobs endpoint returns amz_listing_jobs (product join for SKU) — fall back
// to the payload's item_name when no product row is linked yet.
function toRow(j: AmzJob): Row {
  const fv = (j.payload?.field_values ?? {}) as Record<string, string>
  const result = j.result as SpResult | null
  return {
    id: j.id,
    sku: j.sku ?? (fv.item_name ? fv.item_name.slice(0, 24) : '—'),
    action: j.action,
    status: j.status,
    time: formatDateTime(j.created_at),
    attempts: j.retry_count ?? 0,
    issues: result?.issues?.length ?? 0,
    errorFull: jobErrorText(j),
    submissionId: result?.submissionId ?? null,
    payload: j.payload ?? {},
    result: j.result ?? null,
  }
}

function truncate(s: string, n = 50): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

// Filter options are the display labels (accepted/error/…), matching statusLabel.
const FILTERS = ['pending', 'processing', 'accepted', 'error'] as const

export default function JobsPage() {
  const { apiKey } = useAuth()
  const jobsQuery = useJobs()
  const [filter, setFilter] = useState('') // '' = all; otherwise a display label
  // Sample mode has no backend to refetch from, so it keeps rows locally and
  // mutates them optimistically. Real mode reads from the React Query cache.
  const [sampleRows, setSampleRows] = useState<Row[]>(SAMPLE_ROWS)
  const [retrying, setRetrying] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [detail, setDetail] = useState<Row | null>(null)

  const rows: Row[] = USE_SAMPLE ? sampleRows : (jobsQuery.data?.data.map(toRow) ?? [])

  async function retry(id: string) {
    if (!apiKey || USE_SAMPLE) return
    setRetrying(id)
    try {
      await listAmzApi.retryJob(apiKey, id)
      setDetail(null)
      await jobsQuery.refetch()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Retry thất bại')
    } finally {
      setRetrying(null)
    }
  }

  async function deleteOne(id: string) {
    if (!confirm('Xoá job này?')) return
    if (apiKey && !USE_SAMPLE) {
      try {
        await listAmzApi.deleteJob(apiKey, id)
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Xoá thất bại')
        return
      }
      await jobsQuery.refetch()
      return
    }
    setSampleRows((rs) => rs.filter((r) => r.id !== id))
  }

  // Bulk-remove every error + pending job.
  async function clearFailedPending() {
    const targets = rows.filter((r) => r.status === 'failed' || r.status === 'pending')
    if (targets.length === 0) return
    if (!confirm(`Xoá ${targets.length} job lỗi/chờ?`)) return
    if (apiKey && !USE_SAMPLE) {
      setBusy(true)
      try {
        await Promise.all(targets.map((r) => listAmzApi.deleteJob(apiKey, r.id)))
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Xoá thất bại')
      } finally {
        setBusy(false)
      }
      await jobsQuery.refetch()
      return
    }
    const ids = new Set(targets.map((r) => r.id))
    setSampleRows((rs) => rs.filter((r) => !ids.has(r.id)))
  }

  const shown = filter ? rows.filter((r) => statusLabel(r.status) === filter) : rows
  const showSkeleton = !USE_SAMPLE && jobsQuery.isLoading
  const loading = jobsQuery.isFetching
  const errorMsg =
    !USE_SAMPLE && jobsQuery.isError
      ? jobsQuery.error instanceof Error
        ? jobsQuery.error.message
        : 'Không tải được jobs'
      : null

  const modalJob: JobDetail | null = detail && {
    id: detail.id,
    sku: detail.sku,
    action: detail.action,
    status: detail.status,
    submissionId: detail.submissionId,
    attempts: detail.attempts,
    errorText: detail.errorFull,
    payload: detail.payload,
    result: detail.result,
  }

  return (
    <Layout title="Jobs">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="field">
          <option value="">Tất cả</option>
          {FILTERS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <button onClick={clearFailedPending} disabled={busy} className="btn btn-danger">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Xoá lỗi/chờ
        </button>
        <button onClick={() => jobsQuery.refetch()} disabled={loading} className="btn ml-auto" title="Tải lại">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {USE_SAMPLE && (
        <div className="mb-2.5 rounded-md border border-line bg-panel2 px-3 py-2 text-[11px] text-muted">
          Dữ liệu mẫu — kết nối list-amz service + API key để xem job thật.
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
            {['SKU', 'OP', 'TRẠNG THÁI', 'ISSUES', 'LỖI', 'THỜI GIAN', 'THAO TÁC'].map((h, i) => (
              <th key={i} className="border-b border-line px-2 py-1.5 text-left font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {showSkeleton && <SkeletonRows rows={6} cols={7} />}
          {!showSkeleton &&
            shown.map((j) => (
              <tr key={j.id} className="hover:bg-panel2">
                <td className="border-b border-line px-2 py-1.5 font-mono text-[12px]">{j.sku}</td>
                <td className="border-b border-line px-2 py-1.5">{j.action}</td>
                <td className="border-b border-line px-2 py-1.5">
                  <StatusBadge status={j.status} />
                </td>
                <td className="border-b border-line px-2 py-1.5">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${j.issues > 0 ? 'bg-brand' : 'bg-line2'}`} />
                    {j.issues}
                  </span>
                </td>
                <td className="max-w-[220px] border-b border-line px-2 py-1.5">
                  {j.errorFull ? (
                    <span className="text-[12px] text-danger" title={j.errorFull}>
                      {truncate(j.errorFull)}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="border-b border-line px-2 py-1.5 font-mono text-muted">{j.time}</td>
                <td className="border-b border-line px-2 py-1.5">
                  <div className="flex gap-1.5">
                    <button className="btn !text-[11px]" onClick={() => setDetail(j)}>
                      Chi tiết
                    </button>
                    <button className="btn btn-danger !text-[11px]" onClick={() => deleteOne(j.id)}>
                      <Trash2 size={11} /> Xoá
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          {!showSkeleton && shown.length === 0 && !errorMsg && (
            <tr>
              <td colSpan={7} className="px-2 py-10 text-center text-xs text-muted">
                Chưa có job nào.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {modalJob && (
        <JobDetailModal
          job={modalJob}
          onClose={() => setDetail(null)}
          onRetry={USE_SAMPLE ? undefined : retry}
          retrying={retrying === modalJob.id}
        />
      )}
    </Layout>
  )
}
