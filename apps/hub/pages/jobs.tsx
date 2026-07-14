import { useState } from 'react'
import { RefreshCw, Trash2 } from 'lucide-react'
import Layout from '../components/Layout'
import { SAMPLE_JOBS } from '../lib/sample-data'

const STATUS_BADGE: Record<string, string> = {
  success: 'b-ok',
  failed: 'b-er',
  processing: 'b-wn',
  pending: 'b-mu',
}

export default function JobsPage() {
  const [status, setStatus] = useState('')
  const jobs = SAMPLE_JOBS.filter((j) => !status || j.status === status)

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
        <button className="btn ml-auto">
          <RefreshCw size={13} />
        </button>
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted">
            {['Job ID', 'SKU', 'Hành động', 'Nhân viên', 'Trạng thái', 'Thời gian', ''].map((h, i) => (
              <th key={i} className="border-b border-line px-2 py-1.5 text-left font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id} className="hover:bg-panel2">
              <td className="border-b border-line px-2 py-1.5 font-mono text-[10px] text-muted">{j.id}</td>
              <td className="border-b border-line px-2 py-1.5">{j.sku}</td>
              <td className="border-b border-line px-2 py-1.5">{j.action}</td>
              <td className="border-b border-line px-2 py-1.5">{j.user}</td>
              <td className="border-b border-line px-2 py-1.5">
                <span className={`badge ${STATUS_BADGE[j.status]}`}>{j.status}</span>
              </td>
              <td className="border-b border-line px-2 py-1.5 text-muted">{j.time}</td>
              <td className="border-b border-line px-2 py-1.5">
                <button className={`btn !text-[11px] ${j.status === 'failed' ? 'text-danger' : ''}`}>
                  {j.status === 'failed' ? 'Xem lỗi' : 'Xem'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  )
}
