import { type ReactNode } from 'react'
import Head from 'next/head'
import { Store } from 'lucide-react'
import Sidebar from './Sidebar'
import { useAuth } from '../lib/auth-context'
import { usePlatform, MARKETPLACES, type Platform } from '../lib/platform-context'

export default function Layout({ title, children }: { title?: string; children: ReactNode }) {
  const { user, logout } = useAuth()
  const { platform, marketplace, setPlatform, setMarketplace } = usePlatform()

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

          {user && <span className="text-xs text-muted">{user.user_id.slice(0, 12)}…</span>}
          <button
            onClick={logout}
            className="rounded-md border border-line bg-transparent px-2 py-1 text-[11px] text-danger hover:border-danger"
          >
            Đăng xuất
          </button>
        </header>

        <main className="relative flex-1 overflow-auto p-3.5">
          {title && <h1 className="mb-3 font-disp text-[17px] font-bold text-fg">{title}</h1>}
          {children}
        </main>
      </div>
    </div>
  )
}
