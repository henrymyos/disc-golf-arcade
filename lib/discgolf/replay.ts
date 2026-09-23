// Round replays. A finished round already records every shot's flight path
// (GameState.roundPaths — the same data the course ghost is built from), so a
// replay is just: the course (mode + seed + career hole-length scale), who
// played it, the card, and those paths. Playback re-builds the identical holes
// and flies the disc along the recorded paths — no physics re-simulation, so it
// stays faithful even if the flight model changes later.

import type { Mode } from "./engine";

type Vec = { x: number; y: number };

export type Replay = {
  v: 1;
  mode: Mode;
  seed: number;
  scale?: number;       // career hole-length scale (buildRound's lenScale); 1 when absent
  name: string;
  label?: string;       // course/event name shown in the banner
  scores: number[];
  pars: number[];
  date: number;
  paths: Vec[][][];     // [hole][shot][point]
};

export const REPLAY_PAUSE = 1100;  // ms standing over the lie before each throw
export const REPLAY_PACE = 0.22;   // px/ms flight speed (matches the friend/rival ghosts)
export const REPLAY_HOLE_TAIL = 1400; // ms to admire the result before the next hole

const MODES: readonly Mode[] = ["daily", "academy", "course", "winthrop", "olympus", "tour", "ranked"];
const MAX_HOLES = 27, MAX_SHOTS = 20, MAX_POINTS = 400;

// Keep every 3rd point (and the last) rounded to whole pixels — the same
// thinning the course ghost uses; flights are smooth so the shape survives.
export function thinReplayPath(path: Vec[]): Vec[] {
  return path
    .filter((_, i) => i % 3 === 0 || i === path.length - 1)
    .map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
}

export function buildReplay(o: {
  mode: Mode; seed: number; scale?: number; name: string; label?: string;
  scores: number[]; pars: number[]; paths: Vec[][][]; date?: number;
}): Replay {
  const r: Replay = {
    v: 1, mode: o.mode, seed: Math.trunc(o.seed),
    name: (o.name || "A friend").trim().slice(0, 16) || "A friend",
    scores: o.scores.slice(), pars: o.pars.slice(), date: o.date ?? Date.now(),
    paths: o.paths.map((hole) => hole.map(thinReplayPath)),
  };
  if (o.scale != null && o.scale !== 1) r.scale = o.scale;
  if (o.label) r.label = o.label.slice(0, 48);
  return r;
}

const isInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);
const isCoord = (n: unknown) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) < 1e5;

// Strict shape check for anything loaded from storage or a link. Returns a
// clean copy, or null if it isn't a replay we can safely play.
export function validateReplay(x: unknown): Replay | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (o.v !== 1 || !MODES.includes(o.mode as Mode) || !isInt(o.seed)) return null;
  if (o.scale != null && !(typeof o.scale === "number" && o.scale > 0.3 && o.scale < 3)) return null;
  if (!Array.isArray(o.scores) || !Array.isArray(o.pars) || !Array.isArray(o.paths)) return null;
  const holes = o.paths.length;
  if (holes < 1 || holes > MAX_HOLES || o.scores.length !== holes || o.pars.length !== holes) return null;
  if (!o.scores.every((s) => isInt(s) && s >= 1 && s <= 99) || !o.pars.every((p) => isInt(p) && p >= 2 && p <= 7)) return null;
  const paths: Vec[][][] = [];
  for (const hole of o.paths) {
    if (!Array.isArray(hole) || hole.length > MAX_SHOTS) return null;
    const shots: Vec[][] = [];
    for (const path of hole) {
      if (!Array.isArray(path) || path.length < 1 || path.length > MAX_POINTS) return null;
      const pts: Vec[] = [];
      for (const p of path) {
        if (!p || typeof p !== "object" || !isCoord((p as Vec).x) || !isCoord((p as Vec).y)) return null;
        pts.push({ x: (p as Vec).x, y: (p as Vec).y });
      }
      shots.push(pts);
    }
    paths.push(shots);
  }
  const name = typeof o.name === "string" ? o.name.trim().slice(0, 16) : "";
  const r: Replay = {
    v: 1, mode: o.mode as Mode, seed: o.seed, name: name || "A friend",
    scores: (o.scores as number[]).slice(), pars: (o.pars as number[]).slice(),
    date: isInt(o.date) ? o.date : 0, paths,
  };
  if (typeof o.scale === "number" && o.scale !== 1) r.scale = o.scale;
  if (typeof o.label === "string" && o.label.trim()) r.label = o.label.trim().slice(0, 48);
  return r;
}

function pathLen(path: Vec[]): number {
  let len = 0;
  for (let k = 1; k < path.length; k++) len += Math.hypot(path[k].x - path[k - 1].x, path[k].y - path[k - 1].y);
  return len;
}
function flyMs(path: Vec[]): number {
  return Math.max(240, Math.min(1700, pathLen(path) / REPLAY_PACE));
}

// Total playback length of one hole (all shots + the closing pause), in ms.
export function replayHoleDuration(shots: Vec[][]): number {
  let t = 0;
  for (const p of shots) if (p.length) t += REPLAY_PAUSE + flyMs(p);
  return t + REPLAY_HOLE_TAIL;
}

export type ReplayFrame = {
  x: number; y: number; lift: number;
  done: number;          // shots fully played so far
  flying: number;        // index of the shot in the air, or -1
  trail: Vec[];          // the in-flight shot's path so far (for the live trail)
  finished: boolean;     // hole fully played, including the closing pause
};

// Where the disc is `t` ms into a hole's playback.
export function replayFrame(shots: Vec[][], t: number): ReplayFrame {
  const played = shots.filter((p) => p.length);
  let clock = 0;
  let last: Vec = played.length ? played[0][0] : { x: 0, y: 0 };
  for (let i = 0; i < played.length; i++) {
    const path = played[i];
    const fly = flyMs(path);
    const flyStart = clock + REPLAY_PAUSE;
    const end = flyStart + fly;
    if (t < flyStart) return { x: path[0].x, y: path[0].y, lift: 0, done: i, flying: -1, trail: [], finished: false };
    if (t < end) {
      const f = (t - flyStart) / fly;
      const fi = f * (path.length - 1);
      const i0 = Math.floor(fi), i1 = Math.min(path.length - 1, i0 + 1), fr = fi - i0;
      const x = path[i0].x + (path[i1].x - path[i0].x) * fr;
      const y = path[i0].y + (path[i1].y - path[i0].y) * fr;
      return {
        x, y, lift: Math.sin(f * Math.PI) * Math.min(16, 4 + pathLen(path) * 0.045),
        done: i, flying: i, trail: path.slice(0, i0 + 1).concat([{ x, y }]), finished: false,
      };
    }
    clock = end;
    last = path[path.length - 1];
  }
  return { x: last.x, y: last.y, lift: 0, done: played.length, flying: -1, trail: [], finished: t >= clock + REPLAY_HOLE_TAIL };
}

// Short random id for a shared replay (no ambiguous characters).
export function replayId(): string {
  const a = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}
export const isReplayId = (s: unknown): s is string => typeof s === "string" && /^[a-z2-9]{10}$/.test(s);
