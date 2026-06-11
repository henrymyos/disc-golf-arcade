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

// `42703` = undefined column: the `course` migration hasn't been applied yet.
// Until it is, the legacy single-board behavior keeps working for Glendoveer.
function isMissingColumn(error: { code?: string } | null): boolean {
  return error?.code === "42703";
}

export async function submitArcadeScore(name: string, strokes: number, course = "glendoveer"): Promise<{ ok: true }> {
  const s = Math.round(Number(strokes));
  if (!Number.isFinite(s) || s < MIN_STROKES || s > MAX_STROKES) {
    throw new Error("Invalid score");
  }
  if (!isValidCourse(course)) throw new Error("Invalid course");
  const clean = (name ?? "").trim().slice(0, 16) || "Anon";

  const admin = createAdminClient();
  let { error } = await admin.from("arcade_scores").insert({ name: clean, strokes: s, course });
  if (isMissingColumn(error)) {
    if (course !== "glendoveer") throw new Error("This course's leaderboard isn't set up yet");
    ({ error } = await admin.from("arcade_scores").insert({ name: clean, strokes: s }));
  }
  if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
  return (data ?? []) as ArcadeScore[];
}
