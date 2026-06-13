"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
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
// `worldW` (optional, default W) makes the hole wider than the viewport; the
// camera pans horizontally following the disc, so big doglegs get full room.
// `elevZones` (optional) varies the slope along the hole — each zone applies
// until `to`, a fraction of the way from tee (0) to basket (1); without it the
// whole hole uses the single `elev`.
// `fairways` (optional) adds extra disconnected in-bounds ribbons of the same
// width — e.g. an island tee pad separated from the main fairway by OB.
// `dropZone` (optional): OB throws play from this spot (+1) instead of from
// where the disc crossed the line — like the marked DZs on tournament holes.
// `walls` (optional): horizontal wooden fences that block at ANY height (like
// trees) — leave a gap between segments to make a gate/arch to throw through.
// `roughIsHazard` (optional): everything outside the ribbon plays as HAZARD
// (+1, play where it lies) instead of OB — rope-lined holes like Winthrop 10.
// `obZones` (optional): grass OB islands INSIDE the fairway — play like water
// (OB at ground level) but render as roped-off turf, not ponds.
type Hole = { par: number; worldH: number; worldW?: number; tee: Vec; basket: Vec; fairway: Vec[]; fairways?: Vec[][]; fwWidth: number; trees: Tree[]; water: Water[]; hazard?: Water[]; obZones?: Water[]; dropZone?: Vec; walls?: { x: number; y: number; w: number }[]; roughIsHazard?: boolean; wind?: Vec; windMag?: number; elev?: number; elevZones?: { to: number; elev: number }[] };

// Holes are authored in this old 448-tall frame, then stretched to a length
// that scales with par (below).
const TEE: Vec = { x: 160, y: 416 };

