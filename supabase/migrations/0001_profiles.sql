-- ==========================================================================
-- Cyber_Path migration 0001 — profiles (minimum for Phase 2 auth)
--
-- What this creates:
--   public.profiles       one row per user, keyed to auth.users(id)
--   handle_new_user()     trigger: auto-creates a profile at signup
--   RLS policies          users can see/update ONLY their own profile
--
-- Paste into: Supabase Dashboard → SQL Editor → New query → Run
-- ==========================================================================

-- ── profiles table ────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  username text unique,
  timezone text not null default 'UTC',
  daily_goal_minutes int not null default 45
    check (daily_goal_minutes between 5 and 480),
  preferred_study_time text,          -- e.g. 'morning' | 'afternoon' | 'evening' | 'night'
  experience_level text,              -- 'beginner' | 'some_experience' | 'experienced'
  target_roles text[] not null default '{}',
  learning_style text,                -- 'theory' | 'practical' | 'balanced'
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user. Phase 2: identity + onboarding preferences. Roadmap/progress tables arrive in Phase 3.';

-- keep updated_at honest
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ── auto-create profile at signup ─────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', null))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Row Level Security ────────────────────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- (no delete policy: profiles go away only when the auth user is deleted,
-- via the on-delete-cascade FK — account deletion is a later, explicit feature)
