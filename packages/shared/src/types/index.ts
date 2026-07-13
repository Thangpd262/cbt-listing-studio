export type Role = 'owner' | 'admin' | 'operator' | 'viewer'
export type Platform = 'amazon' | 'walmart' | 'etsy' | 'printify'
export type JobStatus = 'pending' | 'processing' | 'success' | 'failed'

export interface AuthContext {
  account_id: string
  user_id: string
  role: Role
  selling_account_id?: string
  tier: 'free' | 'pro' | 'enterprise'
}

export interface SellingAccount {
  id: string
  account_id: string
  platform: Platform
  region: string
  name: string
  created_at: string
}
