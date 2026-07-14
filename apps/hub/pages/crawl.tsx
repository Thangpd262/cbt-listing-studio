import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Plus, Zap, Eye, Trash2, ImageOff } from 'lucide-react'
import Layout from '../components/Layout'
import CrawlJobPanel, { type PanelGroup, type PanelConfig } from '../components/CrawlJobPanel'
import { useAuth } from '../lib/auth-context'
import { usePlatform } from '../lib/platform-context'
import { crawlApi, productGroupApi, userConfigApi } from '../lib/api'
import { GROUPS, MY_CONFIGS, SAMPLE_LISTINGS, type SampleListing } from '../lib/sample-data'

const SAMPLE_GROUPS: PanelGroup[] = GROUPS.map((g) => ({ id: g.id, name: g.name }))
const SAMPLE_CONFIGS: PanelConfig[] = MY_CONFIGS.map((c) => ({ id: c.id, name: c.name, from: c.from }))

export default function CrawlPage() {
  const { apiKey } = useAuth()
  const { platform } = usePlatform()

  const [listings, setListings] = useState<SampleListing[]>(SAMPLE_LISTINGS)
  const [loading, setLoading] = useState(false)
  const [usingSample, setUsingSample] = useState(true)

  // Groups + user configs feed the filter bar and the job panel.
  const [groups, setGroups] = useState<PanelGroup[]>(SAMPLE_GROUPS)
  const [myConfigs, setMyConfigs] = useState<PanelConfig[]>(SAMPLE_CONFIGS)

  const [group, setGroup] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [panelFor, setPanelFor] = useState<SampleListing | null>(null)

  const loadListings = useCallback(async () => {
    if (!apiKey) {
      setListings(SAMPLE_LISTINGS)
      setUsingSample(true)
      return
    }
    setLoading(true)
    try {
      const res = await crawlApi.getListings(apiKey, { limit: 48, platform: 'etsy' })
      if (res.data.length) {
        setListings(
          res.data.map((l) => ({
            id: l.id,
            title: l.title ?? '(Không tiêu đề)',
            shop: l.shop_name ?? '—',
            group: '—',
            price: l.price ?? 0,
            hasJob: false,
            images: l.images ?? [],
          }))
        )
        setUsingSample(false)
      } else {
        setListings(SAMPLE_LISTINGS)
        setUsingSample(true)
      }
    } catch {
      setListings(SAMPLE_LISTINGS)
      setUsingSample(true)
    } finally {
      setLoading(false)
    }
  }, [apiKey])

  const loadMeta = useCallback(async () => {
    if (!apiKey) {
      setGroups(SAMPLE_GROUPS)
      setMyConfigs(SAMPLE_CONFIGS)
      return
    }
    try {
      const [g, c] = await Promise.all([
        productGroupApi.list(apiKey, platform),
        userConfigApi.list(apiKey),
      ])
      setGroups(g.length ? g.map((x) => ({ id: x.id, name: x.name })) : SAMPLE_GROUPS)
      setMyConfigs(c.map((x) => ({ id: x.id, name: x.name, from: x.based_on })))
    } catch {
      setGroups(SAMPLE_GROUPS)
      setMyConfigs(SAMPLE_CONFIGS)
    }
  }, [apiKey, platform])

  useEffect(() => {
    loadListings()
    loadMeta()
  }, [loadListings, loadMeta])

  const filtered = listings.filter((l) => {
    if (group && l.group !== group) return false
    if (status === 'no-job' && l.hasJob) return false
    if (status === 'has-job' && !l.hasJob) return false
    if (search && !`${l.title} ${l.shop}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

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

  function handleCreate(sku: string) {
    if (panelFor) {
      setListings((ls) => ls.map((l) => (l.id === panelFor.id ? { ...l, hasJob: true } : l)))
    }
    setPanelFor(null)
    alert(`Đã tạo job cho SKU ${sku} → gửi sang Jobs queue (chờ chạy).`)
  }

  return (
    <Layout title="Etsy Crawl">
      {/* Filter bar */}
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <select value={group} onChange={(e) => setGroup(e.target.value)} className="field">
          <option value="">Tất cả nhóm</option>
          {groups.map((g) => (
            <option key={g.id} value={g.name}>
              {g.name}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="field">
          <option value="">Tất cả trạng thái</option>
          <option value="no-job">Chưa tạo job</option>
          <option value="has-job">Đã tạo job</option>
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm tiêu đề, shop…"
          className="field min-w-[120px] flex-1"
        />
        <button onClick={loadListings} disabled={loading} className="btn">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Tải lại
        </button>
        {/* "Thêm nhóm" — replaces the old "Thêm ngách" */}
        <button className="btn btn-ok" onClick={addGroup}>
          <Plus size={13} /> Thêm nhóm
        </button>
      </div>

      {usingSample && (
        <div className="mb-2.5 rounded-md border border-line bg-panel2 px-3 py-2 text-[11px] text-muted">
          Đang hiển thị dữ liệu mẫu. Kết nối crawl service + API key để xem listing thật.
        </div>
      )}

      {/* Listing rows */}
      <div className="grid gap-2">
        {filtered.map((l) => (
          <div
            key={l.id}
            className="grid grid-cols-[60px_1fr_auto] items-center gap-2.5 rounded-[10px] border border-line bg-panel p-2.5"
          >
            {l.images[0] ? (
              <img
                src={l.images[0]}
                alt=""
                className="h-[60px] w-[60px] rounded-md border border-line object-cover"
              />
            ) : (
              <div className="grid h-[60px] w-[60px] place-items-center rounded-md border border-line bg-panel2 text-muted">
                <ImageOff size={20} />
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-xs font-medium text-fg">{l.title}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                {l.shop} · {l.group} · ${l.price.toFixed(2)} ·
                <span className={`badge ${l.hasJob ? 'b-ac' : 'b-mu'}`}>
                  {l.hasJob ? 'Đã tạo job' : 'Chưa tạo job'}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              {l.hasJob ? (
                <button className="btn !text-[11px] text-muted">
                  <Eye size={12} /> Xem job
                </button>
              ) : (
                <button className="btn btn-acc !text-[11px]" onClick={() => setPanelFor(l)}>
                  <Zap size={12} /> Tạo job
                </button>
              )}
              <button className="btn !px-2 !py-1 !text-[11px]" title="Xoá">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-[10px] border border-dashed border-line py-16 text-center text-xs text-muted">
            Không có listing khớp bộ lọc.
          </div>
        )}
      </div>

      {panelFor && (
        <CrawlJobPanel
          listing={panelFor}
          groups={groups}
          myConfigs={myConfigs}
          onClose={() => setPanelFor(null)}
          onCreate={handleCreate}
        />
      )}
    </Layout>
  )
}
