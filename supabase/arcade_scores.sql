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
