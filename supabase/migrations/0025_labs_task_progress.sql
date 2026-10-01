-- ===========================================================================
-- Cyber_Path migration 0025 — labs task progress on the tracker row
--
-- Task checklists need live, mutable progress storage (attempts are
-- immutable snapshots taken at completion). tasks_done holds the indexes
-- of checked lab_tasks on the user's user_labs row.
-- ===========================================================================

alter table public.user_labs
  add column if not exists tasks_done jsonb not null default '[]'::jsonb;
