-- 018: store AI-generated image URLs per crawled listing.
-- Persists images produced by the generator so they survive page reloads and
-- can be removed. JSONB array to match the existing `images` column shape.

ALTER TABLE crawl_listings
  ADD COLUMN IF NOT EXISTS ai_images JSONB NOT NULL DEFAULT '[]';
