// Warm the global caches in parallel the moment the user is authenticated, so
// pages that read them (configs, crawl, settings) render from cache on first
// visit instead of each firing its own cold request. Keys + staleTime mirror
// lib/queries exactly so a prefetched entry is a cache hit, not a duplicate.

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from './auth-context'
import { accountApi, productGroupApi, serviceConfigured, userConfigApi } from './api'
import { queryKeys } from './queries'

const STALE_LONG = 10 * 60_000

export function usePrefetchGlobalData() {
  const queryClient = useQueryClient()
  const { apiKey, token, ready } = useAuth()

  useEffect(() => {
    if (!ready) return

    // Hub-local reads (same origin) only need the API key.
    if (apiKey) {
      void queryClient.prefetchQuery({
        queryKey: queryKeys.userConfigs,
        queryFn: () => userConfigApi.list(apiKey),
        staleTime: STALE_LONG,
      })
      void queryClient.prefetchQuery({
        queryKey: queryKeys.productGroups,
        queryFn: () => productGroupApi.list(apiKey),
        staleTime: STALE_LONG,
      })
    }

    // Account-service reads need the bearer token + a wired account service.
    if (token && serviceConfigured.account) {
      void queryClient.prefetchQuery({
        queryKey: queryKeys.sellingAccounts,
        queryFn: () => accountApi.getSellingAccounts(token),
        staleTime: STALE_LONG,
      })
      void queryClient.prefetchQuery({
        queryKey: queryKeys.team,
        queryFn: () => accountApi.getTeam(token),
        staleTime: STALE_LONG,
      })
    }
  }, [queryClient, apiKey, token, ready])
}
