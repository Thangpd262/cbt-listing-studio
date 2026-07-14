import { useMemo, useState } from 'react'
import { X, Sparkles, Zap, Loader2 } from 'lucide-react'
import { listAmzApi, type SellingAccount } from '../lib/api'
import { SYSTEM_CONFIGS, SAMPLE_AI_IMAGES, type SampleListing } from '../lib/sample-data'

type GalleryImage = { id: string; url: string; ai?: boolean }

export type PanelGroup = { id: string; name: string }
export type PanelConfig = { id: string; name: string; from: string }

// Slide-in panel for turning a crawled listing into an Amazon/Walmart job.
// Flow: sửa title → thêm/bớt ảnh → chọn ảnh main (★) → chọn config → tạo job.
// Amazon: real create via list-amz (config_key + field_values). Otherwise mock.
export default function CrawlJobPanel({
  listing,
  groups,
  myConfigs,
  sellingAccounts,
  apiKey,
  platform,
  onClose,
  onCreated,
}: {
  listing: SampleListing
  groups: PanelGroup[]
  myConfigs: PanelConfig[]
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
  const [mainId, setMainId] = useState<string | null>(
    listing.images.length ? 'etsy-0' : null
  )
  const [sku, setSku] = useState(`${listing.group.slice(0, 5).toUpperCase().replace(/\s/g, '')}-001`)
  const [price, setPrice] = useState(String(listing.price))
  const [config, setConfig] = useState('')
  const [group, setGroup] = useState(listing.group)
  const [sellingAccount, setSellingAccount] = useState(sellingAccounts[0]?.id ?? '')
  const [submitting, setSubmitting] = useState(false)

  const etsyImages = useMemo(() => images.filter((i) => !i.ai), [images])
  const aiImages = useMemo(() => images.filter((i) => i.ai), [images])

  // The config select value is either a "my config" id or a system key.
  // Resolve both to the underlying product_configs key list-amz expects.
  function resolveConfigKey(sel: string): string | null {
    const mine = myConfigs.find((c) => c.id === sel)
    if (mine) return mine.from
    return SYSTEM_CONFIGS.some((s) => s.key === sel) ? sel : null
  }

  async function submit() {
    const configKey = resolveConfigKey(config)
    const mainUrl = images.find((i) => i.id === mainId)?.url ?? images[0]?.url ?? ''
    const extraUrls = images.filter((i) => i.url !== mainUrl).map((i) => i.url)

    // Real Amazon create when we have an API key + selling account + config.
    if (platform === 'amazon' && apiKey && sellingAccount && configKey) {
      setSubmitting(true)
      try {
        const r = await listAmzApi.createListing(apiKey, {
          selling_account_id: sellingAccount,
          sku,
          config_key: configKey,
          field_values: {
            item_name: title,
            price,
            img: mainUrl,
            images: extraUrls.join('\n'),
          },
        })
        if (r.status === 'failed') {
          alert(`Job đã tạo nhưng chạy lỗi: ${r.error ?? 'unknown'}`)
        }
        onCreated()
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Tạo job thất bại')
      } finally {
        setSubmitting(false)
      }
      return
    }

    // Fallback (Walmart, or no API/selling account) — mock the queue push.
    alert(`Đã tạo job cho SKU ${sku} → Jobs queue (demo — chưa nối service).`)
    onCreated()
  }

  function delImg(id: string) {
    setImages((imgs) => imgs.filter((i) => i.id !== id))
    if (mainId === id) setMainId(null)
  }

  function Thumb({ img }: { img: GalleryImage }) {
    const isMain = mainId === img.id
    return (
      <div className="relative h-[72px] w-[72px] flex-shrink-0">
        <img
          src={img.url}
          alt=""
          className={`h-[72px] w-[72px] rounded-md border-2 object-cover ${
            isMain ? 'border-brand' : 'border-transparent'
          }`}
        />
        <button
          onClick={() => setMainId(img.id)}
          title="Đặt làm ảnh main"
          className="absolute left-0.5 top-0.5 rounded bg-black/65 px-1 text-[13px] leading-none text-warn"
        >
          ★
        </button>
        <button
          onClick={() => delImg(img.id)}
          title="Xoá ảnh"
          className="absolute right-0.5 top-0.5 rounded bg-black/65 px-1 text-[11px] leading-none text-danger"
        >
          ×
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
            Ảnh từ Etsy <span className="text-[10px]">(★ = ảnh main · × = xoá)</span>
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

        {/* AI-generated images */}
        <div className="mt-0.5 border-t border-line pt-2.5">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted">
            <Sparkles size={12} className="text-brand" />
            Ảnh AI đã gen
            <span className="badge b-ac ml-1">{aiImages.length} ảnh</span>
          </div>
          {aiImages.length ? (
            <div className="flex flex-wrap gap-2">
              {aiImages.map((img) => (
                <Thumb key={img.id} img={img} />
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-muted">Chưa có ảnh AI.</div>
          )}
        </div>

        {/* Config + group selectors */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="mb-1 text-[11px] text-muted">Config dòng hàng</div>
            <select value={config} onChange={(e) => setConfig(e.target.value)} className="field w-full">
              <option value="">— Chọn config —</option>
              <optgroup label="Config của tôi (từ system defaults)">
                {myConfigs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (từ {c.from})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Config mặc định (hệ thống — chỉ đọc)">
                {SYSTEM_CONFIGS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.key} — {c.label}
                  </option>
                ))}
              </optgroup>
            </select>
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
        <div className="flex justify-end gap-2 border-t border-line pt-2.5">
          <button onClick={onClose} className="btn">
            Huỷ
          </button>
          <button onClick={submit} className="btn btn-acc" disabled={!config || submitting}>
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />} Tạo job → Jobs queue
          </button>
        </div>
      </div>
    </div>
  )
}
