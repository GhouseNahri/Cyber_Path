-- ==========================================================================
-- Cyber_Path migration 0012 — user_topic_progress DELETE policy
--
-- Bug fix: the "Reset progress" action deletes the progress row, but no
-- DELETE policy existed on user_topic_progress, so the delete silently
-- matched zero rows under RLS (topic_reviews cleanup still ran, leaving
-- inconsistent state). Reset is an explicit user feature → owner delete.
-- ==========================================================================

drop policy if exists "utp_delete_own" on public.user_topic_progress;
create policy "utp_delete_own" on public.user_topic_progress
  for delete to authenticated using (auth.uid() = user_id);
