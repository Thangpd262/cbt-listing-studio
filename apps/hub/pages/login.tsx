import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { accountApi } from '../lib/api'
import { useAuth } from '../lib/auth-context'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { token, account_id, user_id, role } = await accountApi.login({ email, password })
      login(token, { account_id, user_id, role })
      router.replace('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-[10px] border border-line bg-panel p-6">
        <h1 className="mb-1 text-xl font-semibold text-fg">Đăng nhập</h1>
        <p className="mb-5 text-sm text-muted">
          <span className="text-brand">CBT</span> Listing Studio
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-fg/90">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field w-full !py-2 !text-sm"
          />
        </label>

        <label className="mb-5 block">
          <span className="mb-1 block text-sm font-medium text-fg/90">Mật khẩu</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field w-full !py-2 !text-sm"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-brand py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>

        <p className="mt-4 text-center text-sm text-muted">
          Chưa có tài khoản?{' '}
          <Link href="/register" className="font-medium text-brand underline">
            Đăng ký
          </Link>
        </p>
      </form>
    </div>
  )
}
