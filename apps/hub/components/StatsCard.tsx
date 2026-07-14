import { type LucideIcon } from 'lucide-react'

export default function StatsCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string
  value: string | number
  icon?: LucideIcon
  hint?: string
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted">{label}</span>
        {Icon && <Icon size={18} className="text-muted" />}
      </div>
      <div className="mt-2 text-3xl font-semibold text-fg">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted/70">{hint}</div>}
    </div>
  )
}
