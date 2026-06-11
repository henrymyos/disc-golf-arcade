"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { submitArcadeScore, getArcadeLeaderboard } from "@/actions/arcade";
import type { ArcadeScore } from "@/lib/arcade-types";
import { getSupabase } from "@/lib/supabase/browser";
import {
  BEST_KEY, HOLEBEST_KEY, SETTINGS_KEY, ACH_KEY, HIST_KEY,
  readLocalProgress, applyProgress, mergeProgress, type Progress,
} from "@/lib/progress";

// ─────────────────────────────────────────────────────────────────────────────
// Retro pixel disc-golf game. You throw from the bottom of the screen toward
// the top across the 18-hole Glendoveer East course (or a seeded Daily
// Challenge). Drag back to aim/power; pick a disc + flight shape; mind wind,
// elevation and OB. Scores persist: a personal best + per-hole bests +
// achievements in localStorage, and a saved-by-name leaderboard in Supabase.
// Everything renders to a small portrait canvas upscaled with image-rendering:
// pixelated for the crunchy old-school look.
// ─────────────────────────────────────────────────────────────────────────────

const W = 320;
const H = 448;
const DISC_R = 3;
const CATCH_R = 9;
const STOP_SPEED = 0.35;
// Persistence keys (BEST_KEY, HOLEBEST_KEY, ...) come from @/lib/progress.

// Height physics: a throw arcs up and comes back down. While airborne the disc
// clears water and trees (throw over hazards); once it lands it brakes hard so
// it doesn't keep gliding forever after the fade.
const GRAVITY = 0.08; // downward pull on height per frame (gentler = floatier flight)
const AIRBORNE_H = 3; // above this height, hazards are cleared
const GROUND_FRICTION = 0.8; // hard deceleration once on the ground
const MAX_DRAG = 95; // pull-back distance (internal px) that maps to full power
const CANCEL_R = 13; // pull the knob back inside this radius (around the disc) and release to cancel
const CANCEL_POWER = CANCEL_R / MAX_DRAG; // below this power, releasing cancels the throw

type Vec = { x: number; y: number };
type Tree = { x: number; y: number; r: number };
type Water = { x: number; y: number; w: number; h: number };
// The fairway is a curved centerline (tee → green) with a width; anything
// outside that ribbon is OUT OF BOUNDS — so doglegs and OB lines both curve.
// Penalty regions (fly over them freely; only matter at ground level):
//  • outside the fairway ribbon, or a `water` pond = OUT OF BOUNDS: +1 and play
//    from where it crossed the line (so you only move back to the edge).
//  • `hazard` = HAZARD (sand): +1 and play where it lies (the disc stays put).
// `worldH` is the hole's full length (taller than the 448px viewport); the
// camera scrolls vertically along it.
// Per-round flavor (set by `buildRound`): `wind` is a tiny per-frame push on the
// disc while it's airborne; `elev` is the hole's slope (+uphill shortens carry,
// −downhill lengthens it). Both render as indicators on the HUD/minimap.
type Hole = { par: number; worldH: number; tee: Vec; basket: Vec; fairway: Vec[]; fwWidth: number; trees: Tree[]; water: Water[]; hazard?: Water[]; wind?: Vec; windMag?: number; elev?: number };

// Holes are authored in this old 448-tall frame, then stretched to a length
// that scales with par (below).
const TEE: Vec = { x: 160, y: 416 };

// Glendoveer East (2026 Northwest Championship), 18 holes / par 66. Each hole
// is an original pixel interpretation of the real one — tee at the bottom, with
// the green, dogleg shape, OB lines, water and tree guards placed to match the
// hole's actual character. Comments note the real par/distance.
const HOLE_TEMPLATES: Omit<Hole, "worldH">[] = [
  // ── Front nine (par 31) ── (`fairway` = curved centerline tee→green; `fwWidth` = corridor width)
  // 1 — par 4, 670ft. Dogleg left around a pond to an upper-right green; mando tree short.
  { par: 4, tee: TEE, basket: { x: 190, y: 98 }, fairway: [{ x: 160, y: 416 }, { x: 150, y: 300 }, { x: 132, y: 215 }, { x: 168, y: 150 }, { x: 190, y: 98 }], fwWidth: 126, trees: [{ x: 206, y: 152, r: 13 }, { x: 118, y: 124, r: 12 }], water: [{ x: 104, y: 206, w: 76, h: 58 }] },
  // 2 — par 3, 390ft. Corridor bending right; tight on the left.
  { par: 3, tee: TEE, basket: { x: 196, y: 122 }, fairway: [{ x: 160, y: 416 }, { x: 168, y: 300 }, { x: 188, y: 200 }, { x: 196, y: 122 }], fwWidth: 112, trees: [{ x: 132, y: 252, r: 13 }, { x: 210, y: 208, r: 13 }, { x: 150, y: 170, r: 12 }], water: [] },
  // 3 — par 3, 370ft. Tree-lined, green up the left.
  { par: 3, tee: TEE, basket: { x: 150, y: 110 }, fairway: [{ x: 160, y: 416 }, { x: 156, y: 290 }, { x: 150, y: 180 }, { x: 150, y: 110 }], fwWidth: 116, trees: [{ x: 196, y: 252, r: 13 }, { x: 120, y: 200, r: 13 }, { x: 202, y: 150, r: 12 }], water: [] },
  // 4 — par 3, 450ft. Slight left to a guarded green.
  { par: 3, tee: TEE, basket: { x: 150, y: 96 }, fairway: [{ x: 160, y: 416 }, { x: 154, y: 260 }, { x: 150, y: 150 }, { x: 150, y: 96 }], fwWidth: 120, trees: [{ x: 150, y: 152, r: 14 }, { x: 118, y: 232, r: 12 }], water: [] },
  // 5 — par 4, 910ft. Wide & open with sand hazards and a pond short of the pin.
  { par: 4, tee: TEE, basket: { x: 160, y: 72 }, fairway: [{ x: 160, y: 416 }, { x: 160, y: 280 }, { x: 160, y: 170 }, { x: 160, y: 72 }], fwWidth: 150, trees: [], water: [{ x: 132, y: 118, w: 56, h: 34 }], hazard: [{ x: 116, y: 182, w: 30, h: 22 }, { x: 184, y: 202, w: 28, h: 20 }] },
  // 6 — par 3, 415ft. Mostly open with a couple of guard trees.
  { par: 3, tee: TEE, basket: { x: 168, y: 110 }, fairway: [{ x: 160, y: 416 }, { x: 164, y: 280 }, { x: 168, y: 160 }, { x: 168, y: 110 }], fwWidth: 128, trees: [{ x: 132, y: 242, r: 13 }, { x: 196, y: 190, r: 13 }], water: [] },
  // 7 — par 4, 710ft. Tree-lined dogleg left.
  { par: 4, tee: TEE, basket: { x: 132, y: 86 }, fairway: [{ x: 160, y: 416 }, { x: 160, y: 290 }, { x: 150, y: 190 }, { x: 132, y: 86 }], fwWidth: 120, trees: [{ x: 196, y: 252, r: 13 }, { x: 150, y: 182, r: 13 }, { x: 206, y: 140, r: 12 }], water: [] },
  // 8 — par 3, 500ft. Straight tree-lined corridor.
  { par: 3, tee: TEE, basket: { x: 160, y: 90 }, fairway: [{ x: 160, y: 416 }, { x: 160, y: 260 }, { x: 160, y: 150 }, { x: 160, y: 90 }], fwWidth: 116, trees: [{ x: 122, y: 242, r: 13 }, { x: 200, y: 242, r: 13 }, { x: 160, y: 162, r: 12 }], water: [] },
  // 9 — par 4, 695ft. S-shaped fairway with a sand hazard.
  { par: 4, tee: TEE, basket: { x: 150, y: 86 }, fairway: [{ x: 160, y: 416 }, { x: 172, y: 300 }, { x: 145, y: 205 }, { x: 162, y: 140 }, { x: 150, y: 86 }], fwWidth: 118, trees: [{ x: 206, y: 252, r: 13 }, { x: 120, y: 182, r: 13 }, { x: 196, y: 130, r: 12 }], water: [], hazard: [{ x: 148, y: 202, w: 28, h: 20 }] },
  // ── Back nine (par 35) ──
  // 10 — par 4, 710ft. S-curve with sand hazards.
  { par: 4, tee: TEE, basket: { x: 168, y: 84 }, fairway: [{ x: 160, y: 416 }, { x: 150, y: 300 }, { x: 182, y: 205 }, { x: 150, y: 140 }, { x: 168, y: 84 }], fwWidth: 120, trees: [{ x: 122, y: 252, r: 13 }, { x: 206, y: 252, r: 13 }, { x: 150, y: 172, r: 12 }], water: [], hazard: [{ x: 176, y: 150, w: 30, h: 22 }, { x: 118, y: 112, w: 28, h: 20 }] },
  // 11 — par 5, 1145ft. Long straight tree-lined corridor.
  { par: 5, tee: TEE, basket: { x: 160, y: 56 }, fairway: [{ x: 160, y: 416 }, { x: 160, y: 310 }, { x: 160, y: 200 }, { x: 160, y: 110 }, { x: 160, y: 56 }], fwWidth: 120, trees: [{ x: 120, y: 292, r: 13 }, { x: 206, y: 232, r: 13 }, { x: 132, y: 172, r: 12 }, { x: 196, y: 120, r: 12 }], water: [] },
  // 12 — par 3, 370ft. Dogleg right around trees.
  { par: 3, tee: TEE, basket: { x: 196, y: 110 }, fairway: [{ x: 160, y: 416 }, { x: 162, y: 270 }, { x: 185, y: 175 }, { x: 196, y: 110 }], fwWidth: 116, trees: [{ x: 140, y: 232, r: 13 }, { x: 168, y: 162, r: 13 }], water: [] },
  // 13 — par 4, 775ft. Dogleg right, tree-lined.
  { par: 4, tee: TEE, basket: { x: 196, y: 84 }, fairway: [{ x: 160, y: 416 }, { x: 166, y: 290 }, { x: 186, y: 185 }, { x: 196, y: 84 }], fwWidth: 120, trees: [{ x: 132, y: 252, r: 13 }, { x: 168, y: 182, r: 13 }, { x: 214, y: 140, r: 12 }], water: [] },
  // 14 — par 4, 845ft. Dogleg left to a guarded green; pond + sand.
  { par: 4, tee: TEE, basket: { x: 138, y: 76 }, fairway: [{ x: 160, y: 416 }, { x: 160, y: 290 }, { x: 150, y: 185 }, { x: 138, y: 76 }], fwWidth: 120, trees: [{ x: 196, y: 252, r: 13 }, { x: 150, y: 172, r: 13 }], water: [{ x: 120, y: 108, w: 50, h: 30 }] },
  // 15 — par 3, 335ft. Narrow tree-lined tunnel straight to the green.
  { par: 3, tee: TEE, basket: { x: 158, y: 88 }, fairway: [{ x: 160, y: 416 }, { x: 158, y: 260 }, { x: 158, y: 150 }, { x: 158, y: 88 }], fwWidth: 96, trees: [{ x: 108, y: 300, r: 14 }, { x: 212, y: 300, r: 14 }, { x: 104, y: 200, r: 14 }, { x: 216, y: 200, r: 14 }, { x: 110, y: 122, r: 13 }, { x: 210, y: 122, r: 13 }], water: [] },
  // 16 — par 3, 410ft. Straight, but trees stand in the fairway.
  { par: 3, tee: TEE, basket: { x: 158, y: 110 }, fairway: [{ x: 160, y: 416 }, { x: 158, y: 280 }, { x: 158, y: 170 }, { x: 158, y: 110 }], fwWidth: 108, trees: [{ x: 150, y: 300, r: 14 }, { x: 168, y: 232, r: 14 }, { x: 132, y: 182, r: 13 }, { x: 186, y: 160, r: 13 }], water: [] },
  // 17 — par 4, 830ft. Tree-lined with gate trees; sand hazard.
  { par: 4, tee: TEE, basket: { x: 160, y: 80 }, fairway: [{ x: 160, y: 416 }, { x: 160, y: 260 }, { x: 160, y: 160 }, { x: 160, y: 80 }], fwWidth: 118, trees: [{ x: 120, y: 252, r: 13 }, { x: 200, y: 252, r: 13 }, { x: 134, y: 160, r: 12 }, { x: 188, y: 160, r: 12 }], water: [], hazard: [{ x: 82, y: 150, w: 28, h: 22 }] },
  // 18 — par 5, 1000ft. Long slight dogleg left with a pond in the fairway.
  { par: 5, tee: TEE, basket: { x: 168, y: 58 }, fairway: [{ x: 160, y: 416 }, { x: 160, y: 310 }, { x: 156, y: 200 }, { x: 162, y: 120 }, { x: 168, y: 58 }], fwWidth: 124, trees: [{ x: 120, y: 300, r: 13 }, { x: 206, y: 222, r: 13 }, { x: 140, y: 152, r: 12 }], water: [{ x: 150, y: 188, w: 70, h: 40 }] },
];

// A max drive carries ~DRIVE world px, so a hole's length is ~(par-2) drives:
// par 3 ≈ reachable in one big drive, par 4 ≈ two, par 5 ≈ three. Each template
// (authored tee y≈416, basket near the top) is stretched vertically to fit, with
// extra room left behind the tee so the pull-back slider isn't cramped.
const DRIVE = 330;
const TEE_BEHIND = 120;
const worldHForPar = (par: number) => (par - 2) * DRIVE + 60 + TEE_BEHIND;
// Stretch an authored template (tee y≈416, basket near the top) into a full hole
// whose length scales with par. Shared by Glendoveer and the procedural daily.
function materializeHole(t: Omit<Hole, "worldH">): Hole {
  const worldH = worldHForPar(t.par);
  const scale = (worldH - 60 - TEE_BEHIND) / (416 - 50); // template y[50..416] → world[60..tee]
  const ty = (y: number) => 60 + (y - 50) * scale;
  return {
    par: t.par,
    worldH,
    tee: { x: 160, y: worldH - TEE_BEHIND },
    basket: { x: t.basket.x, y: ty(t.basket.y) },
    fairway: t.fairway.map((p) => ({ x: p.x, y: ty(p.y) })),
    fwWidth: t.fwWidth,
    trees: t.trees.map((tr) => ({ x: tr.x, y: ty(tr.y), r: tr.r })),
    water: t.water.map((w) => ({ x: w.x, y: ty(w.y), w: w.w, h: w.h * scale })),
    hazard: (t.hazard ?? []).map((o) => ({ x: o.x, y: ty(o.y), w: o.w, h: o.h * scale })),
    elev: t.elev,
  };
}
const HOLES: Hole[] = HOLE_TEMPLATES.map(materializeHole);
const TOTAL_PAR = HOLES.reduce((s, h) => s + h.par, 0);

