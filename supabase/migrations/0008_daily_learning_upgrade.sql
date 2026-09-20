-- ==========================================================================
-- Cyber_Path migration 0008 — daily learning system upgrade
--
-- daily_tasks:
--   status becomes a real state machine:
--     not_started -> in_progress -> completed | skipped | cancelled
--   plus: actual_minutes, difficulty (1-5), per-task notes, skip reason,
--   started/completed/skipped timestamps, optional resource link.
--
-- study_sessions:
--   explicit status (active/paused/completed/abandoned), paused_seconds
--   and last_resumed_at so elapsed time is always wall-clock minus pause,
--   computed server-side.
--
-- Owner-only RLS is inherited from 0006. Idempotent-safe column adds; the
-- constraint drop must precede the data migration (old checks would
-- reject the new status values during the update).
-- ==========================================================================

-- 1. Drop OLD constraints BEFORE migrating values.
alter table public.daily_tasks drop constraint if exists daily_tasks_status_check;
alter table public.daily_tasks drop constraint if exists daily_tasks_kind_check;

-- 2. Migrate legacy status values.
update public.daily_tasks
set status = case status
  when 'pending' then 'not_started'
  when 'done' then 'completed'
  when 'skipped' then 'skipped'
  else status
end
where status in ('pending', 'done', 'skipped');

-- 3. Re-add the state-machine constraints.
alter table public.daily_tasks alter column status set default 'not_started';
alter table public.daily_tasks
  add constraint daily_tasks_status_check
    check (status in ('not_started', 'in_progress', 'completed', 'skipped', 'cancelled'));
alter table public.daily_tasks
  add constraint daily_tasks_kind_check
    check (kind in ('learn', 'practice', 'test', 'build', 'review'));

-- 4. New task columns.
alter table public.daily_tasks add column if not exists actual_minutes int;
alter table public.daily_tasks add column if not exists difficulty smallint;
alter table public.daily_tasks add column if not exists task_notes text;
alter table public.daily_tasks add column if not exists skip_reason_category text;
alter table public.daily_tasks add column if not exists skip_reason_text text;
alter table public.daily_tasks add column if not exists started_at timestamptz;
alter table public.daily_tasks add column if not exists completed_at timestamptz;
alter table public.daily_tasks add column if not exists skipped_at timestamptz;
alter table public.daily_tasks add column if not exists resource_id uuid
  references public.resources (id) on delete set null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'daily_tasks_difficulty_check') then
    alter table public.daily_tasks
      add constraint daily_tasks_difficulty_check check (difficulty between 1 and 5);
  end if;
end $$;

create index if not exists daily_tasks_session_idx on public.daily_tasks (user_id, started_at);

-- 5. Session-level state machine + pause accounting.
alter table public.study_sessions add column if not exists status text not null default 'active';
alter table public.study_sessions add column if not exists paused_seconds int not null default 0;
alter table public.study_sessions add column if not exists last_resumed_at timestamptz;

update public.study_sessions
set status = case when ended_at is null then 'abandoned' else 'completed' end,
    last_resumed_at = started_at
where status = 'active' and ended_at is not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'study_sessions_status_check') then
    alter table public.study_sessions
      add constraint study_sessions_status_check
        check (status in ('active', 'paused', 'completed', 'abandoned'));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'study_sessions_paused_check') then
    alter table public.study_sessions
      add constraint study_sessions_paused_check check (paused_seconds >= 0);
  end if;
end $$;
