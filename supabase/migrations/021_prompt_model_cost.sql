-- 021: prompt system instruction, model binding, and per-user AI cost tracking.
--
-- - prompt_templates gains system_instruction and a NOT NULL model (backfilled).
-- - ai_gen_logs records every AI call (image/text) with per-user attribution.
-- - user_ai_spend is a daily rollup per user/model/step for fast spend summaries.
--
-- The older ai_spend_records table (migration 003) is left in place but is no
-- longer written to; ai_gen_logs supersedes it.

-- 1. prompt_templates: bind a model + optional system instruction to each prompt.
--    model already exists (nullable, migration 013) — backfill then tighten.
UPDATE prompt_templates SET model = 'gpt-image-1' WHERE model IS NULL;

ALTER TABLE prompt_templates
  ALTER COLUMN model SET DEFAULT 'gpt-image-1',
  ALTER COLUMN model SET NOT NULL;

ALTER TABLE prompt_templates
  ADD COLUMN IF NOT EXISTS system_instruction TEXT;

COMMENT ON COLUMN prompt_templates.model IS
  'Model ID used to generate images, e.g. gpt-image-2, gemini-2.5-flash-image';
COMMENT ON COLUMN prompt_templates.system_instruction IS
  'System-level instruction sent with every request that uses this prompt (context, tone, constraints)';

-- 2. ai_gen_logs: one row per AI call.
CREATE TABLE IF NOT EXISTS ai_gen_logs (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID          NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id             UUID          NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  listing_id          UUID,                              -- nullable: gen may run outside a listing
  prompt_template_id  UUID          REFERENCES prompt_templates(id) ON DELETE SET NULL,
  model               TEXT          NOT NULL,
  provider            TEXT          NOT NULL,            -- 'openai' | 'google' | ...
  step                TEXT          NOT NULL,            -- 'image_gen' | 'scene_analysis' | 'title_gen' | 'desc_gen'
  images_requested    INT           NOT NULL DEFAULT 1,
  images_received     INT           NOT NULL DEFAULT 0,
  input_tokens        INT           NOT NULL DEFAULT 0,
  output_tokens       INT           NOT NULL DEFAULT 0,
  cost_usd            NUMERIC(10,6) NOT NULL DEFAULT 0,
  status              TEXT          NOT NULL DEFAULT 'success',  -- 'success' | 'failed'
  error_message       TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_gen_logs_account_id_idx  ON ai_gen_logs(account_id);
CREATE INDEX IF NOT EXISTS ai_gen_logs_user_id_idx     ON ai_gen_logs(user_id);
CREATE INDEX IF NOT EXISTS ai_gen_logs_listing_id_idx  ON ai_gen_logs(listing_id);
CREATE INDEX IF NOT EXISTS ai_gen_logs_created_at_idx  ON ai_gen_logs(created_at DESC);

-- 3. user_ai_spend: daily rollup per user/model/step (upserted on each log write).
CREATE TABLE IF NOT EXISTS user_ai_spend (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID          NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id         UUID          NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  period_date     DATE          NOT NULL,
  model           TEXT          NOT NULL,
  provider        TEXT          NOT NULL,
  step            TEXT          NOT NULL,
  total_calls     INT           NOT NULL DEFAULT 0,
  total_images    INT           NOT NULL DEFAULT 0,
  total_cost_usd  NUMERIC(10,6)  NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT user_ai_spend_unique UNIQUE (account_id, user_id, period_date, model, step)
);

CREATE INDEX IF NOT EXISTS user_ai_spend_account_id_idx ON user_ai_spend(account_id);
CREATE INDEX IF NOT EXISTS user_ai_spend_user_id_idx    ON user_ai_spend(user_id);
CREATE INDEX IF NOT EXISTS user_ai_spend_period_idx      ON user_ai_spend(period_date DESC);

-- 4. Atomic upsert-increment for the daily rollup. Supabase JS upsert replaces
--    rather than accumulates, so the increment lives in SQL and is called via RPC.
CREATE OR REPLACE FUNCTION record_ai_spend(
  p_account_id UUID,
  p_user_id    UUID,
  p_model      TEXT,
  p_provider   TEXT,
  p_step       TEXT,
  p_images     INT,
  p_cost_usd   NUMERIC
) RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO user_ai_spend
    (account_id, user_id, period_date, model, provider, step,
     total_calls, total_images, total_cost_usd, updated_at)
  VALUES
    (p_account_id, p_user_id, CURRENT_DATE, p_model, p_provider, p_step,
     1, p_images, p_cost_usd, now())
  ON CONFLICT (account_id, user_id, period_date, model, step) DO UPDATE SET
    total_calls    = user_ai_spend.total_calls + 1,
    total_images   = user_ai_spend.total_images + EXCLUDED.total_images,
    total_cost_usd = user_ai_spend.total_cost_usd + EXCLUDED.total_cost_usd,
    updated_at     = now();
$$;
