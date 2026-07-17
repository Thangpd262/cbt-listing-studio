import { useEffect } from 'react'
import { X, RotateCcw, Loader2 } from 'lucide-react'

// DB status → competitor-facing label + pill colors (SP-API terminology).
const STATUS_DISPLAY: Record<string, { label: string; cls: string }> = {
  success: { label: 'accepted', cls: 'bg-[#D1FAE5] text-[#065F46]' },
  accepted: { label: 'accepted', cls: 'bg-[#D1FAE5] text-[#065F46]' },
  pending: { label: 'pending', cls: 'bg-[#FEF3C7] text-[#92400E]' },
  processing: { label: 'processing', cls: 'bg-brand-soft text-brand2' },
  failed: { label: 'error', cls: 'bg-[#FEE2E2] text-[#991B1B]' },
  error: { label: 'error', cls: 'bg-[#FEE2E2] text-[#991B1B]' },
}

export function statusLabel(status: string): string {
  return STATUS_DISPLAY[status]?.label ?? status
}

// Color-coded status pill with a leading dot. `status` is the raw DB value.
export function StatusBadge({ status }: { status: string }) {
  const d = STATUS_DISPLAY[status] ?? { label: status, cls: 'bg-panel2 text-muted' }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium ${d.cls}`}>
      ● {d.label}
    </span>
  )
}

export type JobDetail = {
  id: string
  sku: string
  action: string
  status: string // raw DB status
  submissionId: string | null
  attempts: number
  errorText: string | null
  payload: unknown
  result: unknown // raw SP-API response stored on the job row
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5">
      <div className="w-28 flex-shrink-0 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">{label}</div>
      <div className="min-w-0 flex-1 text-[13px] text-fg">{children}</div>
    </div>
  )
}

type SpIssue = { code?: string; message?: string; severity?: string }

export default function JobDetailModal({
  job,
  onClose,
  onRetry,
  retrying,
}: {
  job: JobDetail
  onClose: () => void
  onRetry?: (id: string) => void
  retrying?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const isError = job.status === 'failed' || job.status === 'error'
  const payloadText = (() => {
    try {
      return JSON.stringify(job.payload ?? {}, null, 2)
    } catch {
      return String(job.payload)
    }
  })()
  const resultText = (() => {
    try {
      return JSON.stringify(job.result ?? {}, null, 2)
    } catch {
      return String(job.result)
    }
  })()

  const spResult = job.result as { issues?: SpIssue[]; warnings?: string[]; submissionId?: string } | null
  const warnings = spResult?.warnings ?? spResult?.issues?.filter(i => i.severity?.toUpperCase() === 'WARNING').map(i => `${i.code ? i.code + ': ' : ''}${i.message ?? ''}`) ?? []

  return (
    <div
      onClick={onClose}
      data-testid="job-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-[3px]"
      style={{ background: 'rgba(14,17,22,0.42)' }}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        data-testid="job-modal"
        className="max-h-[85vh] w-[560px] max-w-[92vw] overflow-y-auto rounded-2xl border border-line bg-panel p-6 shadow-[0_20px_60px_rgba(14,17,22,0.16)]"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-disp text-[15px] font-bold text-fg">Chi tiết Job</h2>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="grid h-7 w-7 place-items-center rounded-md border border-line bg-panel2 text-muted transition hover:text-fg"
          >
            <X size={15} />
          </button>
        </div>

        <div className="divide-y divide-line/60">
          <Field label="SKU">
            <span className="font-mono">{job.sku}</span>
          </Field>
          <Field label="Operation">{job.action}</Field>
          <Field label="Trạng thái">
            <StatusBadge status={job.status} />
          </Field>
          <Field label="Submission">
            <span className="break-all font-mono text-[12px]">{job.submissionId ?? '—'}</span>
          </Field>
          <Field label="Attempts">{job.attempts}</Field>
          <Field label="Lỗi">
            {job.errorText ? (
              <span className="whitespace-pre-wrap text-[13px] text-danger">{job.errorText}</span>
            ) : (
              '—'
            )}
          </Field>
          {warnings.length > 0 && (
            <Field label="Warnings">
              <ul className="space-y-0.5">
                {warnings.map((w, i) => (
                  <li key={i} className="text-[12px] text-amber-600">{w}</li>
                ))}
              </ul>
            </Field>
          )}
        </div>

        <div className="mt-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">Payload (gửi lên)</div>
          <pre className="max-h-48 overflow-auto whitespace-pre break-all rounded-lg border border-line bg-panel2 p-3 font-mono text-[11.5px] leading-relaxed text-fg">
            {payloadText}
          </pre>
        </div>

        {!!job.result && (
          <div className="mt-3">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">Response từ Amazon</div>
            <pre className="max-h-48 overflow-auto whitespace-pre break-all rounded-lg border border-line bg-panel2 p-3 font-mono text-[11.5px] leading-relaxed text-fg">
              {resultText}
            </pre>
          </div>
        )}

        {isError && onRetry && (
          <div className="mt-4 flex justify-end">
            <button onClick={() => onRetry(job.id)} disabled={retrying} className="btn btn-danger">
              {retrying ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Thử lại
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
