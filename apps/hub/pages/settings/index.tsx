import Layout from '../../components/Layout'
import SettingsTabs from '../../components/SettingsTabs'
import { useAuth } from '../../lib/auth-context'

export default function SettingsIndexPage() {
  const { user } = useAuth()
  return (
    <Layout title="Settings">
      <SettingsTabs />
      <div className="max-w-lg space-y-3 rounded-lg border border-gray-200 bg-white p-5 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">User ID</span>
          <span className="font-mono">{user?.user_id}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Account ID</span>
          <span className="font-mono">{user?.account_id}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Role</span>
          <span className="font-medium">{user?.role}</span>
        </div>
      </div>
    </Layout>
  )
}
