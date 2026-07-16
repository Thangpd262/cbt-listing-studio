-- 020: surface the real Amazon listing-creation date.
-- The "Ngày tạo" column was showing created_at (first-seen-in-cache ≈ sync time),
-- not when the ASIN/listing was actually created on Amazon. SP-API returns that
-- as summaries[0].createdDate, already stored inside the raw response.
--
-- Run manually in the Supabase SQL editor.

ALTER TABLE amz_listings_cache
  ADD COLUMN IF NOT EXISTS amz_listed_at TIMESTAMPTZ;

-- Backfill from the stored SP-API item (Listings Items summaries.createdDate).
UPDATE amz_listings_cache
SET amz_listed_at = (raw #>> '{summaries,0,createdDate}')::timestamptz
WHERE amz_listed_at IS NULL
  AND raw #>> '{summaries,0,createdDate}' IS NOT NULL;
