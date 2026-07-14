-- 014: attribute each crawled listing to the user who crawled it.
-- Enables per-user visibility (non-admins see only their own) + showing the
-- crawler's email in the UI. Nullable + additive; auth.user_id = app_users.id.

ALTER TABLE crawl_listings
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES app_users(id);

CREATE INDEX IF NOT EXISTS idx_crawl_listings_created_by ON crawl_listings(created_by);
