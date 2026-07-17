// Shared React Query hooks + keys for the global/hot data the hub reads on
// most pages. Centralising the keys and staleTimes here keeps caching policy
// in one place and lets the root prefetch (lib/prefetch) reuse the exact same
// queryFns so a warmed cache is a hit, not a duplicate fetch.

import { useQuery } from '@tanstack/react-query'
import { useAuth } from './auth-context'
import {
  accountApi,
  generatorApi,
  listAmzApi,
  productGroupApi,
  serviceConfigured,
  userConfigApi,
} from './api'

const MINUTE = 60_000

// Rarely-changing global lists: cache long enough that navigating between menus
// is instant. Jobs churn (status flips as the worker runs) so a short window.
const STALE_LONG = 10 * MINUTE
const STALE_JOBS = 30_000

export const queryKeys = {
  userConfigs: ['user-configs'] as const,
  productGroups: ['product-groups'] as const,
  prompts: ['prompts'] as const,
  models: ['models'] as const,
  spend: (period: string, userId?: string) => ['spend', period, userId ?? 'me'] as const,
  sellingAccounts: ['selling-accounts'] as const,
  team: ['team'] as const,
  pendingTeam: ['team', 'pending'] as const,
  jobs: ['jobs'] as const,
}

// ---- Hooks (apiKey-scoped: hub-local + generator + list-amz) ----

export function useUserConfigs() {
  const { apiKey } = useAuth()
  return useQuery({
    queryKey: queryKeys.userConfigs,
    queryFn: () => userConfigApi.list(apiKey as string),
    enabled: !!apiKey,
    staleTime: STALE_LONG,
  })
}

// Fetches product groups for all platforms; pages filter by platform client-side
// so one cache entry (and one prefetch) serves both Amazon and Walmart.
export function useProductGroups() {
  const { apiKey } = useAuth()
  return useQuery({
    queryKey: queryKeys.productGroups,
    queryFn: () => productGroupApi.list(apiKey as string),
    enabled: !!apiKey,
    staleTime: STALE_LONG,
  })
}

export function usePrompts() {
  const { apiKey } = useAuth()
  return useQuery({
    queryKey: queryKeys.prompts,
    queryFn: () => generatorApi.getPrompts(apiKey as string),
    enabled: !!apiKey && serviceConfigured.generator,
    staleTime: STALE_LONG,
  })
}

// Available image models — rarely change, cache long.
export function useModels() {
  const { apiKey } = useAuth()
  return useQuery({
    queryKey: queryKeys.models,
    queryFn: () => generatorApi.getModels(apiKey as string),
    enabled: !!apiKey && serviceConfigured.generator,
    // Models only change on deploy — never refetch during a session, keep cached 1h.
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
  })
}

// AI spend summary for a period (+ optional admin user filter).
export function useSpend(period: string, userId?: string) {
  const { apiKey } = useAuth()
  return useQuery({
    queryKey: queryKeys.spend(period, userId),
    queryFn: () => generatorApi.getSpend(apiKey as string, { period, user_id: userId }),
    enabled: !!apiKey && serviceConfigured.generator,
    staleTime: STALE_JOBS,
  })
}

// Fetches the recent jobs page; the Jobs UI filters by status client-side, so
// one cache entry serves every filter. Short staleTime — job status flips fast.
export function useJobs() {
  const { apiKey } = useAuth()
  return useQuery({
    queryKey: queryKeys.jobs,
    queryFn: () => listAmzApi.getJobs(apiKey as string, { limit: 100 }),
    enabled: !!apiKey && serviceConfigured.listAmz,
    staleTime: STALE_JOBS,
  })
}

// ---- Hooks (token-scoped: account service) ----

export function useSellingAccounts() {
  const { token } = useAuth()
  return useQuery({
    queryKey: queryKeys.sellingAccounts,
    queryFn: () => accountApi.getSellingAccounts(token as string),
    enabled: !!token && serviceConfigured.account,
    staleTime: STALE_LONG,
  })
}

export function useTeam() {
  const { token } = useAuth()
  return useQuery({
    queryKey: queryKeys.team,
    queryFn: () => accountApi.getTeam(token as string),
    enabled: !!token && serviceConfigured.account,
    staleTime: STALE_LONG,
  })
}

// Admin-only sibling of useTeam. Lives here so the team page reads all its data
// through the same cache; not part of the root prefetch (admin-gated, less hot).
export function usePendingTeam(enabledForAdmin: boolean) {
  const { token } = useAuth()
  return useQuery({
    queryKey: queryKeys.pendingTeam,
    queryFn: () => accountApi.getPending(token as string),
    enabled: !!token && serviceConfigured.account && enabledForAdmin,
    staleTime: STALE_LONG,
  })
}
