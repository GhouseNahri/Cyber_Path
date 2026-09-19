-- ==========================================================================
-- Cyber_Path migration 0003 — roadmap schema
--
-- Content tables: readable by any authenticated user, writable only via
-- the Supabase dashboard / SQL editor (no public writes — the roadmap is
-- curated content, not user data).
--
-- User tables: strictly owner-only via RLS (auth.uid() = user_id).
--
-- Paste into: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ==========================================================================

-- ── Content: phases ──────────────────────────────────────────────────────
create table if not exists public.roadmap_phases (
  slug text primary key,
  order_index int not null unique,
  title text not null,
  tagline text,
  description text not null,
  estimated_hours int
);

-- ── Content: topics ──────────────────────────────────────────────────────
create table if not exists public.topics (
  slug text primary key,
  phase_slug text not null references public.roadmap_phases (slug) on delete cascade,
  order_index int not null,
  title text not null,
  summary text not null,
  why_it_matters text not null,
  difficulty text not null default 'beginner'
    check (difficulty in ('beginner', 'intermediate', 'advanced')),
  estimated_minutes int not null default 60
    check (estimated_minutes between 5 and 1440),
  stage_hints jsonb not null default '{}'::jsonb,
  is_optional boolean not null default false,
  unique (phase_slug, order_index)
);

-- ── Content: prerequisites (topic -> topic) ──────────────────────────────
create table if not exists public.topic_prerequisites (
  topic_slug text not null references public.topics (slug) on delete cascade,
  requires_topic_slug text not null references public.topics (slug) on delete cascade,
  primary key (topic_slug, requires_topic_slug),
  check (topic_slug <> requires_topic_slug)
);

-- ── Content: skills + topic linkage ──────────────────────────────────────
create table if not exists public.skills (
  slug text primary key,
  name text not null,
  category text not null
);

create table if not exists public.topic_skills (
  topic_slug text not null references public.topics (slug) on delete cascade,
  skill_slug text not null references public.skills (slug) on delete cascade,
  weight numeric not null default 1.0 check (weight > 0 and weight <= 3),
  primary key (topic_slug, skill_slug)
);

-- ── Content: resources ───────────────────────────────────────────────────
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  topic_slug text not null references public.topics (slug) on delete cascade,
  title text not null,
  provider text not null,
  url text not null,
  type text not null check (type in (
    'documentation', 'article', 'video', 'course',
    'interactive_lab', 'ctf', 'book', 'cheat_sheet', 'exercise'
  )),
  difficulty text check (difficulty in ('beginner', 'intermediate', 'advanced')),
  estimated_minutes int,
  is_free boolean not null default true,
  is_official boolean not null default false,
  priority int not null default 2 check (priority between 1 and 3),
  last_verified date,
  notes text
);

-- ── User progress: topics ────────────────────────────────────────────────
create table if not exists public.user_topic_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_slug text not null references public.topics (slug) on delete cascade,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'completed')),
  stages jsonb not null default '{"read": false, "practice": false, "test": false, "build": false}'::jsonb,
  confidence smallint check (confidence between 1 and 5),
  last_practiced_at timestamptz,
  completed_at timestamptz,
  primary key (user_id, topic_slug)
);

-- ── User progress: resources ─────────────────────────────────────────────
create table if not exists public.user_resource_status (
  user_id uuid not null references auth.users (id) on delete cascade,
  resource_id uuid not null references public.resources (id) on delete cascade,
  status text not null check (status in ('saved', 'done', 'skip')),
  updated_at timestamptz not null default now(),
  primary key (user_id, resource_id)
);

-- ── Indexes on hot paths ─────────────────────────────────────────────────
create index if not exists topics_phase_idx on public.topics (phase_slug, order_index);
create index if not exists prereq_requires_idx on public.topic_prerequisites (requires_topic_slug);
create index if not exists resources_topic_idx on public.resources (topic_slug, priority);
create index if not exists user_topic_progress_user_idx on public.user_topic_progress (user_id);
create index if not exists user_resource_status_user_idx on public.user_resource_status (user_id);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.roadmap_phases enable row level security;
alter table public.topics enable row level security;
alter table public.topic_prerequisites enable row level security;
alter table public.skills enable row level security;
alter table public.topic_skills enable row level security;
alter table public.resources enable row level security;
alter table public.user_topic_progress enable row level security;
alter table public.user_resource_status enable row level security;

-- Content: authenticated users read; no public writes.
drop policy if exists "content_read_authenticated" on public.roadmap_phases;
create policy "content_read_authenticated" on public.roadmap_phases
  for select to authenticated using (true);

drop policy if exists "content_read_authenticated" on public.topics;
create policy "content_read_authenticated" on public.topics
  for select to authenticated using (true);

drop policy if exists "content_read_authenticated" on public.topic_prerequisites;
create policy "content_read_authenticated" on public.topic_prerequisites
  for select to authenticated using (true);

drop policy if exists "content_read_authenticated" on public.skills;
create policy "content_read_authenticated" on public.skills
  for select to authenticated using (true);

drop policy if exists "content_read_authenticated" on public.topic_skills;
create policy "content_read_authenticated" on public.topic_skills
  for select to authenticated using (true);

drop policy if exists "content_read_authenticated" on public.resources;
create policy "content_read_authenticated" on public.resources
  for select to authenticated using (true);

-- User progress: owner-only.
drop policy if exists "utp_select_own" on public.user_topic_progress;
create policy "utp_select_own" on public.user_topic_progress
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "utp_insert_own" on public.user_topic_progress;
create policy "utp_insert_own" on public.user_topic_progress
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "utp_update_own" on public.user_topic_progress;
create policy "utp_update_own" on public.user_topic_progress
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "urs_select_own" on public.user_resource_status;
create policy "urs_select_own" on public.user_resource_status
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "urs_insert_own" on public.user_resource_status;
create policy "urs_insert_own" on public.user_resource_status
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "urs_update_own" on public.user_resource_status;
create policy "urs_update_own" on public.user_resource_status
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