// Fixed per-hole elevation (course identity, not random): + uphill / − downhill,
// roughly −2..+2. Affects how far a throw carries; shown on the minimap as ▲/▼.
const HOLE_ELEV = [0, 1, -1, 2, 0, -1, 1, 0, -1, 1, 0, 1, -2, 2, 0, -1, 1, -1];

type Mode = "daily" | "course";

// Achievements — evaluated from a finished round's per-hole scores.
type Achievement = { id: string; name: string; emoji: string; desc: string };
const ACHIEVEMENTS: Achievement[] = [
  { id: "ace", name: "Ace!", emoji: "🎯", desc: "Hole out in a single throw" },
  { id: "eagle", name: "Eagle Eye", emoji: "🦅", desc: "Score an eagle or better" },
  { id: "birdie", name: "First Birdie", emoji: "🐦", desc: "Score a birdie" },
  { id: "bogeyfree9", name: "Bogey-Free Nine", emoji: "✨", desc: "Play a front or back nine with no bogeys" },
  { id: "underpar", name: "Under Par", emoji: "🏆", desc: "Finish a round under par" },
  { id: "evenpar", name: "Par the Course", emoji: "🟢", desc: "Finish a round at par or better" },
  { id: "regular", name: "Glendoveer Regular", emoji: "📅", desc: "Finish 5 rounds" },
  { id: "daily", name: "Daily Grinder", emoji: "🔥", desc: "Complete a Daily Challenge" },
];
// Which achievement ids this round earns (a superset is fine — newly-unlocked is
// the diff against what's already saved).
function earnedAchievements(scores: number[], pars: number[], mode: Mode, roundsPlayed: number): string[] {
  const out: string[] = [];
  const total = scores.reduce((s, n) => s + (n ?? 0), 0);
  const parTotal = pars.reduce((s, n) => s + n, 0);
  if (scores.some((s) => s === 1)) out.push("ace");
  if (scores.some((s, i) => s != null && s - pars[i] <= -2)) out.push("eagle");
  if (scores.some((s, i) => s != null && s - pars[i] === -1)) out.push("birdie");
  const nineClean = (from: number, to: number) => {
    const slice = scores.slice(from, to);
    return slice.length === 9 && slice.every((s, i) => s != null && s - pars[from + i] <= 0);
  };
  if (nineClean(0, 9) || nineClean(9, 18)) out.push("bogeyfree9");
  if (total < parTotal) out.push("underpar");
  if (total <= parTotal) out.push("evenpar");
  if (mode === "daily") out.push("daily");
  if (roundsPlayed >= 5) out.push("regular");
  return out;
}

// The exact name for a hole score relative to par (a 1-throw hole is always an
// "Ace"). `tone` drives the color shown on the hole-complete screen.
const BOGEY_PREFIX = ["", "", "Double ", "Triple ", "Quadruple ", "Quintuple ", "Sextuple ", "Septuple "];
function scoreLabel(throws: number, par: number): { name: string; emoji: string; tone: "great" | "good" | "even" | "bad" } {
  if (throws === 1) return { name: "Ace!", emoji: "🎯", tone: "great" };
  const d = throws - par;
  if (d <= -4) return { name: "Condor", emoji: "🦅", tone: "great" };
  if (d === -3) return { name: "Albatross", emoji: "🦅", tone: "great" };
  if (d === -2) return { name: "Eagle", emoji: "🦅", tone: "great" };
  if (d === -1) return { name: "Birdie", emoji: "🐦", tone: "good" };
  if (d === 0) return { name: "Par", emoji: "", tone: "even" };
  const pre = BOGEY_PREFIX[d];
  return { name: pre ? `${pre}Bogey` : `+${d}`, emoji: "", tone: "bad" };
}

// The two flight shapes you can pick per throw:
//  • "overstable" — bends steadily one way the whole flight (uses `fade`).
//  • "straight"   — flies straighter and FARTHER. On the climb it `turn`s the
//    opposite way (high-speed turn), then on the descent it fades back with
//    `sFade`. Tuned so the mid is nearly dead straight while the driver carves
//    a gentle S (for a backhand: out to the right, finishing slightly left).
type FlightPath = "overstable" | "straight";
// Straight throws launch this much faster (carry farther) than overstable ones.
const STRAIGHT_SPEED_MUL = 1.13;

// Disc bag — power scales throw speed, `fade` is how many radians an overstable
// flight curves per frame (backhand left, forehand right); `turn`/`sFade` are
// the climb-turn / descent-fade for a straight flight; friction is glide
// (higher = floats/rolls farther). Curving is capped per throw (MAX_FADE_TURN)
// so a disc can never loop or fade backward.
type Disc = { key: string; name: string; brand?: string; power: number; arc: number; fade: number; turn: number; sFade: number; friction: number; color: string; blurb: string; flight?: FlightPath };
const DISCS: Disc[] = [
  // `arc` is the vertical launch per unit power. The putter flies flat so it
  // stays low and reaches the basket near the ground (high chance to catch);
  // the driver climbs to sail over hazards.
  { key: "putter", name: "Putter", power: 0.82, arc: 1.2, fade: 0.004, turn: 0.004, sFade: 0.006, friction: 0.975, color: "#36D7B7", blurb: "Flat, controlled" },
  { key: "mid", name: "Mid", power: 1.0, arc: 2.2, fade: 0.008, turn: 0.0, sFade: 0.002, friction: 0.984, color: "#f5d24a", blurb: "Balanced" },
  { key: "driver", name: "Driver", power: 1.34, arc: 2.9, fade: 0.014, turn: 0.011, sFade: 0.015, friction: 0.990, color: "#e23b3b", blurb: "Far, S-flight" },
];

// Advanced bag — real discs that fly the simple bag's proven lines. Each disc
// borrows a simple-bag tier's stats (putter / mid / fairway / driver) plus a
// baked-in flight shape: "overstable" bends steadily one way, "straight" flies
// the farther S-line — exactly like the simple bag's toggle, just per-disc.
// The fairway tier sits halfway between mid and driver for distance.
const FAIRWAY_BASE: Disc = { key: "fairway", name: "Fairway", power: 1.17, arc: 2.55, fade: 0.011, turn: 0.0055, sFade: 0.0085, friction: 0.987, color: "", blurb: "" };
function advDisc(key: string, name: string, brand: string, color: string, base: Disc, flight: FlightPath, nums: string): Disc {
  return { ...base, key, name, brand, color, flight, blurb: `${brand} · ${nums}` };
}
const ADV_DISCS: Disc[] = [
  // Putt & approach — straight Aviar vs overstable Zone (putter tier)
  advDisc("aviar", "Aviar", "Innova", "#36D7B7", DISCS[0], "straight", "2 / 3 / 0 / 1"),
  advDisc("zone", "Zone", "Discraft", "#e07b3b", DISCS[0], "overstable", "4 / 3 / 0 / 3"),
  // Midrange — straight Buzzz vs overstable Swarm (mid tier)
  advDisc("buzzz", "Buzzz", "Discraft", "#f5d24a", DISCS[1], "straight", "5 / 4 / 0 / 1"),
  advDisc("swarm", "Swarm", "Discraft", "#b85cd6", DISCS[1], "overstable", "5 / 4 / 0 / 3"),
  // Fairway / control — straight Teebird vs overstable Firebird (fairway tier)
  advDisc("teebird", "Teebird", "Innova", "#5fb0e8", FAIRWAY_BASE, "straight", "7 / 5 / 0 / 2"),
  advDisc("firebird", "Firebird", "Innova", "#e2453b", FAIRWAY_BASE, "overstable", "9 / 3 / 0 / 4"),
  // Distance — overstable Nuke OS vs straight-flying Destroyer (driver tier)
  advDisc("nukeos", "Nuke OS", "Discraft", "#2f6fe0", DISCS[2], "overstable", "13 / 5 / 0 / 4"),
  advDisc("destroyer", "Destroyer", "Innova", "#e23b7b", DISCS[2], "straight", "12 / 5 / -1 / 3"),
];
function activeDiscs(advanced: boolean): Disc[] {
  return advanced ? ADV_DISCS : DISCS;
}
// Most the flight path may bend over a single throw (~46°) — keeps fade
// noticeable without ever curving back toward the thrower.
const MAX_FADE_TURN = 0.8;

// "intro" plays a short basket → tee fly-over before you take the tee shot.
type Phase = "intro" | "aim" | "fly" | "holed";
type Screen = "title" | "playing" | "holeComplete" | "gameComplete";

type GameState = {
  holeIndex: number;
  phase: Phase;
  mode: Mode; // daily challenge vs the full course
  advanced: boolean; // advanced bag (real discs) vs simple (putter/mid/driver)
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
  lies: Vec[]; // where each shot on the current hole came to rest (ghost trail)
  shotPaths: Vec[][]; // the actual flight path of each completed shot this hole
  trailBuf: Vec[]; // path of the shot currently in the air
  holedAt: number | null;
  fadeTurn: number; // radians the current flight has curved so far
  fadeSign: number; // -1 backhand (left), +1 forehand (right)
  path: FlightPath; // shape of the current flight (overstable / straight)
  h: number; // current height above the ground
  vh: number; // vertical velocity (height units per frame)
  camY: number; // top of the viewport in world coords (vertical scroll)
  introT: number; // frames elapsed in the intro fly-over
  flash: { text: string; at: number } | null; // big centered penalty banner (OB / hazard)
};

// Aim straight at the basket from a given lie.
function aimAt(from: Vec, basket: Vec): number {
  return Math.atan2(basket.y - from.y, basket.x - from.x);
}

function freshHole(hole: Hole) {
  const tee = hole.tee;
  return {
    phase: "intro" as Phase, // basket → tee fly-over before the tee shot
    disc: { x: tee.x, y: tee.y, vx: 0, vy: 0 },
    rest: { x: tee.x, y: tee.y },
    angle: aimAt(tee, hole.basket), // auto-aimed at the basket
    powerT: 0,
    power: 0,
    throws: 0,
    lies: [{ x: tee.x, y: tee.y }] as Vec[], // start of the ghost trail
    shotPaths: [] as Vec[][],
    trailBuf: [] as Vec[],
    holedAt: null as number | null,
    fadeTurn: 0,
    fadeSign: -1,
    path: "overstable" as FlightPath,
    h: 0,
    vh: 0,
    camY: 0, // start showing the basket (top), then pan down
    introT: 0,
    flash: null as { text: string; at: number } | null,
  };
}

// ── Audio engine: chiptune loop + SFX, all synthesized ───────────────────────
class AudioEngine {
  ctx: AudioContext;
  master: GainNode;
  musicGain: GainNode;
  private step = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.22;
    this.musicGain.connect(this.master);
  }

  private note(freq: number, dur: number, type: OscillatorType, gain: number, dest: AudioNode) {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain: number) {
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  private static MELODY = [
    72, 76, 79, 76, 74, 77, 81, 77,
    72, 76, 79, 84, 81, 79, 76, 74,
  ];
  private static BASS = [48, 0, 55, 0, 53, 0, 50, 0, 48, 0, 55, 0, 53, 0, 50, 0];
  private static midi(n: number) {
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  startMusic() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const m = AudioEngine.MELODY[this.step % AudioEngine.MELODY.length];
      const b = AudioEngine.BASS[this.step % AudioEngine.BASS.length];
      if (m) this.note(AudioEngine.midi(m), 0.18, "square", 0.5, this.musicGain);
      if (b) this.note(AudioEngine.midi(b), 0.22, "triangle", 0.7, this.musicGain);
      this.step++;
    }, 200);
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  setMuted(muted: boolean) {
    this.master.gain.value = muted ? 0 : 0.5;
  }

  // Music volume relative to the SFX bus (0..1).
  setMusicVolume(v: number) {
    this.musicGain.gain.value = 0.34 * Math.max(0, Math.min(1, v));
  }

  resume() {
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  sfx(name: "throw" | "tree" | "water" | "basket" | "win" | "chains") {
    switch (name) {
      case "chains": {
        // Metallic rattle for a near-miss off the chains.
        for (let i = 0; i < 5; i++) {
          setTimeout(() => this.note(900 + Math.random() * 700, 0.05, "square", 0.18, this.master), i * 38);
        }
        break;
      }
      case "throw": {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(660, t);
        osc.frequency.exponentialRampToValueAtTime(220, t + 0.18);
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        osc.connect(g);
        g.connect(this.master);
        osc.start(t);
        osc.stop(t + 0.22);
        break;
      }
      case "tree":
        this.note(140, 0.12, "square", 0.4, this.master);
        break;
      case "water":
        this.noise(0.3, 0.35);
        break;
      case "basket":
        [72, 76, 79].forEach((n, i) =>
          setTimeout(() => this.note(AudioEngine.midi(n), 0.18, "square", 0.5, this.master), i * 70),
        );
        break;
      case "win":
        [72, 74, 76, 79, 84].forEach((n, i) =>
          setTimeout(() => this.note(AudioEngine.midi(n), 0.22, "square", 0.5, this.master), i * 110),
        );
        break;
    }
  }

  close() {
    this.stopMusic();
    void this.ctx.close();
  }
}

// Pure one-frame flight step — the single source of truth for disc physics, so
// the on-screen trajectory preview matches the real flight exactly. Mutates the
// passed flight object; returns what happened this frame.
type Flight = { x: number; y: number; vx: number; vy: number; h: number; vh: number; fadeTurn: number };
type StepStatus = "fly" | "stop" | "hole" | "oob" | "ob";

function inRect(r: Water, x: number, y: number) {
  return x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
}
// Distance from a point to a line segment.
function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
// Distance from a point to a polyline (the fairway centerline).
function distToPath(px: number, py: number, pts: Vec[]) {
  let m = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distToSeg(px, py, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
    if (d < m) m = d;
  }
  return m;
}
function inAnyOB(hole: Hole, x: number, y: number) {
  if (x < 2 || x > W - 2 || y < 2 || y > hole.worldH - 2) return true;
  // Anything more than half the fairway width from the curved centerline is OB.
  if (distToPath(x, y, hole.fairway) > hole.fwWidth / 2) return true;
  for (const w of hole.water) if (inRect(w, x, y)) return true;
  return false;
}

