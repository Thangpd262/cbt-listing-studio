import { useEffect } from 'react'
import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import '../styles/globals.css'
import { AuthProvider, useAuth } from '../lib/auth-context'
import { PlatformProvider } from '../lib/platform-context'

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
  if (!ready) return <div className="flex h-full items-center justify-center text-sm text-muted">Đang tải…</div>
  if (!token && !isPublic) return null
  if (token && isPublic) return null

  return <>{children}</>
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <PlatformProvider>
        <AuthGuard>
          <Component {...pageProps} />
        </AuthGuard>
      </PlatformProvider>
    </AuthProvider>
  )
}
