-- 023: manually-added image URLs per crawled listing.
-- Lets users paste external image links alongside crawl/AI images when building jobs.

ALTER TABLE crawl_listings
  ADD COLUMN IF NOT EXISTS extra_images JSONB NOT NULL DEFAULT '[]';
