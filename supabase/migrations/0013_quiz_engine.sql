-- ==========================================================================
-- Cyber_Path migration 0013 — quiz engine (per-topic knowledge checks)
--
-- quiz_questions: seeded content (like topics/resources) — readable by any
--   authenticated user, writable only via migrations. The correct answer
--   NEVER goes to the client: pages render questions + choices only, and
--   scoring happens server-side in the submit action.
-- quiz_attempts: one row per finished attempt. Owner-only RLS. Stores the
--   user's chosen choice ids for review, but scoring always re-runs against
--   the live question table, so a tampered client cannot fabricate a pass.
--
-- Pass rule: round(correct/count * 100) >= 70 (see src/lib/quiz/engine.ts).
-- Attempts are immutable: select + insert policies only.
-- ==========================================================================

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  topic_slug text not null references public.topics (slug) on delete cascade,
  position int not null check (position between 1 and 10),
  kind text not null check (kind in ('mcq', 'tf', 'scenario')),
  question text not null check (char_length(question) between 8 and 500),
  choices jsonb not null,
  answer_index int not null check (answer_index >= 0),
  explanation text not null check (char_length(explanation) between 8 and 1000),
  unique (topic_slug, position)
);

create index if not exists quiz_questions_topic_idx
  on public.quiz_questions (topic_slug, position);

alter table public.quiz_questions enable row level security;

drop policy if exists "qq_read_authenticated" on public.quiz_questions;
create policy "qq_read_authenticated" on public.quiz_questions
  for select to authenticated using (true);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_slug text not null references public.topics (slug) on delete cascade,
  attempt_number int not null check (attempt_number between 1 and 999),
  score_pct int not null check (score_pct between 0 and 100),
  passed boolean not null,
  answers jsonb not null,
  completed_at timestamptz not null default now(),
  unique (user_id, topic_slug, attempt_number)
);

create index if not exists quiz_attempts_user_idx
  on public.quiz_attempts (user_id, topic_slug, completed_at desc);

alter table public.quiz_attempts enable row level security;

drop policy if exists "qa_select_own" on public.quiz_attempts;
create policy "qa_select_own" on public.quiz_attempts
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "qa_insert_own" on public.quiz_attempts;
create policy "qa_insert_own" on public.quiz_attempts
  for insert to authenticated with check (auth.uid() = user_id);
