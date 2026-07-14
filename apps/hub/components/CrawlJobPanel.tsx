import { useEffect, useMemo, useRef, useState } from 'react'
import { Sparkles, Zap, Loader2, RotateCw, Trash2, User, Crosshair } from 'lucide-react'
import { crawlApi, generatorApi, listAmzApi, type SellingAccount } from '../lib/api'
import { SYSTEM_CONFIGS, SAMPLE_AI_IMAGES, type SampleListing } from '../lib/sample-data'

type GalleryImage = { id: string; url: string; ai?: boolean }

export type PanelGroup = { id: string; name: string }
export type PanelConfig = { id: string; name: string; from: string; imageUrls?: string[] }
export type PanelPrompt = { id: string; name: string }

const AI_MODELS = ['gpt-image-1', 'gemini-2.5-flash-image']

// Inline 3-column card: [listing meta] · [content + images] · [config + actions].
// One card per crawled listing (rendered as a stack in the Crawl page).
export default function CrawlJobPanel({
  listing,
  index,
  myConfigs,
  prompts,
  sellingAccounts,
  apiKey,
  platform,
  onCreated,
  onDelete,
}: {
  listing: SampleListing
  index: number
  myConfigs: PanelConfig[]
  prompts: PanelPrompt[]
  sellingAccounts: SellingAccount[]
  apiKey: string | null
  platform: 'amazon' | 'walmart'
  onCreated: () => void
  onDelete: () => void
}) {
  const [title, setTitle] = useState(listing.title)
  const [images, setImages] = useState<GalleryImage[]>(() => [
    ...listing.images.map((url, i) => ({ id: `etsy-${i}`, url })),
    ...SAMPLE_AI_IMAGES.map((url, i) => ({ id: `ai-${i}`, url, ai: true })),
  ])
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set([...listing.images.map((_, i) => `etsy-${i}`), ...SAMPLE_AI_IMAGES.map((_, i) => `ai-${i}`)])
  )
  const [mainId, setMainId] = useState<string | null>(listing.images.length ? 'etsy-0' : null)
  // Single Etsy image used as the AI style reference (radio behavior).
  const [refImageId, setRefImageId] = useState<string | null>(null)
  // SKU + price are derived silently (no longer edited in this layout).
  const sku = `${(listing.group || 'ITEM').slice(0, 5).toUpperCase().replace(/\s/g, '')}-${String(index + 1).padStart(3, '0')}`
  const price = String(listing.price)
  // title autosave status + tags → search_term
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [tags, setTags] = useState('')
  const [config, setConfig] = useState('')
  const [aiDescription, setAiDescription] = useState(false)
  const [promptId, setPromptId] = useState('')
  const [model, setModel] = useState(AI_MODELS[0])
  const [genLoading, setGenLoading] = useState(false)
  const [regenId, setRegenId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const etsyImages = useMemo(() => images.filter((i) => !i.ai), [images])
  const aiImages = useMemo(() => images.filter((i) => i.ai), [images])
  const selectedCount = images.filter((i) => selected.has(i.id)).length
  const configImages = useMemo(
    () => myConfigs.find((c) => c.id === config)?.imageUrls ?? [],
    [myConfigs, config]
  )

  // selling account is derived silently (not shown in this layout).
  const sellingAccountId = sellingAccounts[0]?.id ?? ''

  // (b) debounce title changes → PUT crawl listing. Skips the initial render.
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    setSaveStatus('saving')
    const t = setTimeout(async () => {
      if (apiKey) {
        try {
          await crawlApi.updateListing(apiKey, listing.id, { title })
        } catch {
          // ignore — keep the local edit
        }
      }
      setSaveStatus('saved')
    }, 1000)
    return () => clearTimeout(t)
  }, [title, apiKey, listing.id])

  function resolveConfigKey(sel: string): string | null {
    const mine = myConfigs.find((c) => c.id === sel)
    if (mine) return mine.from
    return SYSTEM_CONFIGS.some((s) => s.key === sel) ? sel : null
  }

  function delImg(id: string) {
    setImages((imgs) => imgs.filter((i) => i.id !== id))
    setSelected((s) => {
      const n = new Set(s)
      n.delete(id)
      return n
    })
    if (mainId === id) setMainId(null)
    if (refImageId === id) setRefImageId(null)
  }

  function toggleSelected(id: string) {
    setSelected((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  // Generate one image via the selected prompt + model.
  async function genOne(): Promise<string> {
    if (!apiKey) throw new Error('Cần API key')
    if (!promptId) throw new Error('Chọn prompt')
    // Style reference: the selected Etsy image (if any) → img2img.
    const referenceUrl = refImageId ? images.find((i) => i.id === refImageId)?.url : undefined
    const r = await generatorApi.generateImage(apiKey, {
      listing_id: listing.id,
      prompt_id: promptId,
      platform,
      model,
      reference_image_url: referenceUrl,
    })
    return r.url
  }

  async function genImage() {
    if (!apiKey || !promptId) {
      alert('Cần API key + chọn prompt để gen ảnh AI.')
      return
    }
    setGenLoading(true)
    try {
      const url = await genOne()
      const id = `ai-${Date.now()}`
      setImages((imgs) => [...imgs, { id, url, ai: true }])
      setSelected((s) => new Set(s).add(id))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gen ảnh AI thất bại')
    } finally {
      setGenLoading(false)
    }
  }

  async function regen(id: string) {
    if (!apiKey || !promptId) {
      alert('Cần API key + chọn prompt để gen lại.')
      return
    }
    setRegenId(id)
    try {
      const url = await genOne()
      setImages((imgs) => imgs.map((i) => (i.id === id ? { ...i, url } : i)))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gen lại thất bại')
    } finally {
      setRegenId(null)
    }
  }

  async function submit() {
    const configKey = resolveConfigKey(config)
    const selectedUrls = images.filter((i) => selected.has(i.id)).map((i) => i.url)
    const effective = selectedUrls.length ? selectedUrls : configImages
    const mainUrl =
      (mainId && selected.has(mainId) ? images.find((i) => i.id === mainId)?.url : undefined) ??
      effective[0] ??
      ''
    const extraUrls = effective.filter((u) => u !== mainUrl)

    if (platform === 'amazon' && apiKey && sellingAccountId && configKey) {
      setSubmitting(true)
      try {
        const searchTerms = tags.split(/[,\n]/).map((t) => t.trim()).filter(Boolean).join('\n')
        const r = await listAmzApi.createListing(apiKey, {
          selling_account_id: sellingAccountId,
          sku,
          config_key: configKey,
          ai_description: aiDescription,
          field_values: {
            item_name: title,
            price,
            img: mainUrl,
            images: extraUrls.join('\n'),
            search_terms: searchTerms,
          },
        })
        if (r.status === 'failed') alert(`Job đã tạo nhưng chạy lỗi: ${r.error ?? 'unknown'}`)
        onCreated()
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Tạo job thất bại')
      } finally {
        setSubmitting(false)
      }
      return
    }
    alert(`Đã tạo job cho SKU ${sku} → Jobs queue (demo — chưa nối service).`)
    onCreated()
  }

  function Thumb({ img, canRegen, canRef }: { img: GalleryImage; canRegen?: boolean; canRef?: boolean }) {
    const isMain = mainId === img.id
    const isSel = selected.has(img.id)
    const isRef = refImageId === img.id
    return (
      <div className="relative h-24 w-24 flex-shrink-0">
        <img
          src={img.url}
          alt=""
          className={`h-24 w-24 rounded-md border-2 object-cover ${
            isMain ? 'border-brand' : isSel ? 'border-line' : 'border-transparent opacity-50'
          } ${isRef ? 'ring-2 ring-purple-400' : ''}`}
        />
        {/* status badge (top-left) */}
        {isMain ? (
          <span className="absolute left-1 top-1 rounded bg-brand px-1 text-[9px] font-medium text-white">main</span>
        ) : isRef ? (
          <span className="absolute left-1 top-1 rounded bg-purple-500 px-1 text-[9px] font-medium text-white">
            Tham chiếu AI
          </span>
        ) : null}
        {/* delete (top-right) */}
        <button
          onClick={() => delImg(img.id)}
          title="Xoá ảnh"
          className="absolute right-1 top-1 rounded bg-black/65 px-1 text-[12px] leading-none text-danger"
        >
          ×
        </button>
        {/* select checkbox (bottom-left) */}
        <input
          type="checkbox"
          checked={isSel}
          onChange={() => toggleSelected(img.id)}
          title="Chọn ảnh gửi vào job"
          className="absolute bottom-1 left-1 h-4 w-4 cursor-pointer accent-brand"
        />
        {/* action cluster (bottom-right) */}
        <div className="absolute bottom-1 right-1 flex gap-0.5">
          {canRef && (
            <button
              onClick={() => setRefImageId(isRef ? null : img.id)}
              title="Dùng ảnh này làm tham chiếu cho AI gen"
              className={`rounded bg-black/65 px-1 leading-none ${isRef ? 'text-purple-300' : 'text-muted'}`}
            >
              <Crosshair size={12} />
            </button>
          )}
          {canRegen && (
            <button
              onClick={() => regen(img.id)}
              disabled={regenId === img.id}
              title="Gen lại ảnh này"
              className="rounded bg-black/65 px-1 leading-none text-brand"
            >
              {regenId === img.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
            </button>
          )}
          <button
            onClick={() => setMainId(img.id)}
            title="Đặt làm ảnh main"
            className={`rounded bg-black/65 px-1 text-[14px] leading-none ${isMain ? 'text-brand' : 'text-warn'}`}
          >
            ★
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card grid grid-cols-1 gap-4 lg:grid-cols-[190px_minmax(0,1fr)_220px]">
      {/* ── Left: listing meta ── */}
      <div className="flex flex-col gap-1.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-mono text-muted">#{index + 1}</span>
          <span className="grid h-6 w-6 place-items-center rounded-full bg-panel2 text-muted">
            <User size={13} />
          </span>
          <span className="truncate text-muted">{listing.username ?? '—'}</span>
        </div>
        {listing.email && (
          <div className="truncate text-[11px] text-brand" title={listing.email}>
            {listing.email}
          </div>
        )}
        <div className="font-medium text-fg">{listing.shop}</div>
        {listing.etsyId && <div className="font-mono text-[11px] text-muted">{listing.etsyId}</div>}
        <span className={`badge w-fit ${listing.hasJob ? 'b-ok' : 'b-mu'}`}>
          {listing.hasJob ? '✓ Đã tạo job' : 'Chưa tạo job'}
        </span>
        {listing.createdAt && <div className="text-[11px] text-muted">{listing.createdAt}</div>}
      </div>

      {/* ── Middle: title + images ── */}
      <div className="min-w-0">
        {/* Title — its own full-width block, separate from images */}
        <div className="mb-3 rounded-lg border border-line bg-panel2/40 p-2.5">
          <div className="mb-1 text-[11px] text-muted">Tiêu đề sản phẩm</div>
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="field min-h-[64px] w-full resize-y"
          />
          <div className="mt-1 text-[10px] text-muted">
            {title.length} ký tự ·{' '}
            {saveStatus === 'saving' ? 'đang lưu…' : saveStatus === 'saved' ? 'đã lưu' : 'tự lưu'}
          </div>
        </div>

        {/* Etsy images (all, no limit) */}
        <div className="mb-1 text-[11px] font-medium text-fg">
          Ảnh Etsy <span className="text-muted">({etsyImages.length})</span>
        </div>
        {etsyImages.length ? (
          <>
            <div className="flex flex-wrap gap-2">
              {etsyImages.map((img) => (
                <Thumb key={img.id} img={img} canRef />
              ))}
            </div>
            <div className="mb-3 mt-1 flex items-center gap-1 text-[10px] text-muted">
              <Crosshair size={10} className="text-purple-300" /> Chọn ảnh tham chiếu để gen theo phong cách ảnh đó
            </div>
          </>
        ) : (
          <div className="mb-3 text-[11px] text-muted">Không có ảnh Etsy.</div>
        )}

        {/* AI images */}
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-fg">
          <Sparkles size={12} className="text-brand" /> Ảnh AI <span className="text-muted">({aiImages.length})</span>
        </div>
        {aiImages.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {aiImages.map((img) => (
              <Thumb key={img.id} img={img} canRegen />
            ))}
          </div>
        )}
        {/* prompt + model + gen */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select value={promptId} onChange={(e) => setPromptId(e.target.value)} className="field min-w-[150px] flex-1">
            <option value="">— chọn prompt —</option>
            {prompts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select value={model} onChange={(e) => setModel(e.target.value)} className="field">
            {AI_MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button onClick={genImage} disabled={!promptId || genLoading} className="btn btn-acc">
            {genLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Gen ảnh AI
          </button>
        </div>

        {/* Tags → mapped to search_term on the job */}
        <div className="mb-3">
          <div className="mb-1 text-[11px] font-medium text-fg">Tags / Search term</div>
          <textarea
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="mỗi tag 1 dòng, hoặc cách nhau bằng dấu phẩy"
            className="field min-h-[44px] w-full resize-y"
          />
        </div>

        {/* config default images (read-only) */}
        <div className="mb-1 text-[11px] font-medium text-fg">
          Ảnh mặc định (config) <span className="text-muted">({configImages.length})</span>
        </div>
        {configImages.length ? (
          <div className="flex flex-wrap gap-2">
            {configImages.map((url, i) => (
              <img
                key={i}
                src={url}
                alt=""
                title="Ảnh mặc định từ config (dùng khi không chọn ảnh nào)"
                className="h-[56px] w-[56px] rounded-md border border-line object-cover opacity-80"
              />
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-muted">—</div>
        )}

        <div className="mt-3 border-t border-line pt-2 text-[11px] text-muted">
          Đã chọn: <span className="font-semibold text-fg">{selectedCount}</span> ảnh
        </div>
      </div>

      {/* ── Right: config + actions ── */}
      <div className="flex flex-col gap-2.5">
        <div>
          <div className="mb-1 text-[11px] text-muted">Dòng hàng</div>
          <select value={config} onChange={(e) => setConfig(e.target.value)} className="field w-full">
            <option value="">— Chọn config —</option>
            {myConfigs.length > 0
              ? myConfigs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (từ {c.from})
                  </option>
                ))
              : SYSTEM_CONFIGS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.key} — {c.label}
                  </option>
                ))}
          </select>
        </div>

        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={aiDescription}
            onChange={(e) => setAiDescription(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 cursor-pointer accent-brand"
          />
          <span className="text-[11px] text-muted">
            <span className="text-fg">AI viết mô tả</span> — tối ưu keyword từ title + ảnh + search term. Bỏ trống = dùng mô tả trong config.
          </span>
        </label>

        <button onClick={submit} disabled={!config || submitting} className="btn btn-acc w-full justify-center py-2">
          {submitting ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />} Tạo job
        </button>
        <button onClick={onDelete} className="btn w-full justify-center">
          <Trash2 size={13} /> Xóa
        </button>
      </div>
    </div>
  )
}
