-- Single-tenant user management: user-level role + approval status.
-- Roles simplified to: admin (full), operator (uses features).
-- Approval flow: register -> status 'pending' -> admin approves -> role assigned + status 'active'.

-- pgcrypto provides crypt()/gen_salt() for seeding the auth password below.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Add role (nullable: NULL until an admin assigns one on approval) + status.
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('admin', 'operator')),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended'));

CREATE INDEX IF NOT EXISTS idx_app_users_status ON app_users(status);

-- 2. Align granular permission roles to the same 2-role set.
ALTER TABLE user_selling_permissions DROP CONSTRAINT IF EXISTS user_selling_permissions_role_check;
ALTER TABLE user_selling_permissions
  ADD CONSTRAINT user_selling_permissions_role_check CHECK (role IN ('admin', 'operator'));

-- 3. Seed the default admin (idempotent). Single tenant: one account, one admin.
--    Password is stored in Supabase Auth (auth.users), matching the app's Option B auth model.
DO $$
DECLARE
  v_auth_id   uuid;
  v_account_id uuid;
BEGIN
  -- 3a. Auth identity in auth.users.
  SELECT id INTO v_auth_id FROM auth.users WHERE email = 'admin@iart.group';
  IF v_auth_id IS NULL THEN
    v_auth_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_auth_id, 'authenticated', 'authenticated',
      'admin@iart.group', extensions.crypt('12345679qaz', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}', '{"name":"iart Admin"}',
      '', '', '', ''
    );

    -- Identity row required by GoTrue for email/password sign-in.
    INSERT INTO auth.identities (
      user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_auth_id, v_auth_id::text,
      jsonb_build_object('sub', v_auth_id::text, 'email', 'admin@iart.group', 'email_verified', true),
      'email', now(), now(), now()
    );
  END IF;

  -- 3b. The single account.
  SELECT id INTO v_account_id FROM accounts WHERE email = 'admin@iart.group';
  IF v_account_id IS NULL THEN
    INSERT INTO accounts (email, name, tier)
    VALUES ('admin@iart.group', 'iart Admin', 'enterprise')
    RETURNING id INTO v_account_id;

    INSERT INTO subscriptions (account_id, tier) VALUES (v_account_id, 'enterprise')
    ON CONFLICT (account_id) DO NOTHING;
  END IF;

  -- 3c. The admin app_user (active, role admin).
  IF NOT EXISTS (SELECT 1 FROM app_users WHERE auth_user_id = v_auth_id) THEN
    INSERT INTO app_users (account_id, auth_user_id, email, name, role, status)
    VALUES (v_account_id, v_auth_id, 'admin@iart.group', 'iart Admin', 'admin', 'active');
  END IF;
END $$;
