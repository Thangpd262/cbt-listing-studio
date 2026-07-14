-- 011: 30-day retention for generated assets.
-- Each gen_assets row expires 30 days after it was generated; the
-- /api/cleanup-images cron (apps/generator) deletes expired rows + their
-- storage files daily.

ALTER TABLE gen_assets ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Backfill existing rows from their generated time.
UPDATE gen_assets SET expires_at = created_at + interval '30 days' WHERE expires_at IS NULL;

-- New rows auto-expire 30 days from insert (created_at default = now()).
ALTER TABLE gen_assets ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 days');
ALTER TABLE gen_assets ALTER COLUMN expires_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gen_assets_expires_at ON gen_assets(expires_at);
