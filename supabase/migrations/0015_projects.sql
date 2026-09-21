-- ==========================================================================
-- Cyber_Path migration 0015 - project system
--
-- project_ideas: curated catalog (like topics/resources) - readable by any
--   authenticated user, writable only via migrations. Each idea carries its
--   skill mapping and an explicit authorized-use statement.
-- user_projects: the user's tracker rows. Owner-only RLS. status is a real
--   state machine (idea -> planned -> building -> completed -> published);
--   timestamps are set by the server action as the status advances.
-- Milestone progress is stored as a jsonb array of done milestone indexes.
-- ==========================================================================

create table if not exists public.project_ideas (
  slug text primary key,
  title text not null,
  summary text not null,
  why_build_it text not null,
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  estimated_hours int check (estimated_hours between 1 and 500),
  skills jsonb not null default '[]'::jsonb,        -- array of skill slugs
  requirements jsonb not null default '[]'::jsonb,  -- array of strings
  milestones jsonb not null default '[]'::jsonb,    -- array of strings
  authorized_use text not null,
  order_index int not null default 0
);

create index if not exists project_ideas_difficulty_idx
  on public.project_ideas (difficulty, order_index);

alter table public.project_ideas enable row level security;

drop policy if exists "pi_read_authenticated" on public.project_ideas;
create policy "pi_read_authenticated" on public.project_ideas
  for select to authenticated using (true);

create table if not exists public.user_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  idea_slug text references public.project_ideas (slug) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  status text not null default 'idea'
    check (status in ('idea', 'planned', 'building', 'completed', 'published')),
  github_url text,
  demo_url text,
  notes text check (notes is null or char_length(notes) <= 5000),
  milestones_done jsonb not null default '[]'::jsonb, -- array of ints
  started_at timestamptz,
  completed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One tracker row per idea per user; free-text custom projects are allowed
-- alongside (idea_slug null), so the partial unique index covers only ideas.
create unique index if not exists user_projects_idea_unique
  on public.user_projects (user_id, idea_slug)
  where idea_slug is not null;

create index if not exists user_projects_user_idx
  on public.user_projects (user_id, status);

alter table public.user_projects enable row level security;

drop policy if exists "up_select_own" on public.user_projects;
create policy "up_select_own" on public.user_projects
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "up_insert_own" on public.user_projects;
create policy "up_insert_own" on public.user_projects
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "up_update_own" on public.user_projects;
create policy "up_update_own" on public.user_projects
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "up_delete_own" on public.user_projects;
create policy "up_delete_own" on public.user_projects
  for delete to authenticated using (auth.uid() = user_id);
