-- ===========================================================================
-- Cyber_Path migration 0018 — GitHub integration + public portfolio
--
-- github_connections: one row per user. Stores the GitHub identity plus the
--   OAuth access token obtained through Supabase's GitHub provider. The
--   token is server-side only: RLS limits rows to their owner and the API
--   layer never renders it. Public-data scope only (read:user).
--
-- profiles.portfolio_public: explicit opt-in for the shareable portfolio
--   page. Default false — nothing is public until the user says so.
--
-- get_public_portfolio(username): security-definer function that returns ONLY
--   whitelisted, non-sensitive data for a user whose portfolio_public is
--   true. Exposed to anon via execute grant; RLS is bypassed by design but
--   the function itself is the boundary — it selects explicit columns only
--   and never returns tokens, emails or private progress.
-- ===========================================================================

create table if not exists public.github_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  github_id bigint not null,
  github_login text not null,
  access_token text not null,
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz
);

alter table public.github_connections enable row level security;

drop policy if exists "ghc_all_own" on public.github_connections;
create policy "ghc_all_own" on public.github_connections
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Portfolio visibility flag.
alter table public.profiles add column if not exists portfolio_public boolean not null default false;

-- ── Public portfolio: whitelisted projection only ─────────────────────────

create or replace function public.get_public_portfolio(p_username text)
returns table (
  display_name text,
  github_login text,
  experience_level text,
  finished_projects jsonb,
  selected_paths jsonb,
  skill_evidence jsonb
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
    ), '[]'::jsonb) as skill_evidence
  from public.profiles p
  left join public.github_connections gh on gh.user_id = p.id
  where p.username = p_username
    and p.portfolio_public = true;
$$;

-- Anon must be able to call it; the function itself whitelists everything.
grant execute on function public.get_public_portfolio(text) to anon, authenticated;

revoke all on public.github_connections from anon;
