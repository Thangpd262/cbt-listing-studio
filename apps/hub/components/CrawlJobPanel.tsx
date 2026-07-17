import { useEffect, useMemo, useRef, useState } from 'react'
import { Sparkles, Zap, Loader2, RotateCw, Trash2, User, Crosshair, ExternalLink } from 'lucide-react'
import { crawlApi, generatorApi, listAmzApi, type SellingAccount } from '../lib/api'
import ImageLightbox from './ImageLightbox'
import ListingAiCost from './ListingAiCost'
import { type SampleListing } from '../lib/sample-data'

type GalleryImage = { id: string; url: string; ai?: boolean }

export type PanelGroup = { id: string; name: string }
export type PanelConfig = { id: string; name: string; from: string; productType?: string | null; imageUrls?: string[] }
// Model is bound to the prompt (no separate model picker) — carry its metadata so
// the card can show a chip and the legacy "no model" warning.
export type PanelPrompt = {
  id: string
  name: string
  model?: string | null
  model_label?: string | null
  cost_per_image_usd?: number | null
}

// SKU short-code by Amazon product_type. SKU = {SHORT}-{unix10}.
const TYPE_SHORT: Record<string, string> = {
  SHIRT: 'SHIR',
  DRINKING_CUP: 'DRIN',
  BLANKET: 'BLAN',
  SWEATSHIRT: 'SWEA',
  HAT: 'HAT',
  CANDLE: 'CAND',
}

function shortCode(productType: string | null | undefined): string {
  if (!productType) return 'ITEM'
  return TYPE_SHORT[productType] ?? (productType.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'ITEM')
}

// 'YYYY-MM-DD' → 'DD/MM/YYYY' (left as-is if it doesn't match).
function formatDate(d?: string): string | undefined {
  if (!d) return undefined
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d
}