// Glendoveer East (2026 Northwest Championship), 18 holes / par 66. Each hole
// is an original pixel interpretation of the real one — tee at the bottom, with
// the green, dogleg shape, OB lines, water and tree guards placed to match the
// hole's actual character. Comments note the real par/distance.
const HOLE_TEMPLATES: Omit<Hole, "worldH">[] = [
  // ── Front nine (par 31) ── (`fairway` = curved centerline tee→green; `fwWidth` = corridor width)
  // 1 — par 4, 670ft. A 480-wide world: the tee view opens centered, the hole
  // runs straight over a center-left pond, then doglegs hard right and the
  // camera pans with it to a green far right behind a tree gate (caddie book).
  { par: 4, worldW: 480, tee: { x: 160, y: 416 }, basket: { x: 328, y: 96 }, fairway: [{ x: 160, y: 416 }, { x: 162, y: 330 }, { x: 176, y: 260 }, { x: 216, y: 195 }, { x: 271, y: 140 }, { x: 316, y: 110 }, { x: 328, y: 96 }], fwWidth: 126, trees: [{ x: 274, y: 130, r: 9 }, { x: 314, y: 126, r: 9 }, { x: 292, y: 84, r: 9 }, { x: 362, y: 104, r: 9 }], water: [{ x: 124, y: 272, w: 64, h: 44 }], hazard: [{ x: 200, y: 232, w: 30, h: 22 }] },
  // 2 — par 3, 390ft. Sweeps hard right in a 432-wide world. The tree line
  // rides the RIGHT side of the curve, so the play is up its left side and
  // then cutting right into the green at the end. Sand sits 2-3 basket
  // diameters short-right of the pin.
  { par: 3, worldW: 432, tee: { x: 148, y: 416 }, basket: { x: 300, y: 108 }, fairway: [{ x: 148, y: 416 }, { x: 156, y: 330 }, { x: 180, y: 250 }, { x: 222, y: 185 }, { x: 268, y: 140 }, { x: 300, y: 108 }], fwWidth: 110, trees: [
    // Right-of-center tree line through the bend — the lane runs up its left
    { x: 168, y: 330, r: 9 }, { x: 180, y: 290, r: 9 }, { x: 192, y: 250, r: 9 }, { x: 218, y: 210, r: 9 }, { x: 250, y: 170, r: 9 },
    // Green guards
    { x: 284, y: 140, r: 9 }, { x: 334, y: 88, r: 9 },
  ], water: [], hazard: [{ x: 256, y: 140, w: 30, h: 20 }] },
  // 3 — par 3, 370ft. Straight with a mid-right pinch, then a guard cluster
  // dead in front of the green — pick a side, left or right (caddie book).
  { par: 3, tee: TEE, basket: { x: 156, y: 108 }, fairway: [{ x: 160, y: 416 }, { x: 156, y: 290 }, { x: 152, y: 180 }, { x: 156, y: 108 }], fwWidth: 116, trees: [
    { x: 196, y: 252, r: 10 }, { x: 120, y: 200, r: 10 }, { x: 204, y: 228, r: 9 },
    // The guard cluster in front of the basket (gaps left and right of it)
    { x: 136, y: 152, r: 9 }, { x: 154, y: 147, r: 8 }, { x: 171, y: 155, r: 9 },
  ], water: [] },
  // 4 — par 3, 450ft. A wall of trees seals the fairway just past the tee —
  // the play is out LEFT over the OB line. The green sits in a tree pocket
  // with sand short-right (caddie book).
  { par: 3, tee: TEE, basket: { x: 150, y: 96 }, fairway: [{ x: 160, y: 416 }, { x: 154, y: 260 }, { x: 150, y: 150 }, { x: 150, y: 96 }], fwWidth: 120, trees: [
    // Tee-shot wall across the middle of the corridor (no trees in the OB
    // rough) — squeeze past in-bounds at the edges, or fly out left over OB.
    { x: 132, y: 332, r: 10 }, { x: 158, y: 328, r: 10 }, { x: 184, y: 332, r: 10 }, { x: 210, y: 338, r: 9 },
    { x: 118, y: 232, r: 9 },
    // Green pocket
    { x: 150, y: 152, r: 11 }, { x: 118, y: 138, r: 9 }, { x: 182, y: 142, r: 9 },
  ], water: [], hazard: [{ x: 196, y: 120, w: 26, h: 18 }] },
  // 5 — par 4, 910ft. Wide & open, a minefield of sand traps up the middle and
  // a pond right at the green (caddie book shows 5 HZ + water short of pin).
  // The fairway ribbon ends short of the pin so OB sits tight behind the basket.
  { par: 4, tee: TEE, basket: { x: 160, y: 72 }, fairway: [{ x: 160, y: 416 }, { x: 160, y: 280 }, { x: 160, y: 170 }, { x: 160, y: 93 }], fwWidth: 150, trees: [], water: [{ x: 132, y: 118, w: 56, h: 34 }], hazard: [{ x: 116, y: 182, w: 30, h: 22 }, { x: 184, y: 202, w: 28, h: 20 }, { x: 140, y: 215, w: 26, h: 16 }, { x: 190, y: 160, w: 24, h: 16 }, { x: 118, y: 148, w: 24, h: 16 }] },
  // 6 — par 3, 415ft. A tree line works up the center-right and the green hides
  // in its own cluster top-center (caddie book).
  { par: 3, tee: TEE, basket: { x: 165, y: 105 }, fairway: [{ x: 160, y: 416 }, { x: 163, y: 280 }, { x: 165, y: 160 }, { x: 165, y: 105 }], fwWidth: 124, trees: [{ x: 185, y: 300, r: 9 }, { x: 175, y: 245, r: 9 }, { x: 190, y: 195, r: 9 }, { x: 150, y: 140, r: 9 }, { x: 196, y: 128, r: 9 }], water: [] },
  // 7 — par 4, 710ft. Steep climb, so it plays SHORT (basket well down the
  // template); the left side is wooded the whole way — the smart line is right.
  { par: 4, tee: TEE, basket: { x: 142, y: 150 }, fairway: [{ x: 160, y: 416 }, { x: 160, y: 300 }, { x: 154, y: 215 }, { x: 142, y: 150 }], fwWidth: 126, trees: [
    // Left-side wood
    { x: 108, y: 310, r: 9 }, { x: 122, y: 265, r: 9 }, { x: 140, y: 240, r: 10 }, { x: 112, y: 205, r: 9 },
    { x: 168, y: 185, r: 9 },
    // Green pocket
    { x: 104, y: 168, r: 9 }, { x: 184, y: 162, r: 9 }, { x: 146, y: 118, r: 9 },
  ], water: [] },
  // 8 — par 3, 500ft. Long straight corridor — extra left-side trees and a
  // center tree mid-flight; the green sits in a gap between guards.
  { par: 3, tee: TEE, basket: { x: 160, y: 78 }, fairway: [{ x: 160, y: 416 }, { x: 160, y: 260 }, { x: 160, y: 150 }, { x: 160, y: 78 }], fwWidth: 116, trees: [{ x: 130, y: 290, r: 9 }, { x: 195, y: 255, r: 9 }, { x: 118, y: 235, r: 9 }, { x: 160, y: 205, r: 9 }, { x: 126, y: 160, r: 9 }, { x: 124, y: 122, r: 9 }, { x: 196, y: 120, r: 9 }], water: [] },
  // 9 — par 4, 695ft. Runs straight then finishes LEFT to a well-wooded green;
  // sand mid-fairway on the way in (caddie book). Drops downhill off the tee,
  // then climbs to the green over the back half.
  { par: 4, tee: TEE, basket: { x: 138, y: 92 }, elevZones: [{ to: 0.5, elev: -1 }, { to: 1, elev: 1 }], fairway: [{ x: 160, y: 416 }, { x: 166, y: 310 }, { x: 162, y: 215 }, { x: 148, y: 140 }, { x: 138, y: 92 }], fwWidth: 118, trees: [{ x: 200, y: 290, r: 9 }, { x: 120, y: 250, r: 9 }, { x: 178, y: 200, r: 9 }, { x: 110, y: 160, r: 9 }, { x: 170, y: 130, r: 9 }, { x: 100, y: 112, r: 9 }, { x: 176, y: 112, r: 9 }, { x: 96, y: 84, r: 9 }, { x: 134, y: 64, r: 9 }], water: [], hazard: [{ x: 150, y: 180, w: 30, h: 20 }] },
  // ── Back nine (par 35) ──
  // 10 — par 4, 710ft. Gentle S working left, sand everywhere: near the tee,
  // mid-hole, and a pair guarding the green (caddie book).
  { par: 4, tee: TEE, basket: { x: 162, y: 86 }, fairway: [{ x: 160, y: 416 }, { x: 172, y: 310 }, { x: 145, y: 230 }, { x: 152, y: 150 }, { x: 162, y: 86 }], fwWidth: 120, trees: [{ x: 200, y: 270, r: 9 }, { x: 130, y: 190, r: 9 }, { x: 190, y: 160, r: 9 }, { x: 124, y: 106, r: 9 }, { x: 198, y: 98, r: 9 }], water: [], hazard: [{ x: 190, y: 330, w: 26, h: 18 }, { x: 110, y: 250, w: 28, h: 18 }, { x: 120, y: 130, w: 26, h: 18 }, { x: 196, y: 115, w: 26, h: 18 }] },
  // 11 — par 5, 1145ft. Long corridor that pinches at the waist and again near
  // the green; sand left mid-fairway and upper-right of the green (caddie book).
  { par: 5, tee: TEE, basket: { x: 160, y: 60 }, fairway: [{ x: 160, y: 416 }, { x: 160, y: 310 }, { x: 160, y: 200 }, { x: 160, y: 110 }, { x: 160, y: 60 }], fwWidth: 120, trees: [{ x: 120, y: 300, r: 10 }, { x: 200, y: 300, r: 10 }, { x: 150, y: 250, r: 9 }, { x: 180, y: 220, r: 9 }, { x: 125, y: 180, r: 9 }, { x: 195, y: 160, r: 9 }, { x: 160, y: 130, r: 9 }, { x: 120, y: 100, r: 9 }, { x: 200, y: 90, r: 9 }], water: [], hazard: [{ x: 115, y: 215, w: 30, h: 20 }, { x: 196, y: 80, w: 26, h: 16 }] },
  // 12 — par 3, 370ft. Straight up the middle through scattered guards to a
  // tree-ringed green.
  { par: 3, tee: TEE, basket: { x: 162, y: 112 }, fairway: [{ x: 160, y: 416 }, { x: 162, y: 300 }, { x: 162, y: 200 }, { x: 162, y: 112 }], fwWidth: 114, trees: [{ x: 150, y: 250, r: 9 }, { x: 130, y: 200, r: 9 }, { x: 185, y: 165, r: 9 }, { x: 126, y: 128, r: 9 }, { x: 198, y: 124, r: 9 }, { x: 160, y: 78, r: 9 }], water: [] },
  // 13 — par 4, 775ft. An ISLAND tee pad: everything between it and the main
  // fairway is OB, so the drive is a straight forced carry to the upper
  // fairway, which then doglegs RIGHT to a green ringed in trees — 400 wide.
  { par: 4, worldW: 400, tee: { x: 155, y: 416 }, basket: { x: 260, y: 92 }, fairway: [{ x: 150, y: 280 }, { x: 150, y: 250 }, { x: 170, y: 175 }, { x: 230, y: 120 }, { x: 260, y: 92 }], fairways: [[{ x: 155, y: 416 }, { x: 154, y: 404 }]], fwWidth: 90, trees: [
    { x: 185, y: 235, r: 9 }, { x: 125, y: 205, r: 9 },
    // Green ring
    { x: 226, y: 108, r: 9 }, { x: 296, y: 104, r: 9 }, { x: 256, y: 64, r: 9 }, { x: 226, y: 64, r: 9 }, { x: 292, y: 68, r: 9 },
  ], water: [] },
  // 14 — par 4, 845ft. Curves right from the very first shot and keeps working
  // right the whole hole (440-wide world) to a tree-ringed green with sand
  // short-right of the pin.
  { par: 4, worldW: 440, tee: { x: 140, y: 416 }, basket: { x: 300, y: 92 }, fairway: [{ x: 140, y: 416 }, { x: 165, y: 330 }, { x: 200, y: 260 }, { x: 240, y: 195 }, { x: 275, y: 140 }, { x: 300, y: 92 }], fwWidth: 122, trees: [
    { x: 150, y: 300, r: 9 }, { x: 230, y: 290, r: 9 }, { x: 210, y: 220, r: 9 },
    // Green ring
    { x: 262, y: 108, r: 9 }, { x: 336, y: 84, r: 9 }, { x: 296, y: 56, r: 9 }, { x: 270, y: 70, r: 9 },
  ], water: [], hazard: [{ x: 258, y: 128, w: 26, h: 18 }] },
  // 15 — par 3, 335ft. Narrow tunnel walled with trees both sides AND a slalom
  // of trunks inside the lane itself, opening to a clearing around the green.
  { par: 3, tee: TEE, basket: { x: 158, y: 88 }, fairway: [{ x: 160, y: 416 }, { x: 158, y: 260 }, { x: 158, y: 150 }, { x: 158, y: 88 }], fwWidth: 96, trees: [
    { x: 112, y: 300, r: 11 }, { x: 206, y: 300, r: 11 }, { x: 112, y: 255, r: 10 }, { x: 206, y: 255, r: 10 }, { x: 112, y: 200, r: 11 }, { x: 206, y: 200, r: 11 }, { x: 112, y: 160, r: 10 }, { x: 206, y: 160, r: 10 }, { x: 114, y: 122, r: 10 }, { x: 204, y: 122, r: 10 },
    // In-fairway slalom
    { x: 148, y: 330, r: 9 }, { x: 172, y: 230, r: 9 }, { x: 146, y: 178, r: 9 },
  ], water: [] },
  // 16 — par 3, 410ft. Curves gently RIGHT; the lane runs up the left and the
  // green hides RIGHT inside a pocket of trees.
  { par: 3, tee: TEE, basket: { x: 182, y: 104 }, fairway: [{ x: 160, y: 416 }, { x: 158, y: 300 }, { x: 162, y: 200 }, { x: 174, y: 140 }, { x: 182, y: 104 }], fwWidth: 108, trees: [{ x: 180, y: 310, r: 10 }, { x: 200, y: 260, r: 10 }, { x: 150, y: 240, r: 9 }, { x: 185, y: 180, r: 10 }, { x: 140, y: 150, r: 9 }, { x: 214, y: 118, r: 9 }, { x: 162, y: 76, r: 9 }, { x: 148, y: 122, r: 9 }], water: [] },
  // 17 — par 4, 830ft. Bends steadily RIGHT through gate trees to a green
  // ringed in wood; the big sand traps sit on the left of the curve.
  { par: 4, tee: TEE, basket: { x: 220, y: 80 }, fairway: [{ x: 160, y: 416 }, { x: 160, y: 300 }, { x: 175, y: 210 }, { x: 200, y: 140 }, { x: 220, y: 80 }], fwWidth: 118, trees: [
    { x: 120, y: 290, r: 10 }, { x: 200, y: 252, r: 10 }, { x: 125, y: 210, r: 9 }, { x: 140, y: 160, r: 9 }, { x: 188, y: 160, r: 9 },
    // Green ring
    { x: 196, y: 110, r: 9 }, { x: 186, y: 96, r: 9 }, { x: 254, y: 88, r: 9 }, { x: 216, y: 48, r: 9 }, { x: 184, y: 58, r: 9 },
  ], water: [], hazard: [{ x: 142, y: 150, w: 30, h: 20 }, { x: 158, y: 185, w: 22, h: 16 }] },
  // 18 — par 5, 1000ft. The fairway pond sits right where a full DRIVE lands —
  // lay up short or thread past it — then a wood of trees shapes the second
  // shot on the way to the finishing green up right (caddie book).
  { par: 5, tee: TEE, basket: { x: 180, y: 90 }, fairway: [{ x: 160, y: 416 }, { x: 162, y: 330 }, { x: 158, y: 240 }, { x: 164, y: 150 }, { x: 180, y: 90 }], fwWidth: 124, trees: [
    { x: 165, y: 340, r: 9 },
    // Second-shot wood (between the pond and the green approach)
    { x: 150, y: 250, r: 9 }, { x: 190, y: 225, r: 9 }, { x: 130, y: 200, r: 9 }, { x: 175, y: 178, r: 9 },
    { x: 120, y: 130, r: 9 }, { x: 142, y: 110, r: 9 }, { x: 212, y: 102, r: 9 },
  ], water: [{ x: 120, y: 280, w: 74, h: 30 }] },
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
// The tee keeps its authored x — putting the tee off-center (e.g. far left)
// lets a hole dogleg across the full canvas width instead of only ±90px.
function materializeHole(t: Omit<Hole, "worldH">): Hole {
  const worldH = worldHForPar(t.par);
  const scale = (worldH - 60 - TEE_BEHIND) / (416 - 50); // template y[50..416] → world[60..tee]
  const ty = (y: number) => 60 + (y - 50) * scale;
  return {
    par: t.par,
    worldH,
    worldW: t.worldW,
    tee: { x: t.tee.x, y: worldH - TEE_BEHIND },
    basket: { x: t.basket.x, y: ty(t.basket.y) },
    fairway: t.fairway.map((p) => ({ x: p.x, y: ty(p.y) })),
    fairways: t.fairways?.map((f) => f.map((p) => ({ x: p.x, y: ty(p.y) }))),
    fwWidth: t.fwWidth,
    trees: t.trees.map((tr) => ({ x: tr.x, y: ty(tr.y), r: tr.r })),
    water: t.water.map((w) => ({ x: w.x, y: ty(w.y), w: w.w, h: w.h * scale })),
    hazard: (t.hazard ?? []).map((o) => ({ x: o.x, y: ty(o.y), w: o.w, h: o.h * scale })),
    obZones: t.obZones?.map((o) => ({ x: o.x, y: ty(o.y), w: o.w, h: o.h * scale })),
    dropZone: t.dropZone ? { x: t.dropZone.x, y: ty(t.dropZone.y) } : undefined,
    walls: t.walls?.map((wl) => ({ x: wl.x, y: ty(wl.y), w: wl.w })),
    roughIsHazard: t.roughIsHazard,
    elev: t.elev,
    elevZones: t.elevZones, // fractions of tee→basket, so no rescaling needed
  };
}
const HOLES: Hole[] = HOLE_TEMPLATES.map(materializeHole);
const TOTAL_PAR = HOLES.reduce((s, h) => s + h.par, 0);

// ── Winthrop Lake (College Disc Golf National Championships), 18 holes / par
// 61. Authored from the official caddie book: the lake guards the left side of
// the front stretch, the middle is rope-hazard golf across open park, and the
// finish climbs back along the water. Flat terrain (no elev).
const WINTHROP_TEMPLATES: Omit<Hole, "worldH">[] = [
  // 1 — par 4, 701ft. The lake runs the ENTIRE left side while the fairway
  // bends steadily right away from it to a green up the right (caddie book).
  { par: 4, tee: TEE, basket: { x: 205, y: 96 }, fairway: [{ x: 160, y: 416 }, { x: 152, y: 330 }, { x: 150, y: 250 }, { x: 170, y: 175 }, { x: 195, y: 120 }, { x: 205, y: 96 }], elev: -1, fwWidth: 116, trees: [{ x: 120, y: 290, r: 9 }, { x: 200, y: 310, r: 9 }, { x: 205, y: 210, r: 9 }, { x: 238, y: 140, r: 9 }, { x: 240, y: 86, r: 9 }], water: [
    // Continuous shoreline hugging the left OB edge, tee to green — each slab
    // overlaps the next so the lake reads as one body of water, running a
    // little past the basket on the left
    { x: 86, y: 330, w: 26, h: 48 }, { x: 84, y: 282, w: 28, h: 50 }, { x: 88, y: 232, w: 30, h: 52 }, { x: 96, y: 180, w: 30, h: 54 }, { x: 110, y: 138, w: 30, h: 44 }, { x: 124, y: 84, w: 28, h: 56 },
  ] },
  // 2 — par 3, 389ft. The signature water hole: the lake fills everything
  // between tee and basket on the left, creeps to the pin and wraps BEHIND it.
  // The in-bounds bail is the right side — but a tree cluster guards it, so
  // going around rarely leaves a birdie look.
  { par: 3, tee: TEE, basket: { x: 120, y: 98 }, fairway: [{ x: 160, y: 416 }, { x: 165, y: 330 }, { x: 160, y: 240 }, { x: 140, y: 160 }, { x: 120, y: 98 }], elev: -1, fwWidth: 112, trees: [
    { x: 172, y: 166, r: 11 }, { x: 190, y: 150, r: 9 }, { x: 182, y: 196, r: 9 }, { x: 200, y: 186, r: 9 },
  ], water: [
    { x: 60, y: 278, w: 88, h: 42 }, { x: 52, y: 158, w: 96, h: 112 }, // the lake, tee to mid
    { x: 58, y: 84, w: 38, h: 62 }, { x: 88, y: 52, w: 80, h: 28 }, // creeping to the pin + wrapping behind it
  ] },
  // 3 — par 3, 371ft. Hugs the shoreline, bending left to a beachside green.
  // No sand here — OB plays from the marked drop zone short of the green.
  { par: 3, tee: TEE, basket: { x: 118, y: 104 }, fairway: [{ x: 160, y: 416 }, { x: 152, y: 300 }, { x: 138, y: 200 }, { x: 122, y: 140 }, { x: 118, y: 104 }], fwWidth: 108, trees: [{ x: 190, y: 260, r: 10 }, { x: 170, y: 180, r: 9 }, { x: 178, y: 150, r: 9 }], water: [
    // Continuous shoreline down the whole left side, running past the green
    { x: 92, y: 330, w: 26, h: 50 }, { x: 88, y: 282, w: 28, h: 50 }, { x: 82, y: 232, w: 28, h: 52 }, { x: 74, y: 180, w: 30, h: 54 }, { x: 64, y: 134, w: 30, h: 48 }, { x: 56, y: 88, w: 32, h: 48 },
  ], dropZone: { x: 160, y: 142 } },
  // 4 — par 3, 284ft. Open, but a wooden fence crosses the fairway short of
  // the green with a square arch in the middle — thread it or bounce off.
  { par: 3, tee: TEE, basket: { x: 160, y: 100 }, fairway: [{ x: 160, y: 416 }, { x: 160, y: 300 }, { x: 160, y: 180 }, { x: 160, y: 100 }], dropZone: { x: 120, y: 182 }, elev: -1, fwWidth: 120, trees: [], walls: [{ x: 100, y: 150, w: 46 }, { x: 174, y: 150, w: 46 }], water: [] },
  // 5 — par 4, 697ft. Narrow wooded corridor easing LEFT, then cutting back
  // RIGHT at the very end into the green.
  { par: 4, tee: TEE, basket: { x: 172, y: 90 }, fairway: [{ x: 160, y: 416 }, { x: 150, y: 320 }, { x: 142, y: 230 }, { x: 142, y: 160 }, { x: 158, y: 115 }, { x: 172, y: 90 }], fwWidth: 106, trees: [{ x: 115, y: 330, r: 9 }, { x: 198, y: 300, r: 9 }, { x: 118, y: 250, r: 10 }, { x: 192, y: 220, r: 9 }, { x: 120, y: 170, r: 9 }, { x: 195, y: 150, r: 9 }, { x: 130, y: 106, r: 9 }, { x: 210, y: 102, r: 9 }], water: [] },
  // 6 — par 3, 395ft. A "7" shape: out to the RIGHT first, then the whole
  // finish sweeps LEFT down to the green by the clubhouse; OB everywhere.
  { par: 3, tee: TEE, basket: { x: 120, y: 106 }, fairway: [{ x: 160, y: 416 }, { x: 180, y: 340 }, { x: 198, y: 270 }, { x: 200, y: 230 }, { x: 160, y: 160 }, { x: 120, y: 106 }], fwWidth: 110, trees: [{ x: 145, y: 300, r: 9 }, { x: 230, y: 255, r: 9 }, { x: 165, y: 130, r: 9 }, { x: 88, y: 132, r: 9 }, { x: 116, y: 70, r: 9 }], water: [] },
  // 7 — par 4, 549ft. The horseshoe: out LEFT around the bend, then back RIGHT
  // to a hilltop green — 440-wide world, OB inside and out.
  { par: 4, worldW: 440, tee: { x: 300, y: 416 }, basket: { x: 300, y: 104 }, fairway: [{ x: 300, y: 416 }, { x: 230, y: 360 }, { x: 180, y: 300 }, { x: 165, y: 230 }, { x: 185, y: 165 }, { x: 245, y: 125 }, { x: 300, y: 104 }], fwWidth: 116, trees: [{ x: 250, y: 330, r: 9 }, { x: 205, y: 265, r: 9 }, { x: 230, y: 150, r: 9 }, { x: 264, y: 120, r: 9 }, { x: 336, y: 96, r: 9 }, { x: 296, y: 68, r: 9 }], water: [] },
  // 8 — par 4, 734ft. Long, narrow, dead straight — big rope-hazard bunkers
  // snake along both edges (and one mid-lane) the whole way.
  { par: 4, tee: TEE, basket: { x: 160, y: 80 }, fairway: [{ x: 160, y: 416 }, { x: 158, y: 320 }, { x: 160, y: 230 }, { x: 158, y: 150 }, { x: 160, y: 80 }], fwWidth: 98, trees: [{ x: 120, y: 300, r: 9 }, { x: 200, y: 260, r: 9 }, { x: 125, y: 180, r: 9 }], water: [], hazard: [{ x: 104, y: 340, w: 34, h: 26 }, { x: 176, y: 302, w: 32, h: 26 }, { x: 102, y: 250, w: 34, h: 26 }, { x: 146, y: 222, w: 30, h: 22 }, { x: 180, y: 182, w: 30, h: 24 }, { x: 104, y: 154, w: 34, h: 24 }, { x: 176, y: 124, w: 32, h: 22 }] },
  // 9 — par 3, 449ft. Wide-open park golf; rope-hazard pockets flank the green.
  { par: 3, tee: TEE, basket: { x: 150, y: 95 }, fairway: [{ x: 160, y: 416 }, { x: 156, y: 300 }, { x: 150, y: 190 }, { x: 150, y: 95 }], elev: -2, fwWidth: 128, trees: [{ x: 200, y: 220, r: 9 }], water: [], hazard: [{ x: 96, y: 120, w: 30, h: 22 }, { x: 188, y: 112, w: 30, h: 22 }] },
  // 10 — par 3, 413ft. Bends left; everything outside the rope line plays as
  // HAZARD (+1, play it where it lies) — no OB, no sand.
  { par: 3, tee: { x: 180, y: 416 }, basket: { x: 120, y: 100 }, roughIsHazard: true, fairway: [{ x: 180, y: 416 }, { x: 170, y: 320 }, { x: 150, y: 230 }, { x: 130, y: 160 }, { x: 120, y: 100 }], elev: -2, fwWidth: 116, trees: [{ x: 196, y: 260, r: 9 }], water: [] },
  // 11 — par 3, 303ft. A tight tunnel through the woods.
  { par: 3, tee: TEE, basket: { x: 160, y: 108 }, fairway: [{ x: 160, y: 416 }, { x: 160, y: 300 }, { x: 160, y: 200 }, { x: 160, y: 108 }], fwWidth: 96, trees: [{ x: 114, y: 320, r: 10 }, { x: 206, y: 320, r: 10 }, { x: 114, y: 250, r: 10 }, { x: 206, y: 250, r: 10 }, { x: 114, y: 190, r: 10 }, { x: 206, y: 190, r: 10 }, { x: 116, y: 140, r: 9 }, { x: 204, y: 140, r: 9 }, { x: 148, y: 280, r: 8 }, { x: 174, y: 220, r: 8 }], water: [] },
  // 12 — par 3, 321ft. Tree-lined lane drifting right along the path, with
  // thick wood at the tee and around the green.
  { par: 3, tee: TEE, basket: { x: 175, y: 108 }, fairway: [{ x: 160, y: 416 }, { x: 165, y: 300 }, { x: 172, y: 200 }, { x: 175, y: 108 }], fwWidth: 108, trees: [{ x: 130, y: 370, r: 9 }, { x: 195, y: 360, r: 9 }, { x: 125, y: 310, r: 9 }, { x: 210, y: 270, r: 9 }, { x: 130, y: 220, r: 9 }, { x: 215, y: 180, r: 9 }, { x: 140, y: 150, r: 9 }, { x: 206, y: 142, r: 9 }, { x: 140, y: 124, r: 9 }, { x: 212, y: 118, r: 9 }, { x: 172, y: 76, r: 9 }], water: [] },
  // 13 — par 3, 391ft. Straight with staggered tree clusters to weave through;
  // like 10, the rough outside the rope plays as HAZARD instead of OB.
  { par: 3, tee: TEE, basket: { x: 160, y: 100 }, roughIsHazard: true, fairway: [{ x: 160, y: 416 }, { x: 160, y: 300 }, { x: 160, y: 200 }, { x: 160, y: 100 }], elev: -1, fwWidth: 118, trees: [{ x: 150, y: 260, r: 10 }, { x: 172, y: 250, r: 9 }, { x: 185, y: 170, r: 10 }, { x: 140, y: 160, r: 9 }, { x: 128, y: 118, r: 9 }, { x: 196, y: 112, r: 9 }], water: [] },
  // 14 — par 3, 409ft. Drifts right between the gravel lot and the fence line;
  // wooded right off the tee.
  { par: 3, tee: TEE, basket: { x: 185, y: 98 }, fairway: [{ x: 160, y: 416 }, { x: 168, y: 310 }, { x: 178, y: 210 }, { x: 185, y: 98 }], elev: 1, fwWidth: 112, trees: [{ x: 125, y: 370, r: 9 }, { x: 195, y: 362, r: 9 }, { x: 140, y: 330, r: 9 }, { x: 160, y: 250, r: 10 }, { x: 195, y: 180, r: 9 }, { x: 145, y: 160, r: 9 }, { x: 152, y: 114, r: 9 }, { x: 218, y: 90, r: 9 }], water: [] },
  // 15 — par 3, 283ft. Wooded with a rock-gate pinch mid-flight, then a
  // clearing around the green; mind the fallen log right of the pin.
  { par: 3, tee: TEE, basket: { x: 170, y: 104 }, fairway: [{ x: 160, y: 416 }, { x: 162, y: 300 }, { x: 168, y: 200 }, { x: 170, y: 104 }], elev: -1, fwWidth: 100, trees: [{ x: 118, y: 320, r: 10 }, { x: 208, y: 310, r: 10 }, { x: 128, y: 232, r: 9 }, { x: 196, y: 228, r: 9 }, { x: 120, y: 170, r: 9 }, { x: 215, y: 160, r: 9 }, { x: 206, y: 122, r: 8 }], water: [] },
  // 16 — par 3, 249ft. Short pitch to a beach green by the lake — water long,
  // sand short. Don't be greedy.
  { par: 3, tee: TEE, basket: { x: 130, y: 150 }, fairway: [{ x: 160, y: 416 }, { x: 150, y: 310 }, { x: 138, y: 220 }, { x: 130, y: 150 }], dropZone: { x: 178, y: 158 }, elev: -1, fwWidth: 112, trees: [{ x: 190, y: 240, r: 9 }], water: [{ x: 70, y: 90, w: 80, h: 40 }], hazard: [{ x: 92, y: 176, w: 28, h: 16 }, { x: 150, y: 182, w: 26, h: 16 }] },
  // 17 — par 4, 647ft. A narrow shore strip with the lake left the whole way,
  // hooking left at the top behind the trees.
  { par: 4, tee: TEE, basket: { x: 114, y: 100 }, fairway: [{ x: 160, y: 416 }, { x: 148, y: 320 }, { x: 140, y: 240 }, { x: 142, y: 170 }, { x: 128, y: 120 }, { x: 114, y: 100 }], elev: 1, fwWidth: 104, trees: [{ x: 180, y: 280, r: 9 }, { x: 172, y: 200, r: 9 }, { x: 158, y: 140, r: 10 }], water: [{ x: 62, y: 300, w: 30, h: 30 }, { x: 58, y: 200, w: 32, h: 32 }, { x: 56, y: 130, w: 30, h: 24 }] },
  // 18 — par 5, 841ft. The closer: grass OB islands dot the fairway (roped-off
  // turf, not sand), and the hole curves harder RIGHT at the end to the green.
  { par: 5, tee: { x: 200, y: 416 }, basket: { x: 205, y: 84 }, fairway: [{ x: 200, y: 416 }, { x: 175, y: 340 }, { x: 155, y: 260 }, { x: 150, y: 190 }, { x: 175, y: 130 }, { x: 205, y: 84 }], elev: -1, fwWidth: 118, trees: [{ x: 210, y: 300, r: 9 }, { x: 120, y: 240, r: 9 }, { x: 195, y: 170, r: 9 }, { x: 120, y: 150, r: 9 }, { x: 170, y: 96, r: 9 }, { x: 240, y: 100, r: 9 }, { x: 206, y: 44, r: 9 }], water: [], obZones: [{ x: 180, y: 250, w: 34, h: 16 }, { x: 128, y: 148, w: 30, h: 14 }, { x: 190, y: 118, w: 28, h: 12 }] },
];
const WINTHROP_HOLES: Hole[] = WINTHROP_TEMPLATES.map(materializeHole);
const WINTHROP_PAR = WINTHROP_HOLES.reduce((s, h) => s + h.par, 0);
// Winthrop's personal best lives in its own key.
const WBEST_KEY = "discgolf.best.winthrop18";
// Leaderboards are per course; each daily seed gets its own board.
function leaderboardCourse(mode: Mode, seed: number): string {
  return mode === "course" ? "glendoveer" : mode === "winthrop" ? "winthrop" : `daily-${seed}`;
}

// ── Online Friendly Challenge: ephemeral lobbies over Supabase Realtime
// (broadcast + presence, no database). A short shareable code names the
// channel; everyone with the code plays the same seed and scores sync live. ──
type LobbyPlayer = { id: string; name: string; host: boolean; mode?: Mode };
type OnlineScore = { name: string; scores: number[]; total: number; thru: number };
// 4-char codes, omitting easily-confused characters (0/O, 1/I, etc.).
function makeLobbyCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i++) out += alphabet[(Math.random() * alphabet.length) | 0];
  return out;
}
function makeClientId(): string {
  return `${(Math.random() * 1e9) | 0}-${(Math.random() * 1e9) | 0}`;
}

