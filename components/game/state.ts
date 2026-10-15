import {
  H, aimAt, camXFor, type Vec, type Tree, type Hole, type Mode, type FlightPath, type Release,
} from "@/lib/discgolf/engine";
import type { Replay } from "@/lib/discgolf/replay";
import type { SkillMods } from "@/lib/discgolf/career";


// "intro" plays a short basket → tee fly-over before you take the tee shot.
export type Phase = "intro" | "aim" | "fly" | "holed";
export type Screen = "landing" | "title" | "playing" | "holeComplete" | "gameComplete";

export type GameState = {
  holeIndex: number;
  phase: Phase;
  mode: Mode; // daily challenge vs the full course
  practice?: boolean; // single-hole practice (no bests/history/leaderboard)
  practiceHole?: number; // 1-based hole number being practiced
  party?: { names: string[]; current: number; scores: (number | null)[][] }; // hot-seat pass-and-play
  online?: boolean; // online Friendly Challenge round (scores synced over Realtime)
  career?: { eventId: string; eventName: string; venue?: string; character?: string; emoji?: string }; // round is a played Career event
  mini?: { kind: "putt" | "target"; station: number; makes: number; best: number; points: number; attempts: number; total: number; lastPts?: number }; // practice mini-game
  skill: SkillMods; // Career skill effects on flight (identity for normal play)
  momentum?: number; // legacy per-hole momentum multiplier — always 1 now (momentum retired with the Mental skill)
  seed: number; // round seed (drives wind + pins)
  roundHoles: Hole[]; // this round's holes (wind/pins baked in)
  disc: { x: number; y: number; vx: number; vy: number };
  rest: Vec;
  angle: number;
  powerT: number;
  power: number;
  throws: number;
  discIndex: number;
  scores: number[];
  shotPaths: Vec[][]; // the actual flight path of each completed shot this hole
  roundPaths: Vec[][][]; // shotPaths of every finished hole (for the best-round ghost)
  trailBuf: Vec[]; // path of the shot currently in the air
  ghostTrees: Tree[]; // trees the lie is right behind — thrown through, drawn translucent
  holedAt: number | null;
  fadeTurn: number; // radians the current flight has curved so far
  fadeSign: number; // -1 backhand (left), +1 forehand (right)
  path: FlightPath; // shape of the current flight (overstable / straight)
  release: Release; // release angle of the current flight (hyzer / flat / anny)
  h: number; // current height above the ground
  vh: number; // vertical velocity (height units per frame)
  camY: number; // top of the viewport in world coords (vertical scroll)
  camX: number; // left of the viewport in world coords (horizontal pan on wide holes)
  introT: number; // frames elapsed in the intro fly-over
  flash: { text: string; at: number } | null; // big centered penalty banner (OB / hazard)
  lenScale?: number; // career hole-length scale this round was built with (for replays)
  // Watching a recorded round: the disc follows the saved paths, input is off.
  replay?: { data: Replay; clock: number; lastT: number; speed: number; lastFlying: number; ended: boolean };
};

export function freshHole(hole: Hole) {
  const tee = hole.tee;
  return {
    phase: "intro" as Phase, // basket → tee fly-over before the tee shot
    disc: { x: tee.x, y: tee.y, vx: 0, vy: 0 },
    rest: { x: tee.x, y: tee.y },
    angle: aimAt(tee, hole.basket), // auto-aimed at the basket
    powerT: 0,
    power: 0,
    throws: 0,
    shotPaths: [] as Vec[][],
    trailBuf: [] as Vec[],
    ghostTrees: [] as Tree[],
    holedAt: null as number | null,
    fadeTurn: 0,
    fadeSign: -1,
    path: "overstable" as FlightPath,
    release: "flat" as Release,
    h: 0,
    vh: 0,
    camY: 0, // start showing the basket (top), then pan down
    camX: camXFor(hole, hole.basket.x), // intro looks at the basket first
    introT: 0,
    flash: null as { text: string; at: number } | null,
  };
}

// ── Practice mini-games: flat, wide-open single-target "holes" that reuse the
// throw engine. Putting = sink a putt to advance to a longer one (miss ends the
// run). Target = land near the bullseye for points over a fixed set of throws. ──
// The tee sits well up from the bottom edge (world H=448) so the whole pull-back
// (MAX_DRAG=95px, dragged straight DOWN below the disc) stays on-screen — you can
// see exactly where you're dragging to. The target moves up by the same amount, so
// throw distances are unchanged; only the framing shifts.
export const MINI_TEE_Y = 340; // leaves 108px of visible board below the tee (> MAX_DRAG)
export function puttFeet(station: number): number { return 15 + station * 5; }
export function puttHole(station: number): Hole {
  const distPx = 40 + station * 13;
  const tee: Vec = { x: 160, y: MINI_TEE_Y };
  const basket: Vec = { x: 160, y: Math.max(36, MINI_TEE_Y - distPx) };
  return { par: 1, worldH: H, tee, basket, fairway: [tee, basket], fwWidth: 640, trees: [], water: [], hazard: [], elev: 0 };
}
export function targetRadiusPx(station: number): number { return Math.max(13, 34 - station * 2.4); }
export function targetHole(station: number): Hole {
  const distPx = 80 + station * 16;
  const side = (Math.random() * 2 - 1) * Math.min(90, 30 + station * 8);
  const tee: Vec = { x: 160, y: MINI_TEE_Y };
  const basket: Vec = { x: Math.max(44, Math.min(276, 160 + side)), y: Math.max(58, MINI_TEE_Y - distPx) };
  return { par: 1, worldH: H, tee, basket, fairway: [tee, basket], fwWidth: 640, trees: [], water: [], hazard: [], elev: 0 };
}
