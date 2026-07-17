import { useMemo, useState } from 'react'
import { Save, Pencil, Trash2, RefreshCw, Loader2, X } from 'lucide-react'
import Layout from '../components/Layout'
import { SkeletonRows } from '../components/Skeleton'
import { useAuth } from '../lib/auth-context'
import { generatorApi, serviceConfigured, type PromptTemplate, type ImageModel } from '../lib/api'
import { usePrompts, useModels } from '../lib/queries'

// Human labels for provider groups in the model dropdown.
const PROVIDER_LABEL: Record<string, string> = {
  openai: 'OpenAI',
  google: 'Google',
  blackforestlabs: 'Black Forest Labs',
  recraft: 'Recraft',
  stability: 'Stability',
}

// Offline fallback so the dropdown works in sample mode (no generator wired).
const FALLBACK_MODELS: ImageModel[] = [
  { id: 'gpt-image-1', label: 'GPT Image 1', provider: 'openai', cost_per_image_usd: 0.04, supports_multi_image: true, max_images_per_request: 10 },
  { id: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image', provider: 'google', cost_per_image_usd: 0.039, supports_multi_image: false, max_images_per_request: 1 },
]

const DEFAULT_MODEL = 'gpt-image-1'

// prompt_templates.prompt_type is image|title|description; the UI offers
// "image" and "text" (mapped to description) per the product spec.
const TYPES: { value: string; label: string }[] = [
  { value: 'image', label: 'Ảnh (image)' },
  { value: 'description', label: 'Text / mô tả' },
]

type FormState = {
  id: string | null
  name: string
  model: string
  system_instruction: string
  content: string
  prompt_type: string
}

const EMPTY: FormState = { id: null, name: '', model: DEFAULT_MODEL, system_instruction: '', content: '', prompt_type: 'image' }

const SAMPLE: PromptTemplate[] = [
  { id: 's1', name: 'Canvas tối giản nền trắng', platform: null, prompt_type: 'image', content: 'minimalist canvas, white background…', model: 'gpt-image-1', system_instruction: null, is_default: false, created_at: '' },
  { id: 's2', name: 'Boho floral watercolor', platform: null, prompt_type: 'image', content: 'boho floral watercolor style…', model: 'gemini-2.5-flash-image', system_instruction: null, is_default: false, created_at: '' },
]

const typeLabel = (t: string) => TYPES.find((x) => x.value === t)?.label ?? t
const costLabel = (c?: number | null) => (c != null ? `~$${c.toFixed(2)}/ảnh` : '')

export default function PromptAiPage() {
  const { apiKey } = useAuth()
  const promptsQuery = usePrompts()
  const modelsQuery = useModels()
  // Real prompts require an API key + a wired generator service; otherwise (or on
  // a fetch error) fall back to the local sample list, mutated in place.
  const configured = !!apiKey && serviceConfigured.generator
  const usingSample = !configured || promptsQuery.isError
  const [sampleList, setSampleList] = useState<PromptTemplate[]>(SAMPLE)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  const prompts = usingSample ? sampleList : (promptsQuery.data ?? [])
  const loading = promptsQuery.isFetching
  // First real load (no cache yet) → skeleton rows instead of a blank table.
  const showSkeleton = configured && promptsQuery.isLoading

  const models = (configured && modelsQuery.data?.length ? modelsQuery.data : FALLBACK_MODELS)
  // Group models by provider, preserving first-seen provider order.
  const groupedModels = useMemo(() => {
    const groups: Array<{ provider: string; items: ImageModel[] }> = []
    for (const m of models) {
      let g = groups.find((x) => x.provider === m.provider)
      if (!g) { g = { provider: m.provider, items: [] }; groups.push(g) }
      g.items.push(m)
    }
    return groups
  }, [models])
  const modelById = useMemo(() => new Map(models.map((m) => [m.id, m])), [models])

  async function save() {
    if (!form.name.trim() || !form.content.trim()) {
      alert('Nhập tên và nội dung prompt.')
      return
    }
    if (!configured || !apiKey) {
      alert('Cần API key để lưu prompt thật.')
      return
    }
    setSaving(true)
    try {
      const body = {
        name: form.name,
        content: form.content,
        prompt_type: form.prompt_type,
        model: form.model,
        system_instruction: form.system_instruction.trim() || null,
      }
      if (form.id) await generatorApi.updatePrompt(apiKey, form.id, body)
      else await generatorApi.createPrompt(apiKey, body)
      setForm(EMPTY)
      await promptsQuery.refetch()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  function edit(p: PromptTemplate) {
    setForm({
      id: p.id,
      name: p.name,
      model: p.model ?? DEFAULT_MODEL,
      system_instruction: p.system_instruction ?? '',
      content: p.content,
      prompt_type: p.prompt_type,
    })
  }

  async function remove(id: string) {
    if (!configured || !apiKey) {
      setSampleList((ps) => ps.filter((p) => p.id !== id))
      return
    }
    if (!confirm('Xoá prompt này?')) return
    try {
      await generatorApi.removePrompt(apiKey, id)
      if (form.id === id) setForm(EMPTY)
      await promptsQuery.refetch()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Xoá thất bại')
    }
  }

  return (
    <Layout title="Prompt ảnh AI">
      {usingSample && (
        <div className="mb-2.5 rounded-md border border-line bg-panel2 px-3 py-2 text-[11px] text-muted">
          Dữ liệu mẫu — kết nối generator service + API key để quản lý prompt thật.
        </div>
      )}

      {/* Form */}
      <div className="card mb-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium">
          {form.id ? 'Sửa prompt' : 'Prompt mới'}
          {form.id && (
            <button onClick={() => setForm(EMPTY)} className="ml-auto flex items-center gap-1 text-[11px] text-muted hover:text-fg">
              <X size={12} /> huỷ sửa
            </button>
          )}
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <div className="mb-1 text-[11px] text-muted">Tên prompt</div>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="VD: Canvas tối giản nền trắng"
              className="field w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="mb-1 text-[11px] text-muted">Model</div>
              <select value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="field w-full">
                {groupedModels.map((g) => (
                  <optgroup key={g.provider} label={PROVIDER_LABEL[g.provider] ?? g.provider}>
                    {g.items.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} · {costLabel(m.cost_per_image_usd)}
                      </option>
                    ))}
                  </optgroup>
                ))}
                {/* Keep an unknown/legacy model selectable so editing never loses it. */}
                {!modelById.has(form.model) && <option value={form.model}>{form.model}</option>}
              </select>
            </div>
            <div>
              <div className="mb-1 text-[11px] text-muted">Loại</div>
              <select
                value={form.prompt_type}
                onChange={(e) => setForm({ ...form, prompt_type: e.target.value })}
                className="field w-full"
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="mt-2">
          <div className="mb-1 text-[11px] text-muted">System Instruction (tuỳ chọn)</div>
          <textarea
            value={form.system_instruction}
            onChange={(e) => setForm({ ...form, system_instruction: e.target.value })}
            placeholder="Đặt context, tone, constraint cho model. Áp dụng mọi request dùng prompt này."
            className="field min-h-[60px] w-full resize-y"
          />
        </div>
        <div className="mt-2">
          <div className="mb-1 text-[11px] text-muted">Nội dung prompt</div>
          <textarea
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder="Describe your image style…"
            className="field min-h-[90px] w-full resize-y"
          />
        </div>
        <div className="mt-2 flex justify-end">
          <button onClick={save} disabled={saving} className="btn btn-acc">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {form.id ? 'Cập nhật' : 'Lưu prompt'}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="mb-1.5 flex items-center">
        <span className="text-xs text-muted">{prompts.length} prompt</span>
        <button onClick={() => promptsQuery.refetch()} disabled={loading} className="btn ml-auto !text-[11px]">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Tải lại
        </button>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted">
            {['Tên', 'Model', 'Loại', 'Nội dung', ''].map((h, i) => (
              <th key={i} className="border-b border-line px-2 py-1.5 text-left font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {showSkeleton && <SkeletonRows rows={5} cols={5} />}
          {!showSkeleton &&
            prompts.map((p) => (
            <tr key={p.id} className="hover:bg-panel2">
              <td className="border-b border-line px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  {p.name}
                  {p.system_instruction && (
                    <span className="badge b-mu !text-[9px]" title={p.system_instruction}>SI</span>
                  )}
                </div>
              </td>
              <td className="border-b border-line px-2 py-1.5">
                {p.model ? (
                  <span className="badge b-mu font-mono !text-[10px]">{p.model}</span>
                ) : (
                  <span className="text-warn" title="Prompt chưa gán model">— chưa gán —</span>
                )}
              </td>
              <td className="border-b border-line px-2 py-1.5">
                <span className="badge b-mu">{typeLabel(p.prompt_type)}</span>
              </td>
              <td className="max-w-[280px] truncate border-b border-line px-2 py-1.5 text-muted">{p.content}</td>
              <td className="whitespace-nowrap border-b border-line px-2 py-1.5">
                <button onClick={() => edit(p)} className="btn !text-[11px]">
                  <Pencil size={12} /> Sửa
                </button>{' '}
                <button onClick={() => remove(p.id)} className="btn btn-danger !px-2 !py-1 !text-[11px]">
                  <Trash2 size={12} />
                </button>
              </td>
            </tr>
          ))}
          {!showSkeleton && prompts.length === 0 && (
            <tr>
              <td colSpan={5} className="px-2 py-10 text-center text-xs text-muted">
                {loading ? 'Đang tải…' : 'Chưa có prompt nào.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Layout>
  )
}
