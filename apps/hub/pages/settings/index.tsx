import { useState } from 'react'
import Layout from '../../components/Layout'
import SettingsTabs from '../../components/SettingsTabs'
import { useAuth } from '../../lib/auth-context'
import { useSpend } from '../../lib/queries'
import { serviceConfigured } from '../../lib/api'

const PERIODS: { value: string; label: string }[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
]

const money = (n: number) => (n < 0.01 && n > 0 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`)

function AiSpendSection({ isAdmin }: { isAdmin: boolean }) {
  const [period, setPeriod] = useState('7d')
  const { data, isLoading, isError } = useSpend(period)

  return (
    <div className="max-w-lg space-y-3 rounded-lg border border-gray-200 bg-white p-5 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-700">Chi phí AI đã dùng</span>
        <div className="inline-flex overflow-hidden rounded-md border border-gray-200 text-xs">
          {PERIODS.map((p, i) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-2.5 py-1 font-medium transition ${i > 0 ? 'border-l border-gray-200' : ''} ${
                period === p.value ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!serviceConfigured.generator ? (
        <div className="text-xs text-gray-400">Kết nối generator service để xem chi phí.</div>
      ) : isLoading ? (
        <div className="text-xs text-gray-400">Đang tải…</div>
      ) : isError || !data ? (
        <div className="text-xs text-gray-400">Chưa có dữ liệu chi phí.</div>
      ) : (
        <>
          <div className="flex items-baseline gap-2 border-b border-gray-100 pb-2">
            <span className="text-lg font-semibold text-gray-900">{money(data.total_cost_usd)}</span>
            <span className="text-xs text-gray-500">· {data.total_images} ảnh</span>
          </div>

          {data.by_model.length === 0 ? (
            <div className="text-xs text-gray-400">Chưa phát sinh chi phí trong kỳ này.</div>
          ) : (
            <div className="space-y-1">
              {data.by_model.map((m) => (
                <div key={m.model} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">{m.label}</span>
                  <span className="font-mono text-gray-800">
                    {money(m.total_cost_usd)} <span className="text-gray-400">· {m.total_images} ảnh</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {isAdmin && data.by_user.length > 0 && (
            <div className="space-y-1 border-t border-gray-100 pt-2">
              <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Theo user</div>
              {data.by_user.map((u) => (
                <div key={u.user_id} className="flex items-center justify-between text-xs">
                  <span className="truncate text-gray-600">{u.email ?? u.user_id}</span>
                  <span className="font-mono text-gray-800">
                    {money(u.total_cost_usd)} <span className="text-gray-400">· {u.total_images} ảnh</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function SettingsIndexPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  return (
    <Layout title="Settings">
      <SettingsTabs />
      <div className="space-y-4">
        <div className="max-w-lg space-y-3 rounded-lg border border-gray-200 bg-white p-5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">User ID</span>
            <span className="font-mono">{user?.user_id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Account ID</span>
            <span className="font-mono">{user?.account_id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Role</span>
            <span className="font-medium">{user?.role}</span>
          </div>
        </div>

        <AiSpendSection isAdmin={isAdmin} />
      </div>
    </Layout>
  )
}
