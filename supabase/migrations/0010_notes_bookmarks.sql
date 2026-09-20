-- ==========================================================================
-- Cyber_Path migration 0010 — topic notes + topic bookmarks
--
-- Personal knowledge capture: one editable journal-style note per (user,
-- topic), and a lightweight save-for-later bookmark per (user, topic).
-- Both owner-only under RLS. Resource-level saving already exists in
-- user_resource_status; this covers topics.
-- ==========================================================================

create table if not exists public.topic_notes (
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_slug text not null references public.topics (slug) on delete cascade,
  body text not null default '' check (char_length(body) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_slug)
);

create index if not exists topic_notes_user_idx on public.topic_notes (user_id, updated_at desc);

alter table public.topic_notes enable row level security;

drop policy if exists "tn_select_own" on public.topic_notes;
create policy "tn_select_own" on public.topic_notes
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "tn_insert_own" on public.topic_notes;
create policy "tn_insert_own" on public.topic_notes
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "tn_update_own" on public.topic_notes;
create policy "tn_update_own" on public.topic_notes
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.user_topic_bookmarks (
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_slug text not null references public.topics (slug) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, topic_slug)
);

create index if not exists user_topic_bookmarks_user_idx on public.user_topic_bookmarks (user_id, created_at desc);

alter table public.user_topic_bookmarks enable row level security;

drop policy if exists "utb_select_own" on public.user_topic_bookmarks;
create policy "utb_select_own" on public.user_topic_bookmarks
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "utb_insert_own" on public.user_topic_bookmarks;
create policy "utb_insert_own" on public.user_topic_bookmarks
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "utb_delete_own" on public.user_topic_bookmarks;
create policy "utb_delete_own" on public.user_topic_bookmarks
  for delete to authenticated using (auth.uid() = user_id);
