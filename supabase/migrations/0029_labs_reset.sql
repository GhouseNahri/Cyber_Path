-- ===========================================================================
-- Cyber_Path migration 0029 — labs join reset_progress (L5 follow-up)
--
-- The labs system (0022–0028) shipped after reset_progress (0019), so a
-- "full" reset silently left lab completions, attempts, evidence and
-- simulation state behind — skills, analytics and the public portfolio kept
-- showing lab credit for a supposedly fresh start.
--
-- This migration folds labs into the SAME atomic reset:
--   user_labs       tracker rows. Deleting them cascades to lab_attempts,
--                   lab_evidence and lab_notes (all FK ON DELETE CASCADE),
--                   which is exactly right: attempt history, evidence and
--                   journal entries are meaningless without their tracker row.
--   lab_sim_states  persisted simulation positions (composite key, no FK to
--                   user_labs — deleted explicitly).
--
-- Always reset, not optional: a reset must mean a truly fresh start, and a
-- half-fresh state would still credit skills/analytics/portfolio.
--
-- Never touched: auth.users, profiles, onboarding state, github_connections,
-- and all global content (labs, lab_categories, lab_topics, lab_skills,
-- lab_tasks and their seeds are shared by everyone).
--
-- Security unchanged: the target is ALWAYS auth.uid(); anon stays revoked;
-- authenticated callers can only ever delete their own rows.
-- ===========================================================================

create or replace function public.reset_progress(
  p_reset_projects  boolean default false,
  p_reset_notes     boolean default false,
  p_reset_bookmarks boolean default false,
  p_reset_resources boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_deleted jsonb;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  -- One atomic statement block: either everything is removed or nothing is.
  with
    d_progress  as (delete from public.user_topic_progress    where user_id = v_uid returning 1),
    d_tasks     as (delete from public.daily_tasks            where user_id = v_uid returning 1),
    d_sessions  as (delete from public.study_sessions         where user_id = v_uid returning 1),
    d_missed    as (delete from public.missed_days            where user_id = v_uid returning 1),
    d_quiz      as (delete from public.quiz_attempts          where user_id = v_uid returning 1),
    d_reviews   as (delete from public.topic_reviews          where user_id = v_uid returning 1),
    d_labs      as (delete from public.user_labs              where user_id = v_uid returning 1),
    d_sims      as (delete from public.lab_sim_states         where user_id = v_uid returning 1),
    d_projects  as (delete from public.user_projects          where user_id = v_uid and p_reset_projects  returning 1),
    d_notes     as (delete from public.topic_notes            where user_id = v_uid and p_reset_notes     returning 1),
    d_marks     as (delete from public.user_topic_bookmarks   where user_id = v_uid and p_reset_bookmarks returning 1),
    d_resources as (delete from public.user_resource_status   where user_id = v_uid and p_reset_resources returning 1)
  select jsonb_build_object(
    'topic_progress', (select count(*) from d_progress),
    'daily_tasks',    (select count(*) from d_tasks),
    'study_sessions', (select count(*) from d_sessions),
    'missed_days',    (select count(*) from d_missed),
    'quiz_attempts',  (select count(*) from d_quiz),
    'topic_reviews',  (select count(*) from d_reviews),
    'labs',           (select count(*) from d_labs),
    'lab_sim_states', (select count(*) from d_sims),
    'projects',       (select count(*) from d_projects),
    'notes',          (select count(*) from d_notes),
    'bookmarks',      (select count(*) from d_marks),
    'resource_status',(select count(*) from d_resources)
  ) into v_deleted;

  return v_deleted;
end;
$$;

revoke execute on function public.reset_progress(boolean, boolean, boolean, boolean) from public;
revoke execute on function public.reset_progress(boolean, boolean, boolean, boolean) from anon;
grant execute on function public.reset_progress(boolean, boolean, boolean, boolean) to authenticated;
