import { useEffect, useState, useCallback } from 'react'
import {
  Globe, RefreshCw, Sparkles, Trash2, Copy, Check,
  ChevronLeft, ChevronRight, ExternalLink, Tag, Image as ImageIcon,
} from 'lucide-react'
import Layout from '../components/Layout'
import { useAuth } from '../lib/auth-context'
import { crawlApi, type CrawlListing } from '../lib/api'

// ── helpers ────────────────────────────────────────────────────────────────

const PLATFORM_LABEL: Record<string, { label: string; color: string }> = {
  etsy:       { label: 'Etsy',       color: 'bg-orange-100 text-orange-700' },
  aliexpress: { label: 'AliExpress', color: 'bg-red-100 text-red-700' },
  printify:   { label: 'Printify',   color: 'bg-purple-100 text-purple-700' },
  amazon:     { label: 'Amazon',     color: 'bg-yellow-100 text-yellow-700' },
  walmart:    { label: 'Walmart',    color: 'bg-blue-100 text-blue-700' },
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  ingested:  { label: 'Mới',       color: 'bg-gray-100 text-gray-600' },
  analyzing: { label: 'Đang phân tích…', color: 'bg-blue-100 text-blue-700' },
  analyzed:  { label: 'Đã phân tích', color: 'bg-green-100 text-green-700' },
  failed:    { label: 'Thất bại',   color: 'bg-red-100 text-red-700' },
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  )
}

// ── listing card ───────────────────────────────────────────────────────────