// ── Tournament mode: 3 rounds at Winthrop Lake (College Nationals) against a
// seeded AI field, with a cut to the top half after round 2. ──
const TOURN_KEY = "discgolf.tournament.v1";
const TOURN_NAMES = [
  "A. Hammes", "C. Dickerson", "L. Castro", "J. Mwangi", "T. Nakamura", "R. Pulido",
  "S. Ostrander", "M. Beil", "D. Kowalski", "B. Tran", "K. Ferraro", "E. Stokes",
  "G. Lindqvist", "P. Okafor", "N. Marsh", "V. Duarte", "H. Sloan", "W. Pickett",
  "F. Aaltonen", "O. Reyes", "C. Burchfield", "J. Whitlock", "A. Drummond", "Z. Calloway",
  "M. Sorensen", "T. Vega", "R. Easterling", "D. Croft", "S. Bhatt", "L. Mercer",
  "K. Howell", "E. Trask", "B. Quinones", "J. Felder", "Y. Petrov",
];
type Tournament = {
  seed: number;
  round: number; // next round to play (0-based); rounds played = myTotals.length
  myTotals: number[];
  fieldTotals: number[][]; // [round][playerIdx]
  madeCut: boolean;
  finished: boolean;
};
// Per-player skill: divided by 2.5 below, this spans about -10..+1.5 strokes
// vs par per round — the very best in the field average around -10.
function tournSkills(seed: number): number[] {
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  return TOURN_NAMES.map(() => rng() * 29 - 25);
}
// Hole-by-hole field scores so live standings exist mid-round. Skill is fixed
// across rounds — same player, same expected scoring all weekend.
function tournFieldHoles(seed: number, round: number): number[][] {
  const skills = tournSkills(seed);
  const rng = mulberry32((seed * 31 + round * 7919) >>> 0);
  return skills.map((sk) => {
    const perHole = sk / 2.5 / 18;
    return WINTHROP_HOLES.map((h) => {
      let d = Math.round(perHole + (rng() * 2 - 1) * 0.85);
      if (rng() < 0.04) d -= 1; // the odd bomb
      if (rng() < 0.05) d += 1; // and the odd blow-up
      return Math.max(1, h.par + d);
    });
  });
}
function tournFieldRound(seed: number, round: number): number[] {
  return tournFieldHoles(seed, round).map((hs) => hs.reduce((a, b) => a + b, 0));
}
// Live position during a tournament round: the AI field is scored through the
// same number of holes you've played (cut players excluded in the final round).
function tournLive(t: Tournament, myRoundSoFar: number, holesPlayed: number): { rank: number; behind: number; field: number } {
  const roundIdx = t.myTotals.length;
  const fieldHoles = tournFieldHoles(t.seed, roundIdx);
  const myTotal = t.myTotals.reduce((a, b) => a + b, 0) + myRoundSoFar;
  let active = TOURN_NAMES.map((_, i) => i);
  if (roundIdx === 2 && t.fieldTotals.length >= 2) {
    const sums = [t.myTotals[0] + t.myTotals[1], ...t.fieldTotals[0].map((_, i) => t.fieldTotals[0][i] + t.fieldTotals[1][i])];
    const line = [...sums].sort((a, b) => a - b)[Math.floor(sums.length / 2) - 1];
    active = active.filter((i) => t.fieldTotals[0][i] + t.fieldTotals[1][i] <= line);
  }
  const totals = active.map((i) => {
    let prev = 0;
    for (let r = 0; r < roundIdx; r++) prev += t.fieldTotals[r][i];
    return prev + fieldHoles[i].slice(0, holesPlayed).reduce((a, b) => a + b, 0);
  });
  const rank = 1 + totals.filter((v) => v < myTotal).length;
  const leader = Math.min(myTotal, ...totals);
  return { rank, behind: myTotal - leader, field: active.length + 1 };
}
const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;
type TournRow = { name: string; you: boolean; rounds: (number | null)[]; total: number; cut: boolean };
// Standings with the post-R2 cut applied (ties at the line advance).
function tournStandings(t: Tournament): TournRow[] {
  const played = t.myTotals.length;
  const fieldRounds = t.fieldTotals.length;
  let cutLine = Infinity;
  if (played >= 2 && fieldRounds >= 2) {
    const sums = [t.myTotals[0] + t.myTotals[1], ...t.fieldTotals[0].map((_, i) => t.fieldTotals[0][i] + t.fieldTotals[1][i])];
    const sorted = [...sums].sort((a, b) => a - b);
    cutLine = sorted[Math.floor(sorted.length / 2) - 1];
  }
  const rows: TournRow[] = [];
  const myCut = played >= 2 && t.myTotals[0] + t.myTotals[1] > cutLine;
  rows.push({ name: "You", you: true, rounds: t.myTotals.slice(), total: t.myTotals.reduce((a, b) => a + b, 0), cut: myCut });
  TOURN_NAMES.forEach((name, i) => {
    const sum2 = fieldRounds >= 2 ? t.fieldTotals[0][i] + t.fieldTotals[1][i] : 0;
    const cut = fieldRounds >= 2 && sum2 > cutLine;
    const rounds: (number | null)[] = [];
    for (let r = 0; r < fieldRounds; r++) rounds.push(r === 2 && cut ? null : t.fieldTotals[r][i]);
    rows.push({ name, you: false, rounds, total: rounds.reduce<number>((a, b) => a + (b ?? 0), 0), cut });
  });
  rows.sort((a, b) => (a.cut === b.cut ? a.total - b.total : a.cut ? 1 : -1));
  return rows;
}

// Fixed per-hole elevation (course identity, not random): + uphill / − downhill,
// −2..+2. Matches the real Glendoveer East terrain hole by hole (e.g. 2/5/6/11
// drop hard, 7 climbs hard, the closing stretch is flat). Affects how far a
// throw carries; shown on the minimap as ▲/▼.
// (Hole 9 is zoned in its template instead: downhill first half, uphill second.)
const HOLE_ELEV = [0, -2, 0, 0, -2, -2, 2, -1, 0, 0, -2, -1, 1, -1, 0, 0, 0, 0];

type Mode = "daily" | "course" | "winthrop";

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
  { id: "natty", name: "National Champion", emoji: "🏟", desc: "Win the Winthrop Lake tournament" },
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

// Release angle, chosen per throw. Hyzer locks in a hard, early, reliable fade
// (a touch less distance); flat flies the disc's natural shape; anhyzer turns
// the disc over AGAINST its fade while it climbs — more distance and the
// opposite shape, but it only drifts back a little late, so it's commitment.
type Release = "hyzer" | "flat" | "anny";
function releaseSpeedMul(r: Release) {
  return r === "hyzer" ? 0.94 : r === "anny" ? 1.04 : 1;
}

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
// Some advanced discs are earned, not given: each maps to the achievement that
// unlocks it (the simple bag and the advanced core are always available).
const DISC_UNLOCKS: Record<string, { ach: string; label: string } | undefined> = {
  zone: { ach: "birdie", label: "score a birdie" },
  swarm: { ach: "bogeyfree9", label: "bogey-free nine" },
  firebird: { ach: "daily", label: "finish a Daily" },
  nukeos: { ach: "eagle", label: "score an eagle" },
  destroyer: { ach: "underpar", label: "round under par" },
};
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
  practice?: boolean; // single-hole practice (no bests/history/leaderboard)
  practiceHole?: number; // 1-based hole number being practiced
  party?: { names: string[]; current: number; scores: (number | null)[][] }; // hot-seat pass-and-play
  online?: boolean; // online Friendly Challenge round (scores synced over Realtime)
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
  roundPaths: Vec[][][]; // shotPaths of every finished hole (for the best-round ghost)
  trailBuf: Vec[]; // path of the shot currently in the air
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
};

// Aim straight at the basket from a given lie.
function aimAt(from: Vec, basket: Vec): number {
  return Math.atan2(basket.y - from.y, basket.x - from.x);
}

