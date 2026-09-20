-- ==========================================================================
-- Cyber_Path migration 0006 — daily missions + study sessions
--
-- daily_tasks   : the day's generated mission (max ~3 tasks), one row per
--                 task. day_key is the USER'S LOCAL day (YYYY-MM-DD,
--                 computed server-side from profiles.timezone), not UTC.
-- study_sessions: one row per work session. duration_seconds is recorded
--                 when the session ends and is clamped server-side so a
--                 session can never log more than its wall-clock window.
--
-- Both tables are strictly owner-only via RLS (auth.uid() = user_id).
--
-- Paste into: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ==========================================================================

create table if not exists public.daily_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day_key date not null,
  topic_slug text not null references public.topics (slug) on delete cascade,
  kind text not null check (kind in ('learn', 'practice', 'test', 'build')),
  title text not null,
  why text not null,
  planned_minutes int not null check (planned_minutes between 5 and 240),
  status text not null default 'pending' check (status in ('pending', 'done', 'skipped')),
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day_key date not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds int check (duration_seconds >= 0),
  tasks_done int not null default 0,
  tasks_skipped int not null default 0,
  notes text
);

-- Indexes on the hot paths (per-user, per-day lookups).
create index if not exists daily_tasks_user_day_idx on public.daily_tasks (user_id, day_key);
create index if not exists study_sessions_user_day_idx on public.study_sessions (user_id, day_key);

-- Guard against double-generating the same mission slot (two parallel
-- requests): only one task per position per user per day.
create unique index if not exists daily_tasks_slot_unique
  on public.daily_tasks (user_id, day_key, position);

-- ── RLS: owner-only ──────────────────────────────────────────────────────
alter table public.daily_tasks enable row level security;
alter table public.study_sessions enable row level security;

drop policy if exists "dt_select_own" on public.daily_tasks;
create policy "dt_select_own" on public.daily_tasks
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "dt_insert_own" on public.daily_tasks;
create policy "dt_insert_own" on public.daily_tasks
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "dt_update_own" on public.daily_tasks;
create policy "dt_update_own" on public.daily_tasks
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "dt_delete_own" on public.daily_tasks;
create policy "dt_delete_own" on public.daily_tasks
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "ss_select_own" on public.study_sessions;
create policy "ss_select_own" on public.study_sessions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "ss_insert_own" on public.study_sessions;
create policy "ss_insert_own" on public.study_sessions
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "ss_update_own" on public.study_sessions;
create policy "ss_update_own" on public.study_sessions
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
