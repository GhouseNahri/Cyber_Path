-- ===========================================================================
-- Cyber_Path migration 0023 — labs system (user data)
--
-- Per-user lab state. Every table is strictly owner-only via RLS
-- (auth.uid() = user_id), same as quiz_attempts / user_projects.
--
-- user_labs: one row per (user, lab) for catalog labs, and standalone rows
--   for user-created custom labs (lab_slug null, title required). Status
--   machine: not_started → in_progress → completed → revisit → back to
--   in_progress; abandoned from any state. History is kept — abandoned is
--   a state, never a delete.
-- lab_attempts: immutable attempt log (select + insert policies only, like
--   quiz_attempts). No update/delete policies exist by design.
-- lab_evidence: what the practical work proved. visibility is private by
--   default; 'portfolio' is an explicit per-row opt-in read later by the
--   whitelisted portfolio function (L5) — private rows are structurally
--   excluded there.
-- lab_sim_states: per-user persisted state for built-in simulations, so a
--   terminal session survives a page reload. Owner-only.
-- lab_notes: long-form practical journal per lab (L4 reflection lives in
--   user_labs reflection fields; this is the free-form companion).
-- ===========================================================================

-- ── User: lab tracker (catalog + custom) ──────────────────────────────────
create table if not exists public.user_labs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lab_slug text references public.labs (slug) on delete cascade,
  -- Custom labs: user-defined, no catalog row.
  title text check (title is null or char_length(title) between 2 and 160),
  lab_type text not null default 'external' check (lab_type in
    ('simulation', 'sandbox', 'external', 'ctf', 'home_lab', 'custom')),
  provider text not null default '',
  external_url text check (external_url is null or left(external_url, 8) = 'https://'),
  category_slug text references public.lab_categories (slug) on delete set null,
  status text not null default 'not_started' check (status in
    ('not_started', 'in_progress', 'completed', 'revisit', 'abandoned')),
  notes text not null default '' check (char_length(notes) <= 20000),
  -- Structured reflection captured at completion (L4).
  reflection jsonb,
  minutes_spent int not null default 0 check (minutes_spent between 0 and 100000),
  hints_revealed int not null default 0 check (hints_revealed between 0 and 50),
  attempts_count int not null default 0 check (attempts_count between 0 and 9999),
  times_revisited int not null default 0 check (times_revisited between 0 and 999),
  started_at timestamptz,
  completed_at timestamptz,
  revisit_at timestamptz,
  abandoned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A row tracks either a catalog lab or a custom lab — never both, never neither.
  constraint user_labs_catalog_or_custom
    check ((lab_slug is null) = (title is not null))
);

-- Custom labs are user-unique by title; catalog labs one row per lab.
create unique index if not exists user_labs_user_lab_slug_idx
  on public.user_labs (user_id, lab_slug) where lab_slug is not null;
create unique index if not exists user_labs_user_custom_title_idx
  on public.user_labs (lower(title)) where lab_slug is null;

create index if not exists user_labs_user_status_idx
  on public.user_labs (user_id, status, updated_at desc);
create index if not exists user_labs_user_type_idx
  on public.user_labs (user_id, lab_type);

alter table public.user_labs enable row level security;

drop policy if exists "ul_all_own" on public.user_labs;
create policy "ul_all_own" on public.user_labs
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── User: immutable attempt log ───────────────────────────────────────────
create table if not exists public.lab_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  user_lab_id uuid not null references public.user_labs (id) on delete cascade,
  attempt_number int not null check (attempt_number between 1 and 9999),
  result text not null check (result in ('completed', 'failed', 'partial', 'abandoned')),
  tasks_completed jsonb not null default '[]'::jsonb,
  hints_revealed int not null default 0 check (hints_revealed between 0 and 50),
  minutes int not null default 0 check (minutes between 0 and 10000),
  detail jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  unique (user_lab_id, attempt_number)
);

create index if not exists lab_attempts_user_idx
  on public.lab_attempts (user_id, completed_at desc);

alter table public.lab_attempts enable row level security;

drop policy if exists "la_select_own" on public.lab_attempts;
create policy "la_select_own" on public.lab_attempts
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "la_insert_own" on public.lab_attempts;
create policy "la_insert_own" on public.lab_attempts
  for insert to authenticated with check (auth.uid() = user_id);

-- ── User: evidence ────────────────────────────────────────────────────────
create table if not exists public.lab_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  user_lab_id uuid not null references public.user_labs (id) on delete cascade,
  kind text not null check (kind in ('note', 'link', 'writeup')),
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 5000),
  url text check (url is null or left(url, 8) = 'https://'),
  -- Suggested by the engine from lab_skills; user accepts/edits/removes.
  suggested_skills jsonb not null default '[]'::jsonb,
  accepted_skills text[] not null default '{}',
  visibility text not null default 'private' check (visibility in ('private', 'portfolio')),
  created_at timestamptz not null default now()
);

create index if not exists lab_evidence_lab_idx
  on public.lab_evidence (user_lab_id, created_at desc);
create index if not exists lab_evidence_portfolio_idx
  on public.lab_evidence (user_id) where visibility = 'portfolio';

alter table public.lab_evidence enable row level security;

drop policy if exists "le_all_own" on public.lab_evidence;
create policy "le_all_own" on public.lab_evidence
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── User: simulation state (built-in labs) ────────────────────────────────
create table if not exists public.lab_sim_states (
  user_id uuid not null references auth.users (id) on delete cascade,
  lab_slug text not null references public.labs (slug) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, lab_slug)
);

alter table public.lab_sim_states enable row level security;

drop policy if exists "lss_all_own" on public.lab_sim_states;
create policy "lss_all_own" on public.lab_sim_states
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── User: practical journal (free-form notes beyond the tracker row) ──────
create table if not exists public.lab_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  user_lab_id uuid not null references public.user_labs (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 10000),
  created_at timestamptz not null default now()
);

create index if not exists lab_notes_lab_idx
  on public.lab_notes (user_lab_id, created_at desc);

alter table public.lab_notes enable row level security;

drop policy if exists "ln_all_own" on public.lab_notes;
create policy "ln_all_own" on public.lab_notes
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