// Deterministic RNG so the Daily Challenge is identical for everyone that day.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// The day's seed (UTC) — everyone gets the same daily course.
function dailySeed() {
  return Math.floor(Date.now() / 86_400_000);
}
// Pull a candidate pin back toward the (on-centerline) base until it sits safely
// inside the fairway ribbon, so a moved pin is always reachable and in-bounds.
function clampPin(p: Vec, fairway: Vec[], maxOff: number, base: Vec): Vec {
  let q = { ...p };
  for (let k = 0; k < 10 && distToPath(q.x, q.y, fairway) > maxOff; k++) {
    q = { x: q.x + (base.x - q.x) * 0.35, y: q.y + (base.y - q.y) * 0.35 };
  }
  return q;
}
// A gentle, seeded wind vector for one hole.
function seededWind(rng: () => number): { wind: Vec; windMag: number } {
  const ang = rng() * Math.PI * 2;
  const mag = 0.004 + rng() * 0.014; // per-frame airborne push (gentle)
  return { wind: { x: Math.cos(ang) * mag, y: Math.sin(ang) * mag }, windMag: mag };
}
// A point a fraction `t` along a polyline (by arc length).
function pointOnPath(pts: Vec[], t: number): Vec {
  const segs: number[] = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    segs.push(d);
    total += d;
  }
  let target = t * total;
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i] || i === segs.length - 1) {
      const f = segs[i] ? target / segs[i] : 0;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * f, y: pts[i].y + (pts[i + 1].y - pts[i].y) * f };
    }
    target -= segs[i];
  }
  return pts[pts.length - 1];
}
// Procedurally author one hole (template space) from the RNG: a forward-running
// curved fairway with doglegs, guard trees, and the odd pond/sand.
function genDailyHole(rng: () => number): Hole {
  const r = (a: number, b: number) => a + rng() * (b - a);
  const pickN = (arr: number[]) => arr[Math.floor(rng() * arr.length)];
  const par = pickN([3, 3, 3, 4, 4, 4, 4, 5, 5]);
  const basketX = Math.round(r(74, 246));
  const basketY = Math.round(r(72, 138));
  const nBends = par <= 3 ? 1 : par === 4 ? (rng() < 0.5 ? 1 : 2) : 2;
  const pts: Vec[] = [{ x: 160, y: 416 }];
  let prevX = 160;
  for (let i = 1; i <= nBends; i++) {
    const t = i / (nBends + 1);
    const y = Math.round(416 + (basketY - 416) * t);
    prevX = Math.round(Math.max(64, Math.min(248, prevX + r(-72, 72))));
    pts.push({ x: prevX, y });
  }
  pts.push({ x: basketX, y: basketY });
  let fwWidth = Math.round(par <= 3 ? r(104, 124) : par === 4 ? r(112, 140) : r(122, 150));
  if (rng() < 0.2) fwWidth = Math.round(fwWidth * 0.82); // occasional tunnel
  const elev = pickN([-2, -1, -1, 0, 0, 1, 1, 2]);

  const trees: Tree[] = [];
  const addTree = (p: Vec, side: number, extra: number) => {
    const tx = Math.round(p.x + side * (fwWidth / 2 + extra));
    if (tx < 16 || tx > 304 || p.y > 348 || p.y < 96) return;
    trees.push({ x: tx, y: Math.round(p.y), r: Math.round(r(12, 14)) });
  };
  for (let i = 1; i <= nBends; i++) {
    const p = pts[i];
    const turn = Math.sign((pts[i + 1].x - p.x) - (p.x - pts[i - 1].x)) || (rng() < 0.5 ? 1 : -1);
    addTree(p, -turn, r(0, 10)); // guard the inside of the dogleg
  }
  const nExtra = Math.floor(r(1, 3));
  for (let k = 0; k < nExtra; k++) addTree(pointOnPath(pts, r(0.25, 0.8)), rng() < 0.5 ? 1 : -1, r(2, 16));

  const sideBox = (p: Vec, wMin: number, wMax: number, hMin: number, hMax: number, inset: number): Water => {
    const side = rng() < 0.5 ? 1 : -1;
    const w = Math.round(r(wMin, wMax));
    const h = Math.round(r(hMin, hMax));
    const cxp = p.x + side * (fwWidth / 2 - inset);
    const x = Math.round(Math.max(8, Math.min(300 - w, cxp - (side < 0 ? w : 0))));
    return { x, y: Math.round(p.y - h / 2), w, h };
  };
  const water: Water[] = rng() < 0.35 ? [sideBox(pointOnPath(pts, r(0.4, 0.72)), 46, 74, 26, 44, 6)] : [];
  const hazard: Water[] = rng() < 0.32 ? [sideBox(pointOnPath(pts, r(0.3, 0.78)), 24, 36, 18, 26, 10)] : [];

  return materializeHole({ par, tee: TEE, basket: { x: basketX, y: basketY }, fairway: pts, fwWidth, trees, water, hazard, elev });
}
// A fresh, seeded 9-hole course — different every day (the Daily Challenge).
function generateDailyCourse(rng: () => number): Hole[] {
  const holes: Hole[] = [];
  for (let i = 0; i < 9; i++) {
    const h = genDailyHole(rng);
    const { wind, windMag } = seededWind(rng);
    holes.push({ ...h, wind, windMag });
  }
  return holes;
}
// Build one playable round. Daily = a new 9-hole course; course = the 18 fixed
// Glendoveer holes with seeded wind + a jittered pin. Same seed ⇒ same round.
function buildRound(seed: number, mode: Mode): Hole[] {
  const rng = mulberry32(seed);
  if (mode === "daily") return generateDailyCourse(rng);
  return HOLES.map((h, i) => {
    const { wind, windMag } = seededWind(rng);
    const base = h.basket;
    const pin = clampPin(
      { x: base.x + (rng() * 2 - 1) * 22, y: base.y + (rng() * 2 - 1) * 16 },
      h.fairway,
      h.fwWidth / 2 - 9,
      base,
    );
    return { ...h, basket: pin, wind, windMag, elev: HOLE_ELEV[i] ?? 0 };
  });
}
// Carry multiplier from elevation: uphill (+) shortens, downhill (−) lengthens.
// Strong enough to clearly change where a throw lands (±~20% at ±2).
function elevMul(elev: number | undefined) {
  return 1 - (elev ?? 0) * 0.1;
}
// Ground roll-out also depends on slope: downhill rolls farther, uphill checks
// up quickly. Higher friction value = less deceleration = more roll.
function elevGroundFriction(elev: number | undefined) {
  return Math.max(0.7, Math.min(0.92, GROUND_FRICTION - (elev ?? 0) * 0.025));
}
// Best-effort haptics on mobile (no-op where unsupported).
function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* ignore */ }
}
// Forward carry of a full-power throw with this disc (obstacle-free, straight),
// in world px — used to draw the "reach" line. Mirrors the real flight physics
// including the hole's elevation and the straight-flight speed boost.
function fullPowerRange(disc: Disc, elev: number | undefined, speedMul = 1): number {
  let y = 0;
  let vy = disc.power * (1.2 + 3.35) * speedMul * elevMul(elev); // power = 1
  let h = 0;
  let vh = disc.arc; // power = 1
  for (let i = 0; i < 600; i++) {
    y += vy;
    h += vh;
    vh -= GRAVITY;
    if (h <= 0) { h = 0; vh = 0; }
    const airborne = h > AIRBORNE_H;
    vy *= airborne ? disc.friction : elevGroundFriction(elev);
    if (!airborne && vy < STOP_SPEED) break;
  }
  return y;
}
// Where the disc was last in bounds. Walk the disc's recorded flight path
// backward and return the last point that's in bounds — so OB plays from where
// it crossed, never a full rethrow. `trail[0]` is the launch point (always in
// bounds), so this always finds a valid lie; `fallback` is a final safety net.
function lastInBoundsLie(trail: Vec[], hole: Hole, fallback: Vec): Vec {
  for (let i = trail.length - 1; i >= 0; i--) {
    if (!inAnyOB(hole, trail[i].x, trail[i].y)) return { x: trail[i].x, y: trail[i].y };
  }
  return { x: fallback.x, y: fallback.y };
}

function stepFlight(f: Flight, disc: Disc, fadeSign: number, path: FlightPath, hole: Hole): { status: StepStatus; treeHit: boolean } {
  f.x += f.vx;
  f.y += f.vy;
  f.h += f.vh;
  f.vh -= GRAVITY;
  if (f.h <= 0) {
    f.h = 0;
    f.vh = 0;
  }
  const airborne = f.h > AIRBORNE_H;
  const sp = Math.hypot(f.vx, f.vy);
  if (airborne && sp > 0.6 && Math.abs(f.fadeTurn) < MAX_FADE_TURN) {
    // Overstable bends steadily one way. Straight turns the OTHER way while
    // climbing (high-speed turn), then fades back while descending — an S that
    // finishes slightly toward the fade side.
    const a =
      path === "straight"
        ? (f.vh > 0 ? -fadeSign * disc.turn : fadeSign * disc.sFade)
        : fadeSign * disc.fade;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const nvx = f.vx * cos - f.vy * sin;
    const nvy = f.vx * sin + f.vy * cos;
    f.vx = nvx;
    f.vy = nvy;
    f.fadeTurn += a;
  }
  // Wind catches the disc while it's in the air (not once it's on the ground).
  if (airborne && hole.wind) {
    f.vx += hole.wind.x;
    f.vy += hole.wind.y;
  }
  const friction = airborne ? disc.friction : elevGroundFriction(hole.elev);
  f.vx *= friction;
  f.vy *= friction;

  if (f.x < 2 || f.x > W - 2 || f.y < 2 || f.y > hole.worldH - 2) return { status: "oob", treeHit: false };

  // Trees are tall — they block at ANY height, so you must go around them.
  let treeHit = false;
  for (const tr of hole.trees) {
    const dist = Math.hypot(f.x - tr.x, f.y - tr.y);
    const min = tr.r + DISC_R;
    if (dist < min && dist > 0) {
      const nx = (f.x - tr.x) / dist;
      const ny = (f.y - tr.y) / dist;
      f.x = tr.x + nx * min;
      f.y = tr.y + ny * min;
      const dot = f.vx * nx + f.vy * ny;
      f.vx = (f.vx - 2 * dot * nx) * 0.45;
      f.vy = (f.vy - 2 * dot * ny) * 0.45;
      treeHit = true;
    }
  }

  // The basket and OB only interact at ground level (you fly over them). A disc
  // only "lands" while descending or grounded (vh <= 0) — so on takeoff it can
  // climb up and OVER water/OB right next to the lie instead of instantly going
  // OB before it has gained any height.
  if (!airborne) {
    const settling = f.vh <= 0;
    if (settling) {
      if (Math.hypot(f.x - hole.basket.x, f.y - hole.basket.y) < CATCH_R) return { status: "hole", treeHit };
      // Off the curved fairway, or in water, is out of bounds.
      if (distToPath(f.x, f.y, hole.fairway) > hole.fwWidth / 2) return { status: "ob", treeHit };
      for (const wt of hole.water) if (inRect(wt, f.x, f.y)) return { status: "ob", treeHit };
    }
    // Hazards (sand) don't stop the disc — they only cost a stroke if it comes
    // to rest in one, handled where "stop" is processed.
    if (sp < STOP_SPEED) return { status: "stop", treeHit };
  }
  return { status: "fly", treeHit };
}

