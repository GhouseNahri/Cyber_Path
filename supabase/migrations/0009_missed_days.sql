-- ==========================================================================
-- Cyber_Path migration 0009 — missed days (accountability)
--
-- One row per user per calendar day the user marks as missed, with the
-- reason they gave. The streak engine decides which days qualify; this
-- table stores honest self-reports for unqualified days. Task-level skip
-- reasons (0008) are separate and untouched.
--
-- Owner-only RLS, unique per (user_id, day_key) via the primary key.
-- ==========================================================================

create table if not exists public.missed_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day_key date not null,
  reason_category text not null check (reason_category in (
    'no_time', 'too_tired', 'college_work', 'didnt_understand',
    'task_too_difficult', 'lost_motivation', 'forgot', 'technical_problem',
    'personal', 'other'
  )),
  reason_text text,
  created_at timestamptz not null default now(),
  primary key (user_id, day_key)
);

create index if not exists missed_days_user_idx on public.missed_days (user_id, day_key desc);

alter table public.missed_days enable row level security;

drop policy if exists "md_select_own" on public.missed_days;
create policy "md_select_own" on public.missed_days
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "md_insert_own" on public.missed_days;
create policy "md_insert_own" on public.missed_days
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "md_update_own" on public.missed_days;
create policy "md_update_own" on public.missed_days
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
