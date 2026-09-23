"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { validateReplay, replayId, isReplayId, type Replay } from "@/lib/discgolf/replay";

// Shared round replays live as JSON files in a private Storage bucket; the
// public /play page reads and writes them only through these actions (the
// service-role client), like the leaderboard.
const BUCKET = "arcade-replays";
const MAX_BYTES = 256 * 1024;

export async function saveReplay(input: unknown): Promise<{ id: string } | { error: string }> {
  const replay = validateReplay(input);
  if (!replay) return { error: "That replay couldn't be read." };
  const body = JSON.stringify(replay);
  if (body.length > MAX_BYTES) return { error: "Replay is too large to share." };
  const supa = createAdminClient();
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = replayId();
    const { error } = await supa.storage.from(BUCKET).upload(`${id}.json`, body, { contentType: "application/json", upsert: false });
    if (!error) return { id };
    if (!/exists|duplicate/i.test(error.message)) return { error: "Couldn't save the replay — try again." };
  }
  return { error: "Couldn't save the replay — try again." };
}

export async function loadReplay(id: string): Promise<Replay | null> {
  if (!isReplayId(id)) return null;
  const { data, error } = await createAdminClient().storage.from(BUCKET).download(`${id}.json`);
  if (error || !data) return null;
  try { return validateReplay(JSON.parse(await data.text())); } catch { return null; }
}
