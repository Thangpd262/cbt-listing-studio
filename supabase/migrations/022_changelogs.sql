-- 022: "Có gì mới" changelog entries, auto-generated on push to main by the
-- changelog GitHub Action (git commits → Claude summary → row here). Global (not
-- account-scoped); the hub shows the latest N and tracks read state client-side.
create table changelogs (
  id           uuid primary key default gen_random_uuid(),
  version      text not null,           -- e.g. "2026-07-17-<sha>" or a git tag
  summary      text not null,           -- Claude-summarized notes, markdown
  raw_commits  text,                    -- raw commit list, for debugging
  published_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- Newest-first reads.
create index changelogs_published_at_idx on changelogs(published_at desc);

-- RLS: service role only (services use SUPABASE_SERVICE_KEY), matching every
-- other table. The Action writes and the hub reads with the service key.
alter table changelogs enable row level security;
create policy "service_role_all" on changelogs to service_role using (true) with check (true);
