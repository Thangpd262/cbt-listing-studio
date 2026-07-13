import { useEffect } from 'react'
import { useRouter } from 'next/router'

// Entry point: bounce to the dashboard (AuthGuard handles the login redirect).
export default function Home() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard')
  }, [router])
  return null
}
