-- 024: track user-uploaded images attached to crawl listings.
-- Files live in Supabase Storage; rows expire after 21 days and are cleaned up
-- by the /api/cleanup-uploads cron in apps/hub.

CREATE TABLE IF NOT EXISTS crawl_uploaded_images (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid NOT NULL,
  listing_id   uuid NOT NULL REFERENCES crawl_listings(id) ON DELETE CASCADE,
  storage_path text NOT NULL,   -- public URL returned by Supabase Storage
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '21 days'),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crawl_uploaded_images_account   ON crawl_uploaded_images(account_id);
CREATE INDEX IF NOT EXISTS idx_crawl_uploaded_images_listing   ON crawl_uploaded_images(listing_id);
CREATE INDEX IF NOT EXISTS idx_crawl_uploaded_images_expires   ON crawl_uploaded_images(expires_at);
