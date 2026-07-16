import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Plus } from 'lucide-react'
import Layout from '../components/Layout'
import CrawlJobPanel, { type PanelGroup, type PanelConfig, type PanelPrompt } from '../components/CrawlJobPanel'
import { SkeletonCards } from '../components/Skeleton'
import { useAuth } from '../lib/auth-context'
import { usePlatform } from '../lib/platform-context'
import {
  accountApi,
  crawlApi,
  generatorApi,
  productGroupApi,
  serviceConfigured,
  userConfigApi,
  type SellingAccount,
  type TeamMember,
} from '../lib/api'
import { GROUPS, MY_CONFIGS, SAMPLE_LISTINGS, type SampleListing } from '../lib/sample-data'

const SAMPLE_GROUPS: PanelGroup[] = GROUPS.map((g) => ({ id: g.id, name: g.name }))
const SAMPLE_CONFIGS: PanelConfig[] = MY_CONFIGS.map((c) => ({ id: c.id, name: c.name, from: c.from }))
const SAMPLE_PROMPTS: PanelPrompt[] = [
  { id: 'p1', name: 'Canvas tối giản nền trắng' },
  { id: 'p2', name: 'Boho floral watercolor' },
]

// Pull image URLs a user stored in their config overrides (for section "d").
function overrideImages(overrides: Record<string, unknown>): string[] {
  const v = overrides?.image_urls
  return Array.isArray(v) ? v.filter((u): u is string => typeof u === 'string') : []
}

// Etsy listing id from its source URL, e.g. …/listing/4368912589/slug → "4368912589".
function etsyListingId(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  return /\/listing\/(\d+)/.exec(url)?.[1]
}

// Sample listings only when the crawl service isn't wired (local dev).
const USE_SAMPLE = !serviceConfigured.crawl

