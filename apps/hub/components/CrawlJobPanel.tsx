import { useMemo, useState } from 'react'
import { X, Sparkles, Zap, Loader2 } from 'lucide-react'
import { generatorApi, listAmzApi, type SellingAccount } from '../lib/api'
import { SYSTEM_CONFIGS, SAMPLE_AI_IMAGES, type SampleListing } from '../lib/sample-data'

type GalleryImage = { id: string; url: string; ai?: boolean }

export type PanelGroup = { id: string; name: string }
export type PanelConfig = { id: string; name: string; from: string; imageUrls?: string[] }
export type PanelPrompt = { id: string; name: string }

// Slide-in panel: turn a crawled listing into an Amazon/Walmart job.
// Features: edit title · pick/★ main + ×-delete + ☑-select images · gen AI
// images from a prompt · optional AI description · config default images.
export default function CrawlJobPanel({
  listing,
  groups,
  myConfigs,
  prompts,
  sellingAccounts,
  apiKey,
  platform,
  onClose,
  onCreated,
}: {
  listing: SampleListing
  groups: PanelGroup[]
  myConfigs: PanelConfig[]
  prompts: PanelPrompt[]
  sellingAccounts: SellingAccount[]
  apiKey: string | null
  platform: 'amazon' | 'walmart'
  onClose: () => void
  onCreated: () => void
}) {
  const [title, setTitle] = useState(listing.title)
  const [images, setImages] = useState<GalleryImage[]>(() => [
    ...listing.images.map((url, i) => ({ id: `etsy-${i}`, url })),
    ...SAMPLE_AI_IMAGES.map((url, i) => ({ id: `ai-${i}`, url, ai: true })),
  ])
  // (a) selection — everything starts selected; only checked images go to the job.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set([...listing.images.map((_, i) => `etsy-${i}`), ...SAMPLE_AI_IMAGES.map((_, i) => `ai-${i}`)])
  )
  const [mainId, setMainId] = useState<string | null>(listing.images.length ? 'etsy-0' : null)
  const [sku, setSku] = useState(`${listing.group.slice(0, 5).toUpperCase().replace(/\s/g, '')}-001`)
  const [price, setPrice] = useState(String(listing.price))
  const [config, setConfig] = useState('')
  const [group, setGroup] = useState(listing.group)
  const [sellingAccount, setSellingAccount] = useState(sellingAccounts[0]?.id ?? '')
  const [submitting, setSubmitting] = useState(false)
  // (b) AI image generation
  const [promptId, setPromptId] = useState('')
  const [genLoading, setGenLoading] = useState(false)
  // (c) AI description
  const [aiDescription, setAiDescription] = useState(false)

  const etsyImages = useMemo(() => images.filter((i) => !i.ai), [images])
  const aiImages = useMemo(() => images.filter((i) => i.ai), [images])
  const selectedCount = images.filter((i) => selected.has(i.id)).length

  // (d) default images from the chosen user config (read-only fallback).
  const configImages = useMemo(
    () => myConfigs.find((c) => c.id === config)?.imageUrls ?? [],
    [myConfigs, config]
  )

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
  }

  function toggleSelected(id: string) {
    setSelected((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  async function genImage() {
    if (!apiKey || !promptId) {
      alert('Cần API key + chọn prompt để gen ảnh AI.')
      return
    }
    setGenLoading(true)
    try {
      const r = await generatorApi.generateImage(apiKey, { listing_id: listing.id, prompt_id: promptId, platform })
      const id = `ai-${r.id ?? Date.now()}`
      setImages((imgs) => [...imgs, { id, url: r.url, ai: true }])
      setSelected((s) => new Set(s).add(id))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gen ảnh AI thất bại')
    } finally {
      setGenLoading(false)
    }
  }

  async function submit() {
    const configKey = resolveConfigKey(config)
    const selectedUrls = images.filter((i) => selected.has(i.id)).map((i) => i.url)
    // (d) fall back to the config's default images when nothing is selected.
    const effective = selectedUrls.length ? selectedUrls : configImages
    const mainUrl =
      (mainId && selected.has(mainId) ? images.find((i) => i.id === mainId)?.url : undefined) ??
      effective[0] ??
      ''
    const extraUrls = effective.filter((u) => u !== mainUrl)

    if (platform === 'amazon' && apiKey && sellingAccount && configKey) {
      setSubmitting(true)
      try {
        const r = await listAmzApi.createListing(apiKey, {
          selling_account_id: sellingAccount,
          sku,
          config_key: configKey,
          ai_description: aiDescription,
          field_values: { item_name: title, price, img: mainUrl, images: extraUrls.join('\n') },
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

  function Thumb({ img }: { img: GalleryImage }) {
    const isMain = mainId === img.id
    const isSel = selected.has(img.id)
    return (
      <div className="relative h-[72px] w-[72px] flex-shrink-0">
        <img
          src={img.url}
          alt=""
          className={`h-[72px] w-[72px] rounded-md border-2 object-cover ${
            isMain ? 'border-brand' : isSel ? 'border-line' : 'border-transparent opacity-50'
          }`}
        />
        <input
          type="checkbox"
          checked={isSel}
          onChange={() => toggleSelected(img.id)}
          title="Chọn ảnh gửi vào job"
          className="absolute left-1 top-1 h-3.5 w-3.5 cursor-pointer accent-brand"
        />
        <button
          onClick={() => delImg(img.id)}
          title="Xoá ảnh"
          className="absolute right-0.5 top-0.5 rounded bg-black/65 px-1 text-[11px] leading-none text-danger"
        >
          ×
        </button>
        <button
          onClick={() => setMainId(img.id)}
          title="Đặt làm ảnh main"
          className={`absolute bottom-0.5 right-0.5 rounded bg-black/65 px-1 text-[13px] leading-none ${
            isMain ? 'text-brand' : 'text-warn'
          }`}
        >
          ★
        </button>
        {isMain && (
          <div className="absolute inset-x-0 bottom-0 rounded-b bg-brand-soft py-px text-center text-[9px] text-brand">
            main
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-black/60" onClick={onClose}>
      <div
        className="ml-auto flex w-[520px] max-w-full flex-col gap-2.5 overflow-y-auto border-l border-line bg-panel p-3.5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between text-sm font-medium">
          Tạo job từ listing
          <button onClick={onClose} className="text-xl leading-none text-muted hover:text-fg">
            <X size={18} />
          </button>
        </div>

        {/* Editable title */}
        <div>
          <div className="mb-1 text-[11px] text-muted">Tiêu đề Amazon (có thể sửa)</div>
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="field min-h-[52px] w-full resize-y"
          />
        </div>

        {/* Etsy images */}
        <div>
          <div className="mb-1 text-[11px] text-muted">
            Ảnh từ Etsy <span className="text-[10px]">(☑ = gửi · ★ = main · × = xoá)</span>
          </div>
          {etsyImages.length ? (
            <div className="flex flex-wrap gap-2">
              {etsyImages.map((img) => (
                <Thumb key={img.id} img={img} />
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-muted">Không có ảnh Etsy — dùng ảnh AI bên dưới.</div>
          )}
        </div>

        {/* AI-generated images + generator */}
        <div className="mt-0.5 border-t border-line pt-2.5">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted">
            <Sparkles size={12} className="text-brand" />
            Ảnh AI đã gen
            <span className="badge b-ac ml-1">{aiImages.length} ảnh</span>
          </div>
          {aiImages.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {aiImages.map((img) => (
                <Thumb key={img.id} img={img} />
              ))}
            </div>
          )}
          {/* (b) generate a new AI image from a prompt */}
          <div className="flex items-center gap-2">
            <select value={promptId} onChange={(e) => setPromptId(e.target.value)} className="field flex-1">
              <option value="">— chọn prompt —</option>
              {prompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button onClick={genImage} disabled={!promptId || genLoading} className="btn btn-acc">
              {genLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Gen ảnh AI
            </button>
          </div>
        </div>

        {/* (d) config default images — read-only, used only when nothing selected */}
        <div className="border-t border-line pt-2.5">
          <div className="mb-1 text-[11px] text-muted">Ảnh mặc định (config)</div>
          {configImages.length ? (
            <div className="flex flex-wrap gap-2">
              {configImages.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt=""
                  title="Ảnh mặc định từ config — dùng khi không chọn ảnh Etsy/AI"
                  className="h-[56px] w-[56px] rounded-md border border-line object-cover opacity-80"
                />
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-muted">—</div>
          )}
        </div>

        {/* Config + group selectors */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="mb-1 text-[11px] text-muted">Config dòng hàng</div>
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
            {myConfigs.length === 0 && (
              <div className="mt-1 text-[10px] text-muted">
                Chưa có config riêng — đang dùng config mặc định hệ thống.
              </div>
            )}
          </div>
          <div>
            <div className="mb-1 text-[11px] text-muted">Nhóm sản phẩm</div>
            <select value={group} onChange={(e) => setGroup(e.target.value)} className="field w-full">
              {groups.map((g) => (
                <option key={g.id} value={g.name}>
                  {g.name}
                </option>
              ))}
              <option value="__new">+ Thêm nhóm mới</option>
            </select>
          </div>
        </div>

        {/* (c) AI description toggle */}
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={aiDescription}
            onChange={(e) => setAiDescription(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 cursor-pointer accent-brand"
          />
          <span className="text-[11px] text-muted">
            <span className="text-fg">AI viết mô tả</span> — tối ưu keyword từ title. Bỏ trống = dùng mô tả trong config.
          </span>
        </label>

        {platform === 'amazon' && (
          <div>
            <div className="mb-1 text-[11px] text-muted">Selling account</div>
            {sellingAccounts.length ? (
              <select
                value={sellingAccount}
                onChange={(e) => setSellingAccount(e.target.value)}
                className="field w-full"
              >
                {sellingAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.region})
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-md border border-line bg-panel2 px-2.5 py-1.5 text-[11px] text-muted">
                Chưa có selling account Amazon — job sẽ chạy ở chế độ demo.
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="mb-1 text-[11px] text-muted">SKU</div>
            <input value={sku} onChange={(e) => setSku(e.target.value)} className="field w-full" />
          </div>
          <div>
            <div className="mb-1 text-[11px] text-muted">Giá (USD)</div>
            <input value={price} onChange={(e) => setPrice(e.target.value)} className="field w-full" />
          </div>
        </div>

        {/* Submit → Jobs queue */}
        <div className="flex items-center gap-2 border-t border-line pt-2.5">
          <span className="text-[11px] text-muted">
            Đã chọn: <span className="font-semibold text-fg">{selectedCount}</span> ảnh
          </span>
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="btn">
              Huỷ
            </button>
            <button onClick={submit} className="btn btn-acc" disabled={!config || submitting}>
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />} Tạo job → Jobs queue
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
