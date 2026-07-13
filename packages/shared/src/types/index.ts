import type { Platform } from '../constants'

// Role, Platform, JobStatus are exported from ./constants (single source).
// AuthContext is exported from ../middleware/withAuth (the shape withAuth produces).
// This module only owns domain entity types.
export interface SellingAccount {
  id: string
  account_id: string
  platform: Platform
  region: string
  name: string
  created_at: string
}
