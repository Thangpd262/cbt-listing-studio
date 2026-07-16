-- Migration: shipping template per user config
-- Chạy trong Supabase SQL Editor

-- 1. Thêm cột shipping_template_name vào user_product_configs
ALTER TABLE user_product_configs
  ADD COLUMN IF NOT EXISTS shipping_template_name text;

-- 2. Bảng cache shipping templates từ SP-API Reports (per account + selling account)
CREATE TABLE IF NOT EXISTS amz_shipping_templates_cache (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid        NOT NULL,
  selling_account_id uuid     NOT NULL,
  template_name   text        NOT NULL,
  synced_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, selling_account_id, template_name)
);

-- Index để query nhanh theo account + selling_account
CREATE INDEX IF NOT EXISTS idx_amz_shipping_templates_account
  ON amz_shipping_templates_cache (account_id, selling_account_id);

-- 3. Bảng tracking sync job (report đang chạy)
CREATE TABLE IF NOT EXISTS amz_shipping_templates_sync (
  account_id         uuid        NOT NULL,
  selling_account_id uuid        NOT NULL,
  report_id          text,
  status             text        NOT NULL DEFAULT 'idle', -- idle | pending | failed
  error_message      text,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, selling_account_id)
);
