import { type ReactNode, useEffect, useState } from 'react'
import Head from 'next/head'
import { Store, Bell, X } from 'lucide-react'
import Sidebar from './Sidebar'
import { useAuth } from '../lib/auth-context'
import { usePlatform, MARKETPLACES, type Platform } from '../lib/platform-context'
import { changelogApi, type Changelog } from '../lib/api'

const LAST_SEEN_KEY = 'changelog_last_seen'

export default function Layout({ title, headerRight, children }: { title?: string; headerRight?: ReactNode; children: ReactNode }) {
  const { user, logout, apiKey } = useAuth()
  const { platform, marketplace, setPlatform, setMarketplace } = usePlatform()

  // "Có gì mới" changelog: fetch latest, track read state in localStorage.
  const [changelogs, setChangelogs] = useState<Changelog[]>([])
  const [showChangelog, setShowChangelog] = useState(false)
  const [lastSeen, setLastSeen] = useState('')

  useEffect(() => {
    setLastSeen(localStorage.getItem(LAST_SEEN_KEY) ?? '')
  }, [])

  useEffect(() => {
    if (!apiKey) return
    changelogApi
      .list(apiKey, 5)
      .then((d) => setChangelogs(d.changelogs))
      .catch(() => {})
  }, [apiKey])

  const unreadCount = changelogs.filter((c) => c.published_at > lastSeen).length

  function openChangelog() {
    setShowChangelog(true)
    const latest = changelogs[0]?.published_at ?? ''
    if (latest) {
      localStorage.setItem(LAST_SEEN_KEY, latest)
      setLastSeen(latest)
    }
  }

  return (
    <div className="flex h-screen bg-bg">
      <Head>
        <title>{`CBT Listing Studio v${process.env.NEXT_PUBLIC_APP_VERSION}`}</title>
      </Head>
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header: logo · platform + marketplace (moved here) · user · logout */}
        <header className="flex h-[48px] flex-shrink-0 items-center gap-2.5 border-b border-line bg-panel px-3.5">
          <div className="whitespace-nowrap font-disp text-[15px] font-bold tracking-[0.02em] text-fg">
            CBT Listing Studio
          </div>

          {/* Platform + marketplace dropdowns */}
          <div className="flex items-center gap-1.5">
            <Store size={14} className="text-muted" />
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
              className="cursor-pointer rounded-md border border-line bg-panel2 px-2 py-1 text-xs text-fg focus:outline-none focus:border-brand"
            >
              <option value="amazon">Amazon</option>
              <option value="walmart">Walmart</option>
            </select>
            <select
              value={marketplace}
              onChange={(e) => setMarketplace(e.target.value)}
              className="cursor-pointer rounded-md border border-line bg-panel2 px-2 py-1 text-xs text-muted focus:outline-none focus:border-brand"
            >
              {MARKETPLACES[platform].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1" />

          <button
            onClick={openChangelog}
            className="relative text-muted hover:text-fg"
            title="Có gì mới"
            aria-label="Có gì mới"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>

          {user && <span className="text-xs text-muted">{user.user_id.slice(0, 12)}…</span>}
          <button
            onClick={logout}
            className="rounded-md border border-line bg-transparent px-2 py-1 text-[11px] text-danger hover:border-danger"
          >
            Đăng xuất
          </button>
        </header>

        <main className="relative flex-1 overflow-auto p-3.5">
          {title && (
            <div className="mb-3 flex items-center gap-3">
              <h1 className="font-disp text-[17px] font-bold text-fg">{title}</h1>
              {headerRight}
            </div>
          )}
          {children}
        </main>
      </div>

      {showChangelog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowChangelog(false)}
        >
          <div
            className="max-h-[70vh] w-[480px] max-w-[95vw] overflow-y-auto rounded-xl border border-line bg-panel p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-fg">Có gì mới 🎉</h2>
              <button onClick={() => setShowChangelog(false)} className="text-muted hover:text-fg" aria-label="Đóng">
                <X size={16} />
              </button>
            </div>
            {changelogs.length === 0 ? (
              <div className="text-[13px] text-muted">Chưa có bản cập nhật nào.</div>
            ) : (
              changelogs.map((cl) => (
                <div key={cl.id} className="mb-4 border-b border-line pb-4 last:border-0 last:pb-0">
                  <div className="mb-1.5 text-[11px] text-muted">
                    {cl.version} · {formatDate(cl.published_at)}
                  </div>
                  <ChangelogBody summary={cl.summary} />
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// "DD/MM/YYYY" for the changelog entry date.
function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

// Minimal, dependency-free markdown: bullet lines, headings, and **bold** — built
// as React nodes (no dangerouslySetInnerHTML, so summary text can't inject HTML).
function ChangelogBody({ summary }: { summary: string }) {
  const lines = summary.split('\n').map((l) => l.trim()).filter(Boolean)
  return (
    <div className="space-y-1 text-[13px] text-fg">
      {lines.map((line, i) => {
        if (/^#{1,6}\s+/.test(line)) {
          return (
            <div key={i} className="mt-2 font-semibold">
              {renderInline(line.replace(/^#{1,6}\s+/, ''))}
            </div>
          )
        }
        if (/^[-*]\s+/.test(line)) {
          return (
            <div key={i} className="flex gap-1.5">
              <span className="text-muted">•</span>
              <span>{renderInline(line.replace(/^[-*]\s+/, ''))}</span>
            </div>
          )
        }
        return <div key={i}>{renderInline(line)}</div>
      })}
    </div>
  )
}

function renderInline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}
