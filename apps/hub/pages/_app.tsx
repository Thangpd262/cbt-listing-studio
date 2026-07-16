import { useEffect, useState } from 'react'
import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '../styles/globals.css'
import { AuthProvider, useAuth } from '../lib/auth-context'
import { PlatformProvider } from '../lib/platform-context'

// One client per browser session. Defaults tuned for this app: don't refetch on
// window focus (data is not that volatile), retry once, and treat data as fresh
// for 30s by default — per-query staleTime in lib/queries overrides where the
// data is effectively static (global lists) or hotter (jobs).
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  })
}

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
  const [queryClient] = useState(makeQueryClient)
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PlatformProvider>
          <AuthGuard>
            <Component {...pageProps} />
          </AuthGuard>
        </PlatformProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
