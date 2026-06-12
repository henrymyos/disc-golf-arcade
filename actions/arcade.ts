"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ArcadeScore } from "@/lib/arcade-types";

// Scores are scoped per course: the two fixed courses keep all-time boards,
// and each daily seed gets its own board (so it naturally resets every day).
// The theoretical floor is an ace on every hole (9 holes on the daily).
const MIN_STROKES = 9;
const MAX_STROKES = 250;

function isValidCourse(course: string): boolean {
  return course === "glendoveer" || course === "winthrop" || /^daily-\d{1,7}$/.test(course);
}

// The `course` migration may not be applied yet. Postgres reports a missing
// column as 42703, but PostgREST inserts surface it as PGRST204 — check both.
// Until migrated, the legacy single-board behavior keeps working for Glendoveer.
function isMissingColumn(error: { code?: string } | null): boolean {
  return error?.code === "42703" || error?.code === "PGRST204";
}

// Returns a result object instead of throwing: thrown server-action errors get
// masked in production builds, which turns real problems into cryptic red text.
export async function submitArcadeScore(name: string, strokes: number, course = "glendoveer"): Promise<{ ok: boolean; error?: string }> {
  const s = Math.round(Number(strokes));
  if (!Number.isFinite(s) || s < MIN_STROKES || s > MAX_STROKES) {
    return { ok: false, error: "Invalid score" };
  }
  if (!isValidCourse(course)) return { ok: false, error: "Invalid course" };
  const clean = (name ?? "").trim().slice(0, 16) || "Anon";

  const admin = createAdminClient();
  let { error } = await admin.from("arcade_scores").insert({ name: clean, strokes: s, course });
  if (isMissingColumn(error)) {
    if (course !== "glendoveer") {
      return { ok: false, error: "This leaderboard isn't set up yet — ask the course owner to run the latest database migration." };
    }
    ({ error } = await admin.from("arcade_scores").insert({ name: clean, strokes: s }));
  }
  if (error) {
    console.error("submitArcadeScore failed:", error.code, error.message);
    return { ok: false, error: "Couldn't save the score — please try again." };
  }
  return { ok: true };
}

export async function getArcadeLeaderboard(course = "glendoveer", limit = 15): Promise<ArcadeScore[]> {
  if (!isValidCourse(course)) return [];
  const admin = createAdminClient();
  let { data, error } = await admin
    .from("arcade_scores")
    .select("name, strokes, created_at")
    .eq("course", course)
    .order("strokes", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (isMissingColumn(error)) {
    if (course !== "glendoveer") return [];
    ({ data, error } = await admin
      .from("arcade_scores")
      .select("name, strokes, created_at")
      .order("strokes", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(limit));
  }
  if (error) {
    console.error("getArcadeLeaderboard failed:", error.code, error.message);
    return [];
  }
  return (data ?? []) as ArcadeScore[];
}
