-- ==========================================================================
-- Cyber_Path migration 0011 — revision queue (spaced repetition)
--
-- When a user completes a topic, a ladder of spaced reviews is scheduled:
--   review #1 → +intervals[1] days, #2 → +intervals[2], … (default 1,3,7,14,30)
-- Each row is ONE scheduled review (user, topic, review_number). Completing
-- a review inserts the next one at today + intervals[n]. After the final
-- interval, the topic has graduated — no more reviews are created.
--
-- Intervals are per-user configurable via profiles.revision_intervals.
-- Owner-only RLS throughout.
-- ==========================================================================

create table if not exists public.topic_reviews (
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_slug text not null references public.topics (slug) on delete cascade,
  review_number int not null check (review_number between 1 and 6),
  interval_days int not null check (interval_days between 1 and 365),
  due_day_key date not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, topic_slug, review_number)
);

create index if not exists topic_reviews_due_idx
  on public.topic_reviews (user_id, status, due_day_key);

alter table public.topic_reviews enable row level security;

drop policy if exists "tr_select_own" on public.topic_reviews;
create policy "tr_select_own" on public.topic_reviews
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "tr_insert_own" on public.topic_reviews;
create policy "tr_insert_own" on public.topic_reviews
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "tr_update_own" on public.topic_reviews;
create policy "tr_update_own" on public.topic_reviews
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "tr_delete_own" on public.topic_reviews;
create policy "tr_delete_own" on public.topic_reviews
  for delete to authenticated using (auth.uid() = user_id);

-- Per-user configurable schedule. Future scheduling only: existing rows
-- keep their stored interval_days.
alter table public.profiles
  add column if not exists revision_intervals smallint[] not null default '{1,3,7,14,30}';

alter table public.profiles
  add constraint profiles_revision_intervals_len
  check (array_length(revision_intervals, 1) between 1 and 6);