export function DiscGolfGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  // Drag-to-throw (Wii-golf style): pull back to set power + aim, release to throw.
  const dragRef = useRef<{ active: boolean; cx: number; cy: number }>({ active: false, cx: 0, cy: 0 });
  const camRef = useRef(0); // current camera scroll, mirrored for the pointer handlers
  const rangeFlashRef = useRef(0); // when a disc was last switched (brightens the reach line)
  const audioRef = useRef<AudioEngine | null>(null);
  const rafRef = useRef<number>(0);

  const [screen, setScreen] = useState<Screen>("title");
  const [muted, setMuted] = useState(false);
  const [discIndex, setDiscIndex] = useState(1); // Mid by default
  const [throwStyle, setThrowStyle] = useState<"BH" | "FH">("BH");
  const [flightPath, setFlightPath] = useState<FlightPath>("overstable");
  const [hud, setHud] = useState({ hole: 1, par: 3, throws: 0, holes: 18 });

  // End-of-round state
  const [scorecard, setScorecard] = useState<number[]>([]);
  const [finalTotal, setFinalTotal] = useState(0);
  const [finalPars, setFinalPars] = useState<number[]>(HOLES.map((h) => h.par));
  const [finalMode, setFinalMode] = useState<Mode>("course");
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [leaderboard, setLeaderboard] = useState<ArcadeScore[]>([]);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const screenRef = useRef<Screen>("title");
  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  const discIndexRef = useRef(1);
  useEffect(() => {
    discIndexRef.current = discIndex;
  }, [discIndex]);

  const throwStyleRef = useRef<"BH" | "FH">("BH");
  useEffect(() => {
    throwStyleRef.current = throwStyle;
  }, [throwStyle]);

  const flightPathRef = useRef<FlightPath>("overstable");
  useEffect(() => {
    flightPathRef.current = flightPath;
  }, [flightPath]);

  // ── Settings (persisted) ──
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.7);
  const [leftHanded, setLeftHanded] = useState(false);
  const leftHandedRef = useRef(false);
  useEffect(() => { leftHandedRef.current = leftHanded; }, [leftHanded]);
  const [advanced, setAdvanced] = useState(false);
  const advancedRef = useRef(false);
  useEffect(() => { advancedRef.current = advanced; }, [advanced]);
  const modeRef = useRef<Mode>("course");

  // Best-per-hole, achievements, round history (all persisted).
  const holeBestRef = useRef<(number | null)[]>(Array(18).fill(null));
  const [holeBestNote, setHoleBestNote] = useState<{ best: number; isNew: boolean } | null>(null);
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const unlockedRef = useRef<string[]>([]);
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const [roundsPlayed, setRoundsPlayed] = useState(0);
  const roundsPlayedRef = useRef(0);

  // Read all persisted progress from localStorage into state/refs. Runs once on
  // mount and again after a cloud sync overwrites localStorage.
  const loadLocal = useCallback(() => {
    try {
      const best = localStorage.getItem(BEST_KEY);
      setBestScore(best && Number.isFinite(Number(best)) ? Number(best) : null);

      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      if (s.throwStyle === "BH" || s.throwStyle === "FH") setThrowStyle(s.throwStyle);
      if (s.flightPath === "overstable" || s.flightPath === "straight") setFlightPath(s.flightPath);
      if (typeof s.musicVolume === "number") setMusicVolume(s.musicVolume);
      if (typeof s.leftHanded === "boolean") setLeftHanded(s.leftHanded);
      if (typeof s.advanced === "boolean") setAdvanced(s.advanced);

      const hb = JSON.parse(localStorage.getItem(HOLEBEST_KEY) || "null");
      holeBestRef.current = Array(18).fill(null).map((_, i) => (Array.isArray(hb) && typeof hb[i] === "number" ? hb[i] : null));
      const ach = JSON.parse(localStorage.getItem(ACH_KEY) || "[]");
      if (Array.isArray(ach)) { unlockedRef.current = ach; setUnlocked(ach); }
      const hist = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
      if (Array.isArray(hist)) { roundsPlayedRef.current = hist.length; setRoundsPlayed(hist.length); }
    } catch {
      /* ignore */
    }
  }, []);

  // Load once after mount (keeps SSR/CSR markup identical).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { loadLocal(); }, [loadLocal]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ── Optional login + cloud progress (Supabase auth user_metadata) ──
  const supa = getSupabase();
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Push the current local progress up to the signed-in user's metadata.
  const pushCloud = useCallback(async (p?: Progress) => {
    if (!supa) return;
    try {
      const { data } = await supa.auth.getUser();
      if (!data.user) return;
      await supa.auth.updateUser({ data: { arcade_progress: p ?? readLocalProgress() } });
    } catch { /* ignore */ }
  }, [supa]);

  // Debounced cloud save (called after rounds, hole bests, settings changes).
  const saveProgress = useCallback(() => {
    if (!supa || !user) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void pushCloud(); }, 1200);
  }, [supa, user, pushCloud]);

  // On sign-in (and at startup if already signed in), merge cloud progress with
  // local so nothing is lost, then write the union back.
  useEffect(() => {
    if (!supa) return;
    let active = true;
    const onSession = async (sessUser: { email?: string; user_metadata?: { arcade_progress?: Progress } } | null) => {
      if (!active) return;
      if (!sessUser) { setUser(null); return; }
      setUser({ email: sessUser.email ?? "player" });
      const cloud = sessUser.user_metadata?.arcade_progress;
      const merged = cloud ? mergeProgress(readLocalProgress(), cloud) : readLocalProgress();
      if (cloud) { applyProgress(merged); loadLocal(); }
      await pushCloud(merged);
    };
    const { data: sub } = supa.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") void onSession(session?.user ?? null);
      else if (event === "SIGNED_OUT") setUser(null);
      // ignore TOKEN_REFRESHED / USER_UPDATED to avoid update loops
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [supa, loadLocal, pushCloud]);

  const signIn = useCallback(async () => {
    if (!supa) return;
    setAuthBusy(true); setAuthErr(null); setAuthMsg(null);
    const { error } = await supa.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword });
    if (error) setAuthErr(error.message);
    else { setAuthOpen(false); setAuthPassword(""); }
    setAuthBusy(false);
  }, [supa, authEmail, authPassword]);

  const signUp = useCallback(async () => {
    if (!supa) return;
    setAuthBusy(true); setAuthErr(null); setAuthMsg(null);
    const { data, error } = await supa.auth.signUp({
      email: authEmail.trim(),
      password: authPassword,
      options: { emailRedirectTo: typeof location !== "undefined" ? location.origin : undefined },
    });
    if (error) setAuthErr(error.message);
    else if (!data.session) setAuthMsg("Account created — check your email to confirm, then log in.");
    else { setAuthOpen(false); setAuthPassword(""); }
    setAuthBusy(false);
  }, [supa, authEmail, authPassword]);

  const signOut = useCallback(async () => {
    if (!supa) return;
    await supa.auth.signOut();
    setUser(null);
  }, [supa]);

  // Persist settings + push the music volume to the live engine.
  useEffect(() => {
    audioRef.current?.setMusicVolume(musicVolume);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ throwStyle, flightPath, musicVolume, leftHanded, advanced }));
    } catch { /* ignore */ }
    saveProgress();
  }, [throwStyle, flightPath, musicVolume, leftHanded, advanced, saveProgress]);

  const syncHud = useCallback(() => {
    const g = stateRef.current;
    if (!g) return;
    setHud({ hole: g.holeIndex + 1, par: g.roundHoles[g.holeIndex].par, throws: g.throws, holes: g.roundHoles.length });
  }, []);

  const startGame = useCallback((mode?: Mode) => {
    const m = mode ?? modeRef.current;
    modeRef.current = m;
    if (!audioRef.current) {
      audioRef.current = new AudioEngine();
      audioRef.current.setMusicVolume(musicVolume);
    }
    audioRef.current.resume();
    audioRef.current.setMuted(muted);
    audioRef.current.startMusic();
    const seed = m === "daily" ? dailySeed() : (Math.random() * 1e9) | 0;
    const roundHoles = buildRound(seed, m);
    const adv = advancedRef.current;
    const discIndex = Math.min(discIndexRef.current, activeDiscs(adv).length - 1);
    stateRef.current = {
      holeIndex: 0, scores: [], discIndex,
      mode: m, advanced: adv, seed, roundHoles, ...freshHole(roundHoles[0]),
    };
    setSaved(false);
    setSaveErr(null);
    setIsNewBest(false);
    setNewAchievements([]);
    setHoleBestNote(null);
    setSettingsOpen(false);
    setScreen("playing");
    syncHud();
  }, [muted, musicVolume, syncHud]);

  const selectDisc = useCallback((i: number) => {
    setDiscIndex(i);
    if (stateRef.current) stateRef.current.discIndex = i;
    rangeFlashRef.current = performance.now(); // emphasize the reach line briefly
  }, []);

  // Toggling the advanced bag resets to a sensible default disc (the bags don't
  // line up index-for-index).
  const handleSetAdvanced = useCallback((v: boolean) => {
    setAdvanced(v);
    const def = v ? 4 : 1; // Teebird / Mid
    setDiscIndex(def);
    if (stateRef.current) stateRef.current.discIndex = Math.min(def, activeDiscs(v).length - 1);
  }, []);

  const throwDisc = useCallback(() => {
    const g = stateRef.current;
    if (!g || g.phase !== "aim") return;
    const hole = g.roundHoles[g.holeIndex];
    const disc = activeDiscs(g.advanced)[g.discIndex];
    // Advanced discs fly their baked-in shape (e.g. Nuke OS overstable,
    // Destroyer straight); simple mode uses the overstable/straight toggle.
    g.path = g.advanced ? disc.flight ?? "straight" : flightPathRef.current;
    // Slower launch + extra glide (disc friction) so it floats across the
    // fairway. Straight throws carry farther; uphill (+elev) shortens carry.
    const pathMul = g.path === "straight" ? STRAIGHT_SPEED_MUL : 1;
    const speed = disc.power * (1.2 + g.power * 3.35) * pathMul * elevMul(hole.elev);
    g.disc.vx = Math.cos(g.angle) * speed;
    g.disc.vy = Math.sin(g.angle) * speed;
    g.rest = { x: g.disc.x, y: g.disc.y };
    g.trailBuf = [{ x: g.disc.x, y: g.disc.y }]; // start recording the flight path
    // Backhand fades left, forehand fades right — mirrored for a lefty.
    const lh = leftHandedRef.current ? -1 : 1;
    g.fadeSign = (throwStyleRef.current === "BH" ? -1 : 1) * lh;
    g.fadeTurn = 0;
    // Launch upward — height scales with power and the disc's arc, so a putter
    // stays low (lands near the basket to catch) while a driver climbs to clear
    // hazards.
    g.h = 0;
    g.vh = g.power * disc.arc;
    g.throws += 1;
    g.phase = "fly";
    audioRef.current?.sfx("throw");
    vibrate(12);
    syncHud();
  }, [syncHud]);

  const finishGame = useCallback((scores: number[]) => {
    const g = stateRef.current;
    const mode = g?.mode ?? modeRef.current;
    const pars = g ? g.roundHoles.map((h) => h.par) : HOLES.map((h) => h.par);
    const total = scores.reduce((s, n) => s + n, 0);
    setScorecard(scores);
    setFinalTotal(total);
    setFinalPars(pars);
    setFinalMode(mode);

    // Personal best is only tracked for the fixed 18-hole Glendoveer course
    // (the daily course is different every day, so an all-time best is moot).
    if (mode === "course") {
      let prior: number | null = null;
      try {
        const raw = localStorage.getItem(BEST_KEY);
        prior = raw ? Number(raw) : null;
        if (prior != null && !Number.isFinite(prior)) prior = null;
      } catch {
        /* ignore */
      }
      const newBest = prior == null || total < prior;
      const best = newBest ? total : prior!;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* ignore */ }
      setBestScore(best);
      setIsNewBest(newBest);
    } else {
      setIsNewBest(false);
    }

    // Round history (drives "rounds played" + the Regular achievement).
    let hist: { mode: Mode; total: number; date: number }[] = [];
    try { hist = JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); } catch { /* ignore */ }
    hist.push({ mode, total, date: Date.now() });
    try { localStorage.setItem(HIST_KEY, JSON.stringify(hist.slice(-100))); } catch { /* ignore */ }
    roundsPlayedRef.current = hist.length;
    setRoundsPlayed(hist.length);

    // Achievements — unlock any newly-earned ones (judged against this round's pars).
    const earned = earnedAchievements(scores, pars, mode, hist.length);
    const fresh = earned.filter((id) => !unlockedRef.current.includes(id));
    if (fresh.length) {
      const all = [...unlockedRef.current, ...fresh];
      unlockedRef.current = all;
      setUnlocked(all);
      try { localStorage.setItem(ACH_KEY, JSON.stringify(all)); } catch { /* ignore */ }
    }
    setNewAchievements(fresh.map((id) => ACHIEVEMENTS.find((a) => a.id === id)!).filter(Boolean));

    audioRef.current?.sfx("win");
    vibrate([20, 40, 20]);
    setScreen("gameComplete");
    if (mode === "course") void getArcadeLeaderboard().then(setLeaderboard).catch(() => {});
    else setLeaderboard([]);
    saveProgress(); // sync best/achievements/history to the cloud if signed in
  }, [saveProgress]);

  const nextHole = useCallback(() => {
    const g = stateRef.current;
    if (!g) return;
    if (g.holeIndex + 1 >= g.roundHoles.length) {
      finishGame(g.scores.slice());
      return;
    }
    g.holeIndex += 1;
    Object.assign(g, freshHole(g.roundHoles[g.holeIndex]));
    g.discIndex = discIndexRef.current;
    setScreen("playing");
    syncHud();
  }, [syncHud, finishGame]);

  const saveScore = useCallback(async () => {
    if (saving || saved) return;
    setSaving(true);
    setSaveErr(null);
    try {
      await submitArcadeScore(nameInput, finalTotal);
      setSaved(true);
      const lb = await getArcadeLeaderboard();
      setLeaderboard(lb);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [saving, saved, nameInput, finalTotal]);

  // Render the finished round to an image and share it (or download as fallback).
  const shareCard = useCallback(async () => {
    const total = finalTotal;
    const parTotal = finalPars.reduce((s, n) => s + n, 0);
    const over = total - parTotal;
    const nHoles = finalPars.length;
    const isDaily = finalMode === "daily";
    const courseName = isDaily ? `Daily Challenge · ${nHoles} holes · par ${parTotal}` : `Glendoveer East · ${nHoles} holes · par ${parTotal}`;
    const os = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
    const cv = document.createElement("canvas");
    cv.width = 600;
    cv.height = 320;
    const c = cv.getContext("2d");
    if (!c) return;
    c.fillStyle = "#0f1117";
    c.fillRect(0, 0, 600, 320);
    c.textAlign = "left";
    c.fillStyle = "#36D7B7";
    c.font = "bold 32px ui-monospace, monospace";
    c.fillText("DISC GOLF", 28, 52);
    c.fillStyle = "#9aa";
    c.font = "15px ui-monospace, monospace";
    c.fillText(courseName, 28, 78);
    c.fillStyle = "#fff";
    c.font = "bold 56px ui-monospace, monospace";
    c.fillText(`${total}`, 28, 150);
    c.fillStyle = over <= 0 ? "#36D7B7" : "#e08a3b";
    c.font = "bold 26px ui-monospace, monospace";
    c.fillText(over === 0 ? "Even par" : os(over), 120, 150);
    // hole strip (up to 9 per row)
    const perRow = Math.min(9, nHoles);
    const cellW = Math.min(48, Math.floor(540 / perRow));
    const x0 = 28;
    const y0 = 196;
    for (let i = 0; i < nHoles; i++) {
      const x = x0 + (i % perRow) * cellW;
      const y = y0 + Math.floor(i / perRow) * 54;
      const s = scorecard[i];
      const diff = (s ?? finalPars[i]) - finalPars[i];
      c.fillStyle = "#9aa";
      c.font = "11px ui-monospace, monospace";
      c.textAlign = "center";
      c.fillText(`${i + 1}`, x + cellW / 2, y);
      c.fillStyle = s == null ? "#555" : diff < 0 ? "#36D7B7" : diff > 1 ? "#e23b3b" : diff === 1 ? "#f5d24a" : "#fff";
      c.font = "bold 18px ui-monospace, monospace";
      c.fillText(s != null ? `${s}` : "–", x + cellW / 2, y + 22);
    }
    c.textAlign = "left";
    c.fillStyle = "#667";
    c.font = "12px ui-monospace, monospace";
    c.fillText("play it yourself · disc-golf-arcade.vercel.app", 28, 308);

    await new Promise<void>((resolve) => {
      cv.toBlob(async (blob) => {
        if (!blob) return resolve();
        const file = new File([blob], "discgolf-scorecard.png", { type: "image/png" });
        const where = isDaily ? "today's Daily Challenge" : "Glendoveer East";
        try {
          const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
          if (nav.canShare?.({ files: [file] })) {
            await nav.share({ files: [file], title: "Disc Golf", text: `I shot ${total} (${os(over)}) on ${where}!` });
            return resolve();
          }
        } catch {
          /* fall through to download */
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "discgolf-scorecard.png";
        a.click();
        URL.revokeObjectURL(url);
        resolve();
      }, "image/png");
    });
  }, [finalTotal, finalPars, finalMode, scorecard]);

  // When a hole finishes, record/show the best-ever strokes for that hole.
  // Only for Glendoveer — the daily course's holes change every day.
  useEffect(() => {
    if (screen !== "holeComplete") return;
    const g = stateRef.current;
    if (!g || g.mode !== "course") { setHoleBestNote(null); return; }
    const idx = g.holeIndex;
    const s = g.scores[idx];
    if (typeof s !== "number") return;
    const prev = holeBestRef.current[idx];
    const isNew = prev == null || s < prev;
    const best = isNew ? s : prev;
    if (isNew) {
      const arr = holeBestRef.current.slice();
      arr[idx] = s;
      holeBestRef.current = arr;
      try { localStorage.setItem(HOLEBEST_KEY, JSON.stringify(arr)); } catch { /* ignore */ }
      saveProgress();
    }
    setHoleBestNote({ best: best as number, isNew });
  }, [screen, saveProgress]);

  // Keyboard
  useEffect(() => {
    function onDown(e: KeyboardEvent) {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Enter"].includes(e.key)) e.preventDefault();
      keysRef.current.add(e.key);
      if (e.key >= "1" && e.key <= "9") {
        const n = Number(e.key) - 1;
        if (n < activeDiscs(advancedRef.current).length) selectDisc(n);
      }
      if (e.key === "b" || e.key === "B") setThrowStyle("BH");
      if (e.key === "f" || e.key === "F") setThrowStyle("FH");
      if (e.key === " " || e.key === "Enter") {
        if (screenRef.current === "title") startGame();
        else if (screenRef.current === "holeComplete") nextHole();
      }
    }
    function onUp(e: KeyboardEvent) {
      keysRef.current.delete(e.key);
    }
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [startGame, nextHole, selectDisc]);

  // Main loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx0 = canvas.getContext("2d");
    if (!ctx0) return;
    const ctx = ctx0;

    function update() {
      const g = stateRef.current;
      if (!g || screenRef.current !== "playing") return;
      const hole = g.roundHoles[g.holeIndex];
      const maxCam = Math.max(0, hole.worldH - H);

      // Intro fly-over: hold on the basket, then pan down to the tee, then play.
      if (g.phase === "intro") {
        const HOLD = 26;
        const PAN = 60;
        g.introT += 1;
        if (g.introT <= HOLD) {
          g.camY = 0;
        } else {
          const p = Math.min(1, (g.introT - HOLD) / PAN);
          g.camY = p * p * (3 - 2 * p) * maxCam; // smoothstep
        }
        if (g.introT >= HOLD + PAN) {
          g.camY = maxCam;
          g.phase = "aim";
        }
        camRef.current = g.camY;
        return;
      }

      // Camera follows the disc, keeping it ~66% down so the fairway ahead shows.
      const camTarget = Math.min(maxCam, Math.max(0, g.disc.y - H * 0.66));
      g.camY += (camTarget - g.camY) * 0.16;
      camRef.current = g.camY;

      if (g.phase === "aim") {
        // Aim + power are driven by the pointer drag handlers; nothing to do here.
      } else if (g.phase === "fly") {
        const d = g.disc;
        const disc = activeDiscs(g.advanced)[g.discIndex];
        const f: Flight = { x: d.x, y: d.y, vx: d.vx, vy: d.vy, h: g.h, vh: g.vh, fadeTurn: g.fadeTurn };
        const res = stepFlight(f, disc, g.fadeSign, g.path, hole);
        d.x = f.x;
        d.y = f.y;
        d.vx = f.vx;
        d.vy = f.vy;
        g.h = f.h;
        g.vh = f.vh;
        g.fadeTurn = f.fadeTurn;
        g.trailBuf.push({ x: d.x, y: d.y }); // record the real flight curve
        if (res.treeHit) audioRef.current?.sfx("tree");

        if (res.status === "hole") {
          g.phase = "holed";
          g.holedAt = performance.now();
          d.vx = 0;
          d.vy = 0;
          d.x = hole.basket.x;
          d.y = hole.basket.y;
          g.trailBuf.push({ x: hole.basket.x, y: hole.basket.y });
          g.shotPaths.push(g.trailBuf);
          g.trailBuf = [];
          audioRef.current?.sfx("basket");
          vibrate([15, 30, 15]);
        } else if (res.status === "ob" || res.status === "oob") {
          // OUT OF BOUNDS: +1 and play from where it crossed the line.
          const inWater = hole.water.some((w) => inRect(w, f.x, f.y));
          audioRef.current?.sfx(inWater ? "water" : "tree");
          vibrate(60);
          // Replay from the last point the disc was actually in bounds (walk the
          // recorded flight path back), falling back to this throw's start.
          const lie = lastInBoundsLie(g.trailBuf, hole, g.rest);
          g.throws += 1;
          g.flash = { text: "OUT OF BOUNDS", at: performance.now() };
          d.x = lie.x;
          d.y = lie.y;
          d.vx = 0;
          d.vy = 0;
          g.h = 0;
          g.vh = 0;
          g.rest = { x: lie.x, y: lie.y };
          g.lies.push({ x: lie.x, y: lie.y });
          g.shotPaths.push(g.trailBuf); // the curve out to where it crossed OB
          g.trailBuf = [];
          g.angle = aimAt(g.rest, hole.basket);
          g.phase = "aim";
          syncHud();
        } else if (res.status === "stop") {
          // Came to rest. If it's in a hazard (sand), +1 but play where it lies.
          d.vx = 0;
          d.vy = 0;
          g.rest = { x: d.x, y: d.y };
          // Chains rattle when it stops just short of the basket (a near miss).
          const distPin = Math.hypot(d.x - hole.basket.x, d.y - hole.basket.y);
          if (distPin < CATCH_R * 2.4) audioRef.current?.sfx("chains");
          if ((hole.hazard ?? []).some((hz) => inRect(hz, d.x, d.y))) {
            g.throws += 1;
            g.flash = { text: "HAZARD", at: performance.now() };
            audioRef.current?.sfx("tree");
            vibrate(60);
            syncHud();
          }
          g.lies.push({ x: d.x, y: d.y });
          g.shotPaths.push(g.trailBuf);
          g.trailBuf = [];
          g.angle = aimAt(g.rest, hole.basket); // auto-aim at the basket
          g.phase = "aim";
        }
      } else if (g.phase === "holed") {
        if (g.holedAt && performance.now() - g.holedAt > 850) {
          g.scores[g.holeIndex] = g.throws;
          setScreen("holeComplete");
          syncHud();
        }
      }
    }

    function draw() {
      const g = stateRef.current;
      if (!g) return;
      const hole = g.roundHoles[g.holeIndex];
      const cam = g.camY; // world→screen: screenY = worldY - cam

      // Everything outside the fairway is out-of-bounds rough.
      ctx.fillStyle = "#2f5a26";
      ctx.fillRect(0, 0, W, H);
      // Darker rough mowing bands for a little texture.
      const startY = Math.floor(cam / 16) * 16;
      ctx.fillStyle = "#2b5323";
      for (let y = startY; y < cam + H; y += 32) ctx.fillRect(0, y - cam, W, 16);

      // The curved fairway, drawn as a thick ribbon along the centerline. The
      // outer (white) stroke is the OB line; the green stroke inside is the
      // fairway — so doglegs and bends give curved OB edges that follow the hole.
      const fw = hole.fairway;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(fw[0].x, fw[0].y - cam);
      for (let i = 1; i < fw.length; i++) ctx.lineTo(fw[i].x, fw[i].y - cam);
      ctx.strokeStyle = "#eef1e6"; // OB line (ribbon edge)
      ctx.lineWidth = hole.fwWidth;
      ctx.stroke();
      ctx.strokeStyle = "#4d9a39"; // fairway
      ctx.lineWidth = hole.fwWidth - 3;
      ctx.stroke();
      // Mowing stripes inside the fairway.
      ctx.strokeStyle = "#56a541";
      ctx.lineWidth = hole.fwWidth - 3;
      ctx.setLineDash([10, 10]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineJoin = "miter";
      ctx.lineCap = "butt";
      ctx.lineWidth = 1;

      for (const wt of hole.water) {
        const wy = wt.y - cam;
        ctx.fillStyle = "#3a6ea5";
        ctx.fillRect(wt.x, wy, wt.w, wt.h);
        ctx.fillStyle = "#5b8fc4";
        for (let i = 0; i < wt.h; i += 6) ctx.fillRect(wt.x + 2, wy + 3 + i, wt.w - 6, 1);
      }

      // Hazards (sand) — solid sandy ovals, no OB line.
      for (const hz of hole.hazard ?? []) {
        ctx.fillStyle = "#d9c089";
        ctx.beginPath();
        ctx.ellipse(hz.x + hz.w / 2, hz.y - cam + hz.h / 2, hz.w / 2, hz.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#c4a96b";
        ctx.beginPath();
        ctx.ellipse(hz.x + hz.w / 2, hz.y - cam + hz.h / 2, hz.w / 2 - 2, hz.h / 2 - 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Tee pad
      ctx.fillStyle = "#caa46a";
      ctx.fillRect(hole.tee.x - 7, hole.tee.y - cam - 5, 14, 10);
      ctx.fillStyle = "#8a6a3a";
      ctx.fillRect(hole.tee.x - 7, hole.tee.y - cam - 5, 14, 2);

      // Ghost trail: the actual curved flight path of each earlier shot on this
      // hole, with a dot where each came to rest.
      for (const path of g.shotPaths) {
        if (path.length < 2) continue;
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.25;
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y - cam);
        for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y - cam);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineJoin = "miter";
        const end = path[path.length - 1];
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath();
        ctx.arc(end.x, end.y - cam, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      drawBasket(ctx, hole.basket.x, hole.basket.y - cam);
      for (const tr of hole.trees) drawTree(ctx, { x: tr.x, y: tr.y - cam, r: tr.r });

      // Aim: the exact predicted flight path (simulated with the real physics)
      // plus a visible pull-back slider/knob on the disc.
      if (g.phase === "aim") {
        const dr = dragRef.current;
        const aimDisc = activeDiscs(g.advanced)[g.discIndex];
        const lh2 = leftHandedRef.current ? -1 : 1;
        const sign = (throwStyleRef.current === "BH" ? -1 : 1) * lh2;
        const path: FlightPath = g.advanced ? aimDisc.flight ?? "straight" : flightPathRef.current;
        const dsx = g.disc.x;
        const dsy = g.disc.y - cam; // disc screen position

        // Full-power reach for the selected disc: a short tick showing how far it
        // carries. Only shown briefly when switching discs (fading out), and not
        // while lining up a shot. Points up the line toward the basket — or
        // straight up the screen when the basket is off-screen.
        {
          const since = performance.now() - rangeFlashRef.current;
          const SHOW_MS = 2000;
          if (!dr.active && since < SHOW_MS) {
            const range = fullPowerRange(aimDisc, hole.elev, path === "straight" ? STRAIGHT_SPEED_MUL : 1);
            const bsy = hole.basket.y - cam;
            const basketVisible = bsy >= 0 && bsy <= H && hole.basket.x >= 0 && hole.basket.x <= W;
            const ang = basketVisible ? g.angle : -Math.PI / 2; // straight up if off-screen
            const rx = g.disc.x + Math.cos(ang) * range;
            const ry = g.disc.y + Math.sin(ang) * range - cam;
            const half = 2 * CATCH_R; // full length = 2 basket diameters
            const px = -Math.sin(ang); // unit perpendicular to the throw line
            const py = Math.cos(ang);
            if (ry > 14 && ry < H - 2 && rx > 2 && rx < W - 2) {
              const a = Math.max(0, 0.9 * (1 - since / SHOW_MS)); // fade out
              ctx.save();
              ctx.globalAlpha = a;
              ctx.strokeStyle = aimDisc.color;
              ctx.lineWidth = 1.5;
              ctx.lineCap = "round";
              ctx.beginPath();
              ctx.moveTo(rx - px * half, ry - py * half);
              ctx.lineTo(rx + px * half, ry + py * half);
              ctx.stroke();
              ctx.lineCap = "butt";
              ctx.fillStyle = aimDisc.color;
              ctx.font = "7px monospace";
              ctx.textAlign = "center";
              ctx.textBaseline = "bottom";
              ctx.fillText(`${aimDisc.name} max`, rx, ry - half - 2);
              ctx.textBaseline = "middle";
              ctx.restore();
            }
          }
        }

        let kx: number;
        let ky: number;
        let power: number;
        if (dr.active) {
          let pullX = dr.cx - dsx;
          let pullY = dr.cy - dsy;
          const dist = Math.hypot(pullX, pullY) || 0.0001;
          const cl = Math.min(dist, MAX_DRAG);
          pullX = (pullX / dist) * cl;
          pullY = (pullY / dist) * cl;
          kx = dsx + pullX;
          ky = dsy + pullY;
          power = cl / MAX_DRAG;
        } else {
          kx = dsx;
          ky = dsy + 26;
          power = 0;
        }

        // Once pulling back, show a "cancel" area around the disc: release the
        // knob inside it to abort the throw.
        const inCancel = power < CANCEL_POWER;
        if (dr.active) {
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(dsx, dsy, CANCEL_R, 0, Math.PI * 2);
          if (inCancel) {
            ctx.fillStyle = "rgba(226,59,59,0.22)";
            ctx.fill();
            ctx.strokeStyle = "rgba(226,59,59,0.95)";
          } else {
            ctx.strokeStyle = "rgba(255,255,255,0.45)";
          }
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.lineWidth = 1;
          if (inCancel) {
            ctx.fillStyle = "rgba(226,59,59,0.95)";
            ctx.font = "bold 7px ui-monospace, monospace";
            ctx.textAlign = "center";
            ctx.fillText("CANCEL", dsx, dsy - CANCEL_R - 3);
            ctx.textAlign = "left";
          }
        }

        if (dr.active && power > 0.04 && !inCancel) {
          const pathMul = path === "straight" ? STRAIGHT_SPEED_MUL : 1;
          const speed = aimDisc.power * (1.2 + power * 3.35) * pathMul * elevMul(hole.elev);
          const f: Flight = {
            x: g.disc.x, y: g.disc.y,
            vx: Math.cos(g.angle) * speed, vy: Math.sin(g.angle) * speed,
            h: 0, vh: power * aimDisc.arc, fadeTurn: 0,
          };
          const pts: { x: number; y: number }[] = [{ x: f.x, y: f.y }];
          for (let i = 0; i < 360; i++) {
            const r = stepFlight(f, aimDisc, sign, path, hole);
            pts.push({ x: f.x, y: f.y });
            if (r.status !== "fly") break;
          }
          // Only reveal the first half of the flight, fading from solid to gone.
          const shown = Math.max(2, Math.floor(pts.length * 0.5));
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#ffffff";
          for (let i = 0; i < shown - 1; i++) {
            const t = i / (shown - 1);
            ctx.globalAlpha = Math.max(0.04, 0.95 * (1 - Math.pow(t, 1.4)));
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y - cam);
            ctx.lineTo(pts[i + 1].x, pts[i + 1].y - cam);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }

        // Slider track + knob (the pull-back handle), colored by power.
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(dsx, dsy);
        ctx.lineTo(kx, ky);
        ctx.stroke();
        const pc = inCancel ? "#e23b3b" : power < 0.5 ? "#36D7B7" : power < 0.85 ? "#f5d24a" : "#e23b3b";
        ctx.fillStyle = dr.active ? pc : "rgba(255,255,255,0.7)";
        ctx.beginPath();
        ctx.arc(kx, ky, dr.active ? 5 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.stroke();
        ctx.lineWidth = 1;
      }

      // Shadow on the ground + disc lifted by its height.
      const disc = activeDiscs(g.advanced)[g.discIndex];
      const dscreenY = g.disc.y - cam;
      const shadowR = Math.max(1.5, DISC_R - g.h * 0.03);
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath();
      ctx.ellipse(g.disc.x, dscreenY, shadowR, shadowR * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      const discY = dscreenY - g.h;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(g.disc.x, discY, DISC_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = disc.color;
      ctx.fillRect(Math.round(g.disc.x) - 1, Math.round(discY) - 1, 2, 2);

      // ── Mini-map (screen-fixed, top-right) ──
      {
        const s = Math.min(60 / W, (H - 90) / hole.worldH);
        const mw = W * s;
        const mh = hole.worldH * s;
        const ox = W - 7 - mw;
        const oy = 25; // below the HUD pill
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(ox - 3, oy - 3, mw + 6, mh + 6);
        ctx.fillStyle = "#2f5a26"; // rough
        ctx.fillRect(ox, oy, mw, mh);
        // curved fairway ribbon
        ctx.strokeStyle = "#4d9a39";
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.lineWidth = Math.max(3, hole.fwWidth * s);
        ctx.beginPath();
        ctx.moveTo(ox + hole.fairway[0].x * s, oy + hole.fairway[0].y * s);
        for (let i = 1; i < hole.fairway.length; i++) ctx.lineTo(ox + hole.fairway[i].x * s, oy + hole.fairway[i].y * s);
        ctx.stroke();
        ctx.lineJoin = "miter";
        ctx.lineCap = "butt";
        ctx.lineWidth = 1;
        ctx.fillStyle = "#3a6ea5";
        for (const wt of hole.water) ctx.fillRect(ox + wt.x * s, oy + wt.y * s, wt.w * s, wt.h * s);
        ctx.fillStyle = "#d9c089";
        for (const hz of hole.hazard ?? []) ctx.fillRect(ox + hz.x * s, oy + hz.y * s, hz.w * s, hz.h * s);
        ctx.fillStyle = "#234d1f";
        for (const tr of hole.trees) {
          ctx.beginPath();
          ctx.arc(ox + tr.x * s, oy + tr.y * s, Math.max(1.4, tr.r * s), 0, Math.PI * 2);
          ctx.fill();
        }
        // viewport window
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = 1;
        ctx.strokeRect(ox + 0.5, oy + cam * s + 0.5, mw - 1, Math.min(mh, H * s) - 1);
        // basket + disc
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(ox + hole.basket.x * s, oy + hole.basket.y * s, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = disc.color;
        ctx.beginPath();
        ctx.arc(ox + g.disc.x * s, oy + g.disc.y * s, 2.4, 0, Math.PI * 2);
        ctx.fill();

        // ── Wind + elevation panel, under the minimap ──
        const mag = hole.windMag ?? 0;
        const mph = Math.round((mag / 0.018) * 15);
        const wa = Math.atan2(hole.wind?.y ?? 0, hole.wind?.x ?? 0);
        const elev = hole.elev ?? 0;
        const panY = oy + mh + 5;
        const panH = 48;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(ox - 3, panY, mw + 6, panH);

        // — Wind (top) —
        const cxw = ox + 12;
        const cyw = panY + 13;
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cxw, cyw, 9, 0, Math.PI * 2);
        ctx.stroke();
        const windCol = mph >= 10 ? "#e08a3b" : mph >= 5 ? "#f5d24a" : "#9fd4e8";
        const al = 9;
        const hx = cxw + Math.cos(wa) * al;
        const hy = cyw + Math.sin(wa) * al;
        ctx.strokeStyle = windCol;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cxw - Math.cos(wa) * al, cyw - Math.sin(wa) * al);
        ctx.lineTo(hx, hy);
        ctx.stroke();
        ctx.fillStyle = windCol; // triangular arrowhead
        ctx.beginPath();
        ctx.moveTo(hx + Math.cos(wa) * 4, hy + Math.sin(wa) * 4);
        ctx.lineTo(hx + Math.cos(wa + 2.4) * 4, hy + Math.sin(wa + 2.4) * 4);
        ctx.lineTo(hx + Math.cos(wa - 2.4) * 4, hy + Math.sin(wa - 2.4) * 4);
        ctx.closePath();
        ctx.fill();
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = "bold 9px monospace";
        ctx.fillStyle = windCol;
        ctx.fillText(`${mph}mph`, ox + 25, cyw);

        // divider
        ctx.strokeStyle = "rgba(255,255,255,0.14)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ox, panY + 25);
        ctx.lineTo(ox + mw, panY + 25);
        ctx.stroke();

        // — Elevation (bottom): word + a carry % so its effect is explicit —
        const eCol = elev > 0 ? "#e89a4a" : elev < 0 ? "#5fc8e8" : "#9ab";
        const eWord = elev > 0 ? "UPHILL" : elev < 0 ? "DOWNHILL" : "FLAT";
        const chev = (elev > 0 ? "▲" : elev < 0 ? "▼" : "—").repeat(Math.max(1, Math.min(3, Math.abs(elev))));
        ctx.fillStyle = eCol;
        ctx.font = "bold 9px monospace";
        ctx.fillText(`${chev} ${eWord}`, ox, panY + 35);
        const pct = Math.round(-elev * 10); // carry change vs. flat
        ctx.font = "8px monospace";
        ctx.fillStyle = elev === 0 ? "#9ab" : pct > 0 ? "#36D7B7" : "#e08a3b";
        ctx.fillText(elev === 0 ? "even carry" : `${pct > 0 ? "+" : ""}${pct}% carry`, ox, panY + 45);
      }

      // HUD (screen-fixed) — a clean labeled status pill across the top.
      const hudH = 17;
      ctx.fillStyle = "rgba(13,15,20,0.82)";
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(4, 4, W - 8, hudH, 5);
      ctx.fill();
      ctx.stroke();
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      const hcy = 4 + hudH / 2 + 0.5;
      // Live "to par": completed holes plus the current hole once you've thrown.
      const holesIn = g.holeIndex + (g.throws > 0 ? 1 : 0);
      const strokesIn = g.scores.reduce((s, n) => s + (n ?? 0), 0) + (g.throws > 0 ? g.throws : 0);
      const over = strokesIn - g.roundHoles.slice(0, holesIn).reduce((s, h) => s + h.par, 0);
      const overStr = over === 0 ? "E" : over > 0 ? `+${over}` : `${over}`;
      let hx = 11;
      const hudItem = (label: string, value: string, valColor: string) => {
        ctx.font = "bold 6px ui-monospace, monospace";
        ctx.fillStyle = "#6b7280";
        ctx.fillText(label, hx, hcy);
        hx += ctx.measureText(label).width + 3;
        ctx.font = "bold 9px ui-monospace, monospace";
        ctx.fillStyle = valColor;
        ctx.fillText(value, hx, hcy);
        hx += ctx.measureText(value).width + 9;
      };
      hudItem("HOLE", `${g.holeIndex + 1}/${g.roundHoles.length}`, "#ffffff");
      hudItem("PAR", `${hole.par}`, "#ffffff");
      hudItem("THR", `${g.throws}`, "#ffffff");
      hudItem("TO PAR", overStr, over < 0 ? "#36D7B7" : over > 0 ? "#e08a3b" : "#cbd5e1");
      if (g.mode === "daily") {
        ctx.font = "bold 7px ui-monospace, monospace";
        const dw = ctx.measureText("DAILY").width + 8;
        const dx = W - 10 - dw;
        ctx.fillStyle = "rgba(245,210,74,0.18)";
        ctx.beginPath();
        ctx.roundRect(dx, hcy - 6, dw, 12, 3);
        ctx.fill();
        ctx.fillStyle = "#f5d24a";
        ctx.textAlign = "center";
        ctx.fillText("DAILY", dx + dw / 2, hcy);
        ctx.textAlign = "left";
      }

      // Intro caption — hole, par, and the slope (so elevation is read up front).
      if (g.phase === "intro") {
        const elev = hole.elev ?? 0;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, H / 2 - 20, W, 40);
        ctx.fillStyle = "#fff";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`HOLE ${g.holeIndex + 1}  ·  PAR ${hole.par}`, W / 2, H / 2 - 6);
        if (elev !== 0) {
          ctx.fillStyle = elev > 0 ? "#e89a4a" : "#5fc8e8";
          ctx.font = "bold 11px monospace";
          const word = elev > 0 ? "UPHILL" : "DOWNHILL";
          const arr = (elev > 0 ? "▲" : "▼").repeat(Math.min(3, Math.abs(elev)));
          ctx.fillText(`${arr} ${word} — throws play ${elev > 0 ? "shorter" : "longer"}`, W / 2, H / 2 + 8);
        } else {
          ctx.fillStyle = "#9ab";
          ctx.font = "9px monospace";
          ctx.fillText("flat", W / 2, H / 2 + 8);
        }
        ctx.textAlign = "left";
      }

      // Penalty banner — big red "OUT OF BOUNDS / HAZARD" + "+1", centered.
      if (g.flash) {
        const FLASH_MS = 1500;
        const t = (performance.now() - g.flash.at) / FLASH_MS;
        if (t >= 1) {
          g.flash = null;
        } else {
          const alpha = t > 0.7 ? Math.max(0, 1 - (t - 0.7) / 0.3) : 1; // hold, then fade
          const cy = H / 2;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.fillRect(0, cy - 24, W, 48);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(0,0,0,0.85)";
          ctx.fillStyle = "#ff2e2e";
          ctx.font = "bold 22px ui-monospace, monospace";
          ctx.strokeText(g.flash.text, W / 2, cy - 7);
          ctx.fillText(g.flash.text, W / 2, cy - 7);
          ctx.font = "bold 18px ui-monospace, monospace";
          ctx.strokeText("+1", W / 2, cy + 14);
          ctx.fillText("+1", W / 2, cy + 14);
          ctx.restore();
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
        }
      }
    }

    function frame() {
      update();
      draw();
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [syncHud]);

  useEffect(() => {
    return () => {
      audioRef.current?.close();
      audioRef.current = null;
    };
  }, []);

  function toggleMute() {
    setMuted((m) => {
      const next = !m;
      audioRef.current?.setMuted(next);
      return next;
    });
  }

  // ── Canvas display size ───────────────────────────────────────────────────
  // Contain-fit the canvas to the play area: without this it sits at its native
  // 320×448 CSS size (max-w/max-h only shrink), which looks tiny on desktop.
  const playAreaRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const area = playAreaRef.current;
    const canvas = canvasRef.current;
    if (!area || !canvas) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const scale = Math.min(width / W, height / H);
      canvas.style.width = `${W * scale}px`;
      canvas.style.height = `${H * scale}px`;
    });
    ro.observe(area);
    return () => ro.disconnect();
  }, []);

  // ── Drag-to-throw (pointer) ────────────────────────────────────────────────
  const clientToCanvas = useCallback((clientX: number, clientY: number) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { x: (clientX - r.left) * (W / r.width), y: (clientY - r.top) * (H / r.height) };
  }, []);
  // Pull is measured from the disc itself, so the slider/knob stays attached to
  // it: drag the knob back, aim by its direction, release to throw the opposite way.
  const applyDrag = useCallback((g: GameState, px: number, py: number) => {
    const pullX = px - g.disc.x;
    const pullY = py - (g.disc.y - camRef.current); // disc's on-screen Y
    const dist = Math.hypot(pullX, pullY);
    g.power = Math.min(1, dist / MAX_DRAG);
    if (dist > 4) g.angle = Math.atan2(-pullY, -pullX); // throw opposite the pull
  }, []);
  function onCanvasDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (screenRef.current !== "playing") return;
    const g = stateRef.current;
    if (!g || g.phase !== "aim") return;
    const p = clientToCanvas(e.clientX, e.clientY);
    dragRef.current = { active: true, cx: p.x, cy: p.y };
    applyDrag(g, p.x, p.y);
  }

  // Move/release are handled on the window so the throw still fires even when
  // you drag far past the canvas edge (the old bug where a big pull-back
  // sometimes did nothing on release).
  useEffect(() => {
    function move(e: PointerEvent) {
      const dr = dragRef.current;
      if (!dr.active) return;
      const g = stateRef.current;
      if (!g || g.phase !== "aim") return;
      const p = clientToCanvas(e.clientX, e.clientY);
      dr.cx = p.x;
      dr.cy = p.y;
      applyDrag(g, p.x, p.y);
    }
    function up() {
      const dr = dragRef.current;
      if (!dr.active) return;
      dr.active = false;
      const g = stateRef.current;
      if (!g) return;
      // Released inside the cancel ring (or barely pulled) → abort the throw.
      if (g.phase === "aim" && g.power > CANCEL_POWER) throwDisc();
      else g.power = 0;
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [clientToCanvas, applyDrag, throwDisc]);

  const finalParTotal = finalPars.reduce((s, n) => s + n, 0);
  const finalOver = finalTotal - finalParTotal;
  const finalIsDaily = finalMode === "daily";
  const overStr = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);

  return (
    <div className="h-[100dvh] w-full bg-[#0f1117] flex flex-col select-none overflow-hidden">
      {/* Play area — canvas fills the available space, keeping its aspect ratio */}
      <div ref={playAreaRef} className="relative flex-1 min-h-0 flex items-center justify-center p-2">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={onCanvasDown}
          className="max-h-full max-w-full rounded-lg border border-white/10 bg-[#4a8a3a]"
          style={{ imageRendering: "pixelated", touchAction: "none" }}
        />

        {screen === "title" && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-gradient-to-b from-[#1c2233] via-[#141926] to-[#0f1117] px-5">
            <div className="w-full max-w-[290px] flex flex-col items-center text-center">
              {/* Logo */}
              <div className="flex flex-col items-center gap-2">
                <svg width="44" height="44" viewBox="0 0 32 32" aria-hidden className="drop-shadow">
                  <g stroke="#2a7d70" strokeWidth="2" strokeLinecap="round">
                    <line x1="2" y1="12.5" x2="8" y2="12.5" /><line x1="1" y1="18" x2="7" y2="18" />
                  </g>
                  <ellipse cx="18.5" cy="16.5" rx="11" ry="5" fill="#1f9e8c" />
                  <ellipse cx="18.5" cy="14.8" rx="11" ry="5" fill="#36D7B7" />
                  <ellipse cx="18.5" cy="14" rx="6.5" ry="2.4" fill="#5fe6d2" />
                </svg>
                <h1 className="text-white font-black text-[26px] leading-none tracking-tight">
                  Disc Golf <span className="text-[#36D7B7]">Arcade</span>
                </h1>
              </div>
              <p className="text-gray-300 text-xs mt-2.5 font-medium">Pixel disc golf — wind, hills &amp; water.</p>
              <p className="text-gray-500 text-[11px] mt-1">Drag back from the disc to aim &amp; throw.</p>

              {/* Stat pills */}
              {(bestScore != null || roundsPlayed > 0) && (
                <div className="flex gap-2 mt-3">
                  {bestScore != null && (
                    <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5">
                      <p className="text-[#36D7B7] font-bold text-sm leading-none">{bestScore}</p>
                      <p className="text-gray-500 text-[9px] mt-0.5 uppercase tracking-wide">Best ({overStr(bestScore - TOTAL_PAR)})</p>
                    </div>
                  )}
                  {roundsPlayed > 0 && (
                    <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5">
                      <p className="text-white font-bold text-sm leading-none">{roundsPlayed}</p>
                      <p className="text-gray-500 text-[9px] mt-0.5 uppercase tracking-wide">Rounds</p>
                    </div>
                  )}
                </div>
              )}

              {/* Primary actions */}
              <div className="w-full flex flex-col gap-2 mt-5">
                <button type="button" onClick={() => startGame("daily")}
                  className="w-full rounded-xl bg-[#36D7B7] hover:bg-[#2bc4a6] active:scale-[0.99] text-[#0f1117] font-bold py-3 transition flex items-center justify-center gap-2">
                  <span>🔥 Daily Challenge</span>
                </button>
                <button type="button" onClick={() => startGame("course")}
                  className="w-full rounded-xl bg-[#4B3DFF] hover:bg-[#3a2ee0] active:scale-[0.99] text-white font-bold py-3 transition">
                  ▶ Play Glendoveer · 18
                </button>
                <button type="button" onClick={() => setTutorialOpen(true)}
                  className="w-full rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 active:scale-[0.99] text-white font-bold py-3 transition">
                  📖 How to Play
                </button>
              </div>
              <p className="text-gray-500 text-[10px] mt-1.5">Daily = a fresh 9-hole course, same for everyone</p>

              {/* Secondary actions */}
              <div className="w-full flex gap-2 mt-4">
                <button type="button" onClick={() => setSettingsOpen(true)}
                  className="flex-1 rounded-lg border border-white/10 hover:border-white/25 text-gray-300 hover:text-white text-xs font-semibold py-2 transition">
                  ⚙ Settings
                </button>
                {supa && (
                  <button type="button" onClick={() => { setAuthErr(null); setAuthMsg(null); setAuthOpen(true); }}
                    className="flex-1 rounded-lg border border-white/10 hover:border-white/25 text-gray-300 hover:text-white text-xs font-semibold py-2 transition truncate px-2">
                    {user ? `👤 ${user.email}` : "👤 Log in"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {screen === "holeComplete" && (() => {
          const sl = scoreLabel(hud.throws, hud.par);
          const tone =
            sl.tone === "great" ? "text-[#f5d24a]" :
            sl.tone === "good" ? "text-[#36D7B7]" :
            sl.tone === "even" ? "text-white" : "text-[#e08a3b]";
          return (
            <Overlay>
              <p className="text-[#36D7B7] font-bold text-xl">Hole {hud.hole} complete</p>
              <p className={`${tone} font-black text-3xl leading-tight`}>
                {sl.emoji && `${sl.emoji} `}{sl.name}
              </p>
              <p className="text-gray-300 text-sm">{hud.throws} throws · par {hud.par}</p>
              {holeBestNote && (
                <p className="text-xs font-semibold">
                  {holeBestNote.isNew
                    ? <span className="text-[#f5d24a]">★ New best for this hole!</span>
                    : <span className="text-gray-400">Your best here: {holeBestNote.best}</span>}
                </p>
              )}
              <button type="button" onClick={nextHole} className={btn}>
                {hud.hole >= hud.holes ? "See results ▶" : "Next hole ▶"}
              </button>
            </Overlay>
          );
        })()}

        {tutorialOpen && <TutorialPanel onClose={() => setTutorialOpen(false)} />}

        {settingsOpen && (
          <SettingsPanel
            onClose={() => setSettingsOpen(false)}
            throwStyle={throwStyle} setThrowStyle={setThrowStyle}
            flightPath={flightPath} setFlightPath={setFlightPath}
            musicVolume={musicVolume} setMusicVolume={setMusicVolume}
            leftHanded={leftHanded} setLeftHanded={setLeftHanded}
            advanced={advanced} setAdvanced={handleSetAdvanced}
            unlocked={unlocked}
          />
        )}

        {authOpen && (
          <AuthPanel
            onClose={() => setAuthOpen(false)}
            user={user}
            email={authEmail} setEmail={setAuthEmail}
            password={authPassword} setPassword={setAuthPassword}
            busy={authBusy} error={authErr} message={authMsg}
            onSignIn={signIn} onSignUp={signUp} onSignOut={signOut}
          />
        )}
      </div>

      {/* Control panel: disc rack + flight/stance/mute (hidden on results) */}
      {screen !== "gameComplete" && (
        <div className="shrink-0 w-full border-t border-white/10 bg-[#13161b]">
          <div className="mx-auto w-full max-w-[480px] px-3 pt-2 pb-[max(env(safe-area-inset-bottom),0.55rem)] flex flex-col gap-2">
            {/* Disc selector */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">Disc</span>
              <span className="text-[10px] text-gray-400 font-medium truncate ml-2">
                {advanced ? `${ADV_DISCS[discIndex]?.brand ?? ""} ${ADV_DISCS[discIndex]?.name ?? ""}` : "Drag back from the disc to throw"}
              </span>
            </div>
            {advanced ? (
              <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1" style={{ scrollbarWidth: "thin" }}>
                {ADV_DISCS.map((d, i) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => selectDisc(i)}
                    className={`shrink-0 w-[90px] rounded-lg border px-2 py-1.5 text-left transition ${
                      i === discIndex ? "border-[#36D7B7]/70 bg-[#36D7B7]/10" : "border-white/10 hover:border-white/25 bg-white/[0.02]"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className={`text-xs font-bold truncate ${i === discIndex ? "text-white" : "text-gray-300"}`}>{d.name}</span>
                    </span>
                    <span className="block text-[9px] text-gray-500 mt-0.5">{d.brand}</span>
                    <span className="block text-[9px] font-mono text-gray-400 leading-tight">{d.blurb.split("· ")[1]}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {DISCS.map((d, i) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => selectDisc(i)}
                    title={d.blurb}
                    className={`rounded-lg border px-2 py-2 flex items-center gap-1.5 text-xs font-bold transition ${
                      i === discIndex ? "border-[#36D7B7]/70 bg-[#36D7B7]/10 text-white" : "border-white/10 text-gray-300 hover:border-white/25 bg-white/[0.02]"
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="truncate">{d.name}</span>
                    <span className="ml-auto text-[10px] text-gray-600">{i + 1}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Flight (simple mode only) */}
            {!advanced && (
              <div className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500">Flight</span>
                <div className="flex-1 flex gap-1 bg-[#0f1117] border border-white/10 rounded-lg p-1">
                  {([
                    { key: "overstable", label: "Overstable" },
                    { key: "straight", label: "Straight" },
                  ] as const).map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setFlightPath(p.key)}
                      aria-pressed={flightPath === p.key}
                      className={`flex-1 rounded-md px-2 py-1.5 text-xs font-bold transition ${
                        flightPath === p.key ? "bg-[#36D7B7] text-[#0f1117] shadow" : "text-gray-400 hover:text-white"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stance + mute */}
            <div className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500">Stance</span>
              <div className="flex-1 flex gap-1 bg-[#0f1117] border border-white/10 rounded-lg p-1">
                {([
                  { key: "BH", label: "Backhand ◄" },
                  { key: "FH", label: "► Forehand" },
                ] as const).map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setThrowStyle(s.key)}
                    aria-pressed={throwStyle === s.key}
                    className={`flex-1 rounded-md px-2 py-1.5 text-xs font-bold transition ${
                      throwStyle === s.key ? "bg-[#4B3DFF] text-white shadow" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? "Unmute" : "Mute"}
                className="shrink-0 w-10 h-[34px] flex items-center justify-center bg-[#0f1117] border border-white/10 hover:border-white/25 text-white rounded-lg active:bg-white/10 transition"
              >
                {muted ? "🔇" : "🔊"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results: scorecard + save + leaderboard */}
      {screen === "gameComplete" && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm p-4 flex items-start sm:items-center justify-center">
          <div className="w-full max-w-lg space-y-4 my-auto">
            <div className="text-center">
              <h2 className="text-white font-black text-2xl">{finalIsDaily ? "Daily Challenge complete!" : "Round complete!"}</h2>
              <p className="text-gray-400 text-xs">
                {finalIsDaily ? `Today's course · ${finalPars.length} holes · par ${finalParTotal}` : `Glendoveer East · 18 holes · par ${finalParTotal}`}
              </p>
              <p className="text-[#36D7B7] font-bold text-lg mt-1">
                {finalTotal} throws · {finalOver === 0 ? "Even par" : overStr(finalOver)}
                {isNewBest && <span className="ml-2 text-[#f5d24a]">★ New best!</span>}
              </p>
              {!finalIsDaily && bestScore != null && !isNewBest && (
                <p className="text-gray-400 text-xs mt-0.5">Your best: {bestScore} ({overStr(bestScore - TOTAL_PAR)})</p>
              )}
            </div>

            {/* Newly-unlocked achievements */}
            {newAchievements.length > 0 && (
              <div className="bg-[#f5d24a]/10 border border-[#f5d24a]/30 rounded-2xl p-3">
                <p className="text-[#f5d24a] font-bold text-sm mb-2">🏅 Achievement{newAchievements.length > 1 ? "s" : ""} unlocked!</p>
                <div className="flex flex-col gap-1.5">
                  {newAchievements.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-sm">
                      <span className="text-lg">{a.emoji}</span>
                      <span className="text-white font-semibold">{a.name}</span>
                      <span className="text-gray-400 text-xs">— {a.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scorecard — one row per nine */}
            <div className="bg-[#1a1d23] border border-white/5 rounded-2xl p-3 space-y-3 text-[11px]">
              {(finalPars.length > 9
                ? [{ label: "Out", from: 0, to: 9 }, { label: "In", from: 9, to: 18 }]
                : [{ label: "Tot", from: 0, to: finalPars.length }]
              ).map(({ label, from, to }) => {
                const pars = finalPars.slice(from, to);
                const parSum = pars.reduce((s, n) => s + n, 0);
                const youSum = scorecard.slice(from, to).reduce((s, n) => s + (n ?? 0), 0);
                return (
                  <table key={label} className="w-full text-center tabular-nums">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="text-left font-semibold pr-1 w-7"></th>
                        {pars.map((_, i) => (
                          <th key={i} className="font-semibold px-0.5">{from + i + 1}</th>
                        ))}
                        <th className="font-bold pl-1 text-gray-300">{label}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="text-gray-400">
                        <td className="text-left pr-1">Par</td>
                        {pars.map((p, i) => (
                          <td key={i} className="px-0.5">{p}</td>
                        ))}
                        <td className="pl-1 font-mono">{parSum}</td>
                      </tr>
                      <tr className="text-white font-semibold">
                        <td className="text-left pr-1">You</td>
                        {pars.map((p, i) => {
                          const s = scorecard[from + i];
                          const diff = (s ?? p) - p;
                          const color = s == null ? "#6b7280" : diff < 0 ? "#36D7B7" : diff > 1 ? "#e23b3b" : diff === 1 ? "#f5d24a" : "#ffffff";
                          return (
                            <td key={i} className="px-0.5 font-mono" style={{ color }}>{s ?? "–"}</td>
                          );
                        })}
                        <td className="pl-1 font-mono">{youSum}</td>
                      </tr>
                    </tbody>
                  </table>
                );
              })}
              <div className="flex justify-between border-t border-white/5 pt-2 text-white font-bold text-sm">
                <span>Total</span>
                <span className="font-mono">{finalTotal} · par {finalParTotal}</span>
              </div>
            </div>

            {/* Save + leaderboard are for the shared Glendoveer course only. */}
            {finalIsDaily ? (
              <p className="text-center text-gray-400 text-sm">
                Everyone plays the same course today — share your card to compare with friends.
              </p>
            ) : (
              <>
                {saved ? (
                  <p className="text-center text-[#36D7B7] text-sm font-semibold">Saved to the leaderboard ✓</p>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="Your name"
                      maxLength={16}
                      className="flex-1 bg-[#1a1d23] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#4B3DFF]"
                    />
                    <button
                      type="button"
                      onClick={saveScore}
                      disabled={saving}
                      className="bg-[#36D7B7] hover:bg-[#2bc4a6] text-black font-bold text-sm px-4 py-2 rounded-lg transition disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save score"}
                    </button>
                  </div>
                )}
                {saveErr && <p className="text-red-400 text-xs text-center">{saveErr}</p>}

                <div className="bg-[#1a1d23] border border-white/5 rounded-2xl overflow-hidden">
                  <p className="text-white font-bold text-sm px-4 py-2.5 border-b border-white/5">🏆 Leaderboard</p>
                  {leaderboard.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-6">No scores yet — be the first!</p>
                  ) : (
                    <ol>
                      {leaderboard.map((row, i) => (
                        <li
                          key={`${row.name}-${row.created_at}`}
                          className={`flex items-center gap-3 px-4 py-2 text-sm ${i !== 0 ? "border-t border-white/5" : ""}`}
                        >
                          <span className="text-gray-400 font-mono w-6 text-right">{i + 1}</span>
                          <span className="text-white flex-1 truncate">{row.name}</span>
                          <span className="text-gray-400 font-mono">{overStr(row.strokes - TOTAL_PAR)}</span>
                          <span className="text-white font-mono font-bold w-8 text-right">{row.strokes}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </>
            )}

            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => startGame()} className={btn}>↻ Play again</button>
              <button type="button" onClick={shareCard} className="mt-1 bg-[#1a1d23] border border-white/15 hover:border-white/35 text-white font-bold px-6 py-3 rounded-lg transition">
                📤 Share card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btn =
  "mt-1 bg-[#4B3DFF] hover:bg-[#3a2ee0] text-white font-bold px-6 py-3 rounded-lg transition";

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 rounded-lg text-center px-4">
      {children}
    </div>
  );
}

// Paginated how-to-play walkthrough: throw, disc choice, flight shape, stance.
// Each step pairs a small looping SVG animation with a short caption.
function TutorialPanel({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const illo = "w-full rounded-lg border border-white/10 bg-[#10141a]";
  // Knob pull-back loop shared by the line + knob in step 1.
  const pull = { dur: "2.6s", keyTimes: "0;0.45;0.6;1", repeatCount: "indefinite" } as const;
  const steps: { title: string; caption: string; art: React.ReactNode }[] = [
    {
      title: "Pull back & throw",
      caption: "Press on your disc and drag back — the farther you pull, the more power. Release to throw the opposite way. Pulled back but changed your mind? Bring the knob back inside the red ring to cancel.",
      art: (
        <svg viewBox="0 0 220 130" className={illo}>
          <rect x="60" y="0" width="100" height="130" fill="#16331f" />
          <line x1="110" y1="14" x2="110" y2="30" stroke="#cfd8dc" strokeWidth="2" />
          <rect x="102" y="16" width="16" height="9" fill="none" stroke="#cfd8dc" strokeWidth="2" />
          <path d="M110 92 C 104 70, 116 48, 110 30" fill="none" stroke="#36D7B7" strokeWidth="2" strokeDasharray="4 4">
            <animate attributeName="stroke-dashoffset" from="32" to="0" dur="1.2s" repeatCount="indefinite" />
          </path>
          <text x="122" y="62" fill="#36D7B7" fontSize="9">throw</text>
          <circle cx="110" cy="92" r="6" fill="#36D7B7" />
          <line x1="110" y1="92" stroke="rgba(255,255,255,0.7)" strokeWidth="2">
            <animate attributeName="x2" values="110;134;134;110" {...pull} />
            <animate attributeName="y2" values="92;118;118;92" {...pull} />
          </line>
          <circle r="5" fill="#fff">
            <animate attributeName="cx" values="110;134;134;110" {...pull} />
            <animate attributeName="cy" values="92;118;118;92" {...pull} />
          </circle>
          <text x="144" y="122" fill="#9aa4b2" fontSize="9">pull back</text>
        </svg>
      ),
    },
    {
      title: "Pick your disc",
      caption: "Tap a disc in the rack below the screen — any time, even mid-hole. Putters are short but controlled, mids are balanced, drivers fly farthest. When you switch, a tick flashes on the fairway showing that disc's max reach.",
      art: (
        <svg viewBox="0 0 220 130" className={illo}>
          {([
            { name: "Putter", color: "#36D7B7", len: 55, y: 30 },
            { name: "Mid", color: "#f5d24a", len: 82, y: 65 },
            { name: "Driver", color: "#e23b3b", len: 120, y: 100 },
          ] as const).map((d) => (
            <g key={d.name}>
              <circle cx="24" cy={d.y} r="8" fill={d.color} />
              <text x="38" y={d.y + 3} fill="#e7ebf0" fontSize="10" fontWeight="bold">{d.name}</text>
              <rect x="86" y={d.y - 3.5} height="7" rx="3.5" fill={d.color} opacity="0.85">
                <animate attributeName="width" values={`0;${d.len};${d.len}`} keyTimes="0;0.55;1" dur="2.8s" repeatCount="indefinite" />
              </rect>
              <line x1={86 + d.len} y1={d.y - 7} x2={86 + d.len} y2={d.y + 7} stroke={d.color} strokeWidth="2" />
            </g>
          ))}
        </svg>
      ),
    },
    {
      title: "Flight shape",
      caption: "Overstable bends steadily one way — reliable in wind. Straight holds its line and carries farther. Toggle it next to the disc rack. (Advanced bag: each real disc has its own baked-in shape instead.)",
      art: (
        <svg viewBox="0 0 220 130" className={illo}>
          <path d="M70 112 C 70 85, 56 55, 42 32" fill="none" stroke="#e08a3b" strokeWidth="2.5" strokeDasharray="5 4">
            <animate attributeName="stroke-dashoffset" from="36" to="0" dur="1.3s" repeatCount="indefinite" />
          </path>
          <circle cx="70" cy="112" r="5" fill="#e08a3b" />
          <text x="50" y="124" fill="#e08a3b" fontSize="9">Overstable</text>
          <path d="M150 112 C 158 85, 146 50, 145 20" fill="none" stroke="#36D7B7" strokeWidth="2.5" strokeDasharray="5 4">
            <animate attributeName="stroke-dashoffset" from="36" to="0" dur="1.3s" repeatCount="indefinite" />
          </path>
          <circle cx="150" cy="112" r="5" fill="#36D7B7" />
          <text x="132" y="124" fill="#36D7B7" fontSize="9">Straight</text>
          <text x="158" y="30" fill="#9aa4b2" fontSize="8">farther</text>
        </svg>
      ),
    },
    {
      title: "Stance",
      caption: "Backhand (BH) fades left at the end of the flight; forehand (FH) fades right. Pick per throw next to the disc rack to shape shots around trees and doglegs. Left-handed? Flip it in Settings and everything mirrors.",
      art: (
        <svg viewBox="0 0 220 130" className={illo}>
          <path d="M110 110 C 104 75, 86 45, 68 28" fill="none" stroke="#36D7B7" strokeWidth="2.5" strokeDasharray="5 4">
            <animate attributeName="stroke-dashoffset" from="36" to="0" dur="1.3s" repeatCount="indefinite" />
          </path>
          <path d="M110 110 C 116 75, 134 45, 152 28" fill="none" stroke="#f5d24a" strokeWidth="2.5" strokeDasharray="5 4">
            <animate attributeName="stroke-dashoffset" from="36" to="0" dur="1.3s" repeatCount="indefinite" />
          </path>
          <circle cx="110" cy="110" r="6" fill="#fff" />
          <text x="42" y="20" fill="#36D7B7" fontSize="9">BH fades left</text>
          <text x="128" y="20" fill="#f5d24a" fontSize="9">FH fades right</text>
        </svg>
      ),
    },
  ];
  const last = step === steps.length - 1;
  const nav = "rounded-lg px-4 py-2 text-xs font-bold transition";
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm p-4 flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-3 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">How to Play</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <p className="text-[#36D7B7] text-sm font-bold">{step + 1}. {steps[step].title}</p>
        {steps[step].art}
        <p className="text-gray-300 text-xs leading-relaxed min-h-[72px]">{steps[step].caption}</p>
        <div className="flex items-center justify-between pt-1">
          <button type="button" onClick={() => setStep(step - 1)} disabled={step === 0}
            className={`${nav} border border-white/10 text-gray-300 hover:text-white disabled:opacity-30 disabled:hover:text-gray-300`}>
            ◀ Back
          </button>
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === step ? "bg-[#36D7B7]" : "bg-white/15"}`} />
            ))}
          </div>
          <button type="button" onClick={() => (last ? onClose() : setStep(step + 1))}
            className={`${nav} ${last ? "bg-[#36D7B7] hover:bg-[#2bc4a6] text-[#0f1117]" : "bg-[#4B3DFF] hover:bg-[#3a2ee0] text-white"}`}>
            {last ? "Got it ✓" : "Next ▶"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel(props: {
  onClose: () => void;
  throwStyle: "BH" | "FH";
  setThrowStyle: (s: "BH" | "FH") => void;
  flightPath: FlightPath;
  setFlightPath: (p: FlightPath) => void;
  musicVolume: number;
  setMusicVolume: (v: number) => void;
  leftHanded: boolean;
  setLeftHanded: (b: boolean) => void;
  advanced: boolean;
  setAdvanced: (b: boolean) => void;
  unlocked: string[];
}) {
  const { onClose, throwStyle, setThrowStyle, flightPath, setFlightPath, musicVolume, setMusicVolume, leftHanded, setLeftHanded, advanced, setAdvanced, unlocked } = props;
  const seg = (active: boolean) =>
    `flex-1 rounded-md px-2 py-2 text-xs font-bold transition ${active ? "bg-[#4B3DFF] text-white" : "text-gray-400 hover:text-white"}`;
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm p-4 flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-4 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">Settings</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div>
          <p className="text-gray-400 text-xs font-semibold mb-1">Default stance</p>
          <div className="flex gap-1 bg-[#1a1d23] border border-white/10 rounded-lg p-1">
            <button type="button" onClick={() => setThrowStyle("BH")} className={seg(throwStyle === "BH")}>Backhand</button>
            <button type="button" onClick={() => setThrowStyle("FH")} className={seg(throwStyle === "FH")}>Forehand</button>
          </div>
        </div>

        {!advanced && (
          <div>
            <p className="text-gray-400 text-xs font-semibold mb-1">Default flight</p>
            <div className="flex gap-1 bg-[#1a1d23] border border-white/10 rounded-lg p-1">
              <button type="button" onClick={() => setFlightPath("overstable")} className={seg(flightPath === "overstable")}>Overstable</button>
              <button type="button" onClick={() => setFlightPath("straight")} className={seg(flightPath === "straight")}>Straight</button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setAdvanced(!advanced)}
          className="w-full flex items-center justify-between bg-[#1a1d23] border border-white/10 rounded-lg px-3 py-2.5"
        >
          <span className="text-left">
            <span className="block text-white text-sm font-semibold">Advanced discs</span>
            <span className="block text-gray-500 text-[11px]">Throw real Innova / Discraft discs by their flight numbers</span>
          </span>
          <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded ${advanced ? "bg-[#36D7B7] text-[#0f1117]" : "bg-white/10 text-gray-400"}`}>
            {advanced ? "ON" : "OFF"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setLeftHanded(!leftHanded)}
          className="w-full flex items-center justify-between bg-[#1a1d23] border border-white/10 rounded-lg px-3 py-2.5"
        >
          <span className="text-white text-sm font-semibold">Left-handed</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${leftHanded ? "bg-[#36D7B7] text-[#0f1117]" : "bg-white/10 text-gray-400"}`}>
            {leftHanded ? "ON" : "OFF"}
          </span>
        </button>

        <div>
          <p className="text-gray-400 text-xs font-semibold mb-1">Music volume</p>
          <input
            type="range" min={0} max={1} step={0.05} value={musicVolume}
            onChange={(e) => setMusicVolume(Number(e.target.value))}
            className="w-full accent-[#36D7B7]"
          />
        </div>

        <div>
          <p className="text-gray-400 text-xs font-semibold mb-2">Achievements ({unlocked.length}/{ACHIEVEMENTS.length})</p>
          <div className="space-y-1.5">
            {ACHIEVEMENTS.map((a) => {
              const got = unlocked.includes(a.id);
              return (
                <div key={a.id} className={`flex items-center gap-2 text-sm ${got ? "" : "opacity-40"}`}>
                  <span className="text-lg">{got ? a.emoji : "🔒"}</span>
                  <span className="text-white font-semibold">{a.name}</span>
                  <span className="text-gray-500 text-xs truncate">— {a.desc}</span>
                </div>
              );
            })}
          </div>
        </div>

        <button type="button" onClick={onClose} className={`${btn} w-full`}>Done</button>
      </div>
    </div>
  );
}

function AuthPanel(props: {
  onClose: () => void;
  user: { email: string } | null;
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  busy: boolean; error: string | null; message: string | null;
  onSignIn: () => void; onSignUp: () => void; onSignOut: () => void;
}) {
  const { onClose, user, email, setEmail, password, setPassword, busy, error, message, onSignIn, onSignUp, onSignOut } = props;
  const input = "w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#4B3DFF]";
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm p-4 flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-4 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">{user ? "Account" : "Log in"}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        {user ? (
          <>
            <p className="text-gray-300 text-sm">Signed in as <span className="text-white font-semibold break-all">{user.email}</span>.</p>
            <p className="text-[#36D7B7] text-xs font-semibold">✓ Your best scores, hole bests &amp; achievements sync automatically.</p>
            <button type="button" onClick={onSignOut} className="w-full bg-[#1a1d23] border border-white/15 hover:border-white/35 text-white font-bold py-2.5 rounded-lg transition">Log out</button>
          </>
        ) : (
          <>
            <p className="text-gray-400 text-xs">Log in (or create an account) to save your progress and pick it back up on any device.</p>
            <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={input} />
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 6 chars)" className={input} />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            {message && <p className="text-[#36D7B7] text-xs">{message}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={onSignIn} disabled={busy || !email || !password} className="flex-1 bg-[#4B3DFF] hover:bg-[#3a2ee0] text-white font-bold py-2.5 rounded-lg transition disabled:opacity-50">
                {busy ? "…" : "Log in"}
              </button>
              <button type="button" onClick={onSignUp} disabled={busy || !email || !password} className="flex-1 bg-[#36D7B7] hover:bg-[#2bc4a6] text-[#0f1117] font-bold py-2.5 rounded-lg transition disabled:opacity-50">
                {busy ? "…" : "Sign up"}
              </button>
            </div>
            <p className="text-gray-600 text-[11px]">Your scores are also saved on this device without logging in.</p>
          </>
        )}
      </div>
    </div>
  );
}

function drawTree(ctx: CanvasRenderingContext2D, tr: Tree) {
  // Trunk (taller, to read as a full-height tree you can't throw over).
  ctx.fillStyle = "#5a3a1a";
  ctx.fillRect(Math.round(tr.x) - 1, Math.round(tr.y), 3, tr.r + 7);
  // Dark base ring + a canopy lifted slightly for a touch of height.
  ctx.fillStyle = "#225e1f";
  ctx.beginPath();
  ctx.arc(tr.x, tr.y + 1, tr.r + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2f6b2a";
  ctx.beginPath();
  ctx.arc(tr.x, tr.y - 2, tr.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3f8a37";
  ctx.beginPath();
  ctx.arc(tr.x - tr.r * 0.3, tr.y - tr.r * 0.45, tr.r * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawBasket(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.beginPath();
  ctx.arc(x, y, CATCH_R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#9aa0a8";
  ctx.fillRect(Math.round(x) - 1, Math.round(y) - 2, 2, 12);
  ctx.fillStyle = "#7a808a";
  ctx.fillRect(Math.round(x) - 4, Math.round(y) + 10, 8, 2);
  ctx.fillStyle = "#c2c8d0";
  ctx.fillRect(Math.round(x) - 5, Math.round(y) - 8, 10, 3);
  ctx.fillStyle = "#aeb4bd";
  for (let i = -3; i <= 3; i += 3) ctx.fillRect(Math.round(x) + i, Math.round(y) - 5, 1, 5);
}
