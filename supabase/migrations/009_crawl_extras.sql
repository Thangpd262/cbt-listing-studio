-- 009: extend crawl_listings for extension ingest
-- Add aliexpress platform + extra fields from Etsy/AliExpress/Printify crawl

-- Drop old platform CHECK, re-add with aliexpress
ALTER TABLE crawl_listings DROP CONSTRAINT IF EXISTS crawl_listings_platform_check;
ALTER TABLE crawl_listings ADD CONSTRAINT crawl_listings_platform_check
  CHECK (platform IN ('amazon', 'walmart', 'etsy', 'aliexpress', 'printify'));

-- Extra fields — nullable, backward-compatible
ALTER TABLE crawl_listings ADD COLUMN IF NOT EXISTS description  TEXT;
ALTER TABLE crawl_listings ADD COLUMN IF NOT EXISTS shop_name   TEXT;
ALTER TABLE crawl_listings ADD COLUMN IF NOT EXISTS crawl_purpose TEXT NOT NULL DEFAULT 'normal';