export default function CrawlPage() {
  const { apiKey, token, user } = useAuth()
  const { platform } = usePlatform()
  const isAdmin = user?.role === 'admin'

  const [listings, setListings] = useState<SampleListing[]>(USE_SAMPLE ? SAMPLE_LISTINGS : [])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(USE_SAMPLE)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Groups + user configs feed the filter bar and the job panel.
  const [groups, setGroups] = useState<PanelGroup[]>(SAMPLE_GROUPS)
  const [myConfigs, setMyConfigs] = useState<PanelConfig[]>(SAMPLE_CONFIGS)
  const [prompts, setPrompts] = useState<PanelPrompt[]>(SAMPLE_PROMPTS)
  const [sellingAccounts, setSellingAccounts] = useState<SellingAccount[]>([])

  const [teamUsers, setTeamUsers] = useState<TeamMember[]>([])
  const [userFilter, setUserFilter] = useState('') // admin only; '' = all users

  const [group, setGroup] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')

  const loadListings = useCallback(async () => {
    if (USE_SAMPLE || !apiKey) {
      setListings(SAMPLE_LISTINGS)
      setLoaded(true)
      return
    }
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await crawlApi.getListings(apiKey, {
        limit: 48,
        platform: 'etsy',
        user_id: isAdmin && userFilter ? userFilter : undefined,
      })
      setListings(
        res.data.map((l) => ({
          id: l.id,
          title: l.title ?? '(Không tiêu đề)',
          shop: l.shop_name ?? '—',
          group: '—',
          price: l.price ?? 0,
          hasJob: false,
          images: l.images ?? [],
          aiImages: l.ai_images ?? [],
          email: l.created_by_email ?? undefined,
          etsyId: etsyListingId(l.source_url),
          sourceUrl: l.source_url ?? undefined,
          createdAt: l.created_at ? l.created_at.slice(0, 10) : undefined,
        }))
      )
    } catch (e) {
      setListings([])
      setErrorMsg(e instanceof Error ? e.message : 'Không tải được listing')
    } finally {
      setLoaded(true)
      setLoading(false)
    }
  }, [apiKey, isAdmin, userFilter])

  const loadMeta = useCallback(async () => {
    if (!apiKey) {
      setGroups(SAMPLE_GROUPS)
      setMyConfigs(SAMPLE_CONFIGS)
      setPrompts(SAMPLE_PROMPTS)
      return
    }
    try {
      const [g, c, p] = await Promise.all([
        productGroupApi.list(apiKey, platform),
        userConfigApi.list(apiKey),
        generatorApi.getPrompts(apiKey).catch(() => []),
      ])
      setGroups(g.length ? g.map((x) => ({ id: x.id, name: x.name })) : SAMPLE_GROUPS)
      setMyConfigs(
        c.map((x) => ({
          id: x.id,
          name: x.name,
          from: x.based_on,
          productType: x.product_type,
          imageUrls: overrideImages(x.overrides),
        }))
      )
      const imagePrompts = p.filter((x) => x.prompt_type === 'image').map((x) => ({ id: x.id, name: x.name }))
      setPrompts(imagePrompts.length ? imagePrompts : SAMPLE_PROMPTS)
    } catch {
      setGroups(SAMPLE_GROUPS)
      setMyConfigs(SAMPLE_CONFIGS)
      setPrompts(SAMPLE_PROMPTS)
    }
    // Selling accounts (for real job creation) + team list (admin filter) use
    // the bearer token.
    if (token) {
      try {
        const accts = await accountApi.getSellingAccounts(token)
        setSellingAccounts(accts.filter((a) => a.platform === platform && a.is_active))
      } catch {
        setSellingAccounts([])
      }
      if (isAdmin) {
        try {
          setTeamUsers(await accountApi.getTeam(token))
        } catch {
          setTeamUsers([])
        }
      }
    } else {
      setSellingAccounts([])
    }
  }, [apiKey, platform, token, isAdmin])

  useEffect(() => {
    loadListings()
    loadMeta()
  }, [loadListings, loadMeta])

  const filtered = listings.filter((l) => {
    if (group && l.group !== group) return false
    if (status === 'no-job' && l.hasJob) return false
    if (status === 'has-job' && !l.hasJob) return false
    // Search matches title, shop, or the Etsy listing ID.
    if (search && !`${l.title} ${l.shop} ${l.etsyId ?? ''}`.toLowerCase().includes(search.toLowerCase()))
      return false
    return true
  })

  // Counts for the status toggle buttons (over the full loaded set, pre-status-filter).
  const statusCounts = {
    all: listings.length,
    noJob: listings.filter((l) => !l.hasJob).length,
    hasJob: listings.filter((l) => l.hasJob).length,
  }

  async function addGroup() {
    const name = window.prompt('Tên nhóm sản phẩm mới:')?.trim()
    if (!name) return
    if (!apiKey) {
      setGroups((g) => [...g, { id: `local-${Date.now()}`, name }])
      return
    }
    try {
      const created = await productGroupApi.create(apiKey, { name, platform })
      setGroups((g) => [...g, { id: created.id, name: created.name }])
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Thêm nhóm thất bại')
    }
  }

  function handleCreated(id: string) {
    setListings((ls) => ls.map((l) => (l.id === id ? { ...l, hasJob: true } : l)))
  }

  async function handleDelete(id: string) {
    if (!confirm('Xoá listing crawl này?')) return
    if (apiKey && !USE_SAMPLE) {
      try {
        await crawlApi.deleteListing(apiKey, id)
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Xoá thất bại')
        return
      }
    }
    setListings((ls) => ls.filter((l) => l.id !== id))
  }

  return (
    <Layout title="Etsy Crawl">
      {/* Subtitle */}
      <p className="mb-2.5 text-[12.5px] text-muted">
        Chọn dòng hàng, sửa tiêu đề, chọn/xoá ảnh rồi bấm Tạo Job.
        {isAdmin && (
          <span className="ml-1 font-medium text-brand">Admin: bạn đang xem listing của tất cả user.</span>
        )}
      </p>

      {/* Filter bar */}
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        {/* Ngách */}
        <select value={group} onChange={(e) => setGroup(e.target.value)} className="field" title="Lọc theo ngách">
          <option value="">— Tất cả ngách —</option>
          {groups.map((g) => (
            <option key={g.id} value={g.name}>
              {g.name}
            </option>
          ))}
        </select>

        {/* Trạng thái — toggle buttons */}
        <div className="inline-flex overflow-hidden rounded-md border border-line2">
          {[
            { v: '', label: `Tất cả (${statusCounts.all})` },
            { v: 'no-job', label: `Chưa tạo job (${statusCounts.noJob})` },
            { v: 'has-job', label: `Đã tạo job (${statusCounts.hasJob})` },
          ].map((s, i) => (
            <button
              key={s.v}
              onClick={() => setStatus(s.v)}
              className={`px-3 py-1.5 text-xs font-semibold transition ${i > 0 ? 'border-l border-line2' : ''} ${
                status === s.v ? 'bg-brand text-white' : 'bg-panel text-muted hover:bg-panel2 hover:text-fg'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* User (admin only) */}
        {isAdmin && (
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="field"
            title="Lọc theo người crawl (admin)"
          >
            <option value="">Tất cả user</option>
            {teamUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </select>
        )}

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="tiêu đề / shop / listing ID — Enter"
          className="field min-w-[180px] flex-1"
        />
        <button onClick={loadListings} disabled={loading} className="btn">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Tải lại
        </button>
        <button className="btn btn-ok" onClick={addGroup}>
          <Plus size={13} /> Thêm nhóm
        </button>

        <span className="ml-auto whitespace-nowrap rounded-md border border-line bg-panel2 px-2.5 py-1 font-mono text-[11px] text-muted">
          {filtered.length} listing
        </span>
      </div>

      {USE_SAMPLE && (
        <div className="mb-2.5 rounded-md border border-line bg-panel2 px-3 py-2 text-[11px] text-muted">
          Đang hiển thị dữ liệu mẫu. Kết nối crawl service + API key để xem listing thật.
        </div>
      )}
      {errorMsg && (
        <div className="mb-2.5 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[11px] text-danger">
          {errorMsg}
        </div>
      )}

      {/* One inline job card per crawled listing */}
      {!loaded && !USE_SAMPLE ? (
        <SkeletonCards count={3} height="h-52" />
      ) : (
        <div className="grid gap-3">
          {filtered.map((l, i) => (
            <CrawlJobPanel
              key={l.id}
              listing={l}
              index={i}
              myConfigs={myConfigs}
              prompts={prompts}
              sellingAccounts={sellingAccounts}
              apiKey={apiKey}
              platform={platform}
              onCreated={() => handleCreated(l.id)}
              onDelete={() => handleDelete(l.id)}
            />
          ))}
          {filtered.length === 0 && !errorMsg && (
            <div className="rounded-[10px] border border-dashed border-line py-16 text-center text-xs text-muted">
              {listings.length === 0 ? 'Chưa có listing nào.' : 'Không có listing khớp bộ lọc.'}
            </div>
          )}
        </div>
      )}
    </Layout>
  )
}
