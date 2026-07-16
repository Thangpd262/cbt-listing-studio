-- 019: track when a cached Amazon listing was last edited by a user.
-- Distinct from synced_at (last sync from Amazon) — updated_at is bumped by the
-- hub whenever a user edits a field (niche, etc.), powering the "Mới update"
-- sort. Backfilled from synced_at so existing rows have a sensible value.
--
-- Run manually in the Supabase SQL editor.

ALTER TABLE amz_listings_cache
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Backfill: seed with synced_at for every existing row.
UPDATE amz_listings_cache SET updated_at = synced_at WHERE updated_at IS NULL;
