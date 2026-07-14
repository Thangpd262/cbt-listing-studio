import Link from 'next/link'
import { useRouter } from 'next/router'

const TABS = [
  { href: '/settings', label: 'Chung' },
  { href: '/settings/team', label: 'Team' },
  { href: '/settings/selling-accounts', label: 'Selling Accounts' },
  { href: '/settings/api-keys', label: 'API Keys' },
]

export default function SettingsTabs() {
  const router = useRouter()
  return (
    <div className="mb-6 flex gap-1 border-b border-line">
      {TABS.map((t) => {
        const active = router.pathname === t.href
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              active ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-fg'
            }`}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
