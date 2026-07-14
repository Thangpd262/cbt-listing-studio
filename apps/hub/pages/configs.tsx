import { useCallback, useEffect, useState } from 'react'
import { Copy, Plus, Pencil, Trash2 } from 'lucide-react'
import Layout from '../components/Layout'
import ConfigOverrideEditor, { type EditableConfig } from '../components/ConfigOverrideEditor'
import { useAuth } from '../lib/auth-context'
import { userConfigApi } from '../lib/api'
import { SYSTEM_CONFIGS, MY_CONFIGS } from '../lib/sample-data'

type Tab = 'sys' | 'my'

// Unified row for "Config của tôi" — carries overrides so the editor can prefill.
type Row = { id: string; name: string; based_on: string; overrides: Record<string, unknown> }

const SAMPLE_ROWS: Row[] = MY_CONFIGS.map((c) => ({
  id: c.id,
  name: c.name,
  based_on: c.from,
  overrides: {},
}))

function note(overrides: Record<string, unknown>) {
  const n = Object.keys(overrides ?? {}).length
  return n ? `${n} trường đã sửa` : 'chưa sửa'
}

export default function ConfigsPage() {
  const { apiKey } = useAuth()
  const [tab, setTab] = useState<Tab>('sys')
  const [rows, setRows] = useState<Row[]>(SAMPLE_ROWS)
  const [usingSample, setUsingSample] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<EditableConfig | null>(null)

  const load = useCallback(async () => {
    if (!apiKey) {
      setRows(SAMPLE_ROWS)
      setUsingSample(true)
      return
    }
    try {
      const data = await userConfigApi.list(apiKey)
      setRows(
        data.map((r) => ({ id: r.id, name: r.name, based_on: r.based_on, overrides: r.overrides ?? {} }))
      )
      setUsingSample(false)
    } catch {
      setRows(SAMPLE_ROWS)
      setUsingSample(true)
    }
  }, [apiKey])

  useEffect(() => {
    load()
  }, [load])

  async function clone(key: string, label: string) {
    const name = `${label} (bản sao)`
    if (usingSample || !apiKey) {
      setRows((c) => [...c, { id: `my-${Date.now()}`, name, based_on: key, overrides: {} }])
      setTab('my')
      return
    }
    setBusy(true)
    try {
      await userConfigApi.create(apiKey, { name, based_on: key, overrides: {} })
      await load()
      setTab('my')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Nhân bản thất bại')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (usingSample || !apiKey) {
      setRows((c) => c.filter((x) => x.id !== id))
      return
    }
    setBusy(true)
    try {
      await userConfigApi.remove(apiKey, id)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Xoá thất bại')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout title="Config dòng hàng">
      {/* Sub-tabs */}
      <div className="mb-3 flex gap-0.5 border-b border-line">
        <button
          onClick={() => setTab('sys')}
          className={`-mb-px border-b-2 px-3 py-1.5 text-xs ${
            tab === 'sys' ? 'border-brand text-brand' : 'border-transparent text-muted'
          }`}
        >
          Config mặc định (hệ thống)
        </button>
        <button
          onClick={() => setTab('my')}
          className={`-mb-px border-b-2 px-3 py-1.5 text-xs ${
            tab === 'my' ? 'border-brand text-brand' : 'border-transparent text-muted'
          }`}
        >
          Config của tôi
        </button>
      </div>

      {usingSample && (
        <div className="mb-2.5 rounded-md border border-line bg-panel2 px-3 py-2 text-[11px] text-muted">
          Dữ liệu mẫu — kết nối API key để lưu config thật vào DB.
        </div>
      )}

      {tab === 'sys' ? (
        <>
          <div className="mb-2 text-xs text-muted">
            Config gốc do hệ thống xây dựng (schema chuẩn). Không sửa trực tiếp — nhân bản để tạo config riêng.
          </div>
          <div className="overflow-hidden rounded-[10px] border border-line bg-panel">
            <div className="flex items-center gap-2 border-b border-line bg-panel2 px-3 py-2 text-[11px] text-muted">
              <span className="w-[130px]">Key</span>
              <span className="flex-1">Tên</span>
              <span className="w-[110px] text-center">Product type</span>
              <span className="w-[100px] text-center">Variation</span>
              <span className="w-[96px]" />
            </div>
            {SYSTEM_CONFIGS.map((c) => (
              <div
                key={c.key}
                className="flex items-center gap-2 border-b border-line px-3 py-2 last:border-b-0"
              >
                <span className="w-[130px] font-mono text-[11px] text-brand">{c.key}</span>
                <span className="flex-1 text-xs text-fg">{c.label}</span>
                <span className="w-[110px] text-center text-[11px] text-muted">{c.product_type}</span>
                <span className="w-[100px] text-center text-[11px] text-muted">
                  {c.variation_theme || '—'}
                </span>
                <button
                  onClick={() => clone(c.key, c.label)}
                  disabled={busy}
                  className="btn btn-ok !text-[11px]"
                >
                  <Copy size={12} /> Nhân bản
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-muted">Config do bạn tạo, dựa trên config mặc định.</span>
            <button onClick={() => setTab('sys')} className="btn btn-acc !text-[11px]">
              <Plus size={12} /> Tạo từ mặc định
            </button>
          </div>
          <div className="overflow-hidden rounded-[10px] border border-line bg-panel">
            {rows.length === 0 && (
              <div className="px-3 py-10 text-center text-xs text-muted">
                Chưa có config nào. Sang tab &quot;Config mặc định&quot; và nhân bản một cái.
              </div>
            )}
            {rows.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2 border-b border-line px-3 py-2 last:border-b-0"
              >
                <div className="flex-1">
                  <div className="text-xs text-fg">{c.name}</div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    Từ {c.based_on} · {note(c.overrides)}
                  </div>
                </div>
                <button onClick={() => setEditing(c)} className="btn !text-[11px]">
                  <Pencil size={12} /> Sửa
                </button>
                <button
                  onClick={() => remove(c.id)}
                  disabled={busy}
                  className="btn btn-danger !px-2 !py-1 !text-[11px]"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {editing && (
        <ConfigOverrideEditor
          config={editing}
          apiKey={apiKey}
          usingSample={usingSample}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </Layout>
  )
}
