import { useCallback, useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import Layout from '../../components/Layout'
import SettingsTabs from '../../components/SettingsTabs'
import { useAuth } from '../../lib/auth-context'
import { accountApi, type TeamMember } from '../../lib/api'

const ROLES = ['admin', 'operator']

export default function TeamPage() {
  const { token, user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [members, setMembers] = useState<TeamMember[]>([])
  const [pending, setPending] = useState<TeamMember[]>([])
  const [pendingRole, setPendingRole] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const [m, p] = await Promise.all([
        accountApi.getTeam(token),
        isAdmin ? accountApi.getPending(token) : Promise.resolve<TeamMember[]>([]),
      ])
      setMembers(m)
      setPending(p)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được team')
    } finally {
      setLoading(false)
    }
  }, [token, isAdmin])

  useEffect(() => {
    load()
  }, [load])

  async function approve(id: string) {
    if (!token) return
    try {
      await accountApi.approveUser(token, id, pendingRole[id] ?? 'operator')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Duyệt thất bại')
    }
  }

  async function reject(id: string) {
    if (!token) return
    try {
      await accountApi.rejectUser(token, id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Từ chối thất bại')
    }
  }

  return (
    <Layout title="Team">
      <SettingsTabs />
      {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {isAdmin && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Chờ duyệt ({pending.length})</h2>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            {pending.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-400">Không có user nào chờ duyệt.</div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {pending.map((u) => (
                    <tr key={u.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium">{u.name || '—'}</div>
                        <div className="text-gray-500">{u.email}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <select
                            value={pendingRole[u.id] ?? 'operator'}
                            onChange={(e) => setPendingRole({ ...pendingRole, [u.id]: e.target.value })}
                            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => approve(u.id)}
                            className="flex items-center gap-1 rounded-md bg-brand px-2.5 py-1 text-white hover:opacity-90"
                          >
                            <Check size={15} /> Duyệt
                          </button>
                          <button
                            onClick={() => reject(u.id)}
                            className="flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1 text-gray-700 hover:bg-gray-100"
                          >
                            <X size={15} /> Từ chối
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Thành viên</h2>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          {loading ? (
            <div className="px-4 py-6 text-sm text-gray-400">Đang tải…</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2">Tên</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-t border-gray-100">
                    <td className="px-4 py-3">{m.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{m.email}</td>
                    <td className="px-4 py-3">{m.role ?? '—'}</td>
                    <td className="px-4 py-3">{m.status ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </Layout>
  )
}
