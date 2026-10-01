-- ===========================================================================
-- Cyber_Path migration 0028 — labs on the public portfolio (L5)
--
-- Extends get_public_portfolio with two whitelisted projections:
--
--   labs_completed: completed lab titles (catalog or custom), type and
--   completion date. Shown whenever the portfolio is public — the same bar
--   as finished projects (completion is server-validated, never self-claim).
--
--   lab_evidence: ONLY rows the owner explicitly set visibility='portfolio'
--   (per-row opt-in; private rows are structurally excluded). Returns the
--   title/body plus the skill names the evidence accepted, resolved through
--   lab_skills → skills. No notes, no reflections, no attempt history —
--   those stay private forever.
--
-- The function return type changes, so it is dropped and recreated.
-- ===========================================================================

drop function if exists public.get_public_portfolio(text);

create or replace function public.get_public_portfolio(p_username text)
returns table (
  display_name text,
  github_login text,
  experience_level text,
  finished_projects jsonb,
  selected_paths jsonb,
  skill_evidence jsonb,
  labs_completed jsonb,
  lab_evidence jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.display_name,
    gh.github_login,
    p.experience_level,
    -- Finished projects: title, status and public repo URL only.
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', up.title,
        'status', up.status,
        'github_url', up.github_url,
        'demo_url', up.demo_url,
        'completed_at', up.completed_at
      ) order by up.completed_at desc nulls last)
      from public.user_projects up
      where up.user_id = p.id
        and up.status in ('completed', 'published')
    ), '[]'::jsonb) as finished_projects,
    -- Selected career paths: names only.
    coalesce((
      select jsonb_agg(jsonb_build_object('name', cp.name) order by cp.order_index)
      from public.user_career_paths ucp
      join public.career_paths cp on cp.slug = ucp.path_slug
      where ucp.user_id = p.id
    ), '[]'::jsonb) as selected_paths,
    -- Skill evidence: name + level for skills with real progress.
    coalesce((
      select jsonb_agg(jsonb_build_object('name', sk.name, 'level', lvl.level) order by sk.name)
      from (
        select ts.skill_slug,
               case
                 when count(tp.topic_slug) = 0 then 'learning'
                 when count(distinct tp.topic_slug) >= 3
                      and bool_or(coalesce((tp.stages->>'practice')::boolean, false)) then 'competent'
                 else 'practicing'
               end as level
        from public.topic_skills ts
        join public.user_topic_progress tp
          on tp.topic_slug = ts.topic_slug and tp.user_id = p.id
        group by ts.skill_slug
      ) lvl
      join public.skills sk on sk.slug = lvl.skill_slug
    ), '[]'::jsonb) as skill_evidence,
    -- Completed labs (L5): title + type + when. Completion was validated
    -- server-side; nothing here depends on the user's word alone.
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', ul.title,
        'lab_type', ul.lab_type,
        'completed_at', ul.completed_at
      ) order by ul.completed_at desc nulls last)
      from public.user_labs ul
      where ul.user_id = p.id
        and ul.status = 'completed'
        and coalesce(ul.title, '') <> ''
    ), '[]'::jsonb) as labs_completed,
    -- Shared evidence (L5): only rows the owner explicitly made public.
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', le.title,
        'body', le.body,
        'skills', ev.skills
      ) order by le.created_at desc nulls last)
      from public.lab_evidence le
      left join lateral (
        select coalesce(jsonb_agg(jsonb_build_object('name', sk.name) order by sk.name), '[]'::jsonb) as skills
        from unnest(le.accepted_skills) as s(skill_slug)
        join public.skills sk on sk.slug = s.skill_slug
      ) ev on true
      where le.user_id = p.id
        and le.visibility = 'portfolio'
    ), '[]'::jsonb) as lab_evidence
  from public.profiles p
  left join public.github_connections gh on gh.user_id = p.id
  where p.username = p_username
    and p.portfolio_public = true;
$$;

-- Anon must be able to call it; the function itself whitelists everything.
grant execute on function public.get_public_portfolio(text) to anon, authenticated;
