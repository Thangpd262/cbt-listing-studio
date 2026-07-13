#!/usr/bin/env node
// Fallback admin seed via the Supabase Admin API.
// Use this if migration 007's SQL seed fails on a given GoTrue version.
// Idempotent: safe to run multiple times.
//
// Usage (from repo root):
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/seed-admin.mjs
// Or set them in apps/account/.env.local (auto-loaded below).

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ADMIN = {
  email: 'admin@iart.group',
  password: '12345679qaz',
  name: 'iart Admin',
}

// Minimal .env.local loader (no dotenv dependency).
function loadEnvLocal() {
  const here = dirname(fileURLToPath(import.meta.url))
  const envPath = resolve(here, '../apps/account/.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

loadEnvLocal()

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY (set env or apps/account/.env.local)')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

async function findAuthUserByEmail(email) {
  // Paginate through auth users (fine for small/new systems).
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const found = data.users.find((u) => u.email === email)
    if (found) return found
    if (data.users.length < 200) break
  }
  return null
}

async function main() {
  // 1. Auth identity.
  let authUser = await findAuthUserByEmail(ADMIN.email)
  if (!authUser) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: ADMIN.email,
      password: ADMIN.password,
      email_confirm: true,
      user_metadata: { name: ADMIN.name },
    })
    if (error) throw error
    authUser = data.user
    console.log('✓ Created auth user', authUser.id)
  } else {
    console.log('• Auth user exists', authUser.id)
  }

  // 2. The single account.
  let { data: account } = await supabase.from('accounts').select('id').eq('email', ADMIN.email).maybeSingle()
  if (!account) {
    const { data, error } = await supabase
      .from('accounts')
      .insert({ email: ADMIN.email, name: ADMIN.name, tier: 'enterprise' })
      .select('id')
      .single()
    if (error) throw error
    account = data
    await supabase.from('subscriptions').insert({ account_id: account.id, tier: 'enterprise' })
    console.log('✓ Created account', account.id)
  } else {
    console.log('• Account exists', account.id)
  }

  // 3. Admin app_user (active).
  const { data: existingUser } = await supabase
    .from('app_users')
    .select('id')
    .eq('auth_user_id', authUser.id)
    .maybeSingle()
  if (!existingUser) {
    const { data, error } = await supabase
      .from('app_users')
      .insert({
        account_id: account.id,
        auth_user_id: authUser.id,
        email: ADMIN.email,
        name: ADMIN.name,
        role: 'admin',
        status: 'active',
      })
      .select('id')
      .single()
    if (error) throw error
    console.log('✓ Created admin app_user', data.id)
  } else {
    console.log('• Admin app_user exists', existingUser.id)
  }

  console.log('\nSeed complete. Login:', ADMIN.email, '/', ADMIN.password)
}

main().catch((err) => {
  console.error('Seed failed:', err.message ?? err)
  process.exit(1)
})
