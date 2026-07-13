import { useEffect, useState } from 'react'
import { Globe, Sparkles, KeyRound } from 'lucide-react'
import Layout from '../components/Layout'
import StatsCard from '../components/StatsCard'
import { useAuth } from '../lib/auth-context'
import { crawlApi, generatorApi } from '../lib/api'

export default function DashboardPage() {
  const { apiKey } = useAuth()
  const [listings, setListings] = useState<number | '—'>('—')
  const [jobs, setJobs] = useState<number | '—'>('—')

  // Downstream services (Crawl/Generator) arrive in later phases — fail soft.
  useEffect(() => {
    if (!apiKey) return
    crawlApi
      .getListings(apiKey)
      .then((res) => setListings(res.total))
      .catch(() => setListings('—'))
    generatorApi
      .getJobs(apiKey)
      .then((rows) => setJobs(rows.length))
      .catch(() => setJobs('—'))
  }, [apiKey])

  return (
    <Layout title="Dashboard">
      {!apiKey && (
        <div className="mb-5 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Chưa có API key. Tạo một API key ở{' '}
          <a href="/settings/api-keys" className="font-medium underline">
            Settings → API Keys
          </a>{' '}
          để dùng các tính năng Crawl/Generator/List.
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatsCard label="Listings crawled" value={listings} icon={Globe} hint="Từ Crawl service" />
        <StatsCard label="Generator jobs" value={jobs} icon={Sparkles} hint="Từ Generator service" />
        <StatsCard label="API key" value={apiKey ? 'Đã cấu hình' : 'Chưa có'} icon={KeyRound} />
      </div>
    </Layout>
  )
}
