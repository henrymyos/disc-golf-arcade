"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ArcadeScore } from "@/lib/arcade-types";
import { isValidCourse } from "@/lib/boards";
import { writeScore, userIdFromToken, isMissingColumn, type AdminLike } from "@/lib/leaderboard/server-core";
import { loadProTour, proTourCourseBySeed } from "@/lib/discgolf/engine";
import { weeklyStop, weekOpenForPosts, weeklyCardError } from "@/lib/discgolf/weekly";

// Scores are scoped per course: the fixed courses keep all-time boards,
// and each daily seed gets its own board (so it naturally resets every day).
// The theoretical floor is an ace on every hole (9 holes on the daily).
const MIN_STROKES = 9;
const MAX_STROKES = 250;


// Best-effort in-memory rate limit. Fluid Compute reuses warm instances, so a
// per-instance sliding window meaningfully throttles a single flooder even
// though it isn't globally authoritative. The DB upsert (one row per name)
// bounds the damage regardless.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const hits = new Map<string, number[]>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  }
  return false;
}

async function clientKey(): Promise<string> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for") ?? "";
    return fwd.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  } catch {
    return "unknown";
  }
}

// Returns a result object instead of throwing: thrown server-action errors get
// masked in production builds, which turns real problems into cryptic red text.
// `accessToken`: a signed-in player's Supabase session token. When present and
// valid, the score is keyed by their user id; without it the post is a guest
// post under `name` (refused if a signed-in player owns that name).
export async function submitArcadeScore(name: string, strokes: number, course = "glendoveer", accessToken?: string | null): Promise<{ ok: boolean; error?: string; name?: string }> {
  const s = Math.round(Number(strokes));
  if (!Number.isFinite(s) || s < MIN_STROKES || s > MAX_STROKES) {
    return { ok: false, error: "Invalid score" };
  }
  if (!isValidCourse(course)) return { ok: false, error: "Invalid course" };
  if (rateLimited(await clientKey())) {
    return { ok: false, error: "You're saving scores too fast — give it a minute." };
  }
  const admin = createAdminClient() as unknown as AdminLike;
  const userId = await userIdFromToken(admin, accessToken);
  if (accessToken && !userId) return { ok: false, error: "Your sign-in expired — sign in again to post this score." };
  return writeScore(admin, { name, strokes: s, course, userId }, true);
}

// ── Practice mini-game boards (Putting / Accuracy). These are HIGHER-is-better
// (most putts made; most accuracy points), so — exactly like the ranked board —
// we encode the score into the shared "lower is better" board as `MINI_BASE -
// score` and reuse the same keep-your-best RPC + table. No schema change: the
// board key ("putt" / "target") just lives in the existing `course` column. ──
const MINI_BASE = 100_000;
const MINI_MAX = 2000; // sanity cap (real runs: putts ~0–40, accuracy 0–1000)
function isMiniBoard(kind: string): kind is "putt" | "target" {
  return kind === "putt" || kind === "target";
}

export async function submitMiniScore(name: string, score: number, kind: string, accessToken?: string | null): Promise<{ ok: boolean; error?: string; name?: string }> {
  const v = Math.round(Number(score));
  if (!Number.isFinite(v) || v < 0 || v > MINI_MAX) return { ok: false, error: "Invalid score" };
  if (!isMiniBoard(kind)) return { ok: false, error: "Invalid board" };
  if (rateLimited(await clientKey())) {
    return { ok: false, error: "You're saving scores too fast — give it a minute." };
  }
  const admin = createAdminClient() as unknown as AdminLike;
  const userId = await userIdFromToken(admin, accessToken);
  if (accessToken && !userId) return { ok: false, error: "Your sign-in expired — sign in again to post this score." };
  // Same atomic "keep my best" upsert as the golf boards — `least()` on the
  // encoded value keeps the player's HIGHEST score.
  return writeScore(admin, { name, strokes: MINI_BASE - v, course: kind, userId });
}

export async function getMiniLeaderboard(kind: string, limit = 15): Promise<ArcadeScore[]> {
  if (!isMiniBoard(kind)) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("arcade_scores")
    .select("name, strokes, created_at")
    .eq("course", kind)
    .order("strokes", { ascending: true }) // lowest encoded first = highest score first
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("getMiniLeaderboard failed:", error.code, error.message);
    return [];
  }
  // Decode each row back to the real (higher-is-better) score for display.
  return (data ?? []).map((r) => ({ ...r, strokes: MINI_BASE - r.strokes })) as ArcadeScore[];
}

// Weekly Tour Stop (lib/discgolf/weekly). The client sends the per-hole card,
// not a total: the server picks the week's course itself, checks the week is
// still open and the card is plausible for that course's pars, then posts the
// total to that week's board (one best row per player, like every board).
export async function submitWeeklyScore(name: string, week: number, scores: number[], accessToken?: string | null): Promise<{ ok: boolean; error?: string; name?: string }> {
  if (!Number.isInteger(week) || !weekOpenForPosts(week, Date.now())) return { ok: false, error: "This week's Tour Stop has closed." };
  const stop = weeklyStop(week);
  await loadProTour();
  const pars = proTourCourseBySeed(stop.seed)?.proHoles.map((h) => h.par);
  if (!pars || weeklyCardError(scores, pars)) return { ok: false, error: "Invalid score" };
  if (rateLimited(await clientKey())) {
    return { ok: false, error: "You're saving scores too fast — give it a minute." };
  }
  const admin = createAdminClient() as unknown as AdminLike;
  const userId = await userIdFromToken(admin, accessToken);
  if (accessToken && !userId) return { ok: false, error: "Your sign-in expired — sign in again to post this score." };
  return writeScore(admin, { name, strokes: scores.reduce((a, b) => a + b, 0), course: stop.key, userId });
}

export async function getWeeklyLeaderboard(week: number, limit = 10): Promise<ArcadeScore[]> {
  if (!Number.isInteger(week) || week < 0 || week > 1e6) return [];
  return readBoard(weeklyStop(week).key, Math.min(limit, 25));
}

async function readBoard(course: string, limit: number): Promise<ArcadeScore[]> {
  const { data, error } = await createAdminClient()
    .from("arcade_scores")
    .select("name, strokes, created_at")
    .eq("course", course)
    .order("strokes", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("readBoard failed:", error.code, error.message);
    return [];
  }
  return (data ?? []) as ArcadeScore[];
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
