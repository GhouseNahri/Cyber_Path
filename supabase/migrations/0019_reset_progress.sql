-- 0019 — Reset learning progress
--
-- Adds reset_progress(...): a SECURITY DEFINER function that clears the
-- signed-in user's LEARNING PROGRESS atomically, while preserving their
-- account, profile/onboarding, authentication and all global content.
--
-- Scope (always reset — core learning progress):
--   user_topic_progress   topic status/stages/confidence/completion
--   daily_tasks           today's + historical generated tasks
--   study_sessions        session history (streaks are DERIVED from these)
--   missed_days           missed-day reports + reasons
--   quiz_attempts         quiz history (weak-topic detection input)
--   topic_reviews         spaced-repetition queue (backfills on next visit)
--
-- Opt-in flags (personal-knowledge / portfolio items, default preserve):
--   p_reset_projects      user_projects (tracker rows; NOT any GitHub repo)
--   p_reset_notes         topic_notes (your written notes)
--   p_reset_bookmarks     user_topic_bookmarks
--   p_reset_resources     user_resource_status (saved/done/skip marks)
--
-- Never touched: auth.users, profiles, onboarding state, github_connections,
-- roadmap_phases/topics/skills/resources/project_ideas/career_paths (global
-- content shared by all users).
--
-- Security: the target is ALWAYS auth.uid() — never a client-supplied id.
-- Anon is revoked; authenticated callers can only ever reset their own rows
-- (every delete filters user_id = auth.uid()).

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
