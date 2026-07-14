-- 012: attribute each Amazon listing job to the user who created it.
-- Nullable + additive, so existing rows and inserts stay valid.
-- auth.user_id (from withAuth) = app_users.id, so it maps directly.

ALTER TABLE amz_listing_jobs
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES app_users(id);

CREATE INDEX IF NOT EXISTS idx_amz_listing_jobs_created_by ON amz_listing_jobs(created_by);
