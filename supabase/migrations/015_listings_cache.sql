-- 015: read-through caches of live marketplace listings.
-- Populated by the list-* services' /api/listings/sync endpoints (paginate the
-- marketplace API, upsert here). The hub reads these instead of calling SP-API /
-- Walmart directly, so the "Listing" pages load fast and offline of the APIs.

-- Amazon: one row per live listing, keyed by (account, marketplace, asin).
CREATE TABLE amz_listings_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  marketplace_id text NOT NULL,
  asin text NOT NULL,
  sku text,
  title text,
  status text,          -- Amazon listing status string(s), e.g. BUYABLE / DISCOVERABLE
  price numeric,
  quantity int,
  image_url text,
  raw jsonb,            -- full SP-API item response
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, marketplace_id, asin)
);
CREATE INDEX idx_amz_listings_cache_account ON amz_listings_cache(account_id, marketplace_id);

-- Walmart: keyed by (account, sku). Walmart US is single-marketplace and items
-- are identified by SKU / wpid rather than ASIN.
CREATE TABLE wmt_listings_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  sku text NOT NULL,
  wpid text,            -- Walmart product id
  title text,
  status text,          -- publishedStatus, e.g. PUBLISHED / UNPUBLISHED / IN_PROGRESS
  price numeric,
  quantity int,
  image_url text,
  raw jsonb,            -- full Walmart item response
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, sku)
);
CREATE INDEX idx_wmt_listings_cache_account ON wmt_listings_cache(account_id);

-- RLS: match every other table — service role only (services use SUPABASE_SERVICE_KEY).
ALTER TABLE amz_listings_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE wmt_listings_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON amz_listings_cache TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON wmt_listings_cache TO service_role USING (true) WITH CHECK (true);
