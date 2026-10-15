// Leaderboard writes, minus the Next.js "use server" wrapper so they can be
// unit-tested with a fake Supabase admin client (see actions/arcade.ts).
//
// Signed-in players post under their auth user id (one best row per board per
// player); guests post under a chosen name, and a guest name that a signed-in
// player already uses is refused. Both go through submit_arcade_score_v2 (the
// 2026-10-15 migration). Until that migration is applied the old name-keyed RPC
// and plain-insert fallbacks keep the boards working exactly as before.

export const RESERVED_NAME_ERROR = "That name belongs to a signed-in player.";
export const GENERIC_SAVE_ERROR = "Couldn't save the score — please try again.";

type DbError = { code?: string; message?: string } | null;
type DbResult<T = unknown> = { data?: T | null; error: DbError };
// The slice of the Supabase admin client these helpers touch.
export type AdminLike = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<DbResult>;
  from: (table: string) => { insert: (row: Record<string, unknown>) => PromiseLike<DbResult> };
  auth: { getUser: (jwt: string) => PromiseLike<{ data: { user: { id: string } | null }; error: unknown }> };
};

// The `course` migration may not be applied yet. Postgres reports a missing
// column as 42703, but PostgREST inserts surface it as PGRST204 — check both.
export function isMissingColumn(error: DbError): boolean {
  return error?.code === "42703" || error?.code === "PGRST204";
}
// An RPC that hasn't been created yet: PGRST202 from PostgREST, 42883 from Postgres.
export function isMissingFunction(error: DbError): boolean {
  return error?.code === "PGRST202" || error?.code === "42883";
}

// Names are user-controlled and shown to everyone — strip control characters,
// zero-width / bidi-override tricks, collapse whitespace, clamp length, and mask
// a short blocklist. Keeps the board readable and layout-safe.
const BLOCKLIST = /\b(fuck|shit|cunt|nigger|faggot|bitch|rape|nazi)\b/gi;
export function cleanName(raw: string): string {
  const stripped = (raw ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "") // control chars
    .replace(/[​-‏‪-‮⁠﻿]/g, "") // zero-width / bidi
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16);
  const masked = stripped.replace(BLOCKLIST, (m) => "*".repeat(m.length));
  return masked.trim() || "Anon";
}

// The auth user id behind a Supabase access token, or null if it's missing,
// expired or forged. The admin client verifies the JWT server-side.
export async function userIdFromToken(admin: AdminLike, token: string | null | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

export type WriteResult = { ok: boolean; error?: string; name?: string };

// Write one score (already validated + encoded) to `course`'s board.
// `legacyCourseFallback`: before the per-course migration, only Glendoveer had a
// board (golf boards only; the mini boards never relied on it).
export async function writeScore(
  admin: AdminLike,
  { name, strokes, course, userId }: { name: string; strokes: number; course: string; userId: string | null },
  legacyCourseFallback = false,
): Promise<WriteResult> {
  const clean = cleanName(name);
  const { data, error } = await admin.rpc("submit_arcade_score_v2", { p_name: clean, p_strokes: strokes, p_course: course, p_user_id: userId });
  if (!error) {
    if (data === "name_reserved") return { ok: false, error: RESERVED_NAME_ERROR };
    return { ok: true, name: clean };
  }
  if (!isMissingFunction(error)) {
    console.error("writeScore failed:", error.code, error.message);
    return { ok: false, error: GENERIC_SAVE_ERROR };
  }

  // Pre-migration path: the old name-keyed "keep my best" RPC, then plain inserts.
  let { error: e2 } = await admin.rpc("submit_arcade_score", { p_name: clean, p_strokes: strokes, p_course: course });
  if (isMissingFunction(e2)) {
    ({ error: e2 } = await admin.from("arcade_scores").insert({ name: clean, strokes, course }));
    if (legacyCourseFallback && isMissingColumn(e2)) {
      if (course !== "glendoveer") {
        return { ok: false, error: "This leaderboard isn't set up yet — ask the course owner to run the latest database migration." };
      }
      ({ error: e2 } = await admin.from("arcade_scores").insert({ name: clean, strokes }));
    }
  }
  if (e2) {
    console.error("writeScore (legacy) failed:", e2.code, e2.message);
    return { ok: false, error: GENERIC_SAVE_ERROR };
  }
  return { ok: true, name: clean };
}
