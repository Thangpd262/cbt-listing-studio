-- Walmart products
CREATE TABLE wmt_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  selling_account_id UUID NOT NULL,
  listing_id UUID,
  sku TEXT NOT NULL,
  walmart_item_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  variants JSONB NOT NULL DEFAULT '[]',
  attributes JSONB NOT NULL DEFAULT '{}',
  shipping_node TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'staging', 'published', 'inactive', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (selling_account_id, sku)
);

-- Walmart listing jobs
CREATE TABLE wmt_listing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  selling_account_id UUID NOT NULL,
  product_id UUID REFERENCES wmt_products(id),
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'stage', 'publish', 'price_qty')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed')),
  payload JSONB NOT NULL DEFAULT '{}',
  result JSONB,
  error TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Walmart API token cache
CREATE TABLE wmt_api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  selling_account_id UUID UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Walmart product configs
CREATE TABLE wmt_product_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  selling_account_id UUID UNIQUE NOT NULL,
  default_shipping_node TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_wmt_products_account_id ON wmt_products(account_id);
CREATE INDEX idx_wmt_products_selling_account_id ON wmt_products(selling_account_id);
CREATE INDEX idx_wmt_listing_jobs_status ON wmt_listing_jobs(status);
CREATE INDEX idx_wmt_listing_jobs_account_id ON wmt_listing_jobs(account_id);
