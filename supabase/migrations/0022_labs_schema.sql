-- ===========================================================================
-- Cyber_Path migration 0022 — labs system (catalog schema)
--
-- labs is the practical-learning catalog: built-in simulations, sandboxed
-- real labs (future), external provider labs, CTFs and home-lab exercises.
--
-- Content tables (lab_categories, labs, joins, lab_tasks) follow the house
-- pattern from 0003/0013/0017: readable by any authenticated user, writable
-- only via migrations. Nothing user-owned lives here.
--
-- Design notes:
--  * lab_type makes the kind of lab explicit in the UI (simulation / sandbox
--    / external / ctf / home_lab / custom). `custom` catalog entries do not
--    exist — custom labs are user-created rows (0023) and never in this table.
--  * completion_criteria is a self-describing jsonb: {"mode": "manual"} for
--    everything a user confirms themselves, {"mode": "sim", "sim_key": ...}
--    for built-in simulations (validated server-side by the sim engine),
--    {"mode": "sandbox", ...} reserved for the future sandbox provider.
--  * ticks_practice_stage: per-lab, migration-configured. When true,
--    completing the lab marks the mapped roadmap topic's Practice stage via
--    the normal roadmap path — never a bypass.
--  * hints is a tiered array [{tier, text}]; the API reveals tiers one at a
--    time and counts reveals per attempt (gamification stays honest).
--  * external_url must be https — provider links are user-facing.
-- ===========================================================================

-- ── Content: extensible categories ────────────────────────────────────────
create table if not exists public.lab_categories (
  slug text primary key,
  name text not null,
  description text not null default '',
  order_index int not null default 0
);

alter table public.lab_categories enable row level security;

drop policy if exists "lc_read_authenticated" on public.lab_categories;
create policy "lc_read_authenticated" on public.lab_categories
  for select to authenticated using (true);

-- ── Content: the lab catalog ──────────────────────────────────────────────
create table if not exists public.labs (
  slug text primary key,
  title text not null check (char_length(title) between 3 and 160),
  summary text not null check (char_length(summary) between 10 and 500),
  objective text not null check (char_length(objective) between 10 and 1000),
  category_slug text not null references public.lab_categories (slug) on delete restrict,
  lab_type text not null check (lab_type in
    ('simulation', 'sandbox', 'external', 'ctf', 'home_lab')),
  difficulty text not null check (difficulty in
    ('beginner', 'easy', 'intermediate', 'advanced', 'expert', 'adaptive')),
  estimated_minutes int not null default 60
    check (estimated_minutes between 5 and 1440),
  provider text not null default '',
  external_url text check (external_url is null or left(external_url, 8) = 'https://'),
  instructions text not null default '' check (char_length(instructions) <= 8000),
  learning_objectives text[] not null default '{}',
  completion_criteria jsonb not null default '{"mode": "manual"}'::jsonb,
  hints jsonb not null default '[]'::jsonb,
  ticks_practice_stage boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists labs_published_category_idx
  on public.labs (category_slug) where is_published;

alter table public.labs enable row level security;

drop policy if exists "labs_read_authenticated" on public.labs;
create policy "labs_read_authenticated" on public.labs
  for select to authenticated using (true);

-- ── Content: lab ↔ roadmap topic linkage ──────────────────────────────────
create table if not exists public.lab_topics (
  lab_slug text not null references public.labs (slug) on delete cascade,
  topic_slug text not null references public.topics (slug) on delete cascade,
  primary key (lab_slug, topic_slug)
);

alter table public.lab_topics enable row level security;

drop policy if exists "lt_read_authenticated" on public.lab_topics;
create policy "lt_read_authenticated" on public.lab_topics
  for select to authenticated using (true);

-- ── Content: lab ↔ skill linkage (weights mirror topic_skills) ────────────
create table if not exists public.lab_skills (
  lab_slug text not null references public.labs (slug) on delete cascade,
  skill_slug text not null references public.skills (slug) on delete cascade,
  weight numeric not null default 1.0 check (weight > 0 and weight <= 3),
  primary key (lab_slug, skill_slug)
);

alter table public.lab_skills enable row level security;

drop policy if exists "ls_read_authenticated" on public.lab_skills;
create policy "ls_read_authenticated" on public.lab_skills
  for select to authenticated using (true);

-- ── Content: lab prerequisites (lab -> lab) ───────────────────────────────
create table if not exists public.lab_prerequisites (
  lab_slug text not null references public.labs (slug) on delete cascade,
  requires_lab_slug text not null references public.labs (slug) on delete cascade,
  primary key (lab_slug, requires_lab_slug),
  check (lab_slug <> requires_lab_slug)
);

alter table public.lab_prerequisites enable row level security;

drop policy if exists "lp_read_authenticated" on public.lab_prerequisites;
create policy "lp_read_authenticated" on public.lab_prerequisites
  for select to authenticated using (true);

-- ── Content: per-lab task checklists (manual labs) ────────────────────────
create table if not exists public.lab_tasks (
  id uuid primary key default gen_random_uuid(),
  lab_slug text not null references public.labs (slug) on delete cascade,
  position int not null check (position between 1 and 20),
  title text not null check (char_length(title) between 2 and 300),
  detail text check (detail is null or char_length(detail) <= 1000),
  unique (lab_slug, position)
);

create index if not exists lab_tasks_lab_idx
  on public.lab_tasks (lab_slug, position);

alter table public.lab_tasks enable row level security;

drop policy if exists "ltasks_read_authenticated" on public.lab_tasks;
create policy "ltasks_read_authenticated" on public.lab_tasks
  for select to authenticated using (true);
