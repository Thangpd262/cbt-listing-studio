import { useRouter } from 'next/router'
import { Construction } from 'lucide-react'
import Layout from '../../components/Layout'

// One dark placeholder for every tab whose backing service isn't built yet.
// The sidebar links here with a slug; we show a friendly label + note.
const LABELS: Record<string, string> = {
  'prompt-ai': 'Prompt ảnh AI',
  printify: 'Printify Trends',
  'create-listing': 'Tạo listing',
  'product-types': 'Product Types',
  'color-variants': 'Color Variants',
  'stage-listing': 'Stage Listing',
  'draft-jobs': 'Draft Jobs',
  'tm-character': 'Nhân vật TM',
  'tm-studio': 'Studio nhân vật',
  'tm-history': 'Lịch sử nhân vật',
  'sku-lookup': 'Tra cứu SKU',
}

export default function SoonPage() {
  const { slug } = useRouter().query
  const key = Array.isArray(slug) ? slug[0] : slug ?? ''
  const label = LABELS[key] ?? 'Tính năng'

  return (
    <Layout title={label}>
      <div className="flex h-full flex-col items-center justify-center text-center">
        <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-panel2 text-muted">
          <Construction size={30} />
        </div>
        <h2 className="text-lg font-semibold text-fg">{label} — đang hoàn thiện</h2>
        <p className="mt-1.5 max-w-md text-sm text-muted">
          Giao diện dark cho tab này sẽ được nối API khi service backend tương ứng sẵn sàng.
        </p>
      </div>
    </Layout>
  )
}
