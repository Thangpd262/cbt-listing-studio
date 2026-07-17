-- 025: allow 'job_created' as a valid crawl_listings status.
-- Previously the CHECK only included ingested/analyzing/analyzed/failed,
-- causing silent failures when the hub tried to mark a listing as job_created.

ALTER TABLE crawl_listings DROP CONSTRAINT IF EXISTS crawl_listings_status_check;
ALTER TABLE crawl_listings ADD CONSTRAINT crawl_listings_status_check
  CHECK (status IN ('ingested', 'analyzing', 'analyzed', 'failed', 'job_created'));
