import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  LayoutDashboard,
  Sparkles,
  Globe,
  SlidersHorizontal,
  List,
  CirclePlay,
  Plus,
  LayoutGrid,
  TrendingUp,
  Palette,
  ClipboardList,
  Cog,
  Star,
  Wand,
  History,
  Search,
  CircleUser,
  type LucideIcon,
} from 'lucide-react'
import { usePlatform, type Platform } from '../lib/platform-context'

type NavItem = { href: string; label: string; icon: LucideIcon }
type NavGroup = { title: string; items: NavItem[] }

const COMMON: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/prompt-ai', label: 'Prompt ảnh AI', icon: Sparkles },
]

const AMAZON: NavItem[] = [
  { href: '/crawl', label: 'Etsy Crawl', icon: Globe },
  { href: '/configs', label: 'Config dòng hàng', icon: SlidersHorizontal },
  { href: '/list/amz', label: 'Listing trên Amazon', icon: List },
  { href: '/jobs', label: 'Jobs', icon: CirclePlay },
  { href: '/soon/create-listing', label: 'Tạo listing', icon: Plus },
  { href: '/soon/product-types', label: 'Product Types', icon: LayoutGrid },
  { href: '/soon/printify', label: 'Printify Trends', icon: TrendingUp },
]

const WALMART: NavItem[] = [
  { href: '/crawl', label: 'Etsy Crawl', icon: Globe },
  { href: '/configs', label: 'Config dòng hàng', icon: SlidersHorizontal },
  { href: '/soon/color-variants', label: 'Color Variants', icon: Palette },
  { href: '/soon/stage-listing', label: 'Stage Listing', icon: ClipboardList },
  { href: '/soon/draft-jobs', label: 'Draft Jobs', icon: Cog },
  { href: '/list/wmt', label: 'Listing trên Walmart', icon: List },
  { href: '/jobs', label: 'Jobs', icon: CirclePlay },
]

const TM: NavItem[] = [
  { href: '/soon/tm-character', label: 'Nhân vật', icon: Star },
  { href: '/soon/tm-studio', label: 'Listing Studio', icon: Wand },
  { href: '/soon/tm-history', label: 'Lịch sử', icon: History },
]

const UTILITY: NavItem[] = [
  { href: '/soon/sku-lookup', label: 'Tra cứu SKU', icon: Search },
  { href: '/settings', label: 'Tài khoản', icon: CircleUser },
]

function buildGroups(platform: Platform): NavGroup[] {
  return [
    { title: 'Chung', items: COMMON },
    {
      title: platform === 'amazon' ? 'Amazon' : 'Walmart',
      items: platform === 'amazon' ? AMAZON : WALMART,
    },
    { title: 'Nhóm NHÂN VẬT TM', items: TM },
    { title: 'Tiện ích', items: UTILITY },
  ]
}

export default function Sidebar() {
  const router = useRouter()
  const { platform } = usePlatform()
  const groups = buildGroups(platform)

  return (
    <aside className="w-48 flex-shrink-0 overflow-y-auto border-r border-line bg-panel py-1.5">
      {groups.map((group) => (
        <div key={group.title}>
          <div className="px-3 pb-1 pt-2.5 text-[10px] uppercase tracking-wider text-muted">
            {group.title}
          </div>
          {group.items.map(({ href, label, icon: Icon }) => {
            const active =
              router.pathname === href || router.pathname.startsWith(href + '/')
            return (
              <Link
                key={href + label}
                href={href}
                className={`flex items-center gap-2 border-l-2 px-3 py-[7px] text-xs transition ${
                  active
                    ? 'border-brand bg-brand-soft text-brand'
                    : 'border-transparent text-muted hover:bg-panel2 hover:text-fg'
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            )
          })}
        </div>
      ))}
    </aside>
  )
}
