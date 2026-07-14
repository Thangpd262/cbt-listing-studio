// Animated placeholder blocks shown while real data is loading (never sample
// data). Uses the shared panel color so it blends into cards.

// A single shimmering bar.
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-panel2 ${className}`} />
}

// N placeholder table rows (matches the dashboard/jobs/amz table density).
export function SkeletonRows({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="border-b border-line px-2 py-2">
              <Skeleton className="h-3.5 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// A block of placeholder cards (for the crawl page's stacked panels).
export function SkeletonCards({ count = 3, height = 'h-40' }: { count?: number; height?: string }) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={`w-full ${height}`} />
      ))}
    </div>
  )
}
