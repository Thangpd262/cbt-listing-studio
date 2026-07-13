-- Enable RLS on all tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE selling_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_selling_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_scene_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE gen_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gen_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_spend_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE amz_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE amz_listing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_api_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE amz_product_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wmt_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE wmt_listing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wmt_api_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE wmt_product_configs ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (used by all services via SUPABASE_SERVICE_KEY)
-- No policies needed for service role - it bypasses RLS automatically

-- Allow service role full access (already default, but explicit for clarity)
CREATE POLICY "service_role_all" ON accounts TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON app_users TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON api_keys TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON selling_accounts TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON account_credentials TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON user_selling_permissions TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON subscriptions TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON crawl_listings TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON listing_scene_analysis TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON prompt_templates TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON gen_jobs TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON gen_assets TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON ai_spend_records TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON amz_products TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON amz_listing_jobs TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON sp_api_tokens TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON amz_product_configs TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON wmt_products TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON wmt_listing_jobs TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON wmt_api_tokens TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON wmt_product_configs TO service_role USING (true) WITH CHECK (true);
