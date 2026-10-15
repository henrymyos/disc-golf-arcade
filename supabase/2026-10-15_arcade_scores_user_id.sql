-- Migration (2026-10-15): honest leaderboards.
--
-- Henry applies this by hand in the Supabase SQL editor (project
-- disc-golf-arcade), then deploys. It is safe to apply BEFORE deploying: the old
-- submit_arcade_score() RPC is redefined below to keep working against the new
-- indexes, so the live site never breaks in between.
--
-- What changes:
--  * arcade_scores.user_id (nullable). Signed-in players' rows are keyed by
--    (course, user_id); guest rows stay keyed by (course, name).
--  * A guest can't post under a name that a signed-in player already uses
--    (case-insensitive, on any board). Existing guest rows are left alone.
--  * submit_arcade_score_v2() does both atomically and returns 'ok' or
--    'name_reserved'. Like the old RPC it is SECURITY DEFINER and only the
--    service role (the server action) may call it.

begin;

-- 1. The owner column. Deleting an auth user deletes their scores (cascade):
--    SET NULL would turn them into guest rows that could collide on (course, name).
alter table public.arcade_scores
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

-- Foreign keys aren't indexed automatically; this keeps the cascade cheap.
create index if not exists arcade_scores_user_id_idx
  on public.arcade_scores (user_id) where user_id is not null;

-- 2. One best row per signed-in player per board.
create unique index if not exists arcade_scores_course_user_key
  on public.arcade_scores (course, user_id) where user_id is not null;

-- 3. One best row per guest name per board (was: per name, for everyone).
create unique index if not exists arcade_scores_course_guest_name_key
  on public.arcade_scores (course, name) where user_id is null;
drop index if exists public.arcade_scores_course_name_key;

-- 4. Fast "is this name owned by a signed-in player?" lookups.
create index if not exists arcade_scores_owned_name_idx
  on public.arcade_scores (lower(name)) where user_id is not null;

-- 5. The new submit RPC. Keeps each player's best (lowest) score per board.
create or replace function public.submit_arcade_score_v2(
  p_name text,
  p_strokes int,
  p_course text,
  p_user_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is not null then
    insert into public.arcade_scores (name, strokes, course, user_id)
    values (p_name, p_strokes, p_course, p_user_id)
    on conflict (course, user_id) where user_id is not null do update
      set strokes = least(public.arcade_scores.strokes, excluded.strokes),
          name = excluded.name, -- follow the player's current profile name
          created_at = case
            when excluded.strokes < public.arcade_scores.strokes then now()
            else public.arcade_scores.created_at
          end;
    return 'ok';
  end if;

  -- Guest: refuse a name a signed-in player already uses.
  if exists (
    select 1 from public.arcade_scores
    where user_id is not null and lower(name) = lower(p_name)
  ) then
    return 'name_reserved';
  end if;

  insert into public.arcade_scores (name, strokes, course)
  values (p_name, p_strokes, p_course)
  on conflict (course, name) where user_id is null do update
    set strokes = least(public.arcade_scores.strokes, excluded.strokes),
        created_at = case
          when excluded.strokes < public.arcade_scores.strokes then now()
          else public.arcade_scores.created_at
        end;
  return 'ok';
end;
$$;

-- 6. The old RPC (used by the currently deployed site) now goes through the
--    guest path, so it matches the new partial index and respects reserved names.
create or replace function public.submit_arcade_score(p_name text, p_strokes int, p_course text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.submit_arcade_score_v2(p_name, p_strokes, p_course, null);
end;
$$;

-- 7. Only the server (service role) may call either function.
revoke all on function public.submit_arcade_score_v2(text, int, text, uuid) from public, anon, authenticated;
grant execute on function public.submit_arcade_score_v2(text, int, text, uuid) to service_role;
revoke all on function public.submit_arcade_score(text, int, text) from public, anon, authenticated;
grant execute on function public.submit_arcade_score(text, int, text) to service_role;

commit;

-- Optional, later: guest rows posted before this migration under a name that a
-- signed-in player now uses still show on the boards. To list them:
--   select g.course, g.name, g.strokes from public.arcade_scores g
--   where g.user_id is null and exists (
--     select 1 from public.arcade_scores u
--     where u.user_id is not null and lower(u.name) = lower(g.name));
