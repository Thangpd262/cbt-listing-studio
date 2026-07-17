import { useQuery } from '@tanstack/react-query'
import { DollarSign } from 'lucide-react'
import { generatorApi, serviceConfigured } from '../lib/api'
import { useAuth } from '../lib/auth-context'

// Small inline "AI cost: $x" label for a listing, with a hover breakdown by step.
// Self-contained: fetches its own listing spend. Render it only where a listing
// may have generated images (avoids needless calls).
const fmt = (n: number) => (n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`)

export default function ListingAiCost({ listingId }: { listingId: string }) {
  const { apiKey } = useAuth()
  const enabled = !!apiKey && serviceConfigured.generator
  const { data } = useQuery({
    queryKey: ['listing-spend', listingId],
    queryFn: () => generatorApi.getListingSpend(apiKey as string, listingId),
    enabled,
    staleTime: 30_000,
  })

  if (!data || data.total_cost_usd <= 0) return null

  // Aggregate cost per step for the tooltip.
  const byStep: Record<string, number> = {}
  for (const b of data.breakdown) byStep[b.step] = (byStep[b.step] ?? 0) + (Number(b.cost_usd) || 0)
  const tooltip = Object.entries(byStep)
    .map(([step, cost]) => `${step}: ${fmt(cost)}`)
    .join('\n')

  return (
    <span
      title={`${tooltip}\n(${data.total_images} ảnh)`}
      className="inline-flex items-center gap-1 rounded border border-line bg-panel2 px-1.5 py-0.5 font-mono text-[11px] text-muted"
    >
      <DollarSign size={10} className="text-ok" />
      AI cost: <span className="font-medium text-fg">{fmt(data.total_cost_usd)}</span>
    </span>
  )
}
