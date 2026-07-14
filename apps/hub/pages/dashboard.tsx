import { useState } from 'react'
import { Users, TrendingUp, Clock, RefreshCw, Activity } from 'lucide-react'
import Layout from '../components/Layout'
import { BarChart, LineChart, type LineSeries } from '../components/Charts'

// Sample data — swapped for the stats API once the backend ships.
const STATS = [
  { n: '1,248', l: 'Jobs tháng này', d: '+12% so tháng trước', tone: 'up' as const },
  { n: '94%', l: 'Tỷ lệ thành công', d: '+2%', tone: 'up' as const },
  { n: '6', l: 'Nhân viên hoạt động', d: 'không đổi', tone: 'flat' as const },
  { n: '3', l: 'Job đang lỗi', d: 'cần xử lý', tone: 'down' as const },
]

// Jobs per employee, per period.
const JOBS_BY_PERIOD: Record<string, { label: string; value: number }[]> = {
  today: [
    { label: 'Thang', value: 48 }, { label: 'Linh', value: 41 }, { label: 'Nam', value: 33 },
    { label: 'Mai', value: 29 }, { label: 'Hoa', value: 22 }, { label: 'Duc', value: 18 },
  ],
  '7d': [
    { label: 'Thang', value: 312 }, { label: 'Linh', value: 287 }, { label: 'Nam', value: 241 },
    { label: 'Mai', value: 198 }, { label: 'Hoa', value: 167 }, { label: 'Duc', value: 143 },
  ],
  '30d': [
    { label: 'Thang', value: 1240 }, { label: 'Linh', value: 1108 }, { label: 'Nam', value: 962 },
    { label: 'Mai', value: 803 }, { label: 'Hoa', value: 690 }, { label: 'Duc', value: 571 },
  ],
}

// Productivity growth over 4 weeks (the new chart).
const GROWTH: { labels: string[]; series: LineSeries[] } = {
  labels: ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4'],
  series: [
    { name: 'Thang', color: '#5b9bf5', points: [260, 280, 295, 312] },
    { name: 'Linh', color: '#35c97a', points: [230, 250, 268, 287] },
    { name: 'Nam', color: '#e89940', points: [200, 215, 228, 241] },
    { name: 'Mai', color: '#e05252', points: [170, 178, 185, 198] },
  ],
}

const RECENT_JOBS = [
  { sku: 'FLORAL-001', action: 'create', user: 'Thang', status: 'success', time: '2 phút trước' },
  { sku: 'SHIRT-042', action: 'price_qty', user: 'Linh', status: 'success', time: '8 phút trước' },
  { sku: 'MUG-007', action: 'create', user: 'Nam', status: 'failed', time: '15 phút trước' },
  { sku: 'HAT-019', action: 'update', user: 'Thang', status: 'processing', time: '22 phút trước' },
  { sku: 'CANDLE-003', action: 'create', user: 'Mai', status: 'success', time: '35 phút trước' },
]

const STATUS_BADGE: Record<string, string> = {
  success: 'b-ok',
  failed: 'b-er',
  processing: 'b-wn',
  pending: 'b-mu',
}

const HEALTH = [
  { name: 'SP-API Amazon', ok: true, text: 'Hoạt động bình thường' },
  { name: 'Supabase DB', ok: true, text: 'Hoạt động bình thường' },
  { name: 'Etsy Extension', ok: false, text: 'Cần kiểm tra' },
]

const PERIODS: { key: string; label: string }[] = [
  { key: 'today', label: 'Hôm nay' },
  { key: '7d', label: '7 ngày' },
  { key: '30d', label: '30 ngày' },
]

export default function DashboardPage() {
  const [period, setPeriod] = useState('7d')
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? ''

  return (
    <Layout title="Dashboard">
      {/* Stat cards */}
      <div className="mb-2.5 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.l} className="rounded-[10px] border border-line bg-panel px-3 py-2.5">
            <div className="text-xl font-medium text-fg">{s.n}</div>
            <div className="mt-0.5 text-[11px] text-muted">{s.l}</div>
            <div
              className={`mt-0.5 text-[11px] ${
                s.tone === 'up' ? 'text-ok' : s.tone === 'down' ? 'text-danger' : 'text-muted'
              }`}
            >
              {s.d}
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-2.5 lg:grid-cols-2">
        <div className="card">
          <div className="card-title">
            <Users size={14} /> Năng suất nhân viên — {periodLabel}
          </div>
          <div className="mb-2 flex gap-1.5">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`btn !px-2 !py-0.5 !text-[11px] ${period === p.key ? 'btn-acc' : ''}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <BarChart data={JOBS_BY_PERIOD[period]} />
        </div>

        <div className="card">
          <div className="card-title">
            <TrendingUp size={14} /> Tăng trưởng năng suất — 4 tuần
          </div>
          <LineChart labels={GROWTH.labels} series={GROWTH.series} />
        </div>
      </div>

      {/* Recent jobs */}
      <div className="card mt-2.5">
        <div className="card-title">
          <Clock size={14} /> Job gần đây
          <button className="ml-auto text-brand" title="Tải lại">
            <RefreshCw size={13} />
          </button>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted">
              {['SKU', 'Hành động', 'Nhân viên', 'Trạng thái', 'Thời gian'].map((h) => (
                <th key={h} className="border-b border-line px-2 py-1.5 text-left font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RECENT_JOBS.map((j) => (
              <tr key={j.sku} className="hover:bg-panel2">
                <td className="border-b border-line px-2 py-1.5">{j.sku}</td>
                <td className="border-b border-line px-2 py-1.5">{j.action}</td>
                <td className="border-b border-line px-2 py-1.5">{j.user}</td>
                <td className="border-b border-line px-2 py-1.5">
                  <span className={`badge ${STATUS_BADGE[j.status]}`}>{j.status}</span>
                </td>
                <td className="border-b border-line px-2 py-1.5 text-muted">{j.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* System health */}
      <div className="card mt-2.5">
        <div className="card-title">
          <Activity size={14} /> Tình trạng hệ thống
        </div>
        {HEALTH.map((h) => (
          <div key={h.name} className="mb-1.5 flex items-center gap-2 text-xs last:mb-0">
            <span className={`h-2 w-2 rounded-full ${h.ok ? 'bg-ok' : 'bg-warn'}`} />
            <span>{h.name}</span>
            <span className={`ml-auto text-[11px] ${h.ok ? 'text-ok' : 'text-warn'}`}>{h.text}</span>
          </div>
        ))}
      </div>
    </Layout>
  )
}
