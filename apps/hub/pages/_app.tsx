import { useEffect } from 'react'
import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import '../styles/globals.css'
import { AuthProvider, useAuth } from '../lib/auth-context'

const PUBLIC_ROUTES = ['/login', '/register']

// Redirects unauthenticated users to /login for any non-public route.
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, ready } = useAuth()
  const router = useRouter()
  const isPublic = PUBLIC_ROUTES.includes(router.pathname)

  useEffect(() => {
    if (!ready) return
    if (!token && !isPublic) router.replace('/login')
    if (token && isPublic) router.replace('/dashboard')
  }, [ready, token, isPublic, router])

  // Avoid flashing protected content before the redirect resolves.
  if (!ready) return <div className="p-6 text-sm text-gray-400">Đang tải…</div>
  if (!token && !isPublic) return null
  if (token && isPublic) return null

  return <>{children}</>
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <AuthGuard>
        <Component {...pageProps} />
      </AuthGuard>
    </AuthProvider>
  )
}
