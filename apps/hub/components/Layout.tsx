import { type ReactNode } from 'react'
import { LogOut } from 'lucide-react'
import Sidebar from './Sidebar'
import { useAuth } from '../lib/auth-context'

export default function Layout({ title, children }: { title?: string; children: ReactNode }) {
  const { user, logout } = useAuth()

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
          <h1 className="text-base font-semibold">{title}</h1>
          <div className="flex items-center gap-4 text-sm">
            {user && (
              <span className="text-gray-500">
                {user.user_id.slice(0, 8)}… · <span className="font-medium text-gray-900">{user.role}</span>
              </span>
            )}
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-gray-600 hover:bg-gray-100"
            >
              <LogOut size={16} /> Đăng xuất
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
