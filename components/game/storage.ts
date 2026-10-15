import type { Mode } from "@/lib/discgolf/engine";

// ── Resume an interrupted round. A plain solo round (not practice / party /
// online / tournament / challenge) is deterministic from its seed, so the only
// state worth keeping is the seed, the completed-hole scores, and the bag. On
// the title screen this offers "Resume" and reconstructs the round exactly. ──
export const RESUME_KEY = "discgolf.resume.v1";
export const TOURBEST_KEY = "discgolf.tourbests.v1"; // best score per pro-tour venue (by seed)
export const TOURNBEST_KEY = "discgolf.tournplaces.v1"; // best finishing place per tournament (by id)
export const ENTRY_KEY = "discgolf.entry.v1"; // "offline" | "auth" — which front-door choice was made
// Your finishing place (1..field) in each of the current placement run's rounds,
// so the Ranked placement tracker can color each dot green (top 2) / gray (3rd) /
// red (bottom 2). Reset when a fresh run's first round lands. Device-local: it's
// just the current calibration's UI, not synced ranked progress.
export const PLACEMARKS_KEY = "discgolf.placemarks.v1";
export function readPlaceMarks(): (number | null)[] {
  try {
    const a = JSON.parse(localStorage.getItem(PLACEMARKS_KEY) || "null");
    return Array.isArray(a) ? a.map((n) => (typeof n === "number" ? n : null)) : [null, null, null];
  } catch { return [null, null, null]; }
}
// Everyone's first placement round is played against a mid-Silver field; every
// round after re-centers on your running projection. So placement always starts
// from the same rung and climbs (or falls) based on how you do.
export const PLACEMENT_START_RP = 700;
export type ResumeSnap = { v: 1; mode: Mode; seed: number; scores: number[] };
export function holesForMode(mode: Mode): number {
  return mode === "daily" || mode === "academy" ? 9 : 18;
}
export function readResume(): ResumeSnap | null {
  try {
    const r = JSON.parse(localStorage.getItem(RESUME_KEY) || "null");
    if (!r || r.v !== 1 || !Array.isArray(r.scores)) return null;
    if (r.mode !== "course" && r.mode !== "winthrop" && r.mode !== "olympus" && r.mode !== "daily") return null;
    // Nothing played yet, or already finished — not resumable.
    if (r.scores.length === 0 || r.scores.length >= holesForMode(r.mode)) return null;
    return r as ResumeSnap;
  } catch {
    return null;
  }
}

// Persist the current online lobby so a reload / relaunch (or the OS killing the
// PWA) can rejoin it instead of dumping you back on the title screen. Ephemeral:
// only honored for a couple of hours, and cleared the moment you leave.
export const LOBBY_KEY = "discgolf.lobby.v1";
export const LOBBY_TTL = 2 * 60 * 60 * 1000; // 2h — don't reopen a stale lobby
export type LobbySnap = { code: string; name: string; isHost: boolean; mode: Mode; seed?: number; courseKey: string; courseLabel: string; ts: number };
export function readLobbySession(): LobbySnap | null {
  try {
    const s = JSON.parse(localStorage.getItem(LOBBY_KEY) || "null");
    if (!s || typeof s.code !== "string" || typeof s.name !== "string") return null;
    if (Date.now() - (s.ts ?? 0) > LOBBY_TTL) return null;
    return s as LobbySnap;
  } catch { return null; }
}
export function writeLobbySession(s: Omit<LobbySnap, "ts">) {
  try { localStorage.setItem(LOBBY_KEY, JSON.stringify({ ...s, ts: Date.now() })); } catch { /* ignore */ }
}
export function clearLobbySession() {
  try { localStorage.removeItem(LOBBY_KEY); } catch { /* ignore */ }
}
