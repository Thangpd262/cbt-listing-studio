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
    <div className="mb-6 flex gap-1 border-b border-gray-200">
      {TABS.map((t) => {
        const active = router.pathname === t.href
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              active ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
