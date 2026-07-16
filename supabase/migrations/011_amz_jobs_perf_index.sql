-- Speed up the Amazon jobs listing.
--
-- The endpoint filters by account_id and orders by created_at DESC with a
-- LIMIT. With only the account_id-only index, Postgres filters on that index
-- and then sorts every matching row by created_at before applying the limit —
-- the slow path once an account has many jobs. A composite index ordered the
-- same way lets it serve filter + sort + limit from one index range scan.
CREATE INDEX IF NOT EXISTS idx_amz_listing_jobs_account_created
  ON amz_listing_jobs (account_id, created_at DESC);

-- The composite index leads with account_id, so it also covers the plain
-- account_id lookups the old single-column index served. Drop the redundant one
-- to save write overhead.
DROP INDEX IF EXISTS idx_amz_listing_jobs_account_id;
