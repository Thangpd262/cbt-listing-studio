-- Amazon products
CREATE TABLE amz_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  selling_account_id UUID NOT NULL,
  listing_id UUID,
  sku TEXT NOT NULL,
  asin TEXT,
  title TEXT NOT NULL,
  description TEXT,
  bullet_points JSONB NOT NULL DEFAULT '[]',
  images JSONB NOT NULL DEFAULT '[]',
  price NUMERIC(10,2),
  quantity INT NOT NULL DEFAULT 0,
  product_type TEXT,
  attributes JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (selling_account_id, sku)
);

-- Amazon listing jobs
CREATE TABLE amz_listing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  selling_account_id UUID NOT NULL,
  product_id UUID REFERENCES amz_products(id),
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'price_qty')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed')),
  payload JSONB NOT NULL DEFAULT '{}',
  result JSONB,
  error TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Amazon SP-API token cache
CREATE TABLE sp_api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  selling_account_id UUID UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Amazon product configs (shipping template, feed config, etc.)
CREATE TABLE amz_product_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  selling_account_id UUID UNIQUE NOT NULL,
  default_shipping_template TEXT,
  default_product_type TEXT,
  marketplace_id TEXT NOT NULL DEFAULT 'ATVPDKIKX0DER',
  config JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_amz_products_account_id ON amz_products(account_id);
CREATE INDEX idx_amz_products_selling_account_id ON amz_products(selling_account_id);
CREATE INDEX idx_amz_listing_jobs_status ON amz_listing_jobs(status);
CREATE INDEX idx_amz_listing_jobs_account_id ON amz_listing_jobs(account_id);
