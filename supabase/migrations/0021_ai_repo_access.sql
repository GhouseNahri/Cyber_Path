-- 0021 — Explicit per-repository AI access
--
-- A user must explicitly enable AI access for EACH repository they want the
-- assistant to read (Phase 6/8 of the master prompt). Access is READ-ONLY by
-- construction: the assistant only ever calls GitHub's read endpoints with
-- the token already stored server-side in github_connections.
--
-- Rows here are checked by the chat route before any repository data is
-- fetched; disconnecting = deleting the row.

create table if not exists public.ai_repo_access (
  user_id        uuid not null references auth.users (id) on delete cascade,
  repo_full_name text not null check (repo_full_name ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'),
  enabled        boolean not null default true,
  granted_at     timestamptz not null default now(),
  primary key (user_id, repo_full_name)
);

alter table public.ai_repo_access enable row level security;

drop policy if exists "ai_repo_access_owner_only" on public.ai_repo_access;
create policy "ai_repo_access_owner_only"
  on public.ai_repo_access for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists ai_repo_access_user_enabled
  on public.ai_repo_access (user_id) where enabled;
