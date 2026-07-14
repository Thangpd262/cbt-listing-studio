import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Trash2, Plug, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import Layout from '../../components/Layout'
import SettingsTabs from '../../components/SettingsTabs'
import { useAuth } from '../../lib/auth-context'
import { accountApi, type SellingAccount } from '../../lib/api'

// Per-account connection-test state (idle → testing → ok/error).
type TestState = { status: 'testing' | 'ok' | 'error'; error?: string }

const PLATFORMS = ['amazon', 'walmart', 'etsy', 'printify']
const CRED_TYPES = ['private', 'oauth'] as const

const empty = {
  platform: 'amazon',
  region: 'US',
  name: '',
  credType: 'private' as (typeof CRED_TYPES)[number],
  lwa_client_id: '',
  lwa_client_secret: '',
  refresh_token: '',
  seller_id: '',
}

export default function SellingAccountsPage() {
  const { token } = useAuth()
  const [rows, setRows] = useState<SellingAccount[]>([])
  const [form, setForm] = useState({ ...empty })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tests, setTests] = useState<Record<string, TestState>>({})

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      setRows(await accountApi.getSellingAccounts(token))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    setError(null)
    setSaving(true)
    try {
      const credentials =
        form.credType === 'private'
          ? {
              type: 'private',
              lwa_client_id: form.lwa_client_id,
              lwa_client_secret: form.lwa_client_secret,
              refresh_token: form.refresh_token,
              seller_id: form.seller_id,
            }
          : { type: 'oauth', refresh_token: form.refresh_token, seller_id: form.seller_id }

      await accountApi.createSellingAccount(token, {
        platform: form.platform,
        region: form.region,
        name: form.name,
        credentials,
      })
      setForm({ ...empty })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo thất bại')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(id: string) {
    if (!token) return
    try {
      await accountApi.deleteSellingAccount(token, id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xoá thất bại')
    }
  }

  async function onTest(id: string) {
    if (!token) return
    setTests((t) => ({ ...t, [id]: { status: 'testing' } }))
    try {
      const r = await accountApi.testSellingAccount(token, id)
      setTests((t) => ({ ...t, [id]: r.ok ? { status: 'ok' } : { status: 'error', error: r.error } }))
    } catch (err) {
      setTests((t) => ({
        ...t,
        [id]: { status: 'error', error: err instanceof Error ? err.message : 'Kiểm tra thất bại' },
      }))
    }
  }

  const input = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none'

  return (
    <Layout title="Selling Accounts">
      <SettingsTabs />
      {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Danh sách</h2>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            {loading ? (
              <div className="px-4 py-6 text-sm text-gray-400">Đang tải…</div>
            ) : rows.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-400">Chưa có selling account nào.</div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {rows.map((r) => {
                    const t = tests[r.id]
                    return (
                      <tr key={r.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-3">
                          <div className="font-medium">{r.name}</div>
                          <div className="text-gray-500">
                            {r.platform} · {r.region} · {r.is_active ? 'active' : 'inactive'}
                          </div>
                          {/* Connection-test result badge */}
                          {t?.status === 'ok' && (
                            <div className="mt-1 inline-flex items-center gap-1 rounded bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700">
                              <CheckCircle2 size={13} /> Hoạt động
                            </div>
                          )}
                          {t?.status === 'error' && (
                            <div
                              className="mt-1 inline-flex max-w-[280px] items-start gap-1 rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700"
                              title={t.error}
                            >
                              <XCircle size={13} className="mt-px shrink-0" />
                              <span className="line-clamp-2">Lỗi: {t.error ?? 'không rõ'}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-2">
                            <button
                              onClick={() => onTest(r.id)}
                              disabled={t?.status === 'testing'}
                              className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                            >
                              {t?.status === 'testing' ? (
                                <Loader2 size={15} className="animate-spin" />
                              ) : (
                                <Plug size={15} />
                              )}
                              Kiểm tra kết nối
                            </button>
                            <button
                              onClick={() => onDelete(r.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1 text-gray-700 hover:bg-gray-100"
                            >
                              <Trash2 size={15} /> Xoá
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Thêm mới</h2>
          <form onSubmit={onCreate} className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
            <div className="grid grid-cols-2 gap-3">
              <select
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                className={input}
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <input
                placeholder="Region"
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                className={input}
              />
            </div>
            <input
              placeholder="Tên hiển thị"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={input}
            />
            <select
              value={form.credType}
              onChange={(e) => setForm({ ...form, credType: e.target.value as (typeof CRED_TYPES)[number] })}
              className={input}
            >
              {CRED_TYPES.map((t) => (
                <option key={t} value={t}>
                  credentials: {t}
                </option>
              ))}
            </select>

            {form.credType === 'private' && (
              <>
                <input
                  placeholder="LWA Client ID"
                  value={form.lwa_client_id}
                  onChange={(e) => setForm({ ...form, lwa_client_id: e.target.value })}
                  className={input}
                />
                <input
                  placeholder="LWA Client Secret"
                  value={form.lwa_client_secret}
                  onChange={(e) => setForm({ ...form, lwa_client_secret: e.target.value })}
                  className={input}
                />
              </>
            )}
            <input
              placeholder="Refresh Token"
              value={form.refresh_token}
              onChange={(e) => setForm({ ...form, refresh_token: e.target.value })}
              className={input}
            />
            <input
              placeholder="Seller ID"
              value={form.seller_id}
              onChange={(e) => setForm({ ...form, seller_id: e.target.value })}
              className={input}
            />

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-md bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? 'Đang lưu…' : 'Tạo selling account'}
            </button>
          </form>
        </section>
      </div>
    </Layout>
  )
}