function ListingCard({
  listing,
  onAnalyze,
  onDelete,
  analyzing,
}: {
  listing: CrawlListing
  onAnalyze: (id: string) => void
  onDelete: (id: string) => void
  analyzing: boolean
}) {
  const thumb = listing.images?.[0] ?? null
  const platform = PLATFORM_LABEL[listing.platform] ?? { label: listing.platform, color: 'bg-gray-100 text-gray-600' }
  const status = STATUS_LABEL[listing.status] ?? { label: listing.status, color: 'bg-gray-100 text-gray-600' }
  const canAnalyze = listing.status === 'ingested' || listing.status === 'failed'

  return (
    <div className="flex flex-col rounded-lg border border-gray-200 bg-white overflow-hidden hover:shadow-sm transition-shadow">
      {/* Thumbnail */}
      <div className="relative h-44 bg-gray-50 flex items-center justify-center overflow-hidden">
        {thumb ? (
          <img src={thumb} alt={listing.title ?? ''} className="h-full w-full object-cover" />
        ) : (
          <ImageIcon size={32} className="text-gray-300" />
        )}
        {/* Badges overlay */}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          <Badge {...platform} />
          {listing.crawl_purpose === 'tm' && (
            <Badge label="TM" color="bg-violet-100 text-violet-700" />
          )}
        </div>
        {listing.source_url && (
          <a
            href={listing.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-2 right-2 rounded-md bg-white/80 p-1 text-gray-500 hover:text-gray-900 backdrop-blur-sm"
          >
            <ExternalLink size={13} />
          </a>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 text-sm font-medium text-gray-900 leading-snug">
          {listing.title ?? <span className="text-gray-400 italic">Không có tiêu đề</span>}
        </p>

        {listing.shop_name && (
          <p className="text-xs text-gray-400 truncate">{listing.shop_name}</p>
        )}

        <div className="flex items-center gap-2 text-xs text-gray-500">
          {listing.price != null && (
            <span className="font-medium text-gray-700">${listing.price.toFixed(2)}</span>
          )}
          {listing.tags.length > 0 && (
            <span className="flex items-center gap-0.5">
              <Tag size={11} /> {listing.tags.length} tags
            </span>
          )}
          {listing.images.length > 0 && (
            <span className="flex items-center gap-0.5">
              <ImageIcon size={11} /> {listing.images.length} ảnh
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-100">
          <Badge {...status} />
          <div className="ml-auto flex items-center gap-1.5">
            {canAnalyze && (
              <button
                onClick={() => onAnalyze(listing.id)}
                disabled={analyzing}
                title="Phân tích bằng AI"
                className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                <Sparkles size={12} className={analyzing ? 'animate-pulse' : ''} />
                Phân tích
              </button>
            )}
            <button
              onClick={() => onDelete(listing.id)}
              title="Xóa"
              className="rounded-md border border-gray-200 p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── main page ──────────────────────────────────────────────────────────────

const LIMIT = 24

export default function CrawlPage() {
  const { apiKey } = useAuth()

  const [listings, setListings] = useState<CrawlListing[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [platform, setPlatform] = useState('')
  const [status, setStatus] = useState('')

  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  const load = useCallback(async () => {
    if (!apiKey) return
    setLoading(true)
    setError(null)
    try {
      const res = await crawlApi.getListings(apiKey, { page, limit: LIMIT, platform: platform || undefined, status: status || undefined })
      setListings(res.data)
      setTotal(res.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [apiKey, page, platform, status])

  useEffect(() => { load() }, [load])

  // Reset page khi filter thay đổi
  useEffect(() => { setPage(1) }, [platform, status])

  async function handleAnalyze(id: string) {
    if (!apiKey) return
    setAnalyzingIds((s) => new Set(s).add(id))
    // Optimistically update status
    setListings((ls) => ls.map((l) => l.id === id ? { ...l, status: 'analyzing' } : l))
    try {
      await crawlApi.analyzeListing(apiKey, id)
      setListings((ls) => ls.map((l) => l.id === id ? { ...l, status: 'analyzed' } : l))
    } catch {
      setListings((ls) => ls.map((l) => l.id === id ? { ...l, status: 'failed' } : l))
    } finally {
      setAnalyzingIds((s) => { const n = new Set(s); n.delete(id); return n })
    }
  }

  async function handleDelete(id: string) {
    if (!apiKey || !confirm('Xóa listing này?')) return
    try {
      await crawlApi.deleteListing(apiKey, id)
      setListings((ls) => ls.filter((l) => l.id !== id))
      setTotal((t) => t - 1)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Xóa thất bại')
    }
  }

  function copyToken() {
    if (!apiKey) return
    navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Layout title="Crawl">
      {/* Crawl Token banner */}
      <div className="mb-5 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 flex flex-wrap items-center gap-3">
        <Globe size={16} className="text-gray-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-700 mb-0.5">Crawl Token (dán vào extension)</p>
          <p className="font-mono text-xs text-gray-500 truncate">{apiKey ?? '— Chưa có API key, tạo ở Settings → API Keys —'}</p>
        </div>
        {apiKey && (
          <button
            onClick={copyToken}
            className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 shrink-0"
          >
            {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
            {copied ? 'Đã copy!' : 'Copy token'}
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="">Tất cả nền tảng</option>
          <option value="etsy">Etsy</option>
          <option value="aliexpress">AliExpress</option>
          <option value="printify">Printify</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ingested">Mới</option>
          <option value="analyzed">Đã phân tích</option>
          <option value="failed">Thất bại</option>
        </select>

        <span className="ml-auto text-sm text-gray-500">{total} listings</span>

        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Tải lại
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* No API key */}
      {!apiKey && (
        <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Chưa có API key. Tạo ở{' '}
          <a href="/settings/api-keys" className="font-medium underline">Settings → API Keys</a>{' '}
          rồi dán vào extension để bắt đầu crawl.
        </div>
      )}

      {/* Empty state */}
      {apiKey && !loading && listings.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-20 text-center">
          <Globe size={36} className="mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">Chưa có listing nào</p>
          <p className="mt-1 text-xs text-gray-400">
            Cài extension v1.9.0, dán crawl token, rồi crawl listing từ Etsy/AliExpress/Printify.
          </p>
        </div>
      )}

      {/* Grid */}
      {listings.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {listings.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              onAnalyze={handleAnalyze}
              onDelete={handleDelete}
              analyzing={analyzingIds.has(l.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-gray-600">
            Trang {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
            className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </Layout>
  )
}
