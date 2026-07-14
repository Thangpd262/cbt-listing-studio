-- 010: user-owned product configs + product groups
--
-- user_product_configs: a user's clone of a system product_configs row. It keeps
--   only the diffs in `overrides` (jsonb) and points at the source via `based_on`
--   (FK -> product_configs.key). The full schema is always read from the base
--   config, then overrides are applied at listing-build time.
-- product_groups: user-defined grouping of products ("nhóm"), replacing the old
--   free-text niche. Scoped per account + platform.

CREATE TABLE IF NOT EXISTS user_product_configs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL,
  name        text NOT NULL,
  based_on    text NOT NULL REFERENCES product_configs(key) ON DELETE RESTRICT,
  overrides   jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_product_configs_account ON user_product_configs(account_id);
CREATE INDEX IF NOT EXISTS idx_user_product_configs_based_on ON user_product_configs(based_on);

CREATE TABLE IF NOT EXISTS product_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL,
  name        text NOT NULL,
  platform    text NOT NULL DEFAULT 'amazon' CHECK (platform IN ('amazon', 'walmart')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, platform, name)
);

CREATE INDEX IF NOT EXISTS idx_product_groups_account ON product_groups(account_id);

-- Both tables are reached only via the service key (RLS bypassed), consistent
-- with the other service-owned tables; account scoping is enforced in the API layer.
