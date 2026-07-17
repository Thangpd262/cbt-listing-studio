# Prompt System Instruction · Model Expansion · Cost Tracking

**Status:** DONE — Backend + Hub UI implemented, both typecheck clean. Pending: run migration 021, add OPENAI_API_KEY env.
**Scope:** `packages/shared` · `apps/generator` · `apps/hub` · `supabase/migrations`
**Source:** requirements-prompt-model-cost.md, reconciled with SPEC.md / IMPL-SPEC.md / actual repo.

## Decisions (reconciled with repo)
- Migration is **021** (007 taken; latest was 020).
- `prompt_templates.model` already exists (013, nullable) → backfill NULL→`gpt-image-1`, then `NOT NULL DEFAULT`. Add `system_instruction`.
- Cost tracking = **new tables** `ai_gen_logs` + `user_ai_spend` per SPEC (user chose Option A). Existing `ai_spend_records` left untouched (no data migration); code stops writing to it.
- `IMAGE_MODELS` (9 models) added to shared; drives dropdown + cost display + `imageCost()`. Only OpenAI + Google providers are actually wired; others display-only.
- Keep `GET /api/spend/[listingId]` (Hub uses it) **and** add `GET /api/spend/listing/[listingId]` per doc.
- `auth.user_id` = `app_users.id` (confirmed via validate.ts) → safe FK. `logAiCall` is best-effort and guards null user_id.

## Phases
1. **Backend (this pass, checkpoint after):**
   - Migration 021.
   - `packages/shared/src/constants/models.ts` + index export.
   - Generator prompt endpoints (model + system_instruction, validation, enriched GET).
   - `GET /api/models`.
   - `lib/logAiCall.ts`; rewire `spend.ts` (imageCost from constant), `pipeline.ts` (+user_id), `generate-image.ts`, `generate-text.ts`.
   - Spend endpoints: `/api/spend` (total, by_model, by_step, by_user, period), `/api/spend/listing/[id]`, `/api/logs`.
   - Typecheck/build generator + shared.
2. **Hub UI (after review):** prompt form (grouped model dropdown + system_instruction), Crawl model chip (remove selector), Settings AI Spend section, inline per-listing cost.

## Acceptance
See requirements-prompt-model-cost.md checklist. Backend covers: schema, /api/models, /api/spend/listing, logging on every AI call, legacy-safe prompts.
