-- Prompt templates
CREATE TABLE prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  name TEXT NOT NULL,
  platform TEXT CHECK (platform IN ('amazon', 'walmart', 'etsy', 'printify')),
  prompt_type TEXT NOT NULL CHECK (prompt_type IN ('image', 'title', 'description')),
  content TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Generation jobs
CREATE TABLE gen_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  listing_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('amazon', 'walmart')),
  mockup_set_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Generated assets stored in Supabase Storage
CREATE TABLE gen_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  job_id UUID NOT NULL REFERENCES gen_jobs(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL,
  platform TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('image', 'title', 'description')),
  storage_path TEXT,
  content TEXT,
  variant_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI spend tracking
CREATE TABLE ai_spend_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  job_id UUID REFERENCES gen_jobs(id),
  listing_id UUID,
  step TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_prompt_templates_account_id ON prompt_templates(account_id);
CREATE INDEX idx_gen_jobs_account_id ON gen_jobs(account_id);
CREATE INDEX idx_gen_jobs_listing_id ON gen_jobs(listing_id);
CREATE INDEX idx_gen_jobs_status ON gen_jobs(status);
CREATE INDEX idx_gen_assets_job_id ON gen_assets(job_id);
CREATE INDEX idx_ai_spend_records_account_id ON ai_spend_records(account_id);
