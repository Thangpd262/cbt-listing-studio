import { createSupabaseClient } from '@cbt/shared'
import { getSellingAccountCredentials } from './account-client'
import { getWalmartToken } from './wmt-auth'
import { WalmartApiClient, type WmtItem } from './wmt-api'

type Supabase = ReturnType<typeof createSupabaseClient>

const MAX_PAGES = 400 // safety cap (~20k items at limit 50)

// Flatten one Walmart item into a wmt_listings_cache row.
function toCacheRow(accountId: string, item: WmtItem) {
  return {
    account_id: accountId,
    sku: item.sku ?? '',
    wpid: item.wpid ?? null,
    title: item.productName ?? null,
    status: item.publishedStatus ?? item.lifecycleStatus ?? null,
    price: item.price?.amount ?? null,
    quantity: null as number | null, // Walmart getAllItems omits inventory
    image_url: item.primaryImageUrl ?? null,
    raw: item as unknown as Record<string, unknown>,
    synced_at: new Date().toISOString(),
  }
}

// Sync one selling account's items into the cache. Returns rows upserted.
async function syncOneAccount(
  supabase: Supabase,
  accountId: string,
  sellingAccountId: string
): Promise<number> {
  const credentials = await getSellingAccountCredentials(sellingAccountId)
  const token = await getWalmartToken(sellingAccountId, credentials)
  const client = new WalmartApiClient(token)

  let cursor: string | undefined
  let count = 0
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await client.getAllItems(cursor)
    const rows = (res.ItemResponse ?? [])
      .map((item) => toCacheRow(accountId, item))
      .filter((r) => r.sku) // SKU is part of the unique key
    if (rows.length) {
      const { error } = await supabase
        .from('wmt_listings_cache')
        .upsert(rows, { onConflict: 'account_id,sku' })
      if (error) throw new Error(`Cache upsert failed: ${error.message}`)
      count += rows.length
    }
    const next = res.nextCursor
    if (!next || next === cursor || !(res.ItemResponse ?? []).length) break
    cursor = next
  }
  return count
}

// Sync every active Walmart selling account for an account. Per-account errors
// are collected, not thrown.
export async function syncWalmartListings(
  supabase: Supabase,
  accountId: string
): Promise<{ synced: number; duration_ms: number; accounts: number; errors: string[] }> {
  const start = Date.now()
  const { data: accounts, error } = await supabase
    .from('selling_accounts')
    .select('id, name')
    .eq('account_id', accountId)
    .eq('platform', 'walmart')
    .eq('is_active', true)
  if (error) throw new Error(error.message)

  let synced = 0
  const errors: string[] = []
  for (const acct of accounts ?? []) {
    try {
      synced += await syncOneAccount(supabase, accountId, acct.id)
    } catch (err) {
      errors.push(`${acct.name}: ${err instanceof Error ? err.message : 'sync failed'}`)
    }
  }
  return { synced, duration_ms: Date.now() - start, accounts: (accounts ?? []).length, errors }
}
