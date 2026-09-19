-- ==========================================================================
-- Cyber_Path migration 0002 — carry username from signup into profiles
--
-- Why: 0001's handle_new_user() copied only display_name from the signup
-- metadata, so profiles.username started empty for users created by the
-- app. This replaces the function to copy both, and backfills any existing
-- profile rows that are missing a username.
--
-- Paste into: Supabase Dashboard → SQL Editor → New query → Run
-- ==========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', null),
    coalesce(new.raw_user_meta_data ->> 'username', null)
  )
  on conflict (id) do update
    set display_name = coalesce(public.profiles.display_name, excluded.display_name),
        username     = coalesce(public.profiles.username, excluded.username);
  return new;
end;
$$;

-- Backfill profiles created before this fix (leave manually-set usernames alone).
update public.profiles p
set username = (
  select u.raw_user_meta_data ->> 'username'
  from auth.users u
  where u.id = p.id
)
where p.username is null;
