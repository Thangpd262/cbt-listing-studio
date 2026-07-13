export const ROLES = ['owner', 'admin', 'operator', 'viewer'] as const
export type Role = typeof ROLES[number]

export const PLATFORMS = ['amazon', 'walmart', 'etsy', 'printify'] as const
export type Platform = typeof PLATFORMS[number]

export const JOB_STATUS = ['pending', 'processing', 'success', 'failed'] as const
export type JobStatus = typeof JOB_STATUS[number]
