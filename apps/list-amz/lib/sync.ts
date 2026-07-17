import { createSupabaseClient } from '@cbt/shared'
import { getSellingAccountCredentials } from './account-client'
import { getAccessToken } from './lwa'
import { SpApiClient, type SearchListingsItem } from './sp-api'

type Supabase = ReturnType<typeof createSupabaseClient>

const DEFAULT_MARKETPLACE = 'ATVPDKIKX0DER' // Amazon US
const MAX_PAGES = 500 // safety cap (~10k listings at pageSize 20)

// Resolve the marketplace for a selling account (config override or US default).
async function getMarketplaceId(supabase: Supabase, sellingAccountId: string): Promise<string> {
  const { data } = await supabase
    .from('amz_product_configs')
    .select('marketplace_id')
    .eq('selling_account_id', sellingAccountId)
    .maybeSingle()
  return data?.marketplace_id || DEFAULT_MARKETPLACE
}

// Flatten one SP-API listing item into an amz_listings_cache row.
function toCacheRow(accountId: string, marketplaceId: string, item: SearchListingsItem) {
  const s = item.summaries?.[0] ?? {}
  const status = Array.isArray(s.status) ? s.status.join(',') : s.status ?? null
  return {
    account_id: accountId,
    marketplace_id: marketplaceId,
    asin: s.asin ?? '',
    sku: item.sku ?? null,
    title: s.itemName ?? null,
    product_type: s.productType ?? null,
    status,
    price: item.offers?.[0]?.price?.amount ?? null,
    quantity: item.fulfillmentAvailability?.[0]?.quantity ?? null,
    image_url: s.mainImage?.link ?? null,
    amz_listed_at: s.createdDate ?? null, // real Amazon listing-creation date
    raw: item as unknown as Record<string, unknown>,
    synced_at: new Date().toISOString(),
  }
}

// Sync one selling account's live listings into the cache. Returns rows upserted.
async function syncOneAccount(
  supabase: Supabase,
  accountId: string,
  sellingAccountId: string
): Promise<number> {
  const credentials = await getSellingAccountCredentials(sellingAccountId)
  if (!credentials.seller_id) throw new Error('Missing seller_id in credentials')

  const accessToken = await getAccessToken(credentials, sellingAccountId)
  const marketplaceId = await getMarketplaceId(supabase, sellingAccountId)
  const client = new SpApiClient(accessToken, marketplaceId)

  let pageToken: string | undefined
  let count = 0
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await client.searchListings(credentials.seller_id, pageToken)
    const rows = (res.items ?? [])
      .map((item) => toCacheRow(accountId, marketplaceId, item))
      .filter((r) => r.asin) // ASIN is part of the unique key
    if (rows.length) {
      const { error } = await supabase
        .from('amz_listings_cache')
        .upsert(rows, { onConflict: 'account_id,marketplace_id,asin' })
      if (error) throw new Error(`Cache upsert failed: ${error.message}`)
      count += rows.length
    }
    pageToken = res.pagination?.nextToken
    if (!pageToken) break
  }
  return count
}

// Sync every active Amazon selling account for an account. Never partial-fails
// the whole run: per-account errors are collected and returned.
export async function syncAmazonListings(
  supabase: Supabase,
  accountId: string
): Promise<{ synced: number; duration_ms: number; accounts: number; errors: string[] }> {
  const start = Date.now()
  const { data: accounts, error } = await supabase
    .from('selling_accounts')
    .select('id, name')
    .eq('account_id', accountId)
    .eq('platform', 'amazon')
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
