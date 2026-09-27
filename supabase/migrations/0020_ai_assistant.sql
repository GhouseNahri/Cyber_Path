-- 0020 — AI assistant tables
--
-- Gives the AI assistant persistent, per-user storage:
--   ai_permissions   one row per user; controls what context the AI may use
--                    and whether history is stored at all
--   ai_conversations named chats (list/rename/delete/clear)
--   ai_messages      the chat transcript itself
--
-- Every table is owner-only via RLS (same style as the rest of the schema).
-- history_enabled=false stops messages being persisted at all.

-- ─── ai_permissions ────────────────────────────────────────────────────────
create table if not exists public.ai_permissions (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  assistant_enabled    boolean not null default true,
  use_roadmap_context  boolean not null default true,
  use_progress_context boolean not null default true,
  use_github_context   boolean not null default false,
  history_enabled      boolean not null default true,
  response_level       text not null default 'beginner'
    check (response_level in ('beginner', 'intermediate', 'advanced')),
  updated_at           timestamptz not null default now()
);

alter table public.ai_permissions enable row level security;

create policy "ai_permissions_owner_only"
  on public.ai_permissions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── ai_conversations ─────────────────────────────────────────────────────
create table if not exists public.ai_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null default 'New chat'
    check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_conversations enable row level security;

create policy "ai_conversations_owner_only"
  on public.ai_conversations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists ai_conversations_user_recent
  on public.ai_conversations (user_id, updated_at desc);

-- ─── ai_messages ──────────────────────────────────────────────────────────
create table if not exists public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  created_at      timestamptz not null default now()
);

alter table public.ai_messages enable row level security;

create policy "ai_messages_owner_only"
  on public.ai_messages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists ai_messages_conversation_order
  on public.ai_messages (conversation_id, created_at);