// Horizontal camera position that centers `x` inside a hole's world width.
function camXFor(hole: Hole, x: number) {
  return Math.max(0, Math.min((hole.worldW ?? W) - W, x - W / 2));
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
    release: "flat" as Release,
    h: 0,
    vh: 0,
    camY: 0, // start showing the basket (top), then pan down
    camX: camXFor(hole, hole.basket.x), // intro looks at the basket first
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
// Off every fairway ribbon (used for both the OB test and hazard-rough holes).
function offRibbons(hole: Hole, x: number, y: number) {
  const half = hole.fwWidth / 2;
  return ![hole.fairway, ...(hole.fairways ?? [])].some((f) => distToPath(x, y, f) <= half);
}
function inAnyOB(hole: Hole, x: number, y: number) {
  if (x < 2 || x > (hole.worldW ?? W) - 2 || y < 2 || y > hole.worldH - 2) return true;
  // Beyond the ribbon is OB — unless this hole's rough plays as hazard.
  if (!hole.roughIsHazard && offRibbons(hole, x, y)) return true;
  for (const w of hole.water) if (inRect(w, x, y)) return true;
  for (const ob of hole.obZones ?? []) if (inRect(ob, x, y)) return true;
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
    trees.push({ x: tx, y: Math.round(p.y), r: Math.round(r(9, 11)) });
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
  const course = mode === "winthrop" ? WINTHROP_HOLES : HOLES;
  return course.map((h, i) => {
    const { wind, windMag } = seededWind(rng);
    const base = h.basket;
    const pin = clampPin(
      { x: base.x + (rng() * 2 - 1) * 22, y: base.y + (rng() * 2 - 1) * 16 },
      h.fairway,
      h.fwWidth / 2 - 9,
      base,
    );
    return { ...h, basket: pin, wind, windMag, elev: mode === "course" ? HOLE_ELEV[i] ?? 0 : h.elev ?? 0 };
  });
}
// Elevation acts on the disc DURING flight: a per-frame pull along the hole
// axis while airborne. Uphill (+elev) pushes the disc back downfield (+y),
// downhill (−elev) pulls it on toward the basket — so the flight visibly
// stretches or stalls on sloped holes (~±13% carry per |elev| step).
const SLOPE_PULL = 0.014;
// Ground roll-out also depends on slope: downhill rolls farther, uphill checks
// up quickly. Higher friction value = less deceleration = more roll.
function elevGroundFriction(elev: number | undefined) {
  return Math.max(0.7, Math.min(0.92, GROUND_FRICTION - (elev ?? 0) * 0.025));
}
// Elevation at a world position. Most holes have a single slope (`elev`); a
// hole with `elevZones` changes slope along its length (e.g. hole 9 plays
// downhill for the first half, then climbs to the green).
function elevAt(hole: Hole, y: number): number {
  if (!hole.elevZones?.length) return hole.elev ?? 0;
  const t = (hole.tee.y - y) / Math.max(1, hole.tee.y - hole.basket.y);
  for (const z of hole.elevZones) if (t <= z.to) return z.elev;
  return hole.elevZones[hole.elevZones.length - 1].elev;
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
  let vy = disc.power * (1.2 + 3.35) * speedMul; // power = 1
  let h = 0;
  let vh = disc.arc; // power = 1
  for (let i = 0; i < 600; i++) {
    y += vy;
    h += vh;
    vh -= GRAVITY;
    if (h <= 0) { h = 0; vh = 0; }
    const airborne = h > AIRBORNE_H;
    // `vy` here is forward speed, so the uphill pull subtracts from it.
    if (airborne) vy -= (elev ?? 0) * SLOPE_PULL;
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

function stepFlight(f: Flight, disc: Disc, fadeSign: number, path: FlightPath, hole: Hole, release: Release = "flat"): { status: StepStatus; treeHit: boolean } {
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
    // finishes slightly toward the fade side. The release angle overrides the
    // shape: hyzer is a hard steady fade, anhyzer turns over against the fade.
    let a =
      path === "straight"
        ? (f.vh > 0 ? -fadeSign * disc.turn : fadeSign * disc.sFade)
        : fadeSign * disc.fade;
    if (release === "hyzer") a = fadeSign * Math.max(disc.fade, disc.sFade) * 1.6;
    else if (release === "anny") a = f.vh > 0 ? -fadeSign * (disc.fade + disc.turn + 0.004) : fadeSign * disc.sFade * 0.5;
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
  // The slope pulls the airborne disc downhill along the hole axis: uphill
  // (+elev) drags it back toward the tee (+y), downhill carries it onward.
  // Read at the disc's position so zoned holes change slope mid-flight.
  const elevHere = elevAt(hole, f.y);
  if (airborne) f.vy += elevHere * SLOPE_PULL;
  const friction = airborne ? disc.friction : elevGroundFriction(elevHere);
  f.vx *= friction;
  f.vy *= friction;

  if (f.x < 2 || f.x > (hole.worldW ?? W) - 2 || f.y < 2 || f.y > hole.worldH - 2) return { status: "oob", treeHit: false };

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

  // Wooden walls block at any height (like trees) — thread the gap between
  // segments or bounce off the planks.
  for (const wl of hole.walls ?? []) {
    if (f.x > wl.x - DISC_R && f.x < wl.x + wl.w + DISC_R && Math.abs(f.y - wl.y) < 4 + DISC_R) {
      f.y = wl.y + Math.sign(f.y - wl.y || 1) * (4 + DISC_R);
      f.vy = -f.vy * 0.45;
      f.vx *= 0.6;
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
      // Off every fairway ribbon, or in water, is out of bounds — except on
      // hazard-rough holes, where off-ribbon is a playable +1 (handled at rest).
      if (!hole.roughIsHazard && offRibbons(hole, f.x, f.y)) return { status: "ob", treeHit };
      for (const wt of hole.water) if (inRect(wt, f.x, f.y)) return { status: "ob", treeHit };
      for (const ob of hole.obZones ?? []) if (inRect(ob, f.x, f.y)) return { status: "ob", treeHit };
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
  const camRef = useRef({ x: 0, y: 0 }); // current camera scroll, mirrored for the pointer handlers
  const ghostRef = useRef<Vec[][][] | null>(null); // best-round flight paths for the active course
  const rangeFlashRef = useRef(0); // when a disc was last switched (brightens the reach line)
  // Juice: short-lived particles (world coords), camera shake, basket rattle.
  type Particle = { x: number; y: number; vx: number; vy: number; g: number; life: number; max: number; color: string; size: number };
  const particlesRef = useRef<Particle[]>([]);
  const shakeRef = useRef({ until: 0, mag: 0 });
  const rattleRef = useRef(0); // timestamp the basket chains were last hit
  const audioRef = useRef<AudioEngine | null>(null);
  const rafRef = useRef<number>(0);

  const [screen, setScreen] = useState<Screen>("title");
  const [muted, setMuted] = useState(false);
  const [discIndex, setDiscIndex] = useState(1); // Mid by default
  const [throwStyle, setThrowStyle] = useState<"BH" | "FH">("BH");
  const [flightPath, setFlightPath] = useState<FlightPath>("overstable");
  const [hud, setHud] = useState<{ hole: number; par: number; throws: number; holes: number; player?: string }>({ hole: 1, par: 3, throws: 0, holes: 18 });

  // End-of-round state
  const [scorecard, setScorecard] = useState<number[]>([]);
  const [finalTotal, setFinalTotal] = useState(0);
  const [finalSeed, setFinalSeed] = useState(0);
  const [finalPracticeHole, setFinalPracticeHole] = useState<number | null>(null);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [boardsOpen, setBoardsOpen] = useState(false);
  const [tournamentOpen, setTournamentOpen] = useState(false);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const tournamentRef = useRef<Tournament | null>(null);
  useEffect(() => { tournamentRef.current = tournament; }, [tournament]);
  const tournamentPlayRef = useRef(false); // current round is a tournament round
  const [finalTournament, setFinalTournament] = useState(false);
  const [tournLiveView, setTournLiveView] = useState<{ rank: number; behind: number; field: number } | null>(null);
  const [partyOpen, setPartyOpen] = useState(false);
  const [partyView, setPartyView] = useState<{ names: string[]; holeScores: (number | null)[]; totals: number[] } | null>(null);
  const [finalParty, setFinalParty] = useState<{ names: string[]; totals: number[] } | null>(null);

  // ── Online Friendly Challenge lobby (Supabase Realtime) ──
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [lobby, setLobby] = useState<{ code: string; isHost: boolean; mode: Mode } | null>(null);
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [onlineScores, setOnlineScores] = useState<Record<string, OnlineScore>>({});
  const [onlineView, setOnlineView] = useState<{ hole: number; par: number; myId: string } | null>(null);
  const [finalOnline, setFinalOnline] = useState(false);
  const onlineRef = useRef<{ channel: RealtimeChannel; code: string; myId: string; myName: string; isHost: boolean; mode: Mode } | null>(null);
  const onlineScoresRef = useRef<Record<string, OnlineScore>>({});
  const saveTournament = useCallback((t: Tournament | null) => {
    setTournament(t);
    try {
      if (t) localStorage.setItem(TOURN_KEY, JSON.stringify(t));
      else localStorage.removeItem(TOURN_KEY);
    } catch { /* ignore */ }
  }, []);

  // ── Challenge links: ?ch=<mode>.<seed>.<score>.<name> replays the exact
  // same round (same pins + wind) so two players can compare fairly. ──
  type Challenge = { mode: Mode; seed: number; score: number; name: string };
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const challengePlayRef = useRef(false); // current round IS the challenge round
  const [finalChallenge, setFinalChallenge] = useState<Challenge | null>(null);
  useEffect(() => {
    try {
      const raw = new URLSearchParams(location.search).get("ch");
      if (!raw) return;
      const [m, seedS, scoreS, nameS] = raw.split(".");
      const seed = Number(seedS);
      const score = Number(scoreS);
      if ((m === "course" || m === "winthrop" || m === "daily") && Number.isInteger(seed) && Number.isInteger(score) && score > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setChallenge({ mode: m, seed, score, name: decodeURIComponent(nameS ?? "").slice(0, 16) || "A friend" });
      }
    } catch { /* ignore malformed links */ }
  }, []);
  const challengeRef = useRef<Challenge | null>(null);
  useEffect(() => { challengeRef.current = challenge; }, [challenge]);
  const [finalPars, setFinalPars] = useState<number[]>(HOLES.map((h) => h.par));
  const [finalMode, setFinalMode] = useState<Mode>("course");
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [winthropBest, setWinthropBest] = useState<number | null>(null);
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

  const [release, setRelease] = useState<Release>("flat");
  const releaseRef = useRef<Release>("flat");
  useEffect(() => {
    releaseRef.current = release;
  }, [release]);

  // ── Settings (persisted) ──
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.7);
  const [leftHanded, setLeftHanded] = useState(false);
  const [showGhost, setShowGhost] = useState(true);
  const showGhostRef = useRef(true);
  useEffect(() => { showGhostRef.current = showGhost; }, [showGhost]);
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
      const wBest = localStorage.getItem(WBEST_KEY);
      setWinthropBest(wBest && Number.isFinite(Number(wBest)) ? Number(wBest) : null);

      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      if (s.throwStyle === "BH" || s.throwStyle === "FH") setThrowStyle(s.throwStyle);
      if (s.flightPath === "overstable" || s.flightPath === "straight") setFlightPath(s.flightPath);
      if (s.release === "hyzer" || s.release === "flat" || s.release === "anny") setRelease(s.release);
      if (typeof s.musicVolume === "number") setMusicVolume(s.musicVolume);
      if (typeof s.leftHanded === "boolean") setLeftHanded(s.leftHanded);
      if (typeof s.showGhost === "boolean") setShowGhost(s.showGhost);
      if (typeof s.advanced === "boolean") setAdvanced(s.advanced);

      const hb = JSON.parse(localStorage.getItem(HOLEBEST_KEY) || "null");
      holeBestRef.current = Array(18).fill(null).map((_, i) => (Array.isArray(hb) && typeof hb[i] === "number" ? hb[i] : null));
      const ach = JSON.parse(localStorage.getItem(ACH_KEY) || "[]");
      if (Array.isArray(ach)) { unlockedRef.current = ach; setUnlocked(ach); }
      const hist = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
      if (Array.isArray(hist)) { roundsPlayedRef.current = hist.length; setRoundsPlayed(hist.length); }
      const tourn = JSON.parse(localStorage.getItem(TOURN_KEY) || "null");
      if (tourn && typeof tourn.seed === "number" && Array.isArray(tourn.myTotals)) setTournament(tourn);
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
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ throwStyle, flightPath, release, musicVolume, leftHanded, advanced, showGhost }));
    } catch { /* ignore */ }
    saveProgress();
  }, [throwStyle, flightPath, release, musicVolume, leftHanded, advanced, showGhost, saveProgress]);

  const syncHud = useCallback(() => {
    const g = stateRef.current;
    if (!g) return;
    setHud({ hole: g.holeIndex + 1, par: g.roundHoles[g.holeIndex].par, throws: g.throws, holes: g.roundHoles.length, player: g.party ? g.party.names[g.party.current] : undefined });
  }, []);

  const startGame = useCallback((mode?: Mode, seedOverride?: number) => {
    const m = mode ?? modeRef.current;
    modeRef.current = m;
    if (!audioRef.current) {
      audioRef.current = new AudioEngine();
      audioRef.current.setMusicVolume(musicVolume);
    }
    audioRef.current.resume();
    audioRef.current.setMuted(muted);
    audioRef.current.startMusic();
    challengePlayRef.current = false; // the challenge button re-arms this after calling
    tournamentPlayRef.current = false; // ditto for the tournament launcher
    const seed = seedOverride ?? (m === "daily" ? dailySeed() : (Math.random() * 1e9) | 0);
    const roundHoles = buildRound(seed, m);
    const adv = advancedRef.current;
    const discIndex = Math.min(discIndexRef.current, activeDiscs(adv).length - 1);
    stateRef.current = {
      holeIndex: 0, scores: [], discIndex, roundPaths: [],
      mode: m, advanced: adv, seed, roundHoles, ...freshHole(roundHoles[0]),
    };
    // Load this course's best-round ghost (drawn as faint gold lines).
    try {
      ghostRef.current = m === "course" || m === "winthrop" ? JSON.parse(localStorage.getItem(`discgolf.ghost.${m}`) || "null") : null;
    } catch { ghostRef.current = null; }
    setSaved(false);
    setSaveErr(null);
    setIsNewBest(false);
    setNewAchievements([]);
    setHoleBestNote(null);
    setPartyView(null);
    setOnlineView(null);
    setSettingsOpen(false);
    setScreen("playing");
    syncHud();
  }, [muted, musicVolume, syncHud]);

  // Practice a single hole: same engine, but nothing counts (no bests,
  // history, achievements, or leaderboard) — pure reps.
  const startPractice = useCallback((m: Mode, holeIdx: number) => {
    modeRef.current = m;
    if (!audioRef.current) {
      audioRef.current = new AudioEngine();
      audioRef.current.setMusicVolume(musicVolume);
    }
    audioRef.current.resume();
    audioRef.current.setMuted(muted);
    audioRef.current.startMusic();
    challengePlayRef.current = false;
    const seed = (Math.random() * 1e9) | 0;
    const roundHoles = [buildRound(seed, m)[holeIdx]];
    const adv = advancedRef.current;
    stateRef.current = {
      holeIndex: 0, scores: [], discIndex: Math.min(discIndexRef.current, activeDiscs(adv).length - 1), roundPaths: [],
      mode: m, advanced: adv, seed, roundHoles, practice: true, practiceHole: holeIdx + 1, ...freshHole(roundHoles[0]),
    };
    ghostRef.current = null;
    setSaved(false);
    setSaveErr(null);
    setIsNewBest(false);
    setNewAchievements([]);
    setHoleBestNote(null);
    setPartyView(null);
    setOnlineView(null);
    setSettingsOpen(false);
    setScreen("playing");
    syncHud();
  }, [muted, musicVolume, syncHud]);

  // Hot-seat pass-and-play: 2-4 players take turns playing each hole on one
  // device. Nothing counts toward records — it's bragging rights only.
  const startParty = useCallback((m: Mode, names: string[]) => {
    modeRef.current = m;
    if (!audioRef.current) {
      audioRef.current = new AudioEngine();
      audioRef.current.setMusicVolume(musicVolume);
    }
    audioRef.current.resume();
    audioRef.current.setMuted(muted);
    audioRef.current.startMusic();
    challengePlayRef.current = false;
    tournamentPlayRef.current = false;
    const seed = m === "daily" ? dailySeed() : (Math.random() * 1e9) | 0;
    const roundHoles = buildRound(seed, m);
    const adv = advancedRef.current;
    stateRef.current = {
      holeIndex: 0, scores: [], discIndex: Math.min(discIndexRef.current, activeDiscs(adv).length - 1), roundPaths: [],
      mode: m, advanced: adv, seed, roundHoles, practice: true,
      party: { names, current: 0, scores: names.map(() => Array(roundHoles.length).fill(null)) },
      ...freshHole(roundHoles[0]),
    };
    ghostRef.current = null;
    setSaved(false);
    setSaveErr(null);
    setIsNewBest(false);
    setNewAchievements([]);
    setHoleBestNote(null);
    setPartyView(null);
    setOnlineView(null);
    setSettingsOpen(false);
    setScreen("playing");
    syncHud();
  }, [muted, musicVolume, syncHud]);

  // ── Online Friendly Challenge controller ──
  // Begin an online round (host on Start, everyone else on the "start"
  // broadcast). Same seed ⇒ identical holes; scores sync hole-by-hole.
  const beginOnlineRound = useCallback((seed: number, m: Mode) => {
    const o = onlineRef.current;
    if (!o) return;
    modeRef.current = m;
    if (!audioRef.current) {
      audioRef.current = new AudioEngine();
      audioRef.current.setMusicVolume(musicVolume);
    }
    audioRef.current.resume();
    audioRef.current.setMuted(muted);
    audioRef.current.startMusic();
    challengePlayRef.current = false;
    tournamentPlayRef.current = false;
    const roundHoles = buildRound(seed, m);
    const adv = advancedRef.current;
    onlineScoresRef.current = { [o.myId]: { name: o.myName, scores: [], total: 0, thru: 0 } };
    setOnlineScores(onlineScoresRef.current);
    stateRef.current = {
      holeIndex: 0, scores: [], discIndex: Math.min(discIndexRef.current, activeDiscs(adv).length - 1), roundPaths: [],
      mode: m, advanced: adv, seed, roundHoles, online: true,
      ...freshHole(roundHoles[0]),
    };
    ghostRef.current = null;
    setSaved(false);
    setSaveErr(null);
    setIsNewBest(false);
    setNewAchievements([]);
    setHoleBestNote(null);
    setPartyView(null);
    setOnlineView(null);
    setChallengeOpen(false);
    setScreen("playing");
    syncHud();
  }, [muted, musicVolume, syncHud]);

  // Join a Realtime channel for a lobby code: presence drives the roster,
  // broadcast carries the start signal and live scores.
  const connectLobby = useCallback((code: string, myName: string, isHost: boolean, m: Mode) => {
    if (!supa) return false;
    const myId = makeClientId();
    const channel = supa.channel(`dga-lobby-${code}`, {
      config: { presence: { key: myId }, broadcast: { self: false } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const st = channel.presenceState() as unknown as Record<string, LobbyPlayer[]>;
        setLobbyPlayers(Object.values(st).map((arr) => arr[0]).filter(Boolean));
      })
      .on("broadcast", { event: "start" }, ({ payload }) => {
        beginOnlineRound(payload.seed as number, payload.mode as Mode);
      })
      .on("broadcast", { event: "score" }, ({ payload }) => {
        const p = payload as OnlineScore & { id: string };
        onlineScoresRef.current = { ...onlineScoresRef.current, [p.id]: { name: p.name, scores: p.scores, total: p.total, thru: p.thru } };
        setOnlineScores(onlineScoresRef.current);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ id: myId, name: myName, host: isHost, mode: m });
      });
    onlineRef.current = { channel, code, myId, myName, isHost, mode: m };
    return true;
  }, [supa, beginOnlineRound]);

  const createLobby = useCallback((m: Mode, name: string) => {
    const code = makeLobbyCode();
    if (!connectLobby(code, name.trim() || "Host", true, m)) return;
    setLobbyPlayers([{ id: "self", name: name.trim() || "Host", host: true, mode: m }]);
    setLobby({ code, isHost: true, mode: m });
  }, [connectLobby]);

  const joinLobby = useCallback((code: string, name: string) => {
    const c = code.trim().toUpperCase();
    if (!connectLobby(c, name.trim() || "Player", false, "winthrop")) return;
    setLobby({ code: c, isHost: false, mode: "winthrop" });
  }, [connectLobby]);

  const startOnlineHost = useCallback(() => {
    const o = onlineRef.current;
    if (!o) return;
    const seed = (Math.random() * 1e9) | 0;
    void o.channel.send({ type: "broadcast", event: "start", payload: { seed, mode: o.mode } });
    beginOnlineRound(seed, o.mode);
  }, [beginOnlineRound]);

  const leaveLobby = useCallback(() => {
    const o = onlineRef.current;
    if (o) void supa?.removeChannel(o.channel);
    onlineRef.current = null;
    onlineScoresRef.current = {};
    setLobby(null);
    setLobbyPlayers([]);
    setOnlineScores({});
  }, [supa]);

  const selectDisc = useCallback((i: number) => {
    // Locked advanced discs can't be selected until their achievement is earned.
    if (advancedRef.current) {
      const lock = DISC_UNLOCKS[ADV_DISCS[i]?.key ?? ""];
      if (lock && !unlockedRef.current.includes(lock.ach)) return;
    }
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
    const disc = activeDiscs(g.advanced)[g.discIndex];
    // Advanced discs fly their baked-in shape (e.g. Nuke OS overstable,
    // Destroyer straight); simple mode uses the overstable/straight toggle.
    g.path = g.advanced ? disc.flight ?? "straight" : flightPathRef.current;
    g.release = releaseRef.current;
    // Slower launch + extra glide (disc friction) so it floats across the
    // fairway. Straight throws carry farther; the hole's slope acts on the
    // disc in-flight (see SLOPE_PULL in stepFlight), not on the launch.
    const pathMul = (g.path === "straight" ? STRAIGHT_SPEED_MUL : 1) * releaseSpeedMul(g.release);
    const speed = disc.power * (1.2 + g.power * 3.35) * pathMul;
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
    const online = g?.online ?? false;
    // Online and practice rounds don't touch personal records / history.
    const practice = (g?.practice ?? false) || online;
    const pars = g ? g.roundHoles.map((h) => h.par) : HOLES.map((h) => h.par);
    const total = scores.reduce((s, n) => s + n, 0);
    setScorecard(scores);
    setFinalTotal(total);
    setFinalPars(pars);
    setFinalMode(mode);
    setFinalPracticeHole(g?.practice ? g?.practiceHole ?? null : null);
    setFinalParty(g?.party ? { names: g.party.names, totals: g.party.scores.map((sc) => sc.reduce<number>((a, b) => a + (b ?? 0), 0)) } : null);
    setFinalOnline(online);

    // Personal bests are tracked per fixed course — Glendoveer and Winthrop
    // each have their own key (the daily course changes every day).
    if (!practice && (mode === "course" || mode === "winthrop")) {
      const key = mode === "course" ? BEST_KEY : WBEST_KEY;
      let prior: number | null = null;
      try {
        const raw = localStorage.getItem(key);
        prior = raw ? Number(raw) : null;
        if (prior != null && !Number.isFinite(prior)) prior = null;
      } catch {
        /* ignore */
      }
      const newBest = prior == null || total < prior;
      const best = newBest ? total : prior!;
      try { localStorage.setItem(key, String(best)); } catch { /* ignore */ }
      if (mode === "course") setBestScore(best);
      else setWinthropBest(best);
      setIsNewBest(newBest);
      // A new best round becomes the course ghost: every shot's flight path,
      // downsampled to keep storage small.
      if (newBest && g) {
        try {
          const paths = [...g.roundPaths, g.shotPaths].map((hp) =>
            hp.map((path) => path.filter((_, i) => i % 3 === 0 || i === path.length - 1).map((pt) => ({ x: Math.round(pt.x), y: Math.round(pt.y) }))),
          );
          localStorage.setItem(`discgolf.ghost.${mode}`, JSON.stringify(paths));
        } catch { /* ignore */ }
      }
    } else {
      setIsNewBest(false);
    }

    // Round history + achievements only count for full rounds, not practice.
    if (!practice) {
      let hist: { mode: Mode; total: number; date: number; scores?: number[]; pars?: number[] }[] = [];
      try { hist = JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); } catch { /* ignore */ }
      hist.push({ mode, total, date: Date.now(), scores, pars });
      try { localStorage.setItem(HIST_KEY, JSON.stringify(hist.slice(-100))); } catch { /* ignore */ }
      roundsPlayedRef.current = hist.length;
      setRoundsPlayed(hist.length);

      const earned = earnedAchievements(scores, pars, mode, hist.length);
      const fresh = earned.filter((id) => !unlockedRef.current.includes(id));
      if (fresh.length) {
        const all = [...unlockedRef.current, ...fresh];
        unlockedRef.current = all;
        setUnlocked(all);
        try { localStorage.setItem(ACH_KEY, JSON.stringify(all)); } catch { /* ignore */ }
      }
      setNewAchievements(fresh.map((id) => ACHIEVEMENTS.find((a) => a.id === id)!).filter(Boolean));
    } else {
      setNewAchievements([]);
    }

    // Tournament round: record it, simulate the AI field, run the cut, and
    // crown a champion at the end.
    if (tournamentPlayRef.current) {
      tournamentPlayRef.current = false;
      const t = tournamentRef.current;
      if (t && !t.finished) {
        const roundIdx = t.myTotals.length;
        const myTotals = [...t.myTotals, total];
        const fieldTotals = [...t.fieldTotals, tournFieldRound(t.seed, roundIdx)];
        let madeCut = t.madeCut;
        let finished = false;
        if (roundIdx === 1) {
          const sums = [myTotals[0] + myTotals[1], ...fieldTotals[0].map((_, i) => fieldTotals[0][i] + fieldTotals[1][i])];
          const sorted = [...sums].sort((a, b) => a - b);
          const line = sorted[Math.floor(sorted.length / 2) - 1];
          madeCut = myTotals[0] + myTotals[1] <= line;
          if (!madeCut) {
            finished = true;
            fieldTotals.push(tournFieldRound(t.seed, 2)); // the field plays on
          }
        } else if (roundIdx === 2) {
          finished = true;
        }
        const next: Tournament = { ...t, myTotals, fieldTotals, madeCut, finished, round: roundIdx + 1 };
        saveTournament(next);
        if (finished && madeCut && tournStandings(next)[0]?.you && !unlockedRef.current.includes("natty")) {
          const all = [...unlockedRef.current, "natty"];
          unlockedRef.current = all;
          setUnlocked(all);
          try { localStorage.setItem(ACH_KEY, JSON.stringify(all)); } catch { /* ignore */ }
          setNewAchievements((prev) => [...prev, ACHIEVEMENTS.find((a) => a.id === "natty")!]);
        }
      }
      setFinalTournament(true);
    } else {
      setFinalTournament(false);
    }

    audioRef.current?.sfx("win");
    vibrate([20, 40, 20]);
    setScreen("gameComplete");
    setFinalSeed(g?.seed ?? 0);
    setFinalChallenge(challengePlayRef.current ? challengeRef.current : null);
    setLeaderboard([]);
    if (!practice) void getArcadeLeaderboard(leaderboardCourse(mode, g?.seed ?? 0)).then(setLeaderboard).catch(() => {});
    if (!practice) saveProgress(); // sync best/achievements/history to the cloud if signed in
  }, [saveProgress, saveTournament]);

  const nextHole = useCallback(() => {
    const g = stateRef.current;
    if (!g) return;
    if (g.holeIndex + 1 >= g.roundHoles.length) {
      finishGame(g.scores.slice());
      return;
    }
    g.roundPaths.push(g.shotPaths);
    g.holeIndex += 1;
    if (g.party) g.party.current = 0;
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
      const course = leaderboardCourse(finalMode, finalSeed);
      const res = await submitArcadeScore(nameInput, finalTotal, course);
      if (!res.ok) {
        setSaveErr(res.error ?? "Save failed");
        return;
      }
      setSaved(true);
      const lb = await getArcadeLeaderboard(course);
      setLeaderboard(lb);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [saving, saved, nameInput, finalTotal, finalMode, finalSeed]);

  // Share a challenge link that replays this exact round (mode + seed).
  // Render the finished round to an image and share it (or download as fallback).
  const shareCard = useCallback(async () => {
    const total = finalTotal;
    const parTotal = finalPars.reduce((s, n) => s + n, 0);
    const over = total - parTotal;
    const nHoles = finalPars.length;
    const isDaily = finalMode === "daily";
    const courseLabel = isDaily ? "Daily Challenge" : finalMode === "winthrop" ? "Winthrop Lake" : "Glendoveer East";
    const courseName = `${courseLabel} · ${nHoles} holes · par ${parTotal}`;
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
        const where = isDaily ? "today's Daily Challenge" : courseLabel;
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
    if (!g || g.mode !== "course" || g.practice) { setHoleBestNote(null); return; }
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

    function spawnBurst(x: number, y: number, colors: string[], n: number, speed: number, grav = 0.04, life = 26) {
      const ps = particlesRef.current;
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = speed * (0.35 + Math.random() * 0.65);
        ps.push({
          x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - speed * 0.4, g: grav,
          life: life * (0.6 + Math.random() * 0.4), max: life,
          color: colors[(Math.random() * colors.length) | 0], size: 1 + Math.random() * 1.6,
        });
      }
      if (ps.length > 400) ps.splice(0, ps.length - 400);
    }
    function shake(mag: number) {
      shakeRef.current = { until: performance.now() + 160, mag };
    }

    function update() {
      const g = stateRef.current;
      if (!g || screenRef.current !== "playing") return;
      const hole = g.roundHoles[g.holeIndex];
      const maxCam = Math.max(0, hole.worldH - H);
      const basketCamX = camXFor(hole, hole.basket.x);
      const teeCamX = camXFor(hole, hole.tee.x);

      // Intro fly-over: hold on the basket, then pan down to the tee, then play.
      if (g.phase === "intro") {
        const HOLD = 26;
        const PAN = 60;
        g.introT += 1;
        if (g.introT <= HOLD) {
          g.camY = 0;
          g.camX = basketCamX;
        } else {
          const p = Math.min(1, (g.introT - HOLD) / PAN);
          const sp = p * p * (3 - 2 * p); // smoothstep
          g.camY = sp * maxCam;
          g.camX = basketCamX + sp * (teeCamX - basketCamX);
        }
        if (g.introT >= HOLD + PAN) {
          g.camY = maxCam;
          g.camX = teeCamX;
          g.phase = "aim";
        }
        camRef.current = { x: g.camX, y: g.camY };
        return;
      }

      // Camera follows the disc, keeping it ~66% down so the fairway ahead shows
      // — and centered horizontally on wide holes, panning as the hole curves.
      const camTarget = Math.min(maxCam, Math.max(0, g.disc.y - H * 0.66));
      g.camY += (camTarget - g.camY) * 0.16;
      g.camX += (camXFor(hole, g.disc.x) - g.camX) * 0.16;
      camRef.current = { x: g.camX, y: g.camY };

      if (g.phase === "aim") {
        // Aim + power are driven by the pointer drag handlers; nothing to do here.
      } else if (g.phase === "fly") {
        const d = g.disc;
        const disc = activeDiscs(g.advanced)[g.discIndex];
        const f: Flight = { x: d.x, y: d.y, vx: d.vx, vy: d.vy, h: g.h, vh: g.vh, fadeTurn: g.fadeTurn };
        const res = stepFlight(f, disc, g.fadeSign, g.path, hole, g.release);
        d.x = f.x;
        d.y = f.y;
        d.vx = f.vx;
        d.vy = f.vy;
        g.h = f.h;
        g.vh = f.vh;
        g.fadeTurn = f.fadeTurn;
        g.trailBuf.push({ x: d.x, y: d.y }); // record the real flight curve
        if (res.treeHit) {
          audioRef.current?.sfx("tree");
          spawnBurst(d.x, d.y, ["#2f6b22", "#3f8a2e", "#56a541"], 10, 1.6);
          shake(2);
        }

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
          rattleRef.current = performance.now();
          const under = g.throws < hole.par;
          spawnBurst(hole.basket.x, hole.basket.y, ["#36D7B7", "#f5d24a", "#ffffff", "#4B3DFF"], under ? 70 : 36, under ? 2.6 : 1.9, 0.05, 40);
        } else if (res.status === "ob" || res.status === "oob") {
          // OUT OF BOUNDS: +1 and play from where it crossed the line.
          const inWater = hole.water.some((w) => inRect(w, f.x, f.y));
          audioRef.current?.sfx(inWater ? "water" : "tree");
          vibrate(60);
          spawnBurst(
            f.x, f.y,
            inWater ? ["#5b8fc4", "#9cc4e8", "#3a6ea5"] : ["#cfd8dc", "#9aa4b2"],
            inWater ? 16 : 8, inWater ? 1.8 : 1.2,
          );
          shake(inWater ? 3 : 2);
          // Replay from the hole's drop zone if it has one; otherwise from the
          // last point the disc was actually in bounds (walk the recorded
          // flight path back), falling back to this throw's start.
          const lie = hole.dropZone ?? lastInBoundsLie(g.trailBuf, hole, g.rest);
          g.throws += 1;
          g.flash = { text: hole.dropZone ? "OB — DROP ZONE" : "OUT OF BOUNDS", at: performance.now() };
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
          if (distPin < CATCH_R * 2.4) {
            audioRef.current?.sfx("chains");
            rattleRef.current = performance.now();
          }
          if ((hole.hazard ?? []).some((hz) => inRect(hz, d.x, d.y)) || (hole.roughIsHazard && offRibbons(hole, d.x, d.y))) {
            g.throws += 1;
            g.flash = { text: "HAZARD", at: performance.now() };
            spawnBurst(d.x, d.y, ["#d9c089", "#c4a96b"], 12, 1.4);
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
          // Online: record my hole, broadcast my full card (self-healing against
          // dropped messages), and show the live leaderboard.
          if (g.online && onlineRef.current) {
            const o = onlineRef.current;
            const scores = g.scores.slice(0, g.holeIndex + 1).map((x) => x ?? 0);
            const total = scores.reduce((a, b) => a + b, 0);
            const thru = g.holeIndex + 1;
            onlineScoresRef.current = { ...onlineScoresRef.current, [o.myId]: { name: o.myName, scores, total, thru } };
            setOnlineScores(onlineScoresRef.current);
            void o.channel.send({ type: "broadcast", event: "score", payload: { id: o.myId, name: o.myName, scores, total, thru } });
            setOnlineView({ hole: g.holeIndex, par: g.roundHoles[g.holeIndex].par, myId: o.myId });
            setScreen("holeComplete");
            syncHud();
            return;
          }
          if (tournamentPlayRef.current && tournamentRef.current && !tournamentRef.current.finished) {
            const myRoundSoFar = g.scores.reduce((a, b) => a + (b ?? 0), 0);
            setTournLiveView(tournLive(tournamentRef.current, myRoundSoFar, g.holeIndex + 1));
          } else {
            setTournLiveView(null);
          }
          if (g.party) {
            g.party.scores[g.party.current][g.holeIndex] = g.throws;
            if (g.party.current < g.party.names.length - 1) {
              // Pass the device: same hole resets (fly-over intro re-runs) for
              // the next player.
              g.party.current += 1;
              Object.assign(g, freshHole(g.roundHoles[g.holeIndex]));
              g.discIndex = discIndexRef.current;
              syncHud();
              return;
            }
            setPartyView({
              names: g.party.names,
              holeScores: g.party.scores.map((sc) => sc[g.holeIndex]),
              totals: g.party.scores.map((sc) => sc.reduce<number>((a, b) => a + (b ?? 0), 0)),
            });
          }
          setScreen("holeComplete");
          syncHud();
        }
      }

      // Step the particles (cheap Euler + drag).
      const ps = particlesRef.current;
      for (let i = ps.length - 1; i >= 0; i--) {
        const pt = ps[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vy += pt.g;
        pt.vx *= 0.95;
        pt.vy *= 0.95;
        pt.life -= 1;
        if (pt.life <= 0) ps.splice(i, 1);
      }
    }

    function draw() {
      const g = stateRef.current;
      if (!g) return;
      const hole = g.roundHoles[g.holeIndex];
      const cam = g.camY; // world→screen: screenY = worldY - cam
      const camX = g.camX; // world→screen: screenX = worldX - camX

      // Everything outside the fairway is rough — out of bounds normally, or
      // olive-tinted hazard ground on rope-lined holes (+1, play where it lies).
      ctx.fillStyle = hole.roughIsHazard ? "#535426" : "#2f5a26";
      ctx.fillRect(0, 0, W, H);
      // Darker rough mowing bands for a little texture.
      const startY = Math.floor(cam / 16) * 16;
      ctx.fillStyle = hole.roughIsHazard ? "#4b4c22" : "#2b5323";
      for (let y = startY; y < cam + H; y += 32) ctx.fillRect(0, y - cam, W, 16);

      // All world-space drawing below is shifted by the horizontal camera (and
      // jolted briefly by impacts); screen-fixed UI restores afterwards.
      const shk = shakeRef.current;
      const shakeLeft = Math.max(0, shk.until - performance.now()) / 160;
      const jx = shakeLeft > 0 ? (Math.random() - 0.5) * shk.mag * 2 * shakeLeft : 0;
      const jy = shakeLeft > 0 ? (Math.random() - 0.5) * shk.mag * 2 * shakeLeft : 0;
      ctx.save();
      ctx.translate(-camX + jx, jy);

      // The curved fairway, drawn as a thick ribbon along the centerline. The
      // outer (white) stroke is the OB line; the green stroke inside is the
      // fairway — so doglegs and bends give curved OB edges that follow the
      // hole. Extra ribbons (e.g. hole 13's island tee pad) draw the same way.
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      for (const fw of [hole.fairway, ...(hole.fairways ?? [])]) {
        ctx.beginPath();
        ctx.moveTo(fw[0].x, fw[0].y - cam);
        for (let i = 1; i < fw.length; i++) ctx.lineTo(fw[i].x, fw[i].y - cam);
        // Ribbon edge: white OB line, or hazard-yellow rope on hazard-rough holes.
        ctx.strokeStyle = hole.roughIsHazard ? "#e0c25a" : "#eef1e6";
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
      }
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

      // Grass OB islands — turf patches inside the fairway, roped off with a
      // dashed white OB line. Land in one and it plays exactly like water OB.
      for (const ob of hole.obZones ?? []) {
        const ocx = ob.x + ob.w / 2;
        const ocy = ob.y - cam + ob.h / 2;
        ctx.fillStyle = "#3c6b2e";
        ctx.beginPath();
        ctx.ellipse(ocx, ocy, ob.w / 2, ob.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#eef1e6";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.ellipse(ocx, ocy, ob.w / 2, ob.h / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
        ctx.fillStyle = "rgba(238,241,230,0.9)";
        ctx.font = "bold 6px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("OB", ocx, ocy + 0.5);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }

      // Hazards (sand) — sandy ovals ringed in caddie-book orange with an HZ
      // tag, so they read as "+1 stroke" at a glance (unlike plain fairway).
      for (const hz of hole.hazard ?? []) {
        const hx = hz.x + hz.w / 2;
        const hy = hz.y - cam + hz.h / 2;
        ctx.fillStyle = "#d9c089";
        ctx.beginPath();
        ctx.ellipse(hx, hy, hz.w / 2, hz.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#c4a96b";
        ctx.beginPath();
        ctx.ellipse(hx, hy, hz.w / 2 - 2, hz.h / 2 - 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#e0923b";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.ellipse(hx, hy, hz.w / 2, hz.h / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
        ctx.fillStyle = "#a8651f";
        ctx.font = "bold 6px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("HZ", hx, hy + 0.5);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }

      // Wooden walls (mando fences): plank rails with posts; consecutive
      // segments at the same height get an orange arch framing the gap.
      const walls = hole.walls ?? [];
      for (const wl of walls) {
        const wy = wl.y - cam;
        ctx.fillStyle = "#8a6a3a";
        ctx.fillRect(wl.x, wy - 3, wl.w, 6);
        ctx.fillStyle = "#5f451f";
        for (let px = wl.x; px <= wl.x + wl.w - 2; px += 12) ctx.fillRect(px, wy - 4, 2, 8);
        ctx.fillRect(wl.x + wl.w - 2, wy - 4, 2, 8);
      }
      for (let i = 0; i + 1 < walls.length; i++) {
        if (walls[i].y !== walls[i + 1].y) continue;
        const wy = walls[i].y - cam;
        const gx1 = walls[i].x + walls[i].w;
        const gx2 = walls[i + 1].x;
        ctx.strokeStyle = "#e0923b";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gx1, wy + 4);
        ctx.lineTo(gx1, wy - 10);
        ctx.lineTo(gx2, wy - 10);
        ctx.lineTo(gx2, wy + 4);
        ctx.stroke();
        ctx.lineWidth = 1;
      }

      // Drop zone — where OB throws play from on holes that have one.
      if (hole.dropZone) {
        const dzy = hole.dropZone.y - cam;
        ctx.fillStyle = "#e0923b";
        ctx.beginPath();
        ctx.arc(hole.dropZone.x, dzy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#0f1117";
        ctx.font = "bold 5px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("DZ", hole.dropZone.x, dzy + 0.5);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }

      // Tee pad
      ctx.fillStyle = "#caa46a";
      ctx.fillRect(hole.tee.x - 7, hole.tee.y - cam - 5, 14, 10);
      ctx.fillStyle = "#8a6a3a";
      ctx.fillRect(hole.tee.x - 7, hole.tee.y - cam - 5, 14, 2);

      // Best-round ghost: your record round's flight lines on this hole.
      if (ghostRef.current && showGhostRef.current && !g.practice) {
        const hp = ghostRef.current[g.holeIndex];
        if (Array.isArray(hp)) {
          ctx.strokeStyle = "rgba(245,210,74,0.35)";
          ctx.setLineDash([2, 4]);
          ctx.lineWidth = 1;
          for (const path of hp) {
            if (!Array.isArray(path) || path.length < 2) continue;
            ctx.beginPath();
            ctx.moveTo(path[0].x, path[0].y - cam);
            for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y - cam);
            ctx.stroke();
            const end = path[path.length - 1];
            ctx.fillStyle = "rgba(245,210,74,0.55)";
            ctx.fillRect(end.x - 1.5, end.y - cam - 1.5, 3, 3);
          }
          ctx.setLineDash([]);
        }
      }

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

      const rattleAge = performance.now() - rattleRef.current;
      const rattle = rattleAge < 420 ? Math.sin(rattleAge * 0.09) * (1 - rattleAge / 420) * 1.6 : 0;
      drawBasket(ctx, hole.basket.x + rattle, hole.basket.y - cam);
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
            const range = fullPowerRange(aimDisc, elevAt(hole, g.disc.y), (path === "straight" ? STRAIGHT_SPEED_MUL : 1) * releaseSpeedMul(releaseRef.current));
            const bsy = hole.basket.y - cam;
            const bsx = hole.basket.x - camX;
            const basketVisible = bsy >= 0 && bsy <= H && bsx >= 0 && bsx <= W;
            const ang = basketVisible ? g.angle : -Math.PI / 2; // straight up if off-screen
            const rx = g.disc.x + Math.cos(ang) * range;
            const ry = g.disc.y + Math.sin(ang) * range - cam;
            const half = 2 * CATCH_R; // full length = 2 basket diameters
            const px = -Math.sin(ang); // unit perpendicular to the throw line
            const py = Math.cos(ang);
            if (ry > 14 && ry < H - 2 && rx - camX > 2 && rx - camX < W - 2) {
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
          // dr.cx/cy are screen coords; dsx is world-x (drawn under translate).
          let pullX = dr.cx + camX - dsx;
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
          const pathMul = (path === "straight" ? STRAIGHT_SPEED_MUL : 1) * releaseSpeedMul(releaseRef.current);
          const speed = aimDisc.power * (1.2 + power * 3.35) * pathMul;
          const f: Flight = {
            x: g.disc.x, y: g.disc.y,
            vx: Math.cos(g.angle) * speed, vy: Math.sin(g.angle) * speed,
            h: 0, vh: power * aimDisc.arc, fadeTurn: 0,
          };
          const pts: { x: number; y: number }[] = [{ x: f.x, y: f.y }];
          for (let i = 0; i < 360; i++) {
            const r = stepFlight(f, aimDisc, sign, path, hole, releaseRef.current);
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

      // Particles (leaves, splashes, sand, confetti) fade out as they die.
      for (const pt of particlesRef.current) {
        ctx.globalAlpha = Math.max(0, pt.life / pt.max);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - pt.size / 2, pt.y - cam - pt.size / 2, pt.size, pt.size);
      }
      ctx.globalAlpha = 1;

      ctx.restore(); // end of world-space (horizontally panned) drawing

      // ── Mini-map (screen-fixed) — sits on the side AWAY from the hole's
      // upper half, so a dogleg toward one corner is never hidden under it. ──
      {
        const ww = hole.worldW ?? W;
        const s = Math.min(60 / ww, (H - 90) / hole.worldH);
        const mw = ww * s;
        const mh = hole.worldH * s;
        const upper = hole.fairway.filter((p) => p.y < hole.worldH * 0.5);
        const leanX = [...upper, hole.basket].reduce((sum, p) => sum + p.x, 0) / (upper.length + 1);
        const ox = leanX > ww / 2 ? 7 : W - 7 - mw;
        const oy = 25; // below the HUD pill
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(ox - 3, oy - 3, mw + 6, mh + 6);
        ctx.fillStyle = "#2f5a26"; // rough
        ctx.fillRect(ox, oy, mw, mh);
        // curved fairway ribbon(s)
        ctx.strokeStyle = "#4d9a39";
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.lineWidth = Math.max(3, hole.fwWidth * s);
        for (const fw of [hole.fairway, ...(hole.fairways ?? [])]) {
          ctx.beginPath();
          ctx.moveTo(ox + fw[0].x * s, oy + fw[0].y * s);
          for (let i = 1; i < fw.length; i++) ctx.lineTo(ox + fw[i].x * s, oy + fw[i].y * s);
          ctx.stroke();
        }
        ctx.lineJoin = "miter";
        ctx.lineCap = "butt";
        ctx.lineWidth = 1;
        ctx.fillStyle = "#3a6ea5";
        for (const wt of hole.water) ctx.fillRect(ox + wt.x * s, oy + wt.y * s, wt.w * s, wt.h * s);
        for (const hz of hole.hazard ?? []) {
          ctx.fillStyle = "#d9c089";
          ctx.fillRect(ox + hz.x * s, oy + hz.y * s, hz.w * s, hz.h * s);
          ctx.strokeStyle = "#e0923b";
          ctx.strokeRect(ox + hz.x * s + 0.5, oy + hz.y * s + 0.5, Math.max(2, hz.w * s) - 1, Math.max(2, hz.h * s) - 1);
        }
        if (hole.dropZone) {
          ctx.fillStyle = "#e0923b";
          ctx.beginPath();
          ctx.arc(ox + hole.dropZone.x * s, oy + hole.dropZone.y * s, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = "#8a6a3a";
        for (const wl of hole.walls ?? []) {
          ctx.beginPath();
          ctx.moveTo(ox + wl.x * s, oy + wl.y * s);
          ctx.lineTo(ox + (wl.x + wl.w) * s, oy + wl.y * s);
          ctx.stroke();
        }
        ctx.strokeStyle = "rgba(238,241,230,0.9)";
        for (const ob of hole.obZones ?? []) {
          ctx.strokeRect(ox + ob.x * s + 0.5, oy + ob.y * s + 0.5, Math.max(2, ob.w * s) - 1, Math.max(2, ob.h * s) - 1);
        }
        ctx.fillStyle = "#234d1f";
        for (const tr of hole.trees) {
          ctx.beginPath();
          ctx.arc(ox + tr.x * s, oy + tr.y * s, Math.max(1.4, tr.r * s), 0, Math.PI * 2);
          ctx.fill();
        }
        // viewport window (tracks both camera axes)
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = 1;
        ctx.strokeRect(ox + camX * s + 0.5, oy + cam * s + 0.5, Math.min(mw, W * s) - 1, Math.min(mh, H * s) - 1);
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
        const elev = elevAt(hole, g.disc.y); // slope where the disc lies (zoned holes change mid-hole)
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
      if (g.party) hudItem("UP", g.party.names[g.party.current].slice(0, 8), "#f5d24a");
      hudItem("HOLE", g.party ? `${g.holeIndex + 1}/${g.roundHoles.length}` : g.practice ? `P${g.practiceHole}` : `${g.holeIndex + 1}/${g.roundHoles.length}`, "#ffffff");
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
        ctx.fillText(
          g.party
            ? `${g.party.names[g.party.current].toUpperCase().slice(0, 12)}  ·  HOLE ${g.holeIndex + 1}  ·  PAR ${hole.par}`
            : `HOLE ${g.practiceHole ?? g.holeIndex + 1}  ·  PAR ${hole.par}${g.practice ? "  ·  PRACTICE" : ""}`,
          W / 2, H / 2 - 6,
        );
        if (hole.elevZones?.length) {
          // Changing slope, e.g. "▼ DOWNHILL EARLY — UPHILL LATE ▲"
          const first = hole.elevZones[0].elev;
          const last = hole.elevZones[hole.elevZones.length - 1].elev;
          ctx.fillStyle = "#e89a4a";
          ctx.font = "bold 11px monospace";
          const word = (e: number) => (e > 0 ? "UPHILL" : e < 0 ? "DOWNHILL" : "FLAT");
          ctx.fillText(`${first < 0 ? "▼" : "▲"} ${word(first)} EARLY — ${word(last)} LATE ${last < 0 ? "▼" : "▲"}`, W / 2, H / 2 + 8);
        } else if (elev !== 0) {
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
    const pullX = px - (g.disc.x - camRef.current.x); // disc's on-screen X
    const pullY = py - (g.disc.y - camRef.current.y); // disc's on-screen Y
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
  // The personal best for the course just played (null for the daily).
  const finalBest = finalMode === "course" ? bestScore : finalMode === "winthrop" ? winthropBest : null;
  const overStr = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);

  return (
    <div className="h-[100dvh] w-full bg-[#0f1117] flex flex-col select-none overflow-hidden">
      {/* Play area — canvas fills the available space, keeping its aspect ratio */}
      <div ref={playAreaRef} className="relative flex-1 min-h-0 flex items-center justify-center px-2 pt-2 pb-1">
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
              {(bestScore != null || winthropBest != null || roundsPlayed > 0) && (
                <div className="flex gap-2 mt-3">
                  {bestScore != null && (
                    <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5">
                      <p className="text-[#36D7B7] font-bold text-sm leading-none">{bestScore}</p>
                      <p className="text-gray-500 text-[9px] mt-0.5 uppercase tracking-wide">GE Best ({overStr(bestScore - TOTAL_PAR)})</p>
                    </div>
                  )}
                  {winthropBest != null && (
                    <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5">
                      <p className="text-[#f5d24a] font-bold text-sm leading-none">{winthropBest}</p>
                      <p className="text-gray-500 text-[9px] mt-0.5 uppercase tracking-wide">WL Best ({overStr(winthropBest - WINTHROP_PAR)})</p>
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

              {/* A pending challenge from a shared link */}
              {challenge && (
                <button
                  type="button"
                  onClick={() => { startGame(challenge.mode, challenge.seed); challengePlayRef.current = true; }}
                  className="w-full rounded-xl border border-[#e0923b]/60 bg-[#e0923b]/15 hover:bg-[#e0923b]/25 text-white font-bold py-3 px-3 mt-4 transition text-sm"
                >
                  ⚔ {challenge.name} challenged you: {challenge.score} on{" "}
                  {challenge.mode === "course" ? "Glendoveer" : challenge.mode === "winthrop" ? "Winthrop Lake" : "a Daily course"} — play it!
                </button>
              )}

              {/* Primary actions */}
              <div className={`w-full flex flex-col gap-2 ${challenge ? "mt-2" : "mt-5"}`}>
                <button type="button" onClick={() => startGame("daily")}
                  className="w-full rounded-xl bg-[#36D7B7] hover:bg-[#2bc4a6] active:scale-[0.99] text-[#0f1117] font-bold py-3 transition flex items-center justify-center gap-2">
                  <span>🔥 Daily Challenge</span>
                </button>
                <button type="button" onClick={() => startGame("course")}
                  className="w-full rounded-xl bg-[#4B3DFF] hover:bg-[#3a2ee0] active:scale-[0.99] text-white font-bold py-3 transition">
                  ▶ Play Glendoveer · 18
                </button>
                <button type="button" onClick={() => startGame("winthrop")}
                  className="w-full rounded-xl bg-[#f5d24a] hover:bg-[#e3c138] active:scale-[0.99] text-[#0f1117] font-bold py-3 transition">
                  🏆 Play Winthrop Lake · 18
                </button>
                <button type="button" onClick={() => setTournamentOpen(true)}
                  className="w-full rounded-xl border border-[#f5d24a]/40 bg-[#f5d24a]/10 hover:bg-[#f5d24a]/20 active:scale-[0.99] text-white font-bold py-3 transition">
                  🏟 Tournament{tournament && !tournament.finished ? ` · R${tournament.myTotals.length + 1}` : ""}
                </button>
                <button type="button" onClick={() => setChallengeOpen(true)}
                  className="w-full rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 active:scale-[0.99] text-white font-bold py-3 transition">
                  👥 Challenge Friends
                </button>
                <button type="button" onClick={() => setTutorialOpen(true)}
                  className="w-full rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 active:scale-[0.99] text-white font-bold py-3 transition">
                  📖 How to Play
                </button>
              </div>
              <p className="text-gray-500 text-[10px] mt-1.5">Daily = a fresh 9-hole course, same for everyone</p>

              {/* Secondary actions */}
              <div className="w-full flex gap-2 mt-4">
                <button type="button" onClick={() => setBoardsOpen(true)}
                  className="flex-1 rounded-lg border border-white/10 hover:border-white/25 text-gray-300 hover:text-white text-xs font-semibold py-2 transition">
                  🏆 Leaders
                </button>
                <button type="button" onClick={() => setPracticeOpen(true)}
                  className="flex-1 rounded-lg border border-white/10 hover:border-white/25 text-gray-300 hover:text-white text-xs font-semibold py-2 transition">
                  🎯 Practice
                </button>
                <button type="button" onClick={() => setStatsOpen(true)}
                  className="flex-1 rounded-lg border border-white/10 hover:border-white/25 text-gray-300 hover:text-white text-xs font-semibold py-2 transition">
                  📊 Stats
                </button>
              </div>
              <div className="w-full flex gap-2 mt-2">
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

        {screen === "holeComplete" && onlineView && (() => {
          const sl = scoreLabel(hud.throws, onlineView.par);
          const rows = Object.entries(onlineScores)
            .map(([id, s]) => ({ id, ...s }))
            .sort((a, b) => a.total - b.total);
          const lead = rows.length ? rows[0].total : 0;
          return (
            <Overlay>
              <p className="text-[#36D7B7] font-bold text-lg">Hole {onlineView.hole + 1} · {sl.emoji && `${sl.emoji} `}{sl.name}</p>
              <div className="w-full max-w-[260px] space-y-1">
                {rows.map((r) => (
                  <div key={r.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1.5 text-sm">
                    <span className="text-white font-semibold truncate">{r.total === lead ? "👑 " : ""}{r.id === onlineView.myId ? `${r.name} (you)` : r.name}</span>
                    <span className="text-gray-300 font-mono text-xs">thru {r.thru} · {r.total}</span>
                  </div>
                ))}
              </div>
              <button type="button" onClick={nextHole} className={btn}>
                {hud.hole >= hud.holes ? "See results ▶" : "Next hole ▶"}
              </button>
            </Overlay>
          );
        })()}
        {screen === "holeComplete" && partyView && (
          <Overlay>
            <p className="text-[#36D7B7] font-bold text-xl">Hole {hud.hole} complete</p>
            <div className="w-full max-w-[240px] space-y-1">
              {partyView.names.map((n, i) => {
                const sc = partyView.holeScores[i];
                const lead = Math.min(...partyView.totals);
                return (
                  <div key={n} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1.5 text-sm">
                    <span className="text-white font-semibold truncate">{partyView.totals[i] === lead ? "👑 " : ""}{n}</span>
                    <span className="text-gray-300 font-mono">{sc != null ? scoreLabel(sc, hud.par).name : "–"} · {partyView.totals[i]}</span>
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={nextHole} className={btn}>
              {hud.hole >= hud.holes ? "See results ▶" : "Next hole ▶"}
            </button>
          </Overlay>
        )}
        {screen === "holeComplete" && !partyView && !onlineView && (() => {
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
              {tournLiveView && (
                <p className="text-[#f5d24a] text-xs font-bold">
                  🏟 {ordinal(tournLiveView.rank)} of {tournLiveView.field} ·{" "}
                  {tournLiveView.behind === 0 ? "leading!" : `${tournLiveView.behind} back`} · thru {hud.hole}
                </p>
              )}
              <button type="button" onClick={nextHole} className={btn}>
                {hud.hole >= hud.holes ? "See results ▶" : "Next hole ▶"}
              </button>
            </Overlay>
          );
        })()}

        {tutorialOpen && <TutorialPanel onClose={() => setTutorialOpen(false)} />}

        {statsOpen && <StatsPanel onClose={() => setStatsOpen(false)} />}

        {boardsOpen && <LeaderboardPanel onClose={() => setBoardsOpen(false)} />}

        {partyOpen && (
          <PartyPanel
            onClose={() => setPartyOpen(false)}
            onStart={(m, names) => { setPartyOpen(false); startParty(m, names); }}
          />
        )}

        {/* Challenge Friends menu (online lobbies disabled if Supabase isn't set up) */}
        {challengeOpen && !lobby && (
          <ChallengePanel
            online={!!supa}
            onClose={() => setChallengeOpen(false)}
            onPassPlay={() => { setChallengeOpen(false); setPartyOpen(true); }}
            onCreate={(m, name) => createLobby(m, name)}
            onJoin={(code, name) => joinLobby(code, name)}
          />
        )}

        {/* Lobby (shown on the title screen until the host starts) */}
        {screen === "title" && lobby && (
          <LobbyPanel
            lobby={lobby}
            players={lobbyPlayers}
            onStart={startOnlineHost}
            onLeave={leaveLobby}
          />
        )}

        {tournamentOpen && (
          <TournamentPanel
            tournament={tournament}
            onClose={() => setTournamentOpen(false)}
            onNew={() => saveTournament({ seed: (Math.random() * 1e9) | 0, round: 0, myTotals: [], fieldTotals: [], madeCut: true, finished: false })}
            onAbandon={() => saveTournament(null)}
            onPlayRound={(t) => {
              setTournamentOpen(false);
              startGame("winthrop", (t.seed + t.myTotals.length * 1013904223) | 0);
              tournamentPlayRef.current = true;
            }}
          />
        )}

        {practiceOpen && (
          <PracticePanel
            onClose={() => setPracticeOpen(false)}
            onPick={(m, i) => { setPracticeOpen(false); startPractice(m, i); }}
          />
        )}

        {settingsOpen && (
          <SettingsPanel
            onClose={() => setSettingsOpen(false)}
            throwStyle={throwStyle} setThrowStyle={setThrowStyle}
            flightPath={flightPath} setFlightPath={setFlightPath}
            musicVolume={musicVolume} setMusicVolume={setMusicVolume}
            leftHanded={leftHanded} setLeftHanded={setLeftHanded}
            showGhost={showGhost} setShowGhost={setShowGhost}
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

      {/* Control panel: disc rack + flight/stance/mute — only while in a round */}
      {(screen === "playing" || screen === "holeComplete") && (
        <div className="shrink-0 w-full border-t border-white/10 bg-[#13161b]">
          <div className="mx-auto w-full max-w-[480px] px-3 pt-2 pb-[max(calc(env(safe-area-inset-bottom)+0.4rem),1.25rem)] flex flex-col gap-2">
            {/* Disc selector */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">Disc</span>
              <span className="text-[10px] text-gray-400 font-medium truncate ml-2">
                {advanced ? `${ADV_DISCS[discIndex]?.brand ?? ""} ${ADV_DISCS[discIndex]?.name ?? ""}` : "Drag back from the disc to throw"}
              </span>
            </div>
            {advanced ? (
              <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1" style={{ scrollbarWidth: "thin" }}>
                {ADV_DISCS.map((d, i) => {
                  const lock = DISC_UNLOCKS[d.key];
                  const locked = !!lock && !unlocked.includes(lock.ach);
                  return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => selectDisc(i)}
                    disabled={locked}
                    className={`shrink-0 w-[90px] rounded-lg border px-2 py-1.5 text-left transition ${
                      locked ? "border-white/5 bg-white/[0.02] opacity-50"
                        : i === discIndex ? "border-[#36D7B7]/70 bg-[#36D7B7]/10" : "border-white/10 hover:border-white/25 bg-white/[0.02]"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: locked ? "#444" : d.color }} />
                      <span className={`text-xs font-bold truncate ${i === discIndex && !locked ? "text-white" : "text-gray-300"}`}>
                        {locked ? "🔒 " : ""}{d.name}
                      </span>
                    </span>
                    <span className="block text-[9px] text-gray-500 mt-0.5">{locked ? lock!.label : d.brand}</span>
                    <span className="block text-[9px] font-mono text-gray-400 leading-tight">{locked ? "to unlock" : d.blurb.split("· ")[1]}</span>
                  </button>
                  );
                })}
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

            {/* Release angle */}
            <div className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500">Angle</span>
              <div className="flex-1 flex gap-1 bg-[#0f1117] border border-white/10 rounded-lg p-1">
                {([
                  { key: "hyzer", label: "Hyzer ⤸" },
                  { key: "flat", label: "Flat" },
                  { key: "anny", label: "⤹ Anny" },
                ] as const).map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setRelease(r.key)}
                    aria-pressed={release === r.key}
                    className={`flex-1 rounded-md px-2 py-1.5 text-xs font-bold transition ${
                      release === r.key ? "bg-[#e0923b] text-[#0f1117] shadow" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

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
              <h2 className="text-white font-black text-2xl">
                {finalParty || finalOnline ? "Match complete!" : finalPracticeHole != null ? "Practice complete!" : finalIsDaily ? "Daily Challenge complete!" : "Round complete!"}
              </h2>
              <p className="text-gray-400 text-xs">
                {finalPracticeHole != null
                  ? `${finalMode === "winthrop" ? "Winthrop Lake" : "Glendoveer East"} · hole ${finalPracticeHole} · par ${finalParTotal}`
                  : finalIsDaily
                    ? `Today's course · ${finalPars.length} holes · par ${finalParTotal}`
                    : `${finalMode === "winthrop" ? "Winthrop Lake" : "Glendoveer East"} · 18 holes · par ${finalParTotal}`}
              </p>
              <p className="text-[#36D7B7] font-bold text-lg mt-1">
                {finalTotal} throws · {finalOver === 0 ? "Even par" : overStr(finalOver)}
                {isNewBest && <span className="ml-2 text-[#f5d24a]">★ New best!</span>}
              </p>
              {finalBest != null && !isNewBest && (
                <p className="text-gray-400 text-xs mt-0.5">Your best: {finalBest} ({overStr(finalBest - finalParTotal)})</p>
              )}
              {finalChallenge && (
                <p className={`text-sm font-bold mt-1.5 ${finalTotal < finalChallenge.score ? "text-[#36D7B7]" : finalTotal === finalChallenge.score ? "text-gray-300" : "text-[#e08a3b]"}`}>
                  ⚔ vs {finalChallenge.name} ({finalChallenge.score}):{" "}
                  {finalTotal < finalChallenge.score ? "You win!" : finalTotal === finalChallenge.score ? "Tied!" : "They got you."}
                </p>
              )}
            </div>

            {/* Pass-and-play standings */}
            {finalParty && (
              <div className="bg-[#1a1d23] border border-white/5 rounded-2xl overflow-hidden">
                {finalParty.names
                  .map((n, i) => ({ n, t: finalParty.totals[i] }))
                  .sort((a, b) => a.t - b.t)
                  .map((row, i) => (
                    <div key={row.n} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${i ? "border-t border-white/5" : ""}`}>
                      <span className="text-gray-400 font-mono w-5">{i + 1}</span>
                      <span className="text-white font-semibold flex-1 truncate">{i === 0 ? "🏆 " : ""}{row.n}</span>
                      <span className="text-gray-400 font-mono">{overStr(row.t - finalParTotal)}</span>
                      <span className="text-white font-mono font-bold w-8 text-right">{row.t}</span>
                    </div>
                  ))}
              </div>
            )}

            {/* Online Friendly Challenge standings (live — updates as friends finish) */}
            {finalOnline && (
              <div className="bg-[#1a1d23] border border-white/5 rounded-2xl overflow-hidden">
                {Object.entries(onlineScores)
                  .map(([id, s]) => ({ id, ...s }))
                  .sort((a, b) => a.total - b.total)
                  .map((row, i) => (
                    <div key={row.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${i ? "border-t border-white/5" : ""}`}>
                      <span className="text-gray-400 font-mono w-5">{i + 1}</span>
                      <span className="text-white font-semibold flex-1 truncate">{i === 0 ? "🏆 " : ""}{row.name}</span>
                      <span className="text-gray-500 font-mono text-xs">thru {row.thru}</span>
                      <span className="text-gray-400 font-mono">{overStr(row.total - finalParTotal)}</span>
                      <span className="text-white font-mono font-bold w-8 text-right">{row.total}</span>
                    </div>
                  ))}
              </div>
            )}

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

            {/* Save + per-course leaderboard (the daily board resets each day);
                practice rounds skip all of it. */}
            {finalPracticeHole == null && !finalParty && !finalOnline && (<>
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
              <p className="text-white font-bold text-sm px-4 py-2.5 border-b border-white/5">
                🏆 {finalIsDaily ? "Today's leaderboard" : `${finalMode === "winthrop" ? "Winthrop Lake" : "Glendoveer East"} leaderboard`}
              </p>
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
                      <span className="text-gray-400 font-mono">{overStr(row.strokes - finalParTotal)}</span>
                      <span className="text-white font-mono font-bold w-8 text-right">{row.strokes}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            </>)}

            <div className="flex flex-wrap justify-center gap-2">
              {finalPracticeHole != null ? (
                <button type="button" onClick={() => startPractice(finalMode, finalPracticeHole - 1)} className={btn}>↻ Retry hole</button>
              ) : finalTournament ? (
                <button type="button" onClick={() => { audioRef.current?.stopMusic(); setScreen("title"); setTournamentOpen(true); }} className={btn}>
                  🏟 Standings
                </button>
              ) : finalOnline ? (
                <button type="button" onClick={() => { audioRef.current?.stopMusic(); setScreen("title"); }} className={btn}>
                  🎉 Back to lobby
                </button>
              ) : (
                <button type="button" onClick={() => startGame()} className={btn}>↻ Play again</button>
              )}
              <button type="button" onClick={shareCard} className="mt-1 bg-[#1a1d23] border border-white/15 hover:border-white/35 text-white font-bold px-6 py-3 rounded-lg transition">
                📤 Share card
              </button>
              <button
                type="button"
                onClick={() => { audioRef.current?.stopMusic(); if (finalOnline) leaveLobby(); setScreen("title"); }}
                className="mt-1 bg-[#1a1d23] border border-white/15 hover:border-white/35 text-white font-bold px-6 py-3 rounded-lg transition"
              >
                🏠 Home
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

// Challenge Friends entry point: choose hot-seat Pass & Play or an online
// Friendly Challenge, then Create a lobby or Join one with a code.
function ChallengePanel({ online, onClose, onPassPlay, onCreate, onJoin }: {
  online: boolean;
  onClose: () => void;
  onPassPlay: () => void;
  onCreate: (m: Mode, name: string) => void;
  onJoin: (code: string, name: string) => void;
}) {
  const [step, setStep] = useState<"menu" | "create" | "join">("menu");
  const [course, setCourse] = useState<Mode>("winthrop");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const seg = (active: boolean) =>
    `flex-1 rounded-md px-2 py-2 text-xs font-bold transition ${active ? "bg-[#4B3DFF] text-white" : "text-gray-400 hover:text-white"}`;
  const input = "w-full bg-[#1a1d23] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#4B3DFF]";
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm p-4 flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-3 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">👥 Challenge Friends</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        {step === "menu" && (
          <>
            <button type="button" onClick={onPassPlay}
              className="w-full text-left rounded-xl bg-[#1a1d23] border border-white/10 hover:border-white/30 px-4 py-3 transition">
              <span className="block text-white font-bold text-sm">🤝 Pass &amp; Play</span>
              <span className="block text-gray-500 text-[11px] mt-0.5">2–4 players take turns on one device.</span>
            </button>
            <button type="button" onClick={() => online && setStep("create")} disabled={!online}
              className={`w-full text-left rounded-xl border px-4 py-3 transition ${online ? "bg-[#1a1d23] border-white/10 hover:border-white/30" : "bg-white/[0.02] border-white/5 opacity-50"}`}>
              <span className="block text-white font-bold text-sm">🌐 Friendly Challenge</span>
              <span className="block text-gray-500 text-[11px] mt-0.5">
                {online ? "Play the same round online — everyone on their own phone." : "Online play needs Supabase configured."}
              </span>
            </button>
          </>
        )}

        {step === "create" && (
          <>
            <p className="text-gray-400 text-xs">Pick a course and create a lobby — share the code so friends can join.</p>
            <div className="flex gap-1 bg-[#1a1d23] border border-white/10 rounded-lg p-1">
              <button type="button" onClick={() => setCourse("course")} className={seg(course === "course")}>Glendoveer</button>
              <button type="button" onClick={() => setCourse("winthrop")} className={seg(course === "winthrop")}>Winthrop</button>
              <button type="button" onClick={() => setCourse("daily")} className={seg(course === "daily")}>Daily</button>
            </div>
            <input type="text" value={name} maxLength={12} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={input} />
            <button type="button" onClick={() => onCreate(course, name)} className={`${btn} w-full`}>Create lobby</button>
            <button type="button" onClick={() => setStep("menu")} className="w-full text-gray-500 hover:text-gray-300 text-xs py-1 transition">← Back</button>
          </>
        )}

        {step === "join" && (
          <>
            <p className="text-gray-400 text-xs">Enter the 4-character code your friend shared.</p>
            <input type="text" value={code} maxLength={4} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CODE" className={`${input} tracking-[0.3em] text-center font-mono uppercase`} />
            <input type="text" value={name} maxLength={12} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={input} />
            <button type="button" onClick={() => code.trim().length === 4 && onJoin(code, name)} disabled={code.trim().length !== 4} className={`${btn} w-full disabled:opacity-50`}>Join lobby</button>
            <button type="button" onClick={() => setStep("menu")} className="w-full text-gray-500 hover:text-gray-300 text-xs py-1 transition">← Back</button>
          </>
        )}

        {online && step === "menu" && (
          <button type="button" onClick={() => setStep("join")}
            className="w-full text-center text-[#36D7B7] hover:text-[#2bc4a6] text-sm font-semibold py-1 transition">
            Have a code? Join a lobby →
          </button>
        )}
      </div>
    </div>
  );
}

// Lobby waiting room: shows the code, live roster (Realtime presence), and a
// Start button for the host. Friends join with the code from another device.
function LobbyPanel({ lobby, players, onStart, onLeave }: {
  lobby: { code: string; isHost: boolean; mode: Mode };
  players: LobbyPlayer[];
  onStart: () => void;
  onLeave: () => void;
}) {
  const host = players.find((p) => p.host);
  const courseMode = host?.mode ?? lobby.mode;
  const courseLabel = courseMode === "course" ? "Glendoveer East" : courseMode === "winthrop" ? "Winthrop Lake" : "Daily course";
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm p-4 flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-4 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">Lobby</h2>
          <button type="button" onClick={onLeave} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="rounded-xl bg-[#1a1d23] border border-white/10 p-4 text-center">
          <p className="text-gray-500 text-[10px] uppercase tracking-[0.2em]">Join code</p>
          <p className="text-[#36D7B7] font-black text-4xl tracking-[0.25em] mt-1">{lobby.code}</p>
          <p className="text-gray-500 text-[11px] mt-2">{courseLabel}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs font-semibold mb-1.5">Players ({players.length})</p>
          <div className="space-y-1">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 text-sm">
                <span className="text-white font-semibold truncate flex-1">{p.name}</span>
                {p.host && <span className="text-[#f5d24a] text-[10px] font-bold uppercase tracking-wide">Host</span>}
              </div>
            ))}
            {players.length === 0 && <p className="text-gray-500 text-xs">Connecting…</p>}
          </div>
        </div>
        {lobby.isHost ? (
          <>
            <button type="button" onClick={onStart} className={`${btn} w-full`}>▶ Start round</button>
            {players.length < 2 && <p className="text-gray-500 text-[11px] text-center">Waiting for friends to join — you can start anytime.</p>}
          </>
        ) : (
          <p className="text-gray-400 text-sm text-center py-2">Waiting for the host to start…</p>
        )}
      </div>
    </div>
  );
}

// Pass-and-play setup: pick a course, 2-4 players, optional names.
function PartyPanel({ onClose, onStart }: { onClose: () => void; onStart: (m: Mode, names: string[]) => void }) {
  const [course, setCourse] = useState<Mode>("course");
  const [count, setCount] = useState(2);
  const [names, setNames] = useState<string[]>(["", "", "", ""]);
  const seg = (active: boolean) =>
    `flex-1 rounded-md px-2 py-2 text-xs font-bold transition ${active ? "bg-[#4B3DFF] text-white" : "text-gray-400 hover:text-white"}`;
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm p-4 flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-3 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">👥 Pass &amp; Play</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <p className="text-gray-500 text-[11px]">Take turns on each hole, one phone. Doesn&apos;t count toward records.</p>
        <div className="flex gap-1 bg-[#1a1d23] border border-white/10 rounded-lg p-1">
          <button type="button" onClick={() => setCourse("course")} className={seg(course === "course")}>Glendoveer</button>
          <button type="button" onClick={() => setCourse("winthrop")} className={seg(course === "winthrop")}>Winthrop</button>
          <button type="button" onClick={() => setCourse("daily")} className={seg(course === "daily")}>Daily</button>
        </div>
        <div className="flex gap-1 bg-[#1a1d23] border border-white/10 rounded-lg p-1">
          {[2, 3, 4].map((n) => (
            <button key={n} type="button" onClick={() => setCount(n)} className={seg(count === n)}>{n} players</button>
          ))}
        </div>
        <div className="space-y-1.5">
          {Array.from({ length: count }, (_, i) => (
            <input
              key={i}
              type="text"
              value={names[i]}
              maxLength={12}
              onChange={(e) => setNames((ns) => ns.map((n, j) => (j === i ? e.target.value : n)))}
              placeholder={`Player ${i + 1}`}
              className="w-full bg-[#1a1d23] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#4B3DFF]"
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => onStart(course, Array.from({ length: count }, (_, i) => names[i].trim() || `Player ${i + 1}`))}
          className={`${btn} w-full`}
        >
          ▶ Tee off
        </button>
      </div>
    </div>
  );
}

// College Nationals at Winthrop Lake: 3 rounds vs a seeded AI field, top half
// makes the cut after round 2, lowest 3-round total takes the title.
function TournamentPanel({ tournament, onClose, onNew, onAbandon, onPlayRound }: {
  tournament: Tournament | null;
  onClose: () => void;
  onNew: () => void;
  onAbandon: () => void;
  onPlayRound: (t: Tournament) => void;
}) {
  const t = tournament;
  const standings = t && t.myTotals.length > 0 ? tournStandings(t) : null;
  const myRank = standings ? standings.findIndex((r) => r.you) + 1 : 0;
  const champion = t?.finished && t.madeCut && myRank === 1;
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm p-4 flex items-start justify-center rounded-lg">
      <div className="w-full max-w-sm space-y-3 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">🏟 Tournament</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <p className="text-gray-400 text-xs -mt-2">College Nationals · Winthrop Lake · 3 rounds · cut after R2</p>

        {!t ? (
          <>
            <p className="text-gray-300 text-sm">
              Take on a 36-player field over three rounds. The top half survives the cut; the lowest total lifts the trophy.
            </p>
            <button type="button" onClick={onNew} className={`${btn} w-full`}>Start tournament</button>
          </>
        ) : (
          <>
            {champion && (
              <div className="bg-[#f5d24a]/10 border border-[#f5d24a]/40 rounded-xl p-3 text-center">
                <p className="text-[#f5d24a] font-black text-lg">🏆 NATIONAL CHAMPION!</p>
              </div>
            )}
            {t.finished && !t.madeCut && (
              <p className="text-[#e08a3b] text-sm font-semibold text-center">Missed the cut — there&apos;s always next season.</p>
            )}
            {t.finished && t.madeCut && !champion && (
              <p className="text-gray-300 text-sm text-center">Finished <span className="text-white font-bold">#{myRank}</span> of {TOURN_NAMES.length + 1}.</p>
            )}

            {standings ? (
              <div className="bg-[#1a1d23] border border-white/5 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-[11px] tabular-nums">
                  <thead className="sticky top-0 bg-[#1a1d23]">
                    <tr className="text-gray-500 border-b border-white/5">
                      <th className="text-left pl-3 py-1.5 w-8">#</th>
                      <th className="text-left">Player</th>
                      {[0, 1, 2].map((r) => <th key={r} className="text-right pr-1">R{r + 1}</th>)}
                      <th className="text-right pr-3">Tot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((row, i) => (
                      <tr key={row.name} className={`${row.you ? "bg-[#36D7B7]/10 text-[#36D7B7] font-bold" : "text-gray-300"} ${i ? "border-t border-white/5" : ""} ${row.cut ? "opacity-50" : ""}`}>
                        <td className="pl-3 py-1">{row.cut ? "—" : i + 1}</td>
                        <td className="truncate max-w-[110px]">{row.name}{row.cut ? " (cut)" : ""}</td>
                        {[0, 1, 2].map((r) => <td key={r} className="text-right pr-1 font-mono">{row.rounds[r] ?? ""}</td>)}
                        <td className="text-right pr-3 font-mono font-bold">{row.total || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-300 text-sm">Round 1 awaits — the field is warming up.</p>
            )}

            {!t.finished ? (
              <button type="button" onClick={() => onPlayRound(t)} className={`${btn} w-full`}>
                ▶ Play round {t.myTotals.length + 1}
              </button>
            ) : (
              <button type="button" onClick={onNew} className={`${btn} w-full`}>↻ New tournament</button>
            )}
            {!t.finished && (
              <button type="button" onClick={onAbandon} className="w-full text-gray-500 hover:text-gray-300 text-xs py-1 transition">
                Abandon tournament
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Career stats computed from the locally-stored round history. Older rounds
// (before per-hole scores were recorded) still count toward totals/averages.
// Browse the global (Supabase) leaderboard for any course from the title
// screen. Daily uses today's seed; Glendoveer & Winthrop are all-time.
function LeaderboardPanel({ onClose }: { onClose: () => void }) {
  type Board = { key: "course" | "winthrop" | "daily"; label: string; courseKey: string; par: number };
  const [boards] = useState<Board[]>(() => {
    const dSeed = dailySeed();
    const dPar = buildRound(dSeed, "daily").reduce((s, h) => s + h.par, 0);
    return [
      { key: "course", label: "Glendoveer", courseKey: "glendoveer", par: TOTAL_PAR },
      { key: "winthrop", label: "Winthrop", courseKey: "winthrop", par: WINTHROP_PAR },
      { key: "daily", label: "Daily", courseKey: `daily-${dSeed}`, par: dPar },
    ];
  });
  const [pick, setPick] = useState<Board>(boards[0]);
  const [rows, setRows] = useState<ArcadeScore[] | null>(null);
  const over = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
  const seg = (active: boolean) =>
    `flex-1 rounded-md px-2 py-2 text-xs font-bold transition ${active ? "bg-[#4B3DFF] text-white" : "text-gray-400 hover:text-white"}`;
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let active = true;
    setRows(null);
    getArcadeLeaderboard(pick.courseKey, 25).then((r) => { if (active) setRows(r); }).catch(() => { if (active) setRows([]); });
    return () => { active = false; };
  }, [pick]);
  /* eslint-enable react-hooks/set-state-in-effect */
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm p-4 flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-3 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">🏆 Leaderboards</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="flex gap-1 bg-[#1a1d23] border border-white/10 rounded-lg p-1">
          {boards.map((b) => (
            <button key={b.key} type="button" onClick={() => setPick(b)} className={seg(pick.key === b.key)}>{b.label}</button>
          ))}
        </div>
        <p className="text-gray-500 text-[11px]">
          {pick.key === "daily" ? "Today's course · par " : "All-time · par "}{pick.par}
        </p>
        <div className="bg-[#1a1d23] border border-white/5 rounded-2xl overflow-hidden">
          {rows === null ? (
            <p className="text-gray-400 text-sm text-center py-6">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">No scores yet — be the first!</p>
          ) : (
            <ol>
              {rows.map((row, i) => (
                <li
                  key={`${row.name}-${row.created_at}`}
                  className={`flex items-center gap-3 px-4 py-2 text-sm ${i !== 0 ? "border-t border-white/5" : ""}`}
                >
                  <span className={`font-mono w-6 text-right ${i === 0 ? "text-[#f5d24a]" : "text-gray-400"}`}>{i + 1}</span>
                  <span className="text-white flex-1 truncate">{i === 0 ? "👑 " : ""}{row.name}</span>
                  <span className="text-gray-400 font-mono">{over(row.strokes - pick.par)}</span>
                  <span className="text-white font-mono font-bold w-8 text-right">{row.strokes}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <button type="button" onClick={onClose} className={`${btn} w-full`}>Done</button>
      </div>
    </div>
  );
}

function StatsPanel({ onClose }: { onClose: () => void }) {
  const [hist] = useState<{ mode: string; total: number; date: number; scores?: number[]; pars?: number[] }[]>(() => {
    try {
      const h = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
      return Array.isArray(h) ? h : [];
    } catch { return []; }
  });
  const byMode = (m: string) => hist.filter((r) => r.mode === m);
  const avg = (rows: { total: number }[]) => (rows.length ? (rows.reduce((s, r) => s + r.total, 0) / rows.length).toFixed(1) : "–");
  const best = (rows: { total: number }[]) => (rows.length ? Math.min(...rows.map((r) => r.total)) : null);
  // Score-type distribution over every recorded hole.
  const dist = { ace: 0, eagle: 0, birdie: 0, par: 0, bogey: 0, worse: 0 };
  let holesCounted = 0;
  for (const r of hist) {
    if (!r.scores || !r.pars) continue;
    r.scores.forEach((sc, i) => {
      const pr = r.pars![i];
      if (typeof sc !== "number" || typeof pr !== "number") return;
      holesCounted++;
      if (sc === 1) dist.ace++;
      else if (sc - pr <= -2) dist.eagle++;
      else if (sc - pr === -1) dist.birdie++;
      else if (sc === pr) dist.par++;
      else if (sc - pr === 1) dist.bogey++;
      else dist.worse++;
    });
  }
  const rowsFor: { label: string; rows: { total: number }[] }[] = [
    { label: "Glendoveer East", rows: byMode("course") },
    { label: "Winthrop Lake", rows: byMode("winthrop") },
    { label: "Daily Challenge", rows: byMode("daily") },
  ];
  const distRows = [
    { label: "Aces", n: dist.ace, color: "#f5d24a" },
    { label: "Eagles", n: dist.eagle, color: "#f5d24a" },
    { label: "Birdies", n: dist.birdie, color: "#36D7B7" },
    { label: "Pars", n: dist.par, color: "#cbd5e1" },
    { label: "Bogeys", n: dist.bogey, color: "#e0923b" },
    { label: "Double+", n: dist.worse, color: "#e23b3b" },
  ];
  const maxN = Math.max(1, ...distRows.map((d) => d.n));
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm p-4 flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-4 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">Stats</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        {hist.length === 0 ? (
          <p className="text-gray-400 text-sm">No rounds yet — play one and come back!</p>
        ) : (
          <>
            <p className="text-gray-400 text-xs">{hist.length} round{hist.length === 1 ? "" : "s"} played</p>
            <div className="space-y-1.5">
              {rowsFor.map(({ label, rows }) => (
                <div key={label} className="flex items-center justify-between bg-[#1a1d23] border border-white/10 rounded-lg px-3 py-2 text-sm">
                  <span className="text-white font-semibold">{label}</span>
                  <span className="text-gray-400 font-mono text-xs">
                    {rows.length} rds{best(rows) != null ? ` · best ${best(rows)}` : ""} · avg {avg(rows)}
                  </span>
                </div>
              ))}
            </div>
            {holesCounted > 0 && (
              <div>
                <p className="text-gray-400 text-xs font-semibold mb-1.5">Scoring ({holesCounted} holes)</p>
                <div className="space-y-1">
                  {distRows.map((d) => (
                    <div key={d.label} className="flex items-center gap-2 text-xs">
                      <span className="w-14 text-gray-400">{d.label}</span>
                      <div className="flex-1 h-3 bg-white/5 rounded overflow-hidden">
                        <div className="h-full rounded" style={{ width: `${(d.n / maxN) * 100}%`, background: d.color }} />
                      </div>
                      <span className="w-8 text-right text-white font-mono">{d.n}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        <button type="button" onClick={onClose} className={`${btn} w-full`}>Done</button>
      </div>
    </div>
  );
}

// Pick any hole on either course and grind it — practice rounds don't count
// toward bests, history, achievements, or leaderboards.
function PracticePanel({ onClose, onPick }: {
  onClose: () => void;
  onPick: (m: Mode, holeIdx: number) => void;
}) {
  const [course, setCourse] = useState<Mode>("course");
  // Glendoveer per-hole bests, read once when the panel opens.
  const [holeBest] = useState<(number | null)[]>(() => {
    try {
      const hb = JSON.parse(localStorage.getItem(HOLEBEST_KEY) || "null");
      return Array.isArray(hb) ? hb : [];
    } catch { return []; }
  });
  const holes = course === "winthrop" ? WINTHROP_HOLES : HOLES;
  const seg = (active: boolean) =>
    `flex-1 rounded-md px-2 py-2 text-xs font-bold transition ${active ? "bg-[#4B3DFF] text-white" : "text-gray-400 hover:text-white"}`;
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm p-4 flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-3 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">Practice</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="flex gap-1 bg-[#1a1d23] border border-white/10 rounded-lg p-1">
          <button type="button" onClick={() => setCourse("course")} className={seg(course === "course")}>Glendoveer</button>
          <button type="button" onClick={() => setCourse("winthrop")} className={seg(course === "winthrop")}>Winthrop</button>
        </div>
        <p className="text-gray-500 text-[11px]">Pick a hole — practice doesn&apos;t count toward bests or boards.</p>
        <div className="grid grid-cols-3 gap-1.5">
          {holes.map((h, i) => {
            const best = course === "course" ? holeBest[i] : null;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onPick(course, i)}
                className="rounded-lg bg-[#1a1d23] border border-white/10 hover:border-[#36D7B7]/60 px-2 py-2 text-left transition"
              >
                <span className="block text-white font-bold text-sm leading-none">{i + 1}</span>
                <span className="block text-gray-500 text-[10px] mt-1">
                  par {h.par}{best != null ? ` · best ${best}` : ""}
                </span>
              </button>
            );
          })}
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
  showGhost: boolean;
  setShowGhost: (b: boolean) => void;
  advanced: boolean;
  setAdvanced: (b: boolean) => void;
  unlocked: string[];
}) {
  const { onClose, throwStyle, setThrowStyle, flightPath, setFlightPath, musicVolume, setMusicVolume, leftHanded, setLeftHanded, showGhost, setShowGhost, advanced, setAdvanced, unlocked } = props;
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

        <button
          type="button"
          onClick={() => setShowGhost(!showGhost)}
          className="w-full flex items-center justify-between bg-[#1a1d23] border border-white/10 rounded-lg px-3 py-2.5"
        >
          <span className="text-left">
            <span className="block text-white text-sm font-semibold">Best-round ghost</span>
            <span className="block text-gray-500 text-[11px]">Show your record round&apos;s flight lines while you play</span>
          </span>
          <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded ${showGhost ? "bg-[#36D7B7] text-[#0f1117]" : "bg-white/10 text-gray-400"}`}>
            {showGhost ? "ON" : "OFF"}
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
