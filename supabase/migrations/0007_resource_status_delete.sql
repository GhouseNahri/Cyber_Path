-- ==========================================================================
-- Cyber_Path migration 0007 — allow clearing resource status
--
-- 0003 gave user_resource_status select/insert/update policies but no
-- delete path, so "clear my status" had nowhere to land. This adds the
-- owner-only delete policy.
--
-- Paste into: Supabase Dashboard -> SQL Editor -> New query -> Run
-- (or apply via the Supabase connector, as done in Phase 5.)
-- ==========================================================================

drop policy if exists "urs_delete_own" on public.user_resource_status;
create policy "urs_delete_own" on public.user_resource_status
  for delete to authenticated using (auth.uid() = user_id);
