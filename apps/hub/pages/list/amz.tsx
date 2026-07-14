import { CloudDownload, RefreshCw } from 'lucide-react'
import Layout from '../../components/Layout'

// Sample Amazon listings — swapped for list-amz API once that service ships.
const ROWS = [
  {
    sku: 'SHIRT-042',
    title: 'Boho Floral Women Tee Cotton Soft Unisex',
    asin: 'B0CXXX001',
    group: 'Áo thun',
    status: 'active',
  },
  {
    sku: 'MUG-007',
    title: 'Rose Ceramic Mug 11oz Boho Flower Gift',
    asin: '—',
    group: 'Mugs',
    status: 'inactive',
  },
]

export default function ListAmzPage() {
  return (
    <Layout title="Listing trên Amazon">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <input placeholder="SKU / tiêu đề / ASIN…" className="field flex-1" />
        <select className="field">
          <option>Tất cả type</option>
          <option>SHIRT</option>
          <option>MUG</option>
        </select>
        <select className="field">
          <option>Tất cả nhóm</option>
          <option>Phone Cases</option>
          <option>Áo thun</option>
          <option>Mugs</option>
        </select>
        <button className="btn">
          <CloudDownload size={13} /> Đồng bộ ngay
        </button>
        <button className="btn">
          <RefreshCw size={13} />
        </button>
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted">
            {['', 'SKU', 'Tiêu đề', 'ASIN', 'Nhóm', 'Trạng thái', 'Hành động'].map((h, i) => (
              <th key={i} className="border-b border-line px-2 py-1.5 text-left font-normal">
                {i === 0 ? <input type="checkbox" /> : h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.sku} className="hover:bg-panel2">
              <td className="border-b border-line px-2 py-1.5">
                <input type="checkbox" />
              </td>
              <td className="border-b border-line px-2 py-1.5 font-mono text-[11px]">{r.sku}</td>
              <td className="max-w-[200px] truncate border-b border-line px-2 py-1.5">{r.title}</td>
              <td
                className={`border-b border-line px-2 py-1.5 font-mono text-[11px] ${
                  r.asin === '—' ? 'text-muted' : 'text-brand'
                }`}
              >
                {r.asin}
              </td>
              <td className="border-b border-line px-2 py-1.5">
                <span className="badge b-mu">{r.group}</span>
              </td>
              <td className="border-b border-line px-2 py-1.5">
                <span className={`badge ${r.status === 'active' ? 'b-ok' : 'b-er'}`}>{r.status}</span>
              </td>
              <td className="whitespace-nowrap border-b border-line px-2 py-1.5">
                <button className="btn !text-[11px]">Sửa</button>{' '}
                <button className="btn btn-danger !text-[11px]">Xoá</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  )
}
