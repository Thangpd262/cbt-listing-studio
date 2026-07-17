-- 017: extra columns for the hub "Listing trên Amazon" page.
--   niche        — user-assigned product group; hub-owned, set via PATCH.
--   product_type — Amazon productType, surfaced as the Type column + filter.
--   created_at   — first-seen time (distinct from synced_at = last sync time).
-- niche and created_at are NOT written by the sync upsert, so they survive
-- re-syncs (the upsert only touches the columns it sends).

ALTER TABLE amz_listings_cache
  ADD COLUMN IF NOT EXISTS niche        text,
  ADD COLUMN IF NOT EXISTS product_type text,
  ADD COLUMN IF NOT EXISTS created_at   timestamptz NOT NULL DEFAULT now();

-- Backfill Type from the stored SP-API item.
UPDATE amz_listings_cache
  SET product_type = raw->'summaries'->0->>'productType'
  WHERE product_type IS NULL AND raw IS NOT NULL;

-- Backfill created_at from the existing sync time (the column default set every
-- pre-existing row to the migration instant, which post-dates the real sync).
UPDATE amz_listings_cache SET created_at = synced_at WHERE created_at > synced_at;

-- Filtering by group is account-scoped; index the pair used by the list query.
CREATE INDEX IF NOT EXISTS idx_amz_listings_cache_niche
  ON amz_listings_cache(account_id, niche);
