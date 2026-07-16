import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Trash2, Copy } from 'lucide-react'
import Layout from '../../components/Layout'
import SettingsTabs from '../../components/SettingsTabs'
import { useAuth } from '../../lib/auth-context'
import { accountApi } from '../../lib/api'

type KeyRow = { id: string; name: string; last_used_at: string | null; created_at: string }

export default function ApiKeysPage() {
  const { token, apiKey, setApiKey } = useAuth()
  const [rows, setRows] = useState<KeyRow[]>([])
  const [name, setName] = useState('')
  const [freshKey, setFreshKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      setRows(await accountApi.getApiKeys(token))
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
    try {
      const created = await accountApi.createApiKey(token, name || undefined)
      setFreshKey(created.key)
      setApiKey(created.key) // store as active key for downstream services
      setName('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo thất bại')
    }
  }

  async function onRevoke(id: string) {
    if (!token) return
    try {
      await accountApi.revokeApiKey(token, id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revoke thất bại')
    }
  }

  return (
    <Layout title="API Keys">
      <SettingsTabs />
      {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {freshKey && (
        <div className="mb-5 rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
          <div className="mb-1 font-medium">API key mới (chỉ hiện 1 lần — hãy lưu lại):</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-white px-2 py-1 font-mono text-xs">{freshKey}</code>
            <button
              onClick={() => navigator.clipboard?.writeText(freshKey)}
              className="inline-flex items-center gap-1 rounded-md border border-green-300 px-2 py-1 text-green-800 hover:bg-green-100"
            >
              <Copy size={14} /> Copy
            </button>
          </div>
          <div className="mt-1 text-xs text-green-700">Đã đặt làm key đang dùng cho Crawl/Generator/List.</div>
        </div>
      )}

      <form onSubmit={onCreate} className="mb-6 flex max-w-md gap-2">
        <input
          placeholder="Tên key (tuỳ chọn)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-md border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
        <button type="submit" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          Tạo key
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {loading ? (
          <div className="px-4 py-6 text-sm text-gray-400">Đang tải…</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-400">Chưa có API key nào.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Tên</th>
                <th className="px-4 py-2">Lần dùng cuối</th>
                <th className="px-4 py-2">Tạo lúc</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.last_used_at ? new Date(r.last_used_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onRevoke(r.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1 text-gray-700 hover:bg-gray-100"
                    >
                      <Trash2 size={15} /> Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {apiKey && (
        <p className="mt-4 text-xs text-muted">Key đang dùng: <code className="font-mono">{apiKey.slice(0, 12)}…</code></p>
      )}
    </Layout>
  )
}
