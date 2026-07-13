import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  LayoutDashboard,
  Globe,
  Sparkles,
  ShoppingCart,
  Store,
  Settings,
  type LucideIcon,
} from 'lucide-react'

type NavItem = { href: string; label: string; icon: LucideIcon }

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/crawl', label: 'Crawl', icon: Globe },
  { href: '/generator', label: 'Generator', icon: Sparkles },
  { href: '/list/amz', label: 'Amazon', icon: ShoppingCart },
  { href: '/list/wmt', label: 'Walmart', icon: Store },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const router = useRouter()

  return (
    <aside className="flex h-full w-56 flex-col border-r border-gray-200 bg-white">
      <div className="px-5 py-5 text-lg font-semibold tracking-tight">CBT Studio</div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = router.pathname === href || router.pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                active ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
