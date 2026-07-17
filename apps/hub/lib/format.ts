// Relative time in Vietnamese ("2 phút trước"). Used across job tables.
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (secs < 60) return 'vừa xong'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} phút trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  return `${days} ngày trước`
}

// Absolute timestamp: "DD/MM/YYYY, H:MM AM/PM" (12-hour clock). Used in the
// jobs table so the exact submission time is legible.
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM'
  const hour = d.getHours() % 12 || 12
  return `${date}, ${hour}:${pad(d.getMinutes())} ${ampm}`
}
