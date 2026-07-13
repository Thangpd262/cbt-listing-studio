-- Raw listings crawled from platforms
CREATE TABLE crawl_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('amazon', 'walmart', 'etsy', 'printify')),
  source_url TEXT,
  title TEXT,
  images JSONB NOT NULL DEFAULT '[]',
  price NUMERIC(10,2),
  tags JSONB NOT NULL DEFAULT '[]',
  raw_html TEXT,
  status TEXT NOT NULL DEFAULT 'ingested' CHECK (status IN ('ingested', 'analyzing', 'analyzed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scene analysis produced by LLM
CREATE TABLE listing_scene_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  listing_id UUID NOT NULL REFERENCES crawl_listings(id) ON DELETE CASCADE,
  mood TEXT,
  palette JSONB NOT NULL DEFAULT '[]',
  objects JSONB NOT NULL DEFAULT '[]',
  quote TEXT,
  style TEXT,
  niche TEXT,
  raw_response JSONB,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (listing_id)
);

-- Indexes
CREATE INDEX idx_crawl_listings_account_id ON crawl_listings(account_id);
CREATE INDEX idx_crawl_listings_platform ON crawl_listings(platform);
CREATE INDEX idx_crawl_listings_status ON crawl_listings(status);
CREATE INDEX idx_listing_scene_analysis_account_id ON listing_scene_analysis(account_id);
CREATE INDEX idx_listing_scene_analysis_listing_id ON listing_scene_analysis(listing_id);
