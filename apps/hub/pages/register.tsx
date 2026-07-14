import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { accountApi } from '../lib/api'

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await accountApi.register(form)
      setDone(res.message ?? 'Đăng ký thành công. Tài khoản đang chờ admin duyệt.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng ký thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-[10px] border border-line bg-panel p-6">
        <h1 className="mb-1 text-xl font-semibold text-fg">Đăng ký</h1>
        <p className="mb-5 text-sm text-muted">Tài khoản mới cần admin duyệt trước khi đăng nhập.</p>

        {done ? (
          <div className="rounded-md border border-ok bg-ok-soft px-3 py-3 text-sm text-ok">
            {done}
            <div className="mt-3">
              <Link href="/login" className="font-medium text-brand underline">
                Về trang đăng nhập
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            {error && (
              <div className="mb-4 rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}
              </div>
            )}

            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-medium text-fg/90">Tên</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="field w-full !py-2 !text-sm"
              />
            </label>

            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-medium text-fg/90">Email</span>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="field w-full !py-2 !text-sm"
              />
            </label>

            <label className="mb-5 block">
              <span className="mb-1 block text-sm font-medium text-fg/90">Mật khẩu</span>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="field w-full !py-2 !text-sm"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-brand py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Đang gửi…' : 'Đăng ký'}
            </button>

            <p className="mt-4 text-center text-sm text-muted">
              Đã có tài khoản?{' '}
              <Link href="/login" className="font-medium text-brand underline">
                Đăng nhập
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
