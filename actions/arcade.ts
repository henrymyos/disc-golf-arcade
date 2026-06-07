"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ArcadeScore } from "@/lib/arcade-types";

// 9 holes, so the theoretical floor is 9 (an ace on every hole) and anything
// past ~200 is junk. Names are clamped to keep the board tidy.
const MIN_STROKES = 9;
const MAX_STROKES = 200;

export async function submitArcadeScore(name: string, strokes: number): Promise<{ ok: true }> {
  const s = Math.round(Number(strokes));
  if (!Number.isFinite(s) || s < MIN_STROKES || s > MAX_STROKES) {
    throw new Error("Invalid score");
  }
  const clean = (name ?? "").trim().slice(0, 16) || "Anon";

  const admin = createAdminClient();
  const { error } = await admin.from("arcade_scores").insert({ name: clean, strokes: s });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getArcadeLeaderboard(limit = 15): Promise<ArcadeScore[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("arcade_scores")
    .select("name, strokes, created_at")
    .order("strokes", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ArcadeScore[];
}
