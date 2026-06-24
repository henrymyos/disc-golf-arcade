-- Per-user cloud save for the disc-golf arcade. One row per signed-in user,
-- guarded by RLS so each user can only read/write their OWN row. Stored here
-- (not in auth user_metadata) so the progress blob never bloats the session JWT
-- — large metadata can push request headers past hosting limits (494 errors).
create table if not exists public.arcade_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.arcade_progress enable row level security;

-- Own-row-only policies (the browser uses the anon/auth client). The app upserts,
-- so it needs SELECT + INSERT + UPDATE — all scoped to auth.uid() = user_id.
drop policy if exists "arcade_progress_select_own" on public.arcade_progress;
create policy "arcade_progress_select_own" on public.arcade_progress
  for select using (auth.uid() = user_id);

drop policy if exists "arcade_progress_insert_own" on public.arcade_progress;
create policy "arcade_progress_insert_own" on public.arcade_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "arcade_progress_update_own" on public.arcade_progress;
create policy "arcade_progress_update_own" on public.arcade_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
