import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser (anon) Supabase client, used for optional player login + progress
// sync. Returns null when the public env vars aren't configured, so the game
// runs fine (local-only) without auth.
let cached: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  cached = url && key
    ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
    : null;
  return cached;
}
