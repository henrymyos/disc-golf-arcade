-- Leaderboard for the pixel disc-golf arcade game (app/play). The /play route
-- is public (no auth), so writes/reads go through server actions using the
-- service-role admin client; RLS stays on with no public policies.
create table if not exists public.arcade_scores (
  id bigint generated always as identity primary key,
  name text not null,
  strokes integer not null,
  created_at timestamptz not null default now()
);
alter table public.arcade_scores enable row level security;
create index if not exists arcade_scores_strokes_idx on public.arcade_scores (strokes asc, created_at asc);

-- Migration (2026-06-11): per-course + daily leaderboards. Existing rows are
-- Glendoveer scores; daily boards use course values like 'daily-20603'.
alter table public.arcade_scores add column if not exists course text not null default 'glendoveer';
create index if not exists arcade_scores_course_idx on public.arcade_scores (course, strokes asc, created_at asc);

-- Migration (2026-06-13): keep ONE best row per (course, name) so the board
-- can't be flooded with duplicate entries. First collapse existing duplicates
-- (keep the lowest strokes; ties keep the earliest id), then enforce it with a
-- unique index and an atomic upsert function the server action calls.
delete from public.arcade_scores a
using public.arcade_scores b
where a.course = b.course
  and a.name = b.name
  and (a.strokes > b.strokes or (a.strokes = b.strokes and a.id > b.id));
create unique index if not exists arcade_scores_course_name_key
  on public.arcade_scores (course, name);

-- Upsert that only ever lowers a player's score for a course. SECURITY DEFINER
-- so it runs with the table owner's rights (RLS has no public policies).
create or replace function public.submit_arcade_score(p_name text, p_strokes int, p_course text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.arcade_scores (name, strokes, course)
  values (p_name, p_strokes, p_course)
  on conflict (course, name) do update
    set strokes = least(public.arcade_scores.strokes, excluded.strokes),
        created_at = case
          when excluded.strokes < public.arcade_scores.strokes then now()
          else public.arcade_scores.created_at
        end;
end;
$$;
