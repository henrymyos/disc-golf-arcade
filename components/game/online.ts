import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Mode, Vec } from "@/lib/discgolf/engine";
import { courseLabelFor } from "@/lib/discgolf/challenge";
import type { Replay } from "@/lib/discgolf/replay";


// Tournament rivals (visible "ghost" discs) are built in the engine; see
// buildTournGhosts / ghostPosAt.

// ── Online Friendly Challenge: ephemeral lobbies over Supabase Realtime
// (broadcast + presence, no database). A short shareable code names the
// channel; everyone with the code plays the same seed and scores sync live. ──
export type LobbyPlayer = { id: string; name: string; host: boolean; mode?: Mode; courseLabel?: string };
export type OnlineScore = { name: string; scores: number[]; total: number; thru: number };
// 4-char codes, omitting easily-confused characters (0/O, 1/I, etc.).
export function makeLobbyCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i++) out += alphabet[(Math.random() * alphabet.length) | 0];
  return out;
}
export function makeClientId(): string {
  return `${(Math.random() * 1e9) | 0}-${(Math.random() * 1e9) | 0}`;
}

// ── Online ghosts: replay friends' real throws ──────────────────────────────
// Each player broadcasts the recorded flight path of every shot on the hole they
// just played; peers store them and animate a small "ghost" disc tracing that
// exact curve — live when you're on the same hole, or replayed from the start
// when you arrive at a hole they've already played.
export type GhostShots = { shots: Vec[][]; arrivals: number[] }; // arrivals: when each shot reached us (perf clock)
export type OnlineGhost = { name: string; color: string; holes: Record<number, GhostShots> };
export const GHOST_COLORS = ["#e23b7b", "#5fb0e8", "#b85cd6", "#e2a13b", "#36D7B7", "#f5d24a"];
export function ghostColorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0;
  return GHOST_COLORS[h % GHOST_COLORS.length];
}
// Trim a recorded flight polyline to at most `max` points (keeping the ends) so
// it's cheap to broadcast while preserving the shot's shape. Coords are rounded.
export function thinPath(path: Vec[], max = 24): Vec[] {
  if (!Array.isArray(path) || path.length === 0) return [];
  if (path.length <= max) return path.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
  const out: Vec[] = [];
  const step = (path.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) { const p = path[Math.round(i * step)]; out.push({ x: Math.round(p.x), y: Math.round(p.y) }); }
  return out;
}
// "Glendoveer East · 54 (−2)" style caption for a replay.
export function replayCaption(r: Replay): { course: string; score: string } {
  const total = r.scores.reduce((a, b) => a + b, 0);
  const d = total - r.pars.reduce((a, b) => a + b, 0);
  const course = r.label ?? (r.mode === "tour" ? "Pro Tour venue" : r.mode === "ranked" ? "Ranked course" : r.mode === "academy" ? "Academy" : courseLabelFor(r.mode));
  return { course, score: `${total} (${d === 0 ? "E" : d > 0 ? `+${d}` : `−${-d}`})` };
}
export function sendThrows(o: { channel: RealtimeChannel; myId: string; myName: string }, holeIndex: number, shotPaths: Vec[][]) {
  void o.channel.send({ type: "broadcast", event: "throw", payload: { id: o.myId, name: o.myName, hole: holeIndex, paths: shotPaths.map((p) => thinPath(p)) } });
}
export const GHOST_PAUSE = 1300;   // ms a ghost stands over the disc before each throw
export const GHOST_PACE = 0.22;    // px/ms flight speed (matches the AI-rival ghosts)
// Where a friend's ghost is right now, given their shots, when each shot reached
// us, and when we started this hole. Each shot starts after the previous one ends
// OR when it arrived (whichever is later) — so a hole they already finished plays
// straight through from your arrival, while a shot thrown live shows up as it
// lands. Returns null before their first throw and after their last (then hidden).
export function onlineGhostPos(gs: GhostShots, holeEnteredAt: number, now: number): { x: number; y: number; lift: number } | null {
  const { shots, arrivals } = gs;
  if (!shots.length) return null;
  let prevEnd = holeEnteredAt;
  for (let i = 0; i < shots.length; i++) {
    const path = shots[i];
    if (!path || path.length === 0) continue;
    const start = Math.max(prevEnd, arrivals[i] ?? holeEnteredAt);
    let len = 0;
    for (let k = 1; k < path.length; k++) len += Math.hypot(path[k].x - path[k - 1].x, path[k].y - path[k - 1].y);
    const fly = Math.max(240, Math.min(1700, len / GHOST_PACE));
    const flyStart = start + GHOST_PAUSE;
    const end = flyStart + fly;
    if (now < flyStart) return { x: path[0].x, y: path[0].y, lift: 0 }; // lining up at the lie
    if (now < end) {
      const t = (now - flyStart) / fly;
      const fi = t * (path.length - 1);
      const i0 = Math.floor(fi), i1 = Math.min(path.length - 1, i0 + 1), fr = fi - i0;
      return {
        x: path[i0].x + (path[i1].x - path[i0].x) * fr,
        y: path[i0].y + (path[i1].y - path[i0].y) * fr,
        lift: Math.sin(t * Math.PI) * Math.min(16, 4 + len * 0.045),
      };
    }
    prevEnd = end;
  }
  return null; // every known shot played out → stop drawing
}
