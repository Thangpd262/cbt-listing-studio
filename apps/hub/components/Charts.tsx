// Dependency-free SVG charts for the dashboard (no Chart.js needed).
// Two shapes: a single-series bar chart and a multi-series line chart.

const GRID = '#2a2a38'
const AXIS = '#5e5e78'

type BarDatum = { label: string; value: number }

// Jobs-per-employee bar chart.
export function BarChart({ data, height = 170 }: { data: BarDatum[]; height?: number }) {
  const width = 460
  const padL = 30
  const padB = 22
  const padT = 8
  const chartW = width - padL - 8
  const chartH = height - padB - padT
  const max = Math.max(1, ...data.map((d) => d.value))
  // 3 horizontal gridlines
  const ticks = [0, 0.5, 1].map((t) => Math.round(max * t))
  const barW = (chartW / data.length) * 0.62
  const gap = chartW / data.length

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Jobs per employee">
      {ticks.map((t) => {
        const y = padT + chartH - (t / max) * chartH
        return (
          <g key={t}>
            <line x1={padL} y1={y} x2={width - 8} y2={y} stroke={GRID} strokeWidth={1} />
            <text x={padL - 6} y={y + 3} textAnchor="end" fontSize={9} fill={AXIS}>
              {t}
            </text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const h = (d.value / max) * chartH
        const x = padL + i * gap + (gap - barW) / 2
        const y = padT + chartH - h
        return (
          <g key={d.label}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={4}
              fill="rgba(91,155,245,.55)"
              stroke="rgba(91,155,245,.9)"
              strokeWidth={1}
            />
            <text x={x + barW / 2} y={height - 8} textAnchor="middle" fontSize={9} fill={AXIS}>
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export type LineSeries = { name: string; color: string; points: number[] }

// Productivity-growth multi-line chart (new per request).
export function LineChart({
  labels,
  series,
  height = 170,
}: {
  labels: string[]
  series: LineSeries[]
  height?: number
}) {
  const width = 460
  const padL = 30
  const padB = 22
  const padT = 8
  const chartW = width - padL - 8
  const chartH = height - padB - padT
  const all = series.flatMap((s) => s.points)
  const max = Math.max(1, ...all)
  const min = Math.min(...all, 0)
  const span = max - min || 1
  const n = labels.length
  const x = (i: number) => padL + (n === 1 ? chartW / 2 : (i / (n - 1)) * chartW)
  const y = (v: number) => padT + chartH - ((v - min) / span) * chartH
  const ticks = [0, 0.5, 1].map((t) => Math.round(min + span * t))

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Productivity growth">
        {ticks.map((t) => {
          const yy = y(t)
          return (
            <g key={t}>
              <line x1={padL} y1={yy} x2={width - 8} y2={yy} stroke={GRID} strokeWidth={1} />
              <text x={padL - 6} y={yy + 3} textAnchor="end" fontSize={9} fill={AXIS}>
                {t}
              </text>
            </g>
          )
        })}
        {labels.map((lb, i) => (
          <text key={lb} x={x(i)} y={height - 8} textAnchor="middle" fontSize={9} fill={AXIS}>
            {lb}
          </text>
        ))}
        {series.map((s) => {
          const d = s.points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ')
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
              {s.points.map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill={s.color} />
              ))}
            </g>
          )
        })}
      </svg>
      <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1 text-[10px] text-muted">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  )
}
