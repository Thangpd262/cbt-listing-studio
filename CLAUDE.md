# CBT Listing Studio — Claude Code Context

## Architecture

Hub-and-spoke monorepo. 6 independent Next.js services, 1 shared package.

| Service | Port | Purpose |
|---|---|---|
| apps/account | 3001 | Auth, API keys, selling accounts, permissions |
| apps/hub | 3000 | UI shell, dashboard |
| apps/crawl | 3002 | Ingest listings, LLM scene analysis |
| apps/generator | 3003 | AI image gen + content, platform-aware |
| apps/list-amz | 3004 | Amazon SP-API adapter |
| apps/list-wmt | 3005 | Walmart Marketplace API adapter |

## Key Principles

- Every table has `account_id` for multi-tenancy
- Auth: `X-API-Key` header -> Account service validates -> returns AuthContext
- Use `withAuth` from `@cbt/shared` to protect API routes
- Services use `SUPABASE_SERVICE_KEY` (bypasses RLS)
- Platform split: Crawl shared, Generator platform-aware (`platform` param), List split by platform

## Shared Package (@cbt/shared)

Import path: `@cbt/shared`

Exports:
- `withAuth(handler)` — wraps API routes, injects AuthContext
- `AuthContext` type — `{ account_id, user_id, role, selling_account_id?, tier, permissions[] }`
- `ok(res, data)` / `created(res, data)` / `error(res, status, msg)` / `paginated(res, data, total, page, limit)`
- `createSupabaseClient()` — reads SUPABASE_URL + SUPABASE_SERVICE_KEY from env
- `AppError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ValidationError`

## Example API Route Pattern

```typescript
// pages/api/example.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, ok, error, createSupabaseClient } from '@cbt/shared'

export default withAuth(async (req, res, auth) => {
  if (req.method !== 'GET') return error(res, 405, 'Method not allowed')
  
  const supabase = createSupabaseClient()
  const { data, error: dbError } = await supabase
    .from('some_table')
    .select('*')
    .eq('account_id', auth.account_id)
  
  if (dbError) return error(res, 500, dbError.message)
  return ok(res, data)
})
```

## Database

Single Supabase project. Tables per service:
- Account: accounts, app_users, api_keys, selling_accounts, account_credentials, user_selling_permissions, subscriptions
- Crawl: crawl_listings, listing_scene_analysis
- Generator: prompt_templates, gen_jobs, gen_assets, ai_spend_records
- List-AMZ: amz_products, amz_listing_jobs, sp_api_tokens, amz_product_configs
- List-WMT: wmt_products, wmt_listing_jobs, wmt_api_tokens, wmt_product_configs

## Spec Files

- SPEC.md — architecture spec
- IMPL-SPEC.md — full API endpoint spec with TypeScript types
- GUIDE.md — setup guide

## Build Order

1. Account (auth foundation)
2. Hub (UI shell)
3. Crawl
4. Generator
5. List-AMZ
6. List-WMT
