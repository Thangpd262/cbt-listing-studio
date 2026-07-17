import { useEffect, useState } from 'react'
import { X, RotateCcw, Loader2, Truck } from 'lucide-react'
import { productConfigApi, userConfigApi, shippingTemplateApi, type ConfigField } from '../lib/api'
import { SAMPLE_BASE_FIELDS } from '../lib/sample-data'

export type EditableConfig = {
  id: string
  name: string
  based_on: string
  overrides: Record<string, unknown>
  shipping_template_name?: string | null
}

// Full-screen editor để override từng field của cloned config.
// Mỗi ô hiển thị giá trị mặc định của hệ thống; nhập đè để override (trống = dùng mặc định).
export default function ConfigOverrideEditor({
  config,
  apiKey,
  usingSample,
  sellingAccountId,
  onClose,
  onSaved,
}: {
  config: EditableConfig
  apiKey: string | null
  usingSample: boolean
  sellingAccountId: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(config.name)
  const [fields, setFields] = useState<ConfigField[]>([])
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const [k, v] of Object.entries(config.overrides ?? {})) init[k] = String(v ?? '')
    return init
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Shipping template
  const [shippingTemplate, setShippingTemplate] = useState(config.shipping_template_name ?? '')
  const [templates, setTemplates] = useState<string[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  // Load schema fields
  useEffect(() => {
    let cancelled = false
    async function loadFields() {
      if (!apiKey || usingSample) {
        setFields(SAMPLE_BASE_FIELDS)
        setLoading(false)
        return
      }
      try {
        const base = await productConfigApi.get(apiKey, config.based_on)
        if (!cancelled) setFields(base.fields ?? SAMPLE_BASE_FIELDS)
      } catch {
        if (!cancelled) setFields(SAMPLE_BASE_FIELDS)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadFields()
    return () => { cancelled = true }
  }, [apiKey, usingSample, config.based_on])

  // Load cached templates khi mở editor (nếu có selling account)
  useEffect(() => {
    if (!apiKey || !sellingAccountId || usingSample) return
    let cancelled = false
    setLoadingTemplates(true)
    shippingTemplateApi
      .list(apiKey, sellingAccountId)
      .then((r) => { if (!cancelled) setTemplates(r.templates) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingTemplates(false) })
    return () => { cancelled = true }
  }, [apiKey, sellingAccountId, usingSample])


  function setVal(k: string, v: string) {
    setValues((s) => ({ ...s, [k]: v }))
  }
  function resetVal(k: string) {
    setValues((s) => {
      const n = { ...s }
      delete n[k]
      return n
    })
  }

  async function save() {
    const overrides: Record<string, string> = {}
    for (const [k, v] of Object.entries(values)) if (v.trim() !== '') overrides[k] = v
    setSaving(true)
    try {
      if (apiKey && !usingSample) {
        await userConfigApi.update(apiKey, config.id, {
          name,
          overrides,
          shipping_template_name: shippingTemplate || null,
        })
      }
      onSaved()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  const overriddenCount = Object.values(values).filter((v) => v.trim() !== '').length

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-panel">
      <div className="flex h-full flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-3">
          <div className="text-sm font-medium">
            Sửa config <span className="text-muted">· từ {config.based_on}</span>
          </div>
          <button onClick={onClose} className="text-muted hover:text-fg">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* Tên config + thống kê override */}
          <div className="mb-4 flex items-end gap-4">
            <div className="w-80">
              <div className="mb-1 text-[11px] text-muted">Tên config</div>
              <input value={name} onChange={(e) => setName(e.target.value)} className="field w-full" />
            </div>
            <div className="pb-1.5 text-[11px] text-muted">
              Override từng trường (để trống = dùng giá trị mặc định)
              {overriddenCount > 0 && (
                <span className="badge b-ac ml-2">{overriddenCount} đã override</span>
              )}
            </div>
          </div>

          {/* Shipping template */}
          <div className="mb-5 rounded-lg border border-line bg-panel2 px-4 py-3">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-fg">
              <Truck size={13} className="text-muted" />
              Shipping template
              <span className="font-normal text-muted">(cố định cho dòng hàng này)</span>
            </div>
            <div className="flex items-center gap-2">
              {loadingTemplates ? (
                <span className="flex items-center gap-1.5 text-[11px] text-muted">
                  <Loader2 size={12} className="animate-spin" /> Đang tải…
                </span>
              ) : (
                <select
                  value={shippingTemplate}
                  onChange={(e) => setShippingTemplate(e.target.value)}
                  className="field w-64"
                >
                  <option value="">(chưa chọn)</option>
                  {templates.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {!loadingTemplates && templates.length === 0 && (
              <div className="mt-1.5 text-[10px] text-muted">
                Chưa có template.{' '}
                <a href="/settings/selling-accounts" className="text-brand hover:underline">
                  Vào Tài khoản bán → Sync templates
                </a>{' '}
                rồi quay lại đây.
              </div>
            )}
          </div>

          {/* Field overrides */}
          {loading ? (
            <div className="flex items-center gap-2 py-10 text-xs text-muted">
              <Loader2 size={14} className="animate-spin" /> Đang tải schema…
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {fields.map((f) => {
                const val = values[f.k] ?? ''
                const overridden = val.trim() !== ''
                const isWide = f.type === 'textarea'
                return (
                  <div
                    key={f.k}
                    className={`rounded-lg border border-line bg-panel2 p-2.5 ${isWide ? 'col-span-full' : ''}`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-xs font-medium text-fg">{f.label}</span>
                      <span className="font-mono text-[10px] text-muted">{f.k}</span>
                      {overridden && (
                        <button
                          onClick={() => resetVal(f.k)}
                          title="Về mặc định"
                          className="ml-auto flex items-center gap-1 text-[10px] text-muted hover:text-fg"
                        >
                          <RotateCcw size={11} /> reset
                        </button>
                      )}
                    </div>
                    {f.type === 'textarea' ? (
                      <textarea
                        value={val}
                        onChange={(e) => setVal(f.k, e.target.value)}
                        placeholder={f.def || '(trống)'}
                        className={`field min-h-[80px] w-full resize-y ${overridden ? '!border-brand' : ''}`}
                      />
                    ) : f.type === 'select' ? (
                      <select
                        value={val}
                        onChange={(e) => setVal(f.k, e.target.value)}
                        className={`field w-full ${overridden ? '!border-brand' : ''}`}
                      >
                        <option value="">(mặc định: {f.def || '—'})</option>
                        {(f.options ?? '').split(',').filter(Boolean).map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={f.type === 'number' ? 'number' : 'text'}
                        value={val}
                        onChange={(e) => setVal(f.k, e.target.value)}
                        placeholder={f.def || '(trống)'}
                        className={`field w-full ${overridden ? '!border-brand' : ''}`}
                      />
                    )}
                    {f.def && (
                      <div className="mt-1 truncate text-[10px] text-muted">Mặc định: {f.def}</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-line px-6 py-3">
          <button onClick={onClose} className="btn">
            Huỷ
          </button>
          <button onClick={save} disabled={saving} className="btn btn-acc">
            {saving && <Loader2 size={13} className="animate-spin" />} Lưu config
          </button>
        </div>

      </div>
    </div>
  )
}