// Inline 4-column card: [listing meta] · [title] · [images] · [config + actions].
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
    ...listing.aiImages.map((url, i) => ({ id: `ai-${i}`, url, ai: true })),
  ])
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set([...listing.images.map((_, i) => `etsy-${i}`), ...listing.aiImages.map((_, i) => `ai-${i}`)])
  )
  const [mainId, setMainId] = useState<string | null>(listing.images.length ? 'etsy-0' : null)
  // Single Etsy image used as the AI style reference (radio behavior).
  const [refImageId, setRefImageId] = useState<string | null>(null)
  // Fullscreen preview (Etsy or AI image).
  const [lightbox, setLightbox] = useState<{ url: string; caption?: string } | null>(null)
  // Price derived silently; SKU is generated fresh at job-creation time.
  const price = String(listing.price)
  // title autosave status + tags → search_term
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [tags, setTags] = useState(() => (listing.tags ?? []).join('\n'))
  const [config, setConfig] = useState('')
  const [aiDescription, setAiDescription] = useState(false)
  const [promptId, setPromptId] = useState('')
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
  const etsyId = listing.etsyId
  const listingUrl = etsyId ? `https://www.etsy.com/listing/${etsyId}` : null

  // selling account is derived silently (not shown in this layout).
  const sellingAccountId = sellingAccounts[0]?.id ?? ''

  // Persist the AI image list back to the crawl record (survives reload).
  async function persistAiImages(urls: string[]) {
    if (!apiKey) return
    try {
      await crawlApi.updateListing(apiKey, listing.id, { ai_images: urls })
    } catch {
      // ignore — keep the local edit
    }
  }

  // Persist remaining Etsy images after a deletion (survives reload).
  async function persistEtsyImages(urls: string[]) {
    if (!apiKey) return
    try {
      await crawlApi.updateListing(apiKey, listing.id, { images: urls })
    } catch {
      // ignore
    }
  }

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
    }, 500)
    return () => clearTimeout(t)
  }, [title, apiKey, listing.id])

  // Only user configs are selectable now; resolve to the base product_configs key.
  function resolveConfigKey(sel: string): string | null {
    return myConfigs.find((c) => c.id === sel)?.from ?? null
  }

  function delImg(id: string) {
    const img = images.find((i) => i.id === id)
    setImages((imgs) => imgs.filter((i) => i.id !== id))
    setSelected((s) => {
      const n = new Set(s)
      n.delete(id)
      return n
    })
    if (mainId === id) setMainId(null)
    if (refImageId === id) setRefImageId(null)
    // All image types are persisted → removing one must sync to the DB.
    if (img?.ai) persistAiImages(aiImages.filter((i) => i.id !== id).map((i) => i.url))
    else persistEtsyImages(etsyImages.filter((i) => i.id !== id).map((i) => i.url))
  }

  function toggleSelected(id: string) {
    setSelected((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  // The model is bound to the selected prompt (resolved server-side), so no model
  // is sent from here — the chip below just reflects the prompt's model.
  const selectedPrompt = useMemo(() => prompts.find((p) => p.id === promptId), [prompts, promptId])

  // Generate one image via the selected prompt (model comes from the prompt).
  async function genOne(): Promise<string> {
    if (!apiKey) throw new Error('Cần API key')
    if (!promptId) throw new Error('Chọn prompt')
    // Style reference: the selected Etsy image (if any) → img2img.
    const referenceUrl = refImageId ? images.find((i) => i.id === refImageId)?.url : undefined
    const r = await generatorApi.generateImage(apiKey, {
      listing_id: listing.id,
      prompt_id: promptId,
      platform,
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
      persistAiImages([...aiImages.map((i) => i.url), url])
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
      persistAiImages(aiImages.map((i) => (i.id === id ? url : i.url)))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gen lại thất bại')
    } finally {
      setRegenId(null)
    }
  }

  async function submit() {
    if (title.length > 75) {
      alert('Title vuot qua 75 ky tu -- Amazon se tu choi. Rut ngan truoc khi tao job.')
      return
    }
    const configKey = resolveConfigKey(config)
    // SKU = {SHORT}-{listingId8}-{mood8}: deterministic per listing + mood, so the
    // same listing maps to a stable SKU (short-code from the config's product_type).
    const selectedConfig = myConfigs.find((c) => c.id === config)
    const listingShort = listing.id.replace(/-/g, '').slice(0, 8).toUpperCase()
    const moodSlug = (listing.mood ?? '').replace(/\s+/g, '').slice(0, 8).toUpperCase() || 'X'
    const sku = `${shortCode(selectedConfig?.productType)}-${listingShort}-${moodSlug}`
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
          listing_id: listing.id,
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
      <div className="relative h-20 w-20 flex-shrink-0">
        <img
          src={img.url}
          alt=""
          onClick={() => setLightbox({ url: img.url, caption: listing.title })}
          title="Xem ảnh lớn"
          className={`h-20 w-20 cursor-pointer rounded-md border-2 object-cover ${
            isMain ? 'border-brand' : isSel ? 'border-line' : 'border-transparent opacity-50'
          } ${isRef ? 'ring-2 ring-purple-400' : ''}`}
        />
        {/* select checkbox (top-left corner) */}
        <input
          type="checkbox"
          checked={isSel}
          onChange={() => toggleSelected(img.id)}
          title="Chọn ảnh gửi vào job"
          className="absolute left-1 top-1 h-4 w-4 cursor-pointer accent-brand"
        />
        {/* status badge (top-left, next to the checkbox) */}
        {isMain ? (
          <span className="absolute left-6 top-1 rounded bg-brand px-1 text-[9px] font-medium text-white">main</span>
        ) : isRef ? (
          <span className="absolute left-6 top-1 rounded bg-purple-500 px-1 text-[9px] font-medium text-white">
            Ref
          </span>
        ) : null}
        {/* delete (top-right) */}
        <button
          onClick={() => delImg(img.id)}
          title={img.ai ? 'Xoá ảnh AI' : 'Bỏ ảnh khỏi thẻ'}
          className="absolute -right-1.5 -top-1.5 grid h-[18px] w-[18px] place-items-center rounded-full border-[1.5px] border-white bg-danger text-[10px] font-bold leading-none text-white"
        >
          ×
        </button>
        {/* reference toggle ⌖ (bottom-left) */}
        {canRef && (
          <button
            onClick={() => setRefImageId(isRef ? null : img.id)}
            title="Dùng ảnh này làm tham chiếu cho AI gen"
            className={`absolute bottom-1 left-1 rounded bg-black/65 px-1 leading-none ${
              isRef ? 'text-purple-300' : 'text-muted'
            }`}
          >
            <Crosshair size={12} />
          </button>
        )}
        {/* regen (AI) + main ★ (bottom-right) */}
        <div className="absolute bottom-1 right-1 flex gap-0.5">
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
    <div
      data-testid="crawl-card"
      className="card grid grid-cols-1 gap-4 lg:grid-cols-[170px_240px_minmax(0,1fr)_164px] lg:items-start"
    >
      {/* ── Left: listing meta ── */}
      <div className="flex flex-col gap-1 text-xs">
        <span className="font-disp text-[11px] font-bold text-faint">#{index + 1}</span>
        <div className="flex items-center gap-1.5 text-muted">
          <User size={13} />
          <span className="truncate">{listing.username ?? '—'}</span>
        </div>
        {listing.email && (
          <div className="truncate text-brand" title={listing.email}>
            {listing.email}
          </div>
        )}
        <div className="text-sm font-semibold text-fg">{listing.shop}</div>
        {listingUrl ? (
          <a
            href={listingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1 font-mono text-[12px] text-brand hover:underline"
          >
            {etsyId}
            <ExternalLink size={10} />
          </a>
        ) : (
          <span className="font-mono text-[12px] text-faint">—</span>
        )}
        <span className={`badge mt-1 w-fit ${listing.hasJob ? 'b-ok' : 'b-mu'}`}>
          {listing.hasJob ? '● Đã tạo job' : '● Chưa tạo job'}
        </span>
        {formatDate(listing.createdAt) && (
          <div className="font-mono text-[11px] text-muted">{formatDate(listing.createdAt)}</div>
        )}
      </div>

      {/* ── Title (fixed 240×80 textarea) ── */}
      <div className="flex flex-col gap-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Tiêu đề sản phẩm</div>
        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="field h-20 w-[240px] max-w-full resize-none leading-relaxed"
        />
        <div className="text-[11px] text-faint">
          <span className={title.length > 75 ? 'text-red-500 font-semibold' : ''}>{title.length}/75</span>{' '}ký tự ·{' '}
          {saveStatus === 'saving' ? 'đang lưu…' : saveStatus === 'saved' ? 'đã lưu' : 'tự lưu'}
        </div>
      </div>

      {/* ── Images ── */}
      <div className="flex min-w-0 flex-col gap-2.5">
        {/* Etsy images (all, no limit) */}
        <div>
          <div className="mb-1 text-[11.5px] font-semibold text-muted">
            Ảnh Etsy <span className="text-muted">({etsyImages.length})</span>
          </div>
          {etsyImages.length ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {etsyImages.map((img) => (
                  <Thumb key={img.id} img={img} canRef />
                ))}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-muted">
                <Crosshair size={10} className="text-purple-300" /> Chọn ảnh tham chiếu để gen theo phong cách ảnh đó
              </div>
            </>
          ) : (
            <div className="text-[12px] text-faint">—</div>
          )}
        </div>

        {/* AI images — grid only when there are any; else "—" (label always shows count) */}
        <div data-testid="ai-section">
          <div className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold text-muted">
            <Sparkles size={12} className="text-brand" /> Ảnh AI <span className="text-muted">({aiImages.length})</span>
            {apiKey && aiImages.length > 0 && <span className="ml-auto"><ListingAiCost listingId={listing.id} /></span>}
          </div>
          {aiImages.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {aiImages.map((img) => (
                <Thumb key={img.id} img={img} canRegen />
              ))}
            </div>
          ) : (
            <div className="text-[12px] text-faint">—</div>
          )}
          {/* prompt + gen (model is bound to the prompt — no separate picker) */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select value={promptId} onChange={(e) => setPromptId(e.target.value)} className="field min-w-[150px] flex-1">
              <option value="">— chọn prompt —</option>
              {prompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              onClick={genImage}
              disabled={!promptId || genLoading}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#7C3AED] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#6D28D9] disabled:opacity-40"
            >
              {genLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Gen ảnh AI
            </button>
          </div>
          {/* Model chip from the selected prompt, or a legacy "no model" warning */}
          {selectedPrompt && (
            selectedPrompt.model ? (
              <div className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-line bg-panel2 px-2 py-1 text-[11px] text-muted">
                <Sparkles size={11} className="text-brand" />
                Model: <span className="font-medium text-fg">{selectedPrompt.model_label ?? selectedPrompt.model}</span>
                {selectedPrompt.cost_per_image_usd != null && (
                  <span className="text-faint">· ~${selectedPrompt.cost_per_image_usd.toFixed(2)}/ảnh</span>
                )}
              </div>
            ) : (
              <div className="mt-1.5 rounded-md border border-warn/40 bg-warn/10 px-2 py-1 text-[11px] text-warn">
                Prompt này chưa gán model — cập nhật trong tab Prompt ảnh AI.
              </div>
            )
          )}
        </div>

        {/* Tags → mapped to search_term on the job */}
        <div>
          <div className="mb-1 text-[11.5px] font-semibold text-muted">Tags / Search term</div>
          <textarea
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="mỗi tag 1 dòng, hoặc cách nhau bằng dấu phẩy"
            className="field min-h-[40px] w-full resize-y"
          />
        </div>

        {/* config default images (read-only) */}
        <div>
          <div className="mb-1 text-[11.5px] font-semibold text-muted">
            Ảnh mặc định (config) <span className="text-muted">({configImages.length})</span>
          </div>
          {configImages.length ? (
            <div className="flex flex-wrap gap-1.5">
              {configImages.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt=""
                  onClick={() => setLightbox({ url, caption: 'Ảnh mặc định (config)' })}
                  title="Ảnh mặc định từ config (dùng khi không chọn ảnh nào)"
                  className="h-20 w-20 cursor-pointer rounded-md border border-line object-cover opacity-80"
                />
              ))}
            </div>
          ) : (
            <div className="text-[12px] text-faint">—</div>
          )}
        </div>

        <div className="border-t border-line pt-2 text-[11px] text-muted">
          Đã chọn: <span className="font-semibold text-fg">{selectedCount}</span> ảnh
        </div>
      </div>

      {/* ── Right: config + actions ── */}
      <div className="flex flex-col gap-2.5">
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Dòng hàng</div>
          <select
            value={config}
            onChange={(e) => setConfig(e.target.value)}
            disabled={myConfigs.length === 0}
            className="field w-full"
          >
            {myConfigs.length > 0 ? (
              <>
                <option value="">— Chọn config —</option>
                {myConfigs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (từ {c.from})
                  </option>
                ))}
              </>
            ) : (
              <option value="" disabled>
                Chưa có config — tạo trong tab Configs
              </option>
            )}
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
            <span className="text-sm font-medium text-fg">AI viết mô tả</span> — tối ưu keyword từ title + ảnh + search term. Bỏ trống = dùng mô tả trong config.
          </span>
        </label>

        <button onClick={submit} disabled={!config || submitting} className="btn btn-acc w-full justify-center py-2">
          {submitting ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />} Tạo job
        </button>
        <button onClick={onDelete} className="btn btn-danger w-full justify-center">
          <Trash2 size={13} /> Xóa
        </button>
      </div>

      {lightbox && (
        <ImageLightbox url={lightbox.url} caption={lightbox.caption} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}
