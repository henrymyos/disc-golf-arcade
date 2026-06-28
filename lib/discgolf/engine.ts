// Pure disc-golf engine: constants, types, course data, physics, the disc bag,
// scoring, tournament simulation, and the audio engine. No React — extracted
// from the game component so it can be unit-tested and reused (e.g. OG images).
// Imported by components/disc-golf-game.tsx.

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
// `lenMul` scales a hole's length below its par default (e.g. 0.68 ≈ a short
// par-3 you can reach off the tee with a midrange instead of a driver). Not a
// world coordinate — it's a multiplier applied in materializeHole.
type Hole = { par: number; worldH: number; worldW?: number; lenMul?: number; tee: Vec; basket: Vec; fairway: Vec[]; fairways?: Vec[][]; fwWidth: number; trees: Tree[]; water: Water[]; hazard?: Water[]; obZones?: Water[]; dropZone?: Vec; walls?: { x: number; y: number; w: number }[]; roughIsHazard?: boolean; wind?: Vec; windMag?: number; elev?: number; elevZones?: { to: number; elev: number }[]; treeMul?: number };

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

// A max drive carries ~DRIVE world px (≈540 ft at FEET_PER_PX). Hole length is
// set per par to read realistically in feet: par 3 ≈ one big drive (~510 ft),
// par 4 ≈ 650–900 ft, par 5 ≈ 1000–1200 ft. Each template (authored tee y≈416,
// basket near the top) is stretched vertically to fit, with extra room behind
// the tee so the pull-back slider isn't cramped. (The 60 + TEE_BEHIND offsets
// are baked into materializeHole's scale, so worldH carries them too.)
const DRIVE = 330;
const TEE_BEHIND = 120;
const worldHForPar = (par: number) => (par <= 3 ? 510 : par === 4 ? 680 : 890);
// World px ↔ feet for the on-screen distance readout (pxToFeet, defined later, is
// the same factor). No hole is allowed to play shorter than MIN_HOLE_FT — even a
// length-scaled early-career or short procedural hole — so materializeHole grows
// any hole whose straight tee→basket line would read shorter up to this floor.
const FEET_PER_PX = 1.8;
const MIN_HOLE_FT = 200;
const MIN_HOLE_PX = MIN_HOLE_FT / FEET_PER_PX; // ≈111px
// Length of a polyline (the fairway centerline), in px.
function pathLength(pts: Vec[]): number {
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) s += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  return s;
}
// How many trees a hole should carry — scales with its length so the wide-open
// fairways fill in and the longest par 4s/5s reach ~23–27, while short holes stay
// lighter. ~1 tree per 18px of corridor, clamped to a per-par band, thinned ~15%,
// then scaled by the venue's tree density (h.treeMul) so a "Wooded" course stays
// denser than an open "Links" one instead of every course filling to the same
// level. Fixed courses and the daily leave treeMul at 1, landing in the ~17–25 band.
function treeTarget(h: Hole): number {
  const n = Math.round(pathLength(h.fairway) / 18);
  const hi = h.par >= 5 ? 32 : h.par === 4 ? 28 : 21;
  const lo = h.par >= 5 ? 27 : h.par === 4 ? 22 : 15;
  const band = Math.max(lo, Math.min(hi, n));
  // Roughly halve the band (clamp bounds scaled to match) — the fairways were
  // reading too cluttered, so trees only line the edges of a clearly-open lane
  // rather than packing the corridor.
  return Math.max(5, Math.min(15, Math.round(band * (h.treeMul ?? 1) * 0.42)));
}
// True if a tree of radius `m` centred at (x,y) would sit in or touch a pond
// (water = OB), a grass OB island, or a sand bunker. Trees don't grow out of a
// hazard and one standing in the water/sand just reads as broken, so any fill
// tree that would land in a hazard shape is rejected. Geometry mirrors the
// landing tests: water/obZones are rectangles (inRect), bunkers are inscribed
// ellipses (inHazard) — here grown by `m` instead of shrunk by DISC_R.
function treeInHazard(h: Hole, x: number, y: number, m: number): boolean {
  for (const w of h.water) if (x > w.x - m && x < w.x + w.w + m && y > w.y - m && y < w.y + w.h + m) return true;
  for (const ob of h.obZones ?? []) if (x > ob.x - m && x < ob.x + ob.w + m && y > ob.y - m && y < ob.y + ob.h + m) return true;
  for (const hz of h.hazard ?? []) {
    const rx = hz.w / 2 + m, ry = hz.h / 2 + m;
    const nx = (x - (hz.x + hz.w / 2)) / rx, ny = (y - (hz.y + hz.h / 2)) / ry;
    if (nx * nx + ny * ny <= 1) return true;
  }
  return false;
}
// Fill a hole's open corridor with trees so the player has to PICK and shape a
// shot instead of bombing a wide-open fairway. Each hole is brought up to its
// length-scaled target, with trees scattered down the whole length on both sides —
// but always kept OUT of a winding open lane, so a navigable (if twisting) line
// always exists and the hole never becomes an impassable wall. Deterministic
// (seeded per hole, no Date/Math.random) and placed in world coords inside the
// fairway corridor, so the in-bounds invariant holds for procedural holes too.
// Existing authored trees (green rings, tree walls) are kept and counted. Runs at
// the end of materializeHole, so it covers Glendoveer, Winthrop, daily and tour.
function populateTrees(h: Hole): Tree[] {
  // Drop any authored tree whose trunk overlaps a hazard (test grown by the
  // tree's own radius), then keep fill trees clear of hazards too — no trunks
  // standing in water, sand, or OB anywhere.
  const out: Tree[] = h.trees.filter((t) => !treeInHazard(h, t.x, t.y, t.r));
  const target = treeTarget(h);
  if (out.length >= target) return out;
  const half = h.fwWidth / 2;
  // Trees stand in two tight lines hugging the edges of one wide, clearly-open
  // fairway lane that follows the corridor to the basket — so there's always an
  // obvious gap to throw down, never trunks scattered across the fairway. Ordered
  // stations march down the hole dropping a pair of trunks (a "gate") right at
  // the lane edges; the lane bends gently (one soft curve), so you still shape a
  // shot, but the open middle stays wide and continuous the whole way in.
  const laneHW = half * 0.5;    // open fairway half-width — a wide, obvious lane
  const amp = half * 0.2;       // a single gentle bow off the centerline
  const waves = h.par >= 5 ? 1.5 : 1; // at most a bend or two over the whole hole
  const rng = mulberry32(((Math.round(h.basket.x) * 73856093) ^ (Math.round(h.basket.y) * 19349663) ^ (h.worldH * 83492791) ^ (h.par * 0x9e3779b1)) >>> 0);
  const phase = rng();
  const steps = Math.max(4, Math.ceil(target / 2)); // ~2 trees per step (one per edge)
  for (let s = 0; s < steps && out.length < target; s++) {
    const f = 0.06 + ((s + 0.5) / steps) * 0.88; // ordered down the length → clean lines
    const base = pointOnPath(h.fairway, f);
    const ahead = pointOnPath(h.fairway, Math.min(1, f + 0.02));
    const tx = ahead.x - base.x, tyv = ahead.y - base.y;
    const L = Math.hypot(tx, tyv) || 1;
    const nx = -tyv / L, ny = tx / L; // unit perpendicular to travel
    const laneC = Math.sin((f * waves + phase) * Math.PI * 2) * amp; // lane centre at this f
    for (const side of [-1, 1] as const) {
      if (out.length >= target) break;
      const jitter = rng() * 6; // tiny outward jitter so the line looks natural, stays crisp
      let o = laneC + side * (laneHW + jitter);
      o = Math.max(-half * 0.97, Math.min(half * 0.97, o));
      if (Math.abs(o - laneC) < laneHW - 2) continue; // keep the fairway lane clear
      const x = base.x + nx * o, y = base.y + ny * o;
      if (Math.hypot(x - h.basket.x, y - h.basket.y) < 26) continue; // keep the green clear
      if (Math.hypot(x - h.tee.x, y - h.tee.y) < 44) continue;       // keep the tee pad clear
      if (out.some((t) => Math.hypot(x - t.x, y - t.y) < 13)) continue; // no stacking
      if (treeInHazard(h, x, y, 12)) continue; // never plant in water, sand, or OB
      out.push({ x, y, r: 9 + Math.round(rng() * 2) });
    }
  }
  return out;
}
// Stretch an authored template (tee y≈416, basket near the top) into a full hole
// whose length scales with par. Shared by Glendoveer and the procedural daily.
// The tee keeps its authored x — putting the tee off-center (e.g. far left)
// lets a hole dogleg across the full canvas width instead of only ±90px.
function materializeHole(t: Omit<Hole, "worldH">): Hole {
  // `lenMul` shortens a hole below its par default so its drive can be a
  // midrange/fairway shot rather than a max driver (clamped so the tee pad +
  // green still fit).
  let worldH = Math.round(worldHForPar(t.par) * Math.max(0.5, t.lenMul ?? 1));
  // Length floor: a hole's straight tee→basket line must read at least MIN_HOLE_FT.
  // Only the vertical span scales with worldH (the dogleg's x-offset is fixed), so
  // solve for the y-span the floor needs and grow worldH until the line reaches it.
  const dx0 = t.basket.x - t.tee.x;
  const span = 416 - t.basket.y; // template tee-row (416) → basket-row
  if (span > 0) {
    const needDy = Math.sqrt(Math.max(0, MIN_HOLE_PX * MIN_HOLE_PX - dx0 * dx0));
    const minWorldH = Math.ceil(60 + TEE_BEHIND + (416 - 50) * (needDy / span));
    if (minWorldH > worldH) worldH = minWorldH;
  }
  const scale = (worldH - 60 - TEE_BEHIND) / (416 - 50); // template y[50..416] → world[60..tee]
  const ty = (y: number) => 60 + (y - 50) * scale;
  const h: Hole = {
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
    // Hazards are ROUND bunkers: diameter = their width (the x-axis is already in
    // world px), centered on the box and NOT squashed by the vertical stretch — so
    // even on a short hole they stay big, catchable circles instead of the thin
    // slivers you could almost never come to rest fully inside.
    hazard: (t.hazard ?? []).map((o) => { const d = o.w; return { x: o.x, y: ty(o.y + o.h / 2) - d / 2, w: d, h: d }; }),
    obZones: t.obZones?.map((o) => ({ x: o.x, y: ty(o.y), w: o.w, h: o.h * scale })),
    dropZone: t.dropZone ? { x: t.dropZone.x, y: ty(t.dropZone.y) } : undefined,
    walls: t.walls?.map((wl) => ({ x: wl.x, y: ty(wl.y), w: wl.w })),
    roughIsHazard: t.roughIsHazard,
    elev: t.elev,
    elevZones: t.elevZones, // fractions of tee→basket, so no rescaling needed
    treeMul: t.treeMul, // venue-character tree density (≥1 woodier, <1 more open)
  };
  // Fill the corridor with trees (world coords, so the in-corridor check matches
  // play exactly) — see populateTrees.
  return { ...h, trees: populateTrees(h) };
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
  { par: 3, lenMul: 0.8, tee: TEE, basket: { x: 118, y: 104 }, fairway: [{ x: 160, y: 416 }, { x: 152, y: 300 }, { x: 138, y: 200 }, { x: 122, y: 140 }, { x: 118, y: 104 }], fwWidth: 108, trees: [{ x: 190, y: 260, r: 10 }, { x: 170, y: 180, r: 9 }, { x: 178, y: 150, r: 9 }], water: [
    // Continuous shoreline down the whole left side, running past the green
    { x: 92, y: 330, w: 26, h: 50 }, { x: 88, y: 282, w: 28, h: 50 }, { x: 82, y: 232, w: 28, h: 52 }, { x: 74, y: 180, w: 30, h: 54 }, { x: 64, y: 134, w: 30, h: 48 }, { x: 56, y: 88, w: 32, h: 48 },
  ], dropZone: { x: 160, y: 142 } },
  // 4 — par 3, 284ft. Open, but a wooden fence crosses the fairway short of
  // the green with a square arch in the middle — thread it or bounce off.
  { par: 3, lenMul: 0.68, tee: TEE, basket: { x: 160, y: 100 }, fairway: [{ x: 160, y: 416 }, { x: 160, y: 300 }, { x: 160, y: 180 }, { x: 160, y: 100 }], dropZone: { x: 120, y: 182 }, elev: -1, fwWidth: 120, trees: [], walls: [{ x: 100, y: 150, w: 46 }, { x: 174, y: 150, w: 46 }], water: [] },
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
  { par: 3, lenMul: 0.68, tee: TEE, basket: { x: 160, y: 108 }, fairway: [{ x: 160, y: 416 }, { x: 160, y: 300 }, { x: 160, y: 200 }, { x: 160, y: 108 }], fwWidth: 96, trees: [{ x: 114, y: 320, r: 10 }, { x: 206, y: 320, r: 10 }, { x: 114, y: 250, r: 10 }, { x: 206, y: 250, r: 10 }, { x: 114, y: 190, r: 10 }, { x: 206, y: 190, r: 10 }, { x: 116, y: 140, r: 9 }, { x: 204, y: 140, r: 9 }, { x: 148, y: 280, r: 8 }, { x: 174, y: 220, r: 8 }], water: [] },
  // 12 — par 3, 321ft. Tree-lined lane drifting right along the path, with
  // thick wood at the tee and around the green.
  { par: 3, lenMul: 0.8, tee: TEE, basket: { x: 175, y: 108 }, fairway: [{ x: 160, y: 416 }, { x: 165, y: 300 }, { x: 172, y: 200 }, { x: 175, y: 108 }], fwWidth: 108, trees: [{ x: 130, y: 370, r: 9 }, { x: 195, y: 360, r: 9 }, { x: 125, y: 310, r: 9 }, { x: 210, y: 270, r: 9 }, { x: 130, y: 220, r: 9 }, { x: 215, y: 180, r: 9 }, { x: 140, y: 150, r: 9 }, { x: 206, y: 142, r: 9 }, { x: 140, y: 124, r: 9 }, { x: 212, y: 118, r: 9 }, { x: 172, y: 76, r: 9 }], water: [] },
  // 13 — par 3, 391ft. Straight with staggered tree clusters to weave through;
  // like 10, the rough outside the rope plays as HAZARD instead of OB.
  { par: 3, tee: TEE, basket: { x: 160, y: 100 }, roughIsHazard: true, fairway: [{ x: 160, y: 416 }, { x: 160, y: 300 }, { x: 160, y: 200 }, { x: 160, y: 100 }], elev: -1, fwWidth: 118, trees: [{ x: 150, y: 260, r: 10 }, { x: 172, y: 250, r: 9 }, { x: 185, y: 170, r: 10 }, { x: 140, y: 160, r: 9 }, { x: 128, y: 118, r: 9 }, { x: 196, y: 112, r: 9 }], water: [] },
  // 14 — par 3, 409ft. Drifts right between the gravel lot and the fence line;
  // wooded right off the tee.
  { par: 3, tee: TEE, basket: { x: 185, y: 98 }, fairway: [{ x: 160, y: 416 }, { x: 168, y: 310 }, { x: 178, y: 210 }, { x: 185, y: 98 }], elev: 1, fwWidth: 112, trees: [{ x: 125, y: 370, r: 9 }, { x: 195, y: 362, r: 9 }, { x: 140, y: 330, r: 9 }, { x: 160, y: 250, r: 10 }, { x: 195, y: 180, r: 9 }, { x: 145, y: 160, r: 9 }, { x: 152, y: 114, r: 9 }, { x: 218, y: 90, r: 9 }], water: [] },
  // 15 — par 3, 283ft. Wooded with a rock-gate pinch mid-flight, then a
  // clearing around the green; mind the fallen log right of the pin.
  { par: 3, lenMul: 0.68, tee: TEE, basket: { x: 170, y: 104 }, fairway: [{ x: 160, y: 416 }, { x: 162, y: 300 }, { x: 168, y: 200 }, { x: 170, y: 104 }], elev: -1, fwWidth: 100, trees: [{ x: 118, y: 320, r: 10 }, { x: 208, y: 310, r: 10 }, { x: 128, y: 232, r: 9 }, { x: 196, y: 228, r: 9 }, { x: 120, y: 170, r: 9 }, { x: 215, y: 160, r: 9 }, { x: 206, y: 122, r: 8 }], water: [] },
  // 16 — par 3, 249ft. Short pitch to a beach green by the lake — water long,
  // sand short. Don't be greedy.
  { par: 3, lenMul: 0.68, tee: TEE, basket: { x: 130, y: 150 }, fairway: [{ x: 160, y: 416 }, { x: 150, y: 310 }, { x: 138, y: 220 }, { x: 130, y: 150 }], dropZone: { x: 178, y: 158 }, elev: -1, fwWidth: 112, trees: [{ x: 190, y: 240, r: 9 }], water: [{ x: 70, y: 90, w: 80, h: 40 }], hazard: [{ x: 92, y: 176, w: 28, h: 16 }, { x: 150, y: 182, w: 26, h: 16 }] },
  // 17 — par 4, 647ft. A narrow shore strip with the lake left the whole way,
  // hooking left at the top behind the trees.
  { par: 4, tee: TEE, basket: { x: 114, y: 100 }, fairway: [{ x: 160, y: 416 }, { x: 148, y: 320 }, { x: 140, y: 240 }, { x: 142, y: 170 }, { x: 128, y: 120 }, { x: 114, y: 100 }], elev: 1, fwWidth: 104, trees: [{ x: 180, y: 280, r: 9 }, { x: 172, y: 200, r: 9 }, { x: 158, y: 140, r: 10 }], water: [{ x: 62, y: 300, w: 30, h: 30 }, { x: 58, y: 200, w: 32, h: 32 }, { x: 56, y: 130, w: 30, h: 24 }] },
  // 18 — par 5, 841ft. The closer: grass OB islands dot the fairway (roped-off
  // turf, not sand), and the hole curves harder RIGHT at the end to the green.
  { par: 5, tee: { x: 200, y: 416 }, basket: { x: 205, y: 84 }, fairway: [{ x: 200, y: 416 }, { x: 175, y: 340 }, { x: 155, y: 260 }, { x: 150, y: 190 }, { x: 175, y: 130 }, { x: 205, y: 84 }], elev: -1, fwWidth: 118, trees: [{ x: 210, y: 300, r: 9 }, { x: 120, y: 240, r: 9 }, { x: 195, y: 170, r: 9 }, { x: 120, y: 150, r: 9 }, { x: 170, y: 96, r: 9 }, { x: 240, y: 100, r: 9 }, { x: 206, y: 44, r: 9 }], water: [], obZones: [{ x: 180, y: 250, w: 34, h: 16 }, { x: 128, y: 148, w: 30, h: 14 }, { x: 190, y: 118, w: 28, h: 12 }] },
];
const WINTHROP_HOLES: Hole[] = WINTHROP_TEMPLATES.map(materializeHole);
const WINTHROP_PAR = WINTHROP_HOLES.reduce((s, h) => s + h.par, 0);

// The 18 holes of a playable course, by (mode, seed). Glendoveer + Winthrop are
// fixed; a tour venue's seed builds its layout. (Daily/ranked aren't fixed
// courses, so they fall back to Glendoveer.)
function courseHoles(mode: Mode, seed?: number): Hole[] {
  if (mode === "winthrop") return WINTHROP_HOLES;
  if (mode === "tour") return generateTourCourse(seed ?? 0);
  return HOLES; // "course" = Glendoveer East
}
// Intrinsic course difficulty — how hard it plays, from the obstacles, fairway
// tightness, wind, and elevation averaged over the holes. Higher = nastier.
function courseDifficulty(holes: Hole[]): number {
  if (!holes.length) return 0;
  let s = 0;
  for (const h of holes) {
    s += (h.trees?.length ?? 0) * 0.32;
    s += (h.water?.length ?? 0) * 1.0;
    s += (h.hazard?.length ?? 0) * 0.7;
    s += (h.obZones?.length ?? 0) * 0.9;
    s += Math.max(0, 120 - h.fwWidth) / 12; // tighter corridor than ~120px
    s += Math.max(0, h.elev ?? 0) * 0.4; // uphill
    s += (h.windMag ?? 0) * 26;
    if (h.roughIsHazard) s += 0.8;
  }
  return s / holes.length;
}
// Difficulty as a 1–5 star rating (5 = very difficult). Thresholds calibrated to
// the spread of the play-courses (~4.3 easiest to ~7.0 hardest) now that trees
// only line a clear lane and are scaled by venue character — open "Links" venues
// read 1★ while dense "Wooded"/technical ones hit 5★, instead of all piling up.
function difficultyStars(diff: number): 1 | 2 | 3 | 4 | 5 {
  if (diff >= 6.5) return 5;
  if (diff >= 6.0) return 4;
  if (diff >= 5.5) return 3;
  if (diff >= 5.0) return 2;
  return 1;
}
// Convenience: a course's raw difficulty / star difficulty from (mode, seed).
function courseDifficultyOf(mode: Mode, seed?: number): number {
  return courseDifficulty(courseHoles(mode, seed));
}
function courseStarDifficulty(mode: Mode, seed?: number): 1 | 2 | 3 | 4 | 5 {
  return difficultyStars(courseDifficultyOf(mode, seed));
}
// Winthrop's personal best lives in its own key (WBEST_KEY, from @/lib/progress).
// Leaderboards are per course; each daily seed gets its own board.
function leaderboardCourse(mode: Mode, seed: number): string {
  return mode === "course" ? "glendoveer" : mode === "winthrop" ? "winthrop" : mode === "ranked" ? `ranked-${seed}` : mode === "tour" ? `tour-${seed}` : `daily-${seed}`;
}

// ── Tournaments: a roster of named events, each 2–3 rounds on one or two of the
// play-courses, against a seeded AI field. 3-round events cut to the top half
// after round 2. (The roster itself, TOURNAMENTS, is built after TOUR_COURSES.)
const TOURN_KEY = "discgolf.tournament.v1";
const TOURN_NAMES = [
  "A. Hammes", "C. Dickerson", "L. Castro", "J. Mwangi", "T. Nakamura", "R. Pulido",
  "S. Ostrander", "M. Beil", "D. Kowalski", "B. Tran", "K. Ferraro", "E. Stokes",
  "G. Lindqvist", "P. Okafor", "N. Marsh", "V. Duarte", "H. Sloan", "W. Pickett",
  "F. Aaltonen", "O. Reyes", "C. Burchfield", "J. Whitlock", "A. Drummond", "Z. Calloway",
  "M. Sorensen", "T. Vega", "R. Easterling", "D. Croft", "S. Bhatt", "L. Mercer",
  "K. Howell", "E. Trask", "B. Quinones", "J. Felder", "Y. Petrov",
];
const TOURN_FIELD = TOURN_NAMES.length + 1; // 36 (the field + you)
// A round plays one play-course: Glendoveer {mode:"course"}, Winthrop
// {mode:"winthrop"}, or a pro-tour venue {mode:"tour", seed}.
type TournRound = { mode: Mode; seed?: number };
type TournDef = { id: string; name: string; venues: string; rounds: TournRound[]; cut: boolean; seed: number };
type Tournament = {
  id: string; // which TournDef
  seed: number; // AI field seed (from the def)
  round: number; // next round to play (0-based); rounds played = myTotals.length
  myTotals: number[];
  fieldTotals: number[][]; // [round][playerIdx]
  madeCut: boolean;
  finished: boolean;
};
function tournDef(id: string): TournDef | undefined {
  return TOURNAMENTS.find((d) => d.id === id);
}
// A round's bare hole layout (no wind) — used for par + the static difficulty rating.
function tournRoundHoles(round: TournRound): Hole[] {
  return courseHoles(round.mode, round.seed);
}
// The seed a tournament round is actually PLAYED from: tour venues use their fixed
// venue seed; Glendoveer/Winthrop derive a per-round seed so each round's wind +
// pins differ. Matches the seed the player's round is built with (see startGame).
function tournRoundSeed(tournSeed: number, round: number, rd: TournRound): number {
  return rd.seed ?? ((tournSeed + round * 1013904223) | 0);
}
// The wind-/elevation-bearing holes a tournament round is played on — the SAME
// ones YOU face that round — so the field is scored against the real conditions
// instead of a calm, flat stand-in. (tournRoundHoles stays the bare layout.)
function tournRoundPlayHoles(tournSeed: number, round: number, rd: TournRound): Hole[] {
  return buildRound(tournRoundSeed(tournSeed, round, rd), rd.mode);
}
// A tournament's difficulty = the average difficulty of the courses it visits.
function tournDifficulty(def: TournDef): number {
  return def.rounds.reduce((s, r) => s + courseDifficulty(tournRoundHoles(r)), 0) / def.rounds.length;
}
function tournStarDifficulty(def: TournDef): 1 | 2 | 3 | 4 | 5 {
  return difficultyStars(tournDifficulty(def));
}
function tournRoundPar(round: TournRound): number {
  return tournRoundHoles(round).reduce((s, h) => s + h.par, 0);
}
// 3-round events cut to the top half after R2; 2-round events have no cut.
function tournHasCut(def: TournDef): boolean {
  return def.cut && def.rounds.length >= 3;
}
// Per-player skill: divided by 2.5 below, ~ -10..+1.5 strokes vs par per round.
function tournSkills(seed: number): number[] {
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  return TOURN_NAMES.map(() => rng() * 29 - 25);
}
// Signed per-hole conditions, in strokes, for the field's score: WIND projected
// onto the tee→basket axis (tailwind eases, headwind hardens, crosswind a touch
// harder) plus SIGNED elevation (downhill eases, uphill hardens). This is what
// lets the bots feel wind + incline/decline OUTSIDE career too — exactly the way
// the player's disc does on those same holes. (Mirrors career's holeDifficulty.)
function holeConditions(h: Hole): number {
  let wind = 0;
  if (h.wind) {
    const ax = h.basket.x - h.tee.x, ay = h.basket.y - h.tee.y;
    const len = Math.hypot(ax, ay) || 1;
    const along = (h.wind.x * ax + h.wind.y * ay) / len; // >0 = tailwind (helps)
    const cross = Math.abs(h.wind.x * ay - h.wind.y * ax) / len; // sideways magnitude
    wind = (-along + cross * 0.5) / 0.018;
  }
  const elev = h.elevZones?.length ? h.elevZones.reduce((s, z) => s + z.elev, 0) / h.elevZones.length : (h.elev ?? 0);
  return wind * 0.6 + (elev / 2) * 0.5; // tailwind/downhill −, headwind/uphill +
}
// Hole-by-hole field scores for a round on `holes`, so live standings exist
// mid-round. Skill is fixed across rounds (same player all weekend). When `holes`
// carry wind/elevation (the played layout), each hole's conditions shift the
// field's score on that hole, so windy/uphill holes cost the bots and downwind/
// downhill holes reward them — just like they do for you.
function tournFieldHoles(seed: number, round: number, holes: Hole[]): number[][] {
  const skills = tournSkills(seed);
  const rng = mulberry32((seed * 31 + round * 7919) >>> 0);
  // Couple the field's scoring to how hard the course actually is, so the star
  // rating means something: on a tough venue the field shoots closer to par (a
  // higher winning total), on an easy one it goes deep. Centered on a mid course
  // (~3.5) so difficulty shifts the field a few strokes/round either way.
  const diffAdj = (courseDifficulty(holes) - 3.5) * 0.1;
  return skills.map((sk) => {
    const perHole = sk / 2.5 / 18 + diffAdj;
    return holes.map((h) => {
      let d = Math.round(perHole + holeConditions(h) + (rng() * 2 - 1) * 0.85);
      if (rng() < 0.04) d -= 1; // the odd bomb
      if (rng() < 0.05) d += 1; // and the odd blow-up
      return Math.max(1, h.par + d);
    });
  });
}
function tournFieldRound(seed: number, round: number, holes: Hole[]): number[] {
  return tournFieldHoles(seed, round, holes).map((hs) => hs.reduce((a, b) => a + b, 0));
}
// Median two-round cut line (Infinity until two rounds exist).
function tournCutLine(t: Tournament): number {
  if (t.myTotals.length < 2 || t.fieldTotals.length < 2) return Infinity;
  const sums = [t.myTotals[0] + t.myTotals[1], ...t.fieldTotals[0].map((_, i) => t.fieldTotals[0][i] + t.fieldTotals[1][i])];
  return [...sums].sort((a, b) => a - b)[Math.floor(sums.length / 2) - 1];
}
// Full live leaderboard during a round — everyone scored through the same number
// of holes (cut players dropped in the final round), sorted, with rank, to-par,
// and which row is you. Par-thru spans completed rounds + this round's holes.
type TournLiveRow = { rank: number; name: string; total: number; toPar: number; you: boolean };
function tournLiveStandings(t: Tournament, def: TournDef, myRoundSoFar: number, holesPlayed: number): TournLiveRow[] {
  const roundIdx = t.myTotals.length;
  const holes = tournRoundPlayHoles(t.seed, roundIdx, def.rounds[roundIdx]); // the wind/elev holes you actually play
  const fieldHoles = tournFieldHoles(t.seed, roundIdx, holes);
  let active = TOURN_NAMES.map((_, i) => i);
  if (tournHasCut(def) && roundIdx === 2 && t.fieldTotals.length >= 2) {
    const line = tournCutLine(t);
    active = active.filter((i) => t.fieldTotals[0][i] + t.fieldTotals[1][i] <= line);
  }
  const parBefore = def.rounds.slice(0, roundIdx).reduce((s, r) => s + tournRoundPar(r), 0);
  const parThru = parBefore + holes.slice(0, holesPlayed).reduce((s, h) => s + h.par, 0);
  const rows = [{ name: "You", total: t.myTotals.reduce((a, b) => a + b, 0) + myRoundSoFar, you: true }];
  for (const i of active) {
    let prev = 0;
    for (let r = 0; r < roundIdx; r++) prev += t.fieldTotals[r][i];
    rows.push({ name: TOURN_NAMES[i], total: prev + fieldHoles[i].slice(0, holesPlayed).reduce((a, b) => a + b, 0), you: false });
  }
  rows.sort((a, b) => a.total - b.total);
  return rows.map((r, idx) => ({ rank: idx + 1, name: r.name, total: r.total, toPar: r.total - parThru, you: r.you }));
}
type TournRow = { name: string; you: boolean; rounds: (number | null)[]; total: number; cut: boolean };
// Final standings, with the post-R2 cut applied for 3-round events.
function tournStandings(t: Tournament, def: TournDef): TournRow[] {
  const fieldRounds = t.fieldTotals.length;
  const hasCut = tournHasCut(def);
  const cutLine = hasCut ? tournCutLine(t) : Infinity;
  const rows: TournRow[] = [];
  const myCut = hasCut && t.myTotals.length >= 2 && t.myTotals[0] + t.myTotals[1] > cutLine;
  rows.push({ name: "You", you: true, rounds: t.myTotals.slice(), total: t.myTotals.reduce((a, b) => a + b, 0), cut: myCut });
  TOURN_NAMES.forEach((name, i) => {
    const sum2 = fieldRounds >= 2 ? t.fieldTotals[0][i] + t.fieldTotals[1][i] : 0;
    const cut = hasCut && fieldRounds >= 2 && sum2 > cutLine;
    const rounds: (number | null)[] = [];
    for (let r = 0; r < fieldRounds; r++) rounds.push(r === 2 && cut ? null : t.fieldTotals[r][i]);
    rows.push({ name, you: false, rounds, total: rounds.reduce<number>((a, b) => a + (b ?? 0), 0), cut });
  });
  rows.sort((a, b) => (a.cut === b.cut ? a.total - b.total : a.cut ? 1 : -1));
  return rows;
}
// Your 1-based finishing place (out of TOURN_FIELD).
function tournPlace(t: Tournament, def: TournDef): number {
  return tournStandings(t, def).findIndex((r) => r.you) + 1;
}

// Fixed per-hole elevation (course identity, not random): + uphill / − downhill,
// −2..+2. Matches the real Glendoveer East terrain hole by hole (e.g. 2/5/6/11
// drop hard, 7 climbs hard, the closing stretch is flat). Affects how far a
// throw carries; shown on the minimap as ▲/▼.
// (Hole 9 is zoned in its template instead: downhill first half, uphill second.)
const HOLE_ELEV = [0, -2, 0, 0, -2, -2, 2, -1, 0, 0, -2, -1, 1, -1, 0, 0, 0, 0];

// "tour" = a procedurally-generated 18-hole pro course (built from a seed; named
// venues live in the Career schedule). Lets the pro tour visit many courses.
// "ranked" = a weekly procedurally-generated 18-hole course shared by everyone
// that week (the async global ranked ladder); built like a tour course.
// "daily" = the Daily Challenge (9 REAL holes mixed from the app's courses).
// "academy" = the procedurally-generated short 9-hole course the early Career
// (youth/high-school) events play — kept separate so the Daily can use real holes
// without changing the gentle, beginner-friendly Career layouts.
type Mode = "daily" | "academy" | "course" | "winthrop" | "tour" | "ranked";

// Achievements — evaluated from a finished round's per-hole scores. Each pays a
// one-time coin bounty (`coins`) the first time it's unlocked, scaled to how
// hard it is to pull off.
type Achievement = { id: string; name: string; emoji: string; desc: string; coins: number };
const ACHIEVEMENTS: Achievement[] = [
  // Single-hole feats
  { id: "birdie", name: "First Birdie", emoji: "🐦", desc: "Score a birdie", coins: 25 },
  { id: "eagle", name: "Eagle Eye", emoji: "🦅", desc: "Score an eagle or better", coins: 100 },
  { id: "albatross", name: "Albatross", emoji: "💫", desc: "Score 3-under on a single hole", coins: 400 },
  { id: "ace", name: "Ace!", emoji: "🎯", desc: "Hole out in a single throw", coins: 300 },
  // In-round streaks & tallies
  { id: "hotstart", name: "Hot Start", emoji: "☀️", desc: "Open a round with three straight birdies", coins: 200 },
  { id: "birdiestreak", name: "On Fire", emoji: "⚡", desc: "Birdie three holes in a row", coins: 150 },
  { id: "fivebirdies", name: "Birdie Barrage", emoji: "🐤", desc: "Make 5 birdies in one round", coins: 150 },
  { id: "bogeyfree9", name: "Bogey-Free Nine", emoji: "✨", desc: "Play a nine with no bogeys", coins: 100 },
  { id: "bogeyfree18", name: "Clean Card", emoji: "🧊", desc: "Play a full 18 with no bogeys", coins: 250 },
  // Round totals
  { id: "evenpar", name: "Par the Course", emoji: "🟢", desc: "Finish a round at par or better", coins: 50 },
  { id: "underpar", name: "Under Par", emoji: "🏆", desc: "Finish a round under par", coins: 75 },
  { id: "lowround", name: "Going Low", emoji: "🌟", desc: "Finish a round 5-under or better", coins: 200 },
  { id: "subten", name: "Double Digits", emoji: "💎", desc: "Finish a round 10-under or better", coins: 400 },
  // Modes & milestones
  { id: "daily", name: "Daily Grinder", emoji: "🔥", desc: "Complete a Daily Challenge", coins: 40 },
  { id: "tourstop", name: "Tour Pro", emoji: "⛳", desc: "Finish a pro-tour course", coins: 60 },
  { id: "ranked", name: "Ranked Up", emoji: "🏅", desc: "Play a ranked round", coins: 60 },
  { id: "regular", name: "Regular", emoji: "📅", desc: "Finish 5 rounds", coins: 50 },
  { id: "veteran", name: "Veteran", emoji: "🎖", desc: "Finish 25 rounds", coins: 150 },
  { id: "centurion", name: "Centurion", emoji: "💯", desc: "Finish 100 rounds", coins: 600 },
  { id: "natty", name: "National Champion", emoji: "🏟", desc: "Win the Winthrop Lake tournament", coins: 500 },
];
// Total coin bounty for a set of freshly-unlocked achievement ids.
function achievementReward(ids: string[]): number {
  return ids.reduce((sum, id) => sum + (ACHIEVEMENTS.find((a) => a.id === id)?.coins ?? 0), 0);
}
// Which achievement ids this round earns (a superset is fine — newly-unlocked is
// the diff against what's already saved).
function earnedAchievements(scores: number[], pars: number[], mode: Mode, roundsPlayed: number): string[] {
  const out: string[] = [];
  const total = scores.reduce((s, n) => s + (n ?? 0), 0);
  const parTotal = pars.reduce((s, n) => s + n, 0);
  // Per-hole score relative to par (a missing hole sits well over par so it
  // never counts as a birdie/clean hole).
  const rel = scores.map((s, i) => (s != null ? s - pars[i] : 99));
  if (scores.some((s) => s === 1)) out.push("ace");
  if (rel.some((d) => d <= -3)) out.push("albatross");
  if (rel.some((d) => d <= -2)) out.push("eagle");
  if (rel.some((d) => d === -1)) out.push("birdie");
  // Birdie-or-better tallies and streaks.
  if (rel.filter((d) => d <= -1).length >= 5) out.push("fivebirdies");
  let run = 0;
  for (const d of rel) {
    run = d <= -1 ? run + 1 : 0;
    if (run >= 3) { out.push("birdiestreak"); break; }
  }
  if (rel.length >= 3 && rel[0] <= -1 && rel[1] <= -1 && rel[2] <= -1) out.push("hotstart");
  const nineClean = (from: number, to: number) => {
    const slice = scores.slice(from, to);
    return slice.length === 9 && slice.every((s, i) => s != null && s - pars[from + i] <= 0);
  };
  if (nineClean(0, 9) || nineClean(9, 18)) out.push("bogeyfree9");
  if (scores.length >= 18 && rel.slice(0, 18).every((d) => d <= 0)) out.push("bogeyfree18");
  if (total <= parTotal) out.push("evenpar");
  if (total < parTotal) out.push("underpar");
  if (total <= parTotal - 5) out.push("lowround");
  if (total <= parTotal - 10) out.push("subten");
  if (mode === "daily") out.push("daily");
  if (mode === "tour") out.push("tourstop");
  if (mode === "ranked") out.push("ranked");
  if (roundsPlayed >= 5) out.push("regular");
  if (roundsPlayed >= 25) out.push("veteran");
  if (roundsPlayed >= 100) out.push("centurion");
  return out;
}

// The exact name for a hole score relative to par (a 1-throw hole is always an
// "Ace"). `tone` drives the color shown on the hole-complete screen. Index 1 is
// the plain "Bogey" (no prefix); 2..7 add the Double/Triple/… prefix.
const BOGEY_PREFIX = ["", "", "Double ", "Triple ", "Quadruple ", "Quintuple ", "Sextuple ", "Septuple "];
function scoreLabel(throws: number, par: number): { name: string; emoji: string; tone: "great" | "good" | "even" | "bad" } {
  // A valid score is at least one stroke; guard non-positive/garbage input so it
  // can never produce a nonsense sub-ace label (e.g. scoreLabel(0) → "Albatross").
  if (!(throws >= 1)) throws = 1;
  if (throws === 1) return { name: "Ace!", emoji: "🎯", tone: "great" };
  const d = throws - par;
  if (d <= -4) return { name: "Condor", emoji: "🦅", tone: "great" };
  if (d === -3) return { name: "Albatross", emoji: "🦅", tone: "great" };
  if (d === -2) return { name: "Eagle", emoji: "🦅", tone: "great" };
  if (d === -1) return { name: "Birdie", emoji: "🐦", tone: "good" };
  if (d === 0) return { name: "Par", emoji: "", tone: "even" };
  // d >= 1: name it "[prefix ]Bogey" for 1..7, then fall back to "+N".
  if (d >= 1 && d < BOGEY_PREFIX.length) return { name: `${BOGEY_PREFIX[d]}Bogey`, emoji: "", tone: "bad" };
  return { name: `+${d}`, emoji: "", tone: "bad" };
}

// Star rating for a course best (0–3): 1★ for even par, 2★ for −9, 3★ for −18.
// `best` is the total strokes; null/over par earns no stars.
function courseStars(best: number | null | undefined, par: number): 0 | 1 | 2 | 3 {
  if (best == null) return 0;
  const toPar = best - par;
  if (toPar <= -18) return 3;
  if (toPar <= -9) return 2;
  if (toPar <= 0) return 1;
  return 0;
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

// Disc physics — power scales throw speed, `fade` is how many radians an
// overstable flight curves per frame (backhand left, forehand right);
// `turn`/`sFade` are the climb-turn / descent-fade for a straight flight;
// friction is glide (higher = floats/rolls farther). Curving is capped per
// throw (MAX_FADE_TURN) so a disc can never loop or fade backward.
type Disc = { key: string; name: string; brand?: string; power: number; arc: number; fade: number; turn: number; sFade: number; friction: number; color: string; blurb: string; flight?: FlightPath };
// Hidden tier base stats (putter / mid / driver). Not a playable bag of their
// own — every real disc in ADV_DISCS borrows one of these tiers' physics.
// `arc` is the vertical launch per unit power: the putter flies flat and low
// (lands near the ground, easy to catch); the driver climbs to clear hazards.
const TIER_BASE: Disc[] = [
  { key: "putter", name: "Putter", power: 0.82, arc: 1.2, fade: 0.004, turn: 0.004, sFade: 0.006, friction: 0.975, color: "#36D7B7", blurb: "Flat, controlled" },
  { key: "mid", name: "Mid", power: 1.0, arc: 2.2, fade: 0.008, turn: 0.0, sFade: 0.002, friction: 0.984, color: "#f5d24a", blurb: "Balanced" },
  { key: "driver", name: "Driver", power: 1.34, arc: 2.9, fade: 0.014, turn: 0.011, sFade: 0.015, friction: 0.990, color: "#e23b3b", blurb: "Far, S-flight" },
];

// The disc bag — real discs, each borrowing a tier's stats (putter / mid /
// fairway / driver) plus a baked-in flight shape: "overstable" bends steadily
// one way, "straight" flies the farther S-line. The fairway tier sits halfway
// between mid and driver for distance.
const FAIRWAY_BASE: Disc = { key: "fairway", name: "Fairway", power: 1.17, arc: 2.55, fade: 0.011, turn: 0.0055, sFade: 0.0085, friction: 0.987, color: "", blurb: "" };
// `over` lets a disc deviate from its tier's stock physics so two discs in the
// same tier+flight aren't byte-identical. Only the curve params (turn/sFade/
// fade) are tuned per disc — power/arc/friction stay on the tier, so carry
// distance is unchanged and the discs differ only in how they bend, matching
// their printed flight numbers. (straight discs: `turn` = high-speed turnover
// while climbing, `sFade` = fade-back while descending. overstable: `fade`.)
function advDisc(key: string, name: string, brand: string, color: string, base: Disc, flight: FlightPath, nums: string, over: Partial<Disc> = {}): Disc {
  return { ...base, key, name, brand, color, flight, blurb: `${brand} · ${nums}`, ...over };
}
const ADV_DISCS: Disc[] = [
  // Putt & approach — straight Aviar vs overstable Zone/Harp (putter tier)
  advDisc("aviar", "Aviar", "Innova", "#36D7B7", TIER_BASE[0], "straight", "2 / 3 / 0 / 1"),
  advDisc("zone", "Zone", "Discraft", "#e07b3b", TIER_BASE[0], "overstable", "4 / 3 / 0 / 3", { fade: 0.005 }),
  advDisc("harp", "Harp", "Westside", "#d6b85c", TIER_BASE[0], "overstable", "3 / 1 / 0 / 4", { fade: 0.008 }), // harder, low-glide meat hook
  // Midrange — straight Buzzz vs overstable Swarm/Roc (mid tier)
  advDisc("buzzz", "Buzzz", "Discraft", "#f5d24a", TIER_BASE[1], "straight", "5 / 4 / 0 / 1"),
  advDisc("swarm", "Swarm", "Discraft", "#b85cd6", TIER_BASE[1], "overstable", "5 / 4 / 0 / 3", { fade: 0.010 }), // more overstable
  advDisc("roc", "Roc3", "Innova", "#7ad17a", TIER_BASE[1], "overstable", "5 / 4 / 0 / 3", { fade: 0.006 }), // workable, near-neutral
  // Fairway / control — straight Teebird/River vs overstable Firebird/PD (fairway tier)
  advDisc("teebird", "Teebird", "Innova", "#5fb0e8", FAIRWAY_BASE, "straight", "7 / 5 / 0 / 2", { turn: 0.004, sFade: 0.0095 }), // dead-straight, reliable fade
  advDisc("firebird", "Firebird", "Innova", "#e2453b", FAIRWAY_BASE, "overstable", "9 / 3 / 0 / 4", { fade: 0.015 }), // hard meat hook
  advDisc("river", "River", "Latitude 64", "#5fd6c8", FAIRWAY_BASE, "straight", "7 / 7 / -1 / 1", { turn: 0.010, sFade: 0.005 }), // understable glider
  advDisc("pd", "PD", "Discmania", "#3b6fe2", FAIRWAY_BASE, "overstable", "9 / 4 / 0 / 3", { fade: 0.012 }), // overstable, more glide than Firebird
  // Distance — overstable Nuke OS/Zeus vs straight Destroyer/Wraith (driver tier)
  advDisc("nukeos", "Nuke OS", "Discraft", "#2f6fe0", TIER_BASE[2], "overstable", "13 / 5 / 0 / 4", { fade: 0.018 }), // the most overstable bomber
  advDisc("destroyer", "Destroyer", "Innova", "#e23b7b", TIER_BASE[2], "straight", "12 / 5 / -1 / 3", { turn: 0.011, sFade: 0.017 }), // fast, dependable finish
  advDisc("wraith", "Wraith", "Innova", "#e2843b", TIER_BASE[2], "straight", "11 / 5 / -1 / 3", { turn: 0.015, sFade: 0.013 }), // longer, more turnover
  advDisc("zeus", "Zeus", "Discraft", "#9b3be2", TIER_BASE[2], "overstable", "12 / 5 / -1 / 3", { fade: 0.013 }), // controllable overstable
  // ── Expanded collection: more molds to buy in the shop / draft, each filling
  // a distinct flight niche the starter bag doesn't cover. (Appended on purpose
  // so existing disc indices — incl. DEFAULT_DISC_INDEX — stay put.) ──
  advDisc("pure", "Pure", "Latitude 64", "#6ee0a0", TIER_BASE[0], "straight", "3 / 3 / -1 / 1", { turn: 0.009, sFade: 0.004 }), // understable putter — turnover putts + rollers
  advDisc("mako", "Mako3", "Innova", "#c8e85f", TIER_BASE[1], "straight", "5 / 5 / 0 / 0", { turn: 0.002, sFade: 0.0012 }), // the dead-straight mid, almost no fade
  advDisc("leopard", "Leopard3", "Innova", "#e89a3b", FAIRWAY_BASE, "straight", "6 / 5 / -2 / 1", { turn: 0.013, sFade: 0.004 }), // understable fairway — easy turnover + tailwind bombs
  advDisc("thunderbird", "Thunderbird", "Innova", "#3b8ee2", FAIRWAY_BASE, "straight", "9 / 5 / 0 / 2", { turn: 0.003, sFade: 0.011 }), // stable control driver — straight with a dependable finish
  advDisc("sidewinder", "Sidewinder", "Innova", "#d65fc8", TIER_BASE[2], "straight", "9 / 5 / -3 / 1", { turn: 0.018, sFade: 0.010 }), // big-turn distance glider for huge anhyzers
  advDisc("boss", "Boss", "Innova", "#b03b3b", TIER_BASE[2], "overstable", "13 / 5 / -1 / 3", { fade: 0.016 }), // overstable power driver — holds a hard line into wind
];
// Some advanced discs are earned, not given: each maps to the achievement that
// unlocks it. Every player STARTS with just a putter + a midrange — the simple
// Putter/Mid and the advanced Aviar/Buzzz — and unlocks the rest by leveling up
// (DISC_LEVEL) or buying them with coins (DISC_PRICE). Achievements are a third,
// optional shortcut.
const DISC_UNLOCKS: Record<string, { ach: string; label: string } | undefined> = {
  zone: { ach: "birdie", label: "score a birdie" },
  swarm: { ach: "bogeyfree9", label: "bogey-free nine" },
  firebird: { ach: "daily", label: "finish a Daily" },
  nukeos: { ach: "eagle", label: "score an eagle" },
  destroyer: { ach: "underpar", label: "round under par" },
};
// Minimum player level at which a disc becomes AVAILABLE — to draft at level-up
// or buy in the shop. (Reaching the level no longer hands it over for free; you
// choose discs as you level.) Putter/mid molds and the fairway drivers come
// early; the distance drivers don't open up until ~level 10.
const DISC_LEVEL: Record<string, number> = {
  // Fairway drivers come early — the first level-up (lvl 2) hands one over.
  zone: 2, swarm: 2, teebird: 2, river: 2,
  harp: 3, roc: 3,
  pure: 4, mako: 4,
  firebird: 5, leopard: 5,
  pd: 6, thunderbird: 6,
  // Distance drivers — held back until the double digits.
  nukeos: 10, destroyer: 10, sidewinder: 10, wraith: 11, boss: 11, zeus: 12,
};
// Coin price to buy a disc in the shop. Every disc is also free to draft at its
// unlock level, so the shop is purely an "impatience tax": pay to add a disc to
// the bag a few levels early. Priced so a driver costs ~a day of coins rather
// than the old ~30k that nobody ever paid (the shop was dead money before).
const DISC_PRICE: Record<string, number> = {
  zone: 400, harp: 450, pure: 500, teebird: 600, roc: 650, swarm: 700, mako: 750,
  river: 900, leopard: 950, firebird: 1100, thunderbird: 1200, pd: 1300,
  wraith: 4500, sidewinder: 5000, nukeos: 5500, destroyer: 6500, boss: 7000, zeus: 7500,
};
// A disc is unlocked (in your collection) if it's core (Aviar/Buzzz), already
// acquired (`owned` — chosen at level-up or bought), or earned via its
// achievement once you've reached its minimum level.
function isDiscUnlocked(disc: Disc, unlocked: string[], owned: string[] = [], level = 1): boolean {
  const lock = DISC_UNLOCKS[disc.key];
  const priced = DISC_PRICE[disc.key] != null;
  const minLvl = DISC_LEVEL[disc.key];
  if (!lock && !priced && minLvl == null) return true; // core
  if (owned.includes(disc.key)) return true; // chosen at level-up, or bought
  return !!lock && unlocked.includes(lock.ach) && (minLvl == null || level >= minLvl); // earned (level-gated)
}
// Smallest player level at which a disc can be obtained (null if no gate).
function discUnlockLevel(disc: Disc): number | null {
  return DISC_LEVEL[disc.key] ?? null;
}
// Is this disc available to draft/buy at the given level yet?
function discAvailableAtLevel(disc: Disc, level: number): boolean {
  const minLvl = DISC_LEVEL[disc.key];
  return minLvl == null || level >= minLvl;
}
// The two discs offered when reaching `level` — available, not-yet-owned discs,
// lowest minimum-level first, biased so the pair differs in flight (a straight
// vs. an overstable option) for a real choice. Returns 0–2 keys.
function levelUpChoices(level: number, unlocked: string[], owned: string[] = []): string[] {
  const cands = ADV_DISCS
    .filter((d) => discAvailableAtLevel(d, level) && !isDiscUnlocked(d, unlocked, owned, level))
    .sort((a, b) => (DISC_LEVEL[a.key] ?? 0) - (DISC_LEVEL[b.key] ?? 0) || ADV_DISCS.indexOf(a) - ADV_DISCS.indexOf(b));
  if (!cands.length) return [];
  // A new player's FIRST level-up (lvl 2) always hands over a fairway driver: a
  // choice between the controllable Teebird and the easy, long River — both real
  // drivers — instead of two overstable utility discs. So you leave level 2 with
  // a proper driver in the bag.
  if (level === 2) {
    const drivers = ["teebird", "river"]
      .map((k) => discByKey(k))
      .filter((d): d is Disc => !!d && !isDiscUnlocked(d, unlocked, owned, level));
    if (drivers.length === 2) return drivers.map((d) => d.key);
    if (drivers.length === 1) {
      const other = cands.find((d) => d.key !== drivers[0].key);
      return other ? [drivers[0].key, other.key] : [drivers[0].key];
    }
    // both already owned (e.g. bought in the shop) → fall through to the generic pick
  }
  const c1 = cands[0];
  const c2 = cands.find((d) => d.key !== c1.key && d.flight !== c1.flight) ?? cands.find((d) => d.key !== c1.key);
  return c2 ? [c1.key, c2.key] : [c1.key];
}
const DEFAULT_DISC_INDEX = 3; // Buzzz — the free core midrange

// ── The bag: players carry at most BAG_MAX discs into a round; only those are
// selectable. Discs are unlocked (level / coins / achievements) into the
// COLLECTION, and the player curates which ones ride in the bag. ──
const BAG_MAX = 5;
// Order newly-unlocked discs auto-fill the bag in — a balanced straight-disc
// spread first (putter / mid / fairway / driver), then the rest.
const BAG_PRIORITY = [
  "aviar", "buzzz", "teebird", "destroyer", "wraith",
  "river", "zone", "swarm", "firebird", "pd", "roc", "harp", "nukeos", "zeus",
];
function discByKey(key: string): Disc | undefined {
  return ADV_DISCS.find((d) => d.key === key);
}
function discIndexByKey(key: string): number {
  return ADV_DISCS.findIndex((d) => d.key === key);
}
// Every disc key the player has unlocked (core, owned, leveled, or earned).
function unlockedDiscKeys(unlocked: string[], owned: string[] = [], level = 1): string[] {
  return ADV_DISCS.filter((d) => isDiscUnlocked(d, unlocked, owned, level)).map((d) => d.key);
}
// Auto-fill the bag with newly-unlocked discs (priority order) until it's full;
// discs unlocked beyond capacity stay in the collection. `seen` marks which
// unlocks have already been auto-processed, so a disc the player removed from
// the bag is never silently re-added. Pure + idempotent.
function reconcileBag(bag: string[], seen: string[], unlockedKeys: string[]): { bag: string[]; seen: string[] } {
  const valid = new Set(unlockedKeys);
  const nb = bag.filter((k) => valid.has(k)).slice(0, BAG_MAX); // drop stale/locked, cap
  const fresh = unlockedKeys.filter((k) => !seen.includes(k));
  const add = (k: string) => { if (nb.length < BAG_MAX && fresh.includes(k) && !nb.includes(k)) nb.push(k); };
  for (const k of BAG_PRIORITY) add(k);
  for (const k of fresh) add(k); // any disc not in the priority list (safety)
  const nextSeen = Array.from(new Set([...seen, ...unlockedKeys]));
  return { bag: nb, seen: nextSeen };
}
// Clamp a remembered disc index to one that's actually in the bag, so a round
// never starts on a disc the player isn't carrying.
function validDiscIndex(idx: number, bag: string[]): number {
  const i = idx | 0;
  if (i >= 0 && i < ADV_DISCS.length && bag.includes(ADV_DISCS[i].key)) return i;
  const first = ADV_DISCS.findIndex((d) => bag.includes(d.key));
  return first >= 0 ? first : DEFAULT_DISC_INDEX;
}
// Most the flight path may bend over a single throw (~46°) — keeps fade
// noticeable without ever curving back toward the thrower.
const MAX_FADE_TURN = 0.8;

// Aim straight at the basket from a given lie.
function aimAt(from: Vec, basket: Vec): number {
  return Math.atan2(basket.y - from.y, basket.x - from.x);
}

// Horizontal camera position that centers `x` inside a hole's world width.
function camXFor(hole: Hole, x: number) {
  return Math.max(0, Math.min((hole.worldW ?? W) - W, x - W / 2));
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
// Hazards (sand) are DRAWN as an ellipse inscribed in {x,y,w,h}, so a plain
// bounding-box test false-positives in the rect corners that are visually
// fairway. This tests whether the whole disc sits inside that ellipse — a
// throw only counts as a hazard when it's completely in the sand, not merely
// clipping the edge. Shrinking the radii by DISC_R approximates "disc fully
// contained"; a hazard smaller than the disc can never fully contain it.
function inHazard(hz: Water, x: number, y: number) {
  const cx = hz.x + hz.w / 2;
  const cy = hz.y + hz.h / 2;
  const rx = hz.w / 2 - DISC_R;
  const ry = hz.h / 2 - DISC_R;
  if (rx <= 0 || ry <= 0) return false;
  const nx = (x - cx) / rx;
  const ny = (y - cy) / ry;
  return nx * nx + ny * ny <= 1;
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
// curved fairway with doglegs, guard trees, and the odd pond/sand. `opts.par`
// forces the par (else it's picked); `opts.tighten` (<1) narrows the fairway;
// waterChance/hazardChance/Max and extraTreesHi shape a venue's character (lots
// of water, sand, or trees). Obstacles are placed INSIDE the fairway corridor
// (within ±fwWidth/2 of the centerline) so they're real hazards to navigate,
// not scenery sitting out in the already-OB rough.
type GenOpts = { par?: number; tighten?: number; waterChance?: number; waterMax?: number; hazardChance?: number; hazardMax?: number; extraTreesHi?: number; lenScale?: number; treeMul?: number };
function genDailyHole(rng: () => number, opts: GenOpts = {}): Hole {
  const r = (a: number, b: number) => a + rng() * (b - a);
  const pickN = (arr: number[]) => arr[Math.floor(rng() * arr.length)];
  const par = opts.par ?? pickN([3, 3, 3, 4, 4, 4, 4, 5, 5]);
  const tighten = opts.tighten ?? 1;
  const pro = tighten < 1;
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
  let fwWidth = Math.round((par <= 3 ? r(104, 124) : par === 4 ? r(112, 140) : r(122, 150)) * tighten);
  if (rng() < 0.2) fwWidth = Math.round(fwWidth * 0.82); // occasional tunnel
  const elev = pickN([-2, -1, -1, 0, 0, 1, 1, 2]);

  const trees: Tree[] = [];
  // `off` is an absolute distance from the centerline (kept under fwWidth/2 so
  // the tree is in-bounds — a gate to throw around, not a fence in the rough).
  const addTree = (p: Vec, side: number, off: number) => {
    const tx = Math.round(p.x + side * off);
    if (tx < 16 || tx > 304 || p.y > 348 || p.y < 96) return;
    trees.push({ x: tx, y: Math.round(p.y), r: Math.round(r(9, 11)) });
  };
  for (let i = 1; i <= nBends; i++) {
    const p = pts[i];
    const turn = Math.sign((pts[i + 1].x - p.x) - (p.x - pts[i - 1].x)) || (rng() < 0.5 ? 1 : -1);
    addTree(p, -turn, fwWidth / 2 - r(4, 14)); // guard the inside of the dogleg, just inside the line
  }
  const nExtra = Math.floor(r(1, opts.extraTreesHi ?? (pro ? 4 : 3)));
  for (let k = 0; k < nExtra; k++) addTree(pointOnPath(pts, r(0.25, 0.8)), rng() < 0.5 ? 1 : -1, fwWidth * r(0.15, 0.42));

  // A water/sand box that fills ONE side of the corridor — from at-or-near the
  // centerline out toward (and a touch past) the edge — so it overlaps the
  // in-bounds line and must be carried or skirted, while the opposite half
  // stays a clear landing lane.
  const sideBox = (p: Vec, wMin: number, wMax: number, hMin: number, hMax: number): Water => {
    const side = rng() < 0.5 ? 1 : -1;
    const w = Math.round(r(wMin, wMax));
    const h = Math.round(r(hMin, hMax));
    const near = p.x + side * r(0, (fwWidth / 2) * 0.35); // near edge: at-or-just-off the centerline
    const left = side > 0 ? near : near - w;              // box's left edge (it extends `side`-ward)
    const x = Math.round(Math.max(8, Math.min(300 - w, left)));
    return { x, y: Math.round(p.y - h / 2), w, h };
  };
  const waterChance = opts.waterChance ?? (pro ? 0.4 : 0.35);
  const hazardChance = opts.hazardChance ?? (pro ? 0.42 : 0.32);
  const water: Water[] = [];
  for (let i = 0; i < (opts.waterMax ?? 1); i++) if (rng() < waterChance) water.push(sideBox(pointOnPath(pts, r(0.4, 0.72)), 46, 74, 26, 44));
  // Sand traps stay in play: a bunker kept FULLY inside the fairway corridor
  // (never floating out in OB) and clear of any water (sand in a pond isn't
  // real). Axis-aligned overlap test with a small margin so they never touch.
  const overlaps = (a: Water, b: Water, m = 4) =>
    a.x - m < b.x + b.w && a.x + a.w + m > b.x && a.y - m < b.y + b.h && a.y + a.h + m > b.y;
  const sandBox = (p: Vec): Water => {
    const side = rng() < 0.5 ? 1 : -1;
    const half = fwWidth / 2;
    // A ROUND bunker, big enough to actually land in — but never so wide it seals
    // off the corridor (always leaves a ~28px landing lane). materializeHole keeps
    // it circular (diameter = this width) in world space. Three r() draws, same as
    // the old elliptical bunker, so every course's trees/pins/water are untouched.
    const d = Math.round(Math.max(28, Math.min(r(34, 48), fwWidth - 28)));
    const jitter = r(-6, 6);                        // small along-fairway nudge (keeps the RNG stream stable)
    const reach = Math.max(0, half - d / 2 - 2);    // how far the center can sit off the centerline
    const cx = p.x + side * r(reach * 0.4, reach);  // biased to one side so a lane is left opposite
    const x = Math.round(Math.max(8, Math.min(312 - d, cx - d / 2)));
    return { x, y: Math.round(p.y - d / 2 + jitter), w: d, h: d };
  };
  const hazard: Water[] = [];
  for (let i = 0; i < (opts.hazardMax ?? 1); i++) {
    if (rng() >= hazardChance) continue;
    for (let tries = 0; tries < 6; tries++) {
      const cand = sandBox(pointOnPath(pts, r(0.3, 0.78)));
      if (water.some((wb) => overlaps(cand, wb)) || hazard.some((hb) => overlaps(cand, hb))) continue;
      hazard.push(cand);
      break;
    }
  }

  // Length variety: like a real course, not every hole is a max-driver shot.
  // Many par-3s play short enough to reach with a midrange or fairway off the
  // tee; par 4/5 keep their length (their drives still need distance). Rolled
  // last so obstacle placement for a given seed is unchanged. `opts.lenScale`
  // (<1) shrinks every hole on top of that — used by early-career courses so a
  // developing player can reach without a distance driver.
  const lenMul = (par <= 3 ? pickN([0.6, 0.7, 0.82, 1, 1]) : 1) * (opts.lenScale ?? 1);
  return materializeHole({ par, lenMul, tee: TEE, basket: { x: basketX, y: basketY }, fairway: pts, fwWidth, trees, water, hazard, elev, treeMul: opts.treeMul });
}
// The 18 pars of a generated pro course — cheap to compute (own RNG), so the
// Career schedule can show a course's par without building all its geometry.
function tourPars(seed: number): number[] {
  const rng = mulberry32((seed ^ 0x6f4e3d2c) >>> 0);
  const bag = [3, 3, 4, 4, 4, 4, 4, 5]; // pro mix → par ~68–71 over 18
  return Array.from({ length: 18 }, () => bag[Math.floor(rng() * bag.length)]);
}
// ── Venue character: every generated tour course has a personality (wooded,
// water-laden, links-windy, sandy, technical, or classic parkland) that biases
// its hole generation + wind, so courses feel distinct, not interchangeable. ──
type TourStyle = { character: string; emoji: string; gen: GenOpts; windMul: number };
const TOUR_STYLES: TourStyle[] = [
  { character: "Wooded", emoji: "🌲", gen: { tighten: 0.84, extraTreesHi: 6, waterChance: 0.18, hazardChance: 0.28, treeMul: 1.35 }, windMul: 0.65 },
  { character: "Water-laden", emoji: "💧", gen: { tighten: 0.96, waterChance: 0.72, waterMax: 2, hazardChance: 0.25, extraTreesHi: 3, treeMul: 0.95 }, windMul: 1.0 },
  { character: "Links (open & windy)", emoji: "🌬", gen: { tighten: 1.08, extraTreesHi: 2, waterChance: 0.2, hazardChance: 0.55, hazardMax: 2, treeMul: 0.85 }, windMul: 1.8 },
  { character: "Sandy", emoji: "🏜", gen: { tighten: 0.96, hazardChance: 0.82, hazardMax: 2, waterChance: 0.18, extraTreesHi: 3, treeMul: 0.95 }, windMul: 1.1 },
  { character: "Tight & technical", emoji: "🎯", gen: { tighten: 0.8, extraTreesHi: 5, waterChance: 0.35, hazardChance: 0.45, treeMul: 1.2 }, windMul: 0.85 },
  { character: "Parkland", emoji: "🏞", gen: { tighten: 0.92, treeMul: 1.0 }, windMul: 1.0 },
];
function tourStyle(seed: number): TourStyle {
  return TOUR_STYLES[(seed >>> 3) % TOUR_STYLES.length];
}
// A short character tag for a venue (shown in the Career schedule + HUD).
function tourCharacter(seed: number): { character: string; emoji: string } {
  const s = tourStyle(seed);
  return { character: s.character, emoji: s.emoji };
}
// A procedurally-generated 18-hole pro "tour" course with a venue character,
// using the pars from tourPars(seed). Deterministic.
function generateTourCourse(seed: number, lenScale = 1): Hole[] {
  const pars = tourPars(seed);
  const style = tourStyle(seed);
  const rng = mulberry32((seed ^ 0x2545f491) >>> 0);
  return pars.map((par) => {
    const h = genDailyHole(rng, { par, ...style.gen, ...(lenScale === 1 ? {} : { lenScale }) });
    const { wind, windMag } = seededWind(rng);
    return { ...h, wind: { x: wind.x * style.windMul, y: wind.y * style.windMul }, windMag: windMag * style.windMul };
  });
}
// Named venues for generated pro "tour" courses. The seed picks one (and builds
// the actual 18 holes), so the pro tour visits many distinct courses a season.
const VENUE_NAMES = [
  "Pinecrest Ridge", "Granite Falls", "Harbor Pines", "Copperhead GC", "Whitetail Run",
  "Sandstone Mesa", "Cedar Hollow", "Iron Mountain", "Blue Heron Park", "Timber Ridge",
  "Cypress Bend", "Eagle Bluff", "Riverbend Commons", "Foxglove Meadows", "Lakeshore Links",
  "Birchwood Trace", "Coyote Canyon", "Maplewood Estate", "Silver Creek", "Thunder Valley",
  "Heron Marsh", "Oakmont Acres", "Sunset Dunes", "Wolf Ridge", "Aspen Glade", "Stonebriar",
];
function tourVenue(seed: number): string {
  return VENUE_NAMES[seed % VENUE_NAMES.length];
}
// A fixed roster of pro-tour venues, playable standalone from "Play Courses"
// (the same procedurally-generated layouts the Career tour visits). Built by
// walking seeds until we have a set of distinct, varied venues — deterministic,
// so a venue's layout never changes between sessions.
export type TourCourse = { seed: number; name: string; character: string; emoji: string; par: number; holes: number };
function buildTourRoster(count: number): TourCourse[] {
  const out: TourCourse[] = [];
  const names = new Set<string>();
  const chars = new Map<string, number>();
  let seed = 0x1a2b3c4d >>> 0;
  // Bound the walk so a bad parameterization can never spin forever.
  for (let guard = 0; guard < 5000 && out.length < count; guard++) {
    seed = (seed + 0x9e3779b1) >>> 0;
    const name = tourVenue(seed);
    if (names.has(name)) continue;
    const { character, emoji } = tourCharacter(seed);
    // Keep the roster varied: at most two venues of the same character.
    if ((chars.get(character) ?? 0) >= 2) continue;
    names.add(name);
    chars.set(character, (chars.get(character) ?? 0) + 1);
    out.push({ seed, name, character, emoji, par: tourPars(seed).reduce((a, b) => a + b, 0), holes: 18 });
  }
  return out;
}
const TOUR_COURSES: TourCourse[] = buildTourRoster(8);

// The tournament roster — named events on the play-courses: single-course
// championships (3 rounds, cut) plus two-course series (2–3 rounds). Built once
// from the course roster; each event's `seed` (an id hash) drives its AI field.
function buildTournaments(): TournDef[] {
  const glen: TournRound = { mode: "course" };
  const wint: TournRound = { mode: "winthrop" };
  const tour = (c: TourCourse): TournRound => ({ mode: "tour", seed: c.seed });
  const seedOf = (s: string) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const ev = (name: string, venues: string, rounds: TournRound[], cut: boolean): TournDef => ({ id: name, name, venues, rounds, cut, seed: seedOf(name) });
  const t = TOUR_COURSES;
  const list: TournDef[] = [
    ev("Glendoveer Championship", "Glendoveer East", [glen, glen, glen], true),
    ev("Winthrop Lake Classic", "Winthrop Lake", [wint, wint, wint], true),
    ...t.map((c) => ev(`${c.name} Open`, c.name, [tour(c), tour(c), tour(c)], true)),
    ev("Northwest Showdown", "Glendoveer East + Winthrop Lake", [glen, wint], false),
  ];
  if (t[0]) list.push(ev("Champions Cup", `Glendoveer East + ${t[0].name}`, [glen, tour(t[0])], false));
  if (t[0] && t[1]) list.push(ev("Spring Swing", `${t[0].name} + ${t[1].name}`, [tour(t[0]), tour(t[1]), tour(t[0])], true));
  if (t[2] && t[3]) list.push(ev("Coastal Cup", `${t[2].name} + ${t[3].name}`, [tour(t[2]), tour(t[3])], false));
  if (t[4] && t[5]) list.push(ev("Summer Series", `${t[4].name} + ${t[5].name}`, [tour(t[4]), tour(t[5]), tour(t[4])], true));
  if (t[6] && t[7]) list.push(ev("Autumn Classic", `${t[6].name} + ${t[7].name}`, [tour(t[6]), tour(t[7])], false));
  return list;
}
const TOURNAMENTS: TournDef[] = buildTournaments();
// Every REAL hole in the app's playable courses — Glendoveer East, Winthrop Lake,
// and the eight pro-tour venues (the exact set shown on "Play Courses"). This is
// the pool the Daily Challenge AND the early-Career events draw from, so they
// always serve holes that exist in a real course and never invent their own.
// `lenScale` (<1) re-materializes every course shorter — the same shrink the
// early Career applies elsewhere — so a developing player can still reach greens;
// 1 is the courses at their normal length. Cached per lenScale.
const DAILY_POOLS = new Map<number, Hole[]>();
function dailyHolePool(lenScale = 1): Hole[] {
  const cached = DAILY_POOLS.get(lenScale);
  if (cached) return cached;
  const pool: Hole[] = [];
  if (lenScale === 1) {
    // Glendoveer plays with its authored elevation profile (the same per-hole
    // values "course" mode applies); Winthrop and the tour venues carry their own.
    HOLES.forEach((h, i) => pool.push({ ...h, elev: HOLE_ELEV[i] ?? 0 }));
    pool.push(...WINTHROP_HOLES);
    for (const c of TOUR_COURSES) pool.push(...generateTourCourse(c.seed));
  } else {
    // The same real holes, re-materialized shorter (exactly how "course",
    // "winthrop" and tour modes shorten a hole for the early Career).
    HOLE_TEMPLATES.forEach((t, i) => pool.push({ ...materializeHole({ ...t, lenMul: (t.lenMul ?? 1) * lenScale }), elev: HOLE_ELEV[i] ?? 0 }));
    WINTHROP_TEMPLATES.forEach((t) => pool.push(materializeHole({ ...t, lenMul: (t.lenMul ?? 1) * lenScale })));
    for (const c of TOUR_COURSES) pool.push(...generateTourCourse(c.seed, lenScale));
  }
  DAILY_POOLS.set(lenScale, pool);
  return pool;
}
// 9 DISTINCT real holes sampled from across every course in the app (see
// dailyHolePool), in a seed-shuffled order, each handed seeded wind so it still
// varies. Deterministic — same seed (+ lenScale) ⇒ same nine holes. It never makes
// up a hole; every one comes from a real course. Backs both the Daily Challenge
// (full length) and the early-Career "academy" events (shortened via lenScale).
function generateDailyMix(rng: () => number, lenScale = 1): Hole[] {
  const pool = dailyHolePool(lenScale);
  const idx = pool.map((_, i) => i);
  const n = Math.min(9, idx.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (idx.length - i)); // partial Fisher–Yates → 9 distinct
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, n).map((i) => {
    const { wind, windMag } = seededWind(rng);
    return { ...pool[i], wind, windMag };
  });
}
// Build one playable round. Daily = 9 real holes mixed from the app's courses;
// academy = the same 9-real-hole mix shortened for the early Career; tour = a
// generated 18-hole pro course; course = the 18 fixed Glendoveer holes with
// seeded wind. Pins are FIXED at their authored spot — every round plays the same
// basket position (no per-round jitter), so a hole is always identical and a pin
// can never land in water or behind a tree. Same seed ⇒ same round.
// `lenScale` (<1) shortens every hole — early-career play sets it so a developing
// player can reach greens without a distance driver. The fixed courses
// (Glendoveer/Winthrop) are re-materialized from their templates at the scaled
// length; 1 (the default for all normal play) returns the unchanged courses.
function buildRound(seed: number, mode: Mode, lenScale = 1): Hole[] {
  const rng = mulberry32(seed);
  if (mode === "daily") return generateDailyMix(rng);
  if (mode === "academy") return generateDailyMix(rng, lenScale);
  if (mode === "tour" || mode === "ranked") return generateTourCourse(seed, lenScale);
  const templates = mode === "winthrop" ? WINTHROP_TEMPLATES : HOLE_TEMPLATES;
  const full = mode === "winthrop" ? WINTHROP_HOLES : HOLES;
  return templates.map((t, i) => {
    const h = lenScale === 1 ? full[i] : materializeHole({ ...t, lenMul: (t.lenMul ?? 1) * lenScale });
    const { wind, windMag } = seededWind(rng);
    return { ...h, wind, windMag, elev: mode === "course" ? HOLE_ELEV[i] ?? 0 : h.elev ?? 0 };
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
function fullPowerRange(disc: Disc, elev: number | undefined, speedMul = 1, alongWind = 0): number {
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
    // `vy` here is forward speed, so the uphill pull subtracts from it and a
    // tailwind (alongWind > 0) adds to it, a headwind subtracts — same as flight.
    if (airborne) vy += alongWind - (elev ?? 0) * SLOPE_PULL;
    vy *= airborne ? disc.friction : elevGroundFriction(elev);
    if (!airborne && vy < STOP_SPEED) break;
  }
  return y;
}
// The wind's component ALONG the throw (lie → basket), signed: positive is a
// tailwind that carries the disc on, negative a headwind that knocks it down. Fed
// to the auto-caddie so it clubs up into the wind and down with it.
function windAlong(hole: Hole, from: Vec): number {
  if (!hole.wind) return 0;
  const ax = hole.basket.x - from.x, ay = hole.basket.y - from.y;
  const len = Math.hypot(ax, ay) || 1;
  return (hole.wind.x * ax + hole.wind.y * ay) / len;
}
// World px → feet, for the on-screen distance readout. FEET_PER_PX (1.8, defined
// up top by the hole-length floor) is tuned to realistic disc golf carries: a
// full-power straight midrange (~160px) ≈ 290ft, a fairway (~221px) ≈ 400ft, and
// a distance driver (~300px) ≈ 540ft.
function pxToFeet(px: number): number {
  return Math.round(px * FEET_PER_PX);
}
// Straight-line distance (px) between two points — the lie-to-basket measure the
// auto-caddie and the HUD use.
function distBetween(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
// Auto-caddie: pick the disc to start the next shot with, from the player's BAG,
// based on how far the basket still is. Prefers a STRAIGHT disc — the shortest
// one whose full-power carry still reaches (so close shots get a putter, mid
// shots a midrange, long drives a driver); if no straight disc reaches, the
// longest straight in the bag; if the bag has no straight discs at all, the
// best-fitting disc of any flight. Overstable discs aren't auto-picked when a
// straight option exists (those are for manual shaping).
function autoDiscIndex(remaining: number, bag: string[], elev = 0, alongWind = 0): number {
  const inBag = ADV_DISCS
    .map((d, i) => ({ i, d, reach: fullPowerRange(d, elev, d.flight === "straight" ? STRAIGHT_SPEED_MUL : 1, alongWind) }))
    .filter((x) => bag.includes(x.d.key));
  if (!inBag.length) return DEFAULT_DISC_INDEX;
  const straight = inBag.filter((x) => x.d.flight === "straight").sort((a, b) => a.reach - b.reach);
  const pool = (straight.length ? straight : inBag.slice()).sort((a, b) => a.reach - b.reach);
  for (const x of pool) if (x.reach >= remaining) return x.i;
  return pool[pool.length - 1].i; // nothing reaches → the longest disc in the pool
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

// The stroke penalty + new lie for a flight that just ended, given the
// `stepFlight` status. This is the rule the game applies after each shot:
//   - OB / off-world ("ob" / "oob"): +1 stroke, replay from the hole's drop
//     zone if it has one, otherwise the last in-bounds point on the recorded
//     flight path. `kind` is "water" when the disc ended inside a water rect
//     (so the caller can pick a splash effect), else "ob".
//   - At-rest ("stop") sitting in sand — a `hazard` ellipse, or the rough on a
//     `roughIsHazard` hole: +1 stroke, play where it lies (`lie` is null).
//   - Anything else (clean stop, still flying, holed out): no penalty.
// `pos` is where the disc ended (the flight point for OB, the resting point for
// a stop); `trail` is the recorded flight curve; `rest` is the prior lie, a
// final fallback for the OB walk-back. Pure, so it's unit-tested directly.
type PenaltyKind = "none" | "ob" | "water" | "sand";
type Penalty = { kind: PenaltyKind; strokes: number; lie: Vec | null };
function resolvePenalty(status: StepStatus, hole: Hole, pos: Vec, trail: Vec[], rest: Vec): Penalty {
  if (status === "ob" || status === "oob") {
    const water = hole.water.some((w) => inRect(w, pos.x, pos.y));
    const lie = hole.dropZone ?? lastInBoundsLie(trail, hole, rest);
    return { kind: water ? "water" : "ob", strokes: 1, lie };
  }
  if (status === "stop") {
    const sand =
      (hole.hazard ?? []).some((hz) => inHazard(hz, pos.x, pos.y)) ||
      (!!hole.roughIsHazard && offRibbons(hole, pos.x, pos.y));
    if (sand) return { kind: "sand", strokes: 1, lie: null };
  }
  return { kind: "none", strokes: 0, lie: null };
}

// Trees the disc is resting right up against — close enough that in real life
// you'd just throw past the trunk from your stance. A throw from here passes
// THROUGH them (stepFlight skips any tree handed in via `opts.ghostTrees`), and
// the renderer shows them translucent so you can see you're clear. It's
// direction-agnostic: a tree you're nearly touching won't reappear in your
// flight once you've thrown away from it, so there's no need to gate on aim.
function treesAtLie(hole: Hole, x: number, y: number): Tree[] {
  return hole.trees.filter((tr) => Math.hypot(x - tr.x, y - tr.y) <= tr.r + DISC_R * 3);
}

// `opts` carries Career skill effects for the player's own flights: `windMul`
// scales how hard the wind shoves the disc (low control → blown around), and
// `catchR` widens/narrows the basket catch radius (putting skill). `ghostTrees`
// lists trees to ignore for collision (you're throwing through one you're stuck
// behind). All default to neutral, so non-career / open-lie play is unchanged.
function stepFlight(f: Flight, disc: Disc, fadeSign: number, path: FlightPath, hole: Hole, release: Release = "flat", opts: { catchR?: number; windMul?: number; ghostTrees?: Tree[] } = {}): { status: StepStatus; treeHit: boolean } {
  const catchR = opts.catchR ?? CATCH_R;
  const windMul = opts.windMul ?? 1;
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
    f.vx += hole.wind.x * windMul;
    f.vy += hole.wind.y * windMul;
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

  // Trees are tall — they block at ANY height, so you must go around them. The
  // exception: a tree you're stuck right behind is "ghosted" for this throw, so
  // you can throw through the gap past the trunk like you would in real life.
  let treeHit = false;
  for (const tr of hole.trees) {
    if (opts.ghostTrees?.includes(tr)) continue;
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
      // A disc screaming at the basket tends to blow through the chains, so the
      // catch radius shrinks with horizontal speed: a controlled approach or putt
      // (slow, sp ≲ 0.45) catches in the full radius, while a full-power bomb has
      // to be nearly dead-center to drop. Keeps throw-in eagles possible but hard.
      const effCatchR = catchR * Math.max(0.3, Math.min(1, 1 - (sp - 0.45) / 1.7));
      if (Math.hypot(f.x - hole.basket.x, f.y - hole.basket.y) < effCatchR) return { status: "hole", treeHit };
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

// ── Visible tournament rivals. The field is simulated as a stroke count per
// player per hole; here a few of the favorites are turned into "ghost" discs
// that play the hole alongside you — fabricated shot-by-shot down the fairway
// from their simulated score, so the round feels live. Deterministic. ──
// One shot in a ghost's hole: stand at `from` for `pause` ms, then fly to `to`
// over `fly` ms. `ctrl` (a quadratic-bezier control point) bends the flight around
// a tree it would otherwise pass through; null = a straight flight.
type GhostSeg = { from: Vec; to: Vec; ctrl: Vec | null; pause: number; fly: number; lift: number };
type TournGhost = { name: string; color: string; segs: GhostSeg[]; delay: number; holedFired: boolean };
type GhostState = { holeIndex: number; startAt: number; ghosts: TournGhost[] };
const GHOST_PALETTE = ["#e23b7b", "#5fb0e8", "#b85cd6", "#e2a13b"];
const N_RIVALS = 4;
// How far a rival's drive/approach carries (px) when laying out their shot path —
// a solid throw, so on a short hole they go straight at the basket in one like you
// would, rather than dribbling down the fairway.
const GHOST_DRIVE = DRIVE * 0.9;
// A rival's disc flies at the SAME pace as yours (measured ~0.2 px/ms airborne for
// a real throw), so flight time scales with distance — a drive takes ~1.2s, a putt
// a fraction — instead of every shot zipping over in a fixed ~0.6s (which made long
// shots look unnaturally fast). Floor/ceiling keep putts readable and bombs sane.
const GHOST_FLIGHT_SPEED = 0.2; // px/ms
const GHOST_MIN_FLY = 240;      // ms
const GHOST_MAX_FLY = 1700;     // ms

// If the straight line from `a` to `b` would pass through a tree, return a bezier
// control point that bows the flight around the worst offender (to the clear side,
// keeping ~a disc's width of air) — so a rival shapes a shot around the trunk like
// you would, instead of flying through it. null when the line is already clear.
function ghostAvoidTree(a: Vec, b: Vec, trees: Tree[]): Vec | null {
  const dx = b.x - a.x, dy = b.y - a.y;
  const segLen = Math.hypot(dx, dy);
  if (segLen < 8 || !trees.length) return null;
  const ux = dx / segLen, uy = dy / segLen; // unit along the line
  const nx = -uy, ny = ux;                  // unit perpendicular
  let worst: { t: number; sp: number; clear: number } | null = null;
  for (const tr of trees) {
    const rx = tr.x - a.x, ry = tr.y - a.y;
    const along = rx * ux + ry * uy;                 // distance along the line
    if (along <= 6 || along >= segLen - 6) continue; // tree sits at a lie, not mid-flight
    const sp = rx * nx + ry * ny;                    // signed perpendicular offset of the tree
    const clear = tr.r + DISC_R + 4 - Math.abs(sp);  // >0 ⇒ the straight line clips this tree
    if (clear <= 0) continue;
    if (!worst || clear > worst.clear) worst = { t: along / segLen, sp, clear };
  }
  if (!worst) return null;
  const side = worst.sp >= 0 ? -1 : 1;               // curve opposite the trunk
  // perp offset of B(t) from the chord is 2·t·(1−t)·perp(control); invert for the
  // offset that clears the tree (with a touch of margin), then clamp the bow.
  const targetPerp = side * (worst.clear + 4);
  const denom = Math.max(0.06, 2 * worst.t * (1 - worst.t));
  const perp = Math.max(-segLen * 0.7, Math.min(segLen * 0.7, targetPerp / denom));
  return { x: a.x + dx * worst.t + nx * perp, y: a.y + dy * worst.t + ny * perp };
}

// Generic ghost builder: turn a list of racers (name, color, shot count for THIS
// hole) into discs that play the hole tee → fairway landings → basket, one shot
// per node. Shared by tournament play and Career/Ranked events.
type GhostRacer = { name: string; color: string; shots: number };
function buildRacerGhosts(seed: number, holeIndex: number, hole: Hole, racers: GhostRacer[], now: number): GhostState {
  const ghosts = racers.map((rc, gi) => {
    const s = Math.max(1, rc.shots);
    const rng = mulberry32((seed ^ (gi * 2654435761) ^ (holeIndex * 40503) ^ 0x77777) >>> 0);
    const pts: Vec[] = [{ x: hole.tee.x, y: hole.tee.y }];
    // Throws it takes to REACH the green. On a short hole this is 1, so the first
    // throw flies right at the basket like a real drive; any remaining strokes are
    // putts that close in on the cup — instead of evenly dawdling down the fairway.
    const reach = Math.max(1, Math.ceil(distBetween(hole.tee, hole.basket) / GHOST_DRIVE));
    for (let k = 1; k < s; k++) {
      if (k >= reach) {
        // On/around the green — short putts converging on the basket.
        const putt = k - reach;        // 0 = the approach that lands on the green
        const last = s - 1 - reach;    // index of the final putt before holing out
        const spread = hole.fwWidth * 0.16 * (last > 0 ? 1 - putt / (last + 1) : 0.5);
        const ang = rng() * Math.PI * 2;
        pts.push({ x: hole.basket.x + Math.cos(ang) * spread, y: hole.basket.y + Math.sin(ang) * spread });
      } else {
        // Still advancing down the fairway — reach the green (f→1) on throw #reach.
        const f = k / reach;
        const base = pointOnPath(hole.fairway, f);
        const ahead = pointOnPath(hole.fairway, Math.min(1, f + 0.02));
        const dx = ahead.x - base.x, dy = ahead.y - base.y;
        const len = Math.hypot(dx, dy) || 1;
        const j = (rng() * 2 - 1) * hole.fwWidth * 0.22; // lateral spread within the corridor
        pts.push({ x: base.x + (-dy / len) * j, y: base.y + (dx / len) * j });
      }
    }
    pts.push({ x: hole.basket.x, y: hole.basket.y });
    // One segment per shot: a beat lining up, then a flight whose length scales with
    // distance (player pace) and that curves around any tree in the way.
    const segs: GhostSeg[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const segLen = distBetween(a, b);
      const fly = Math.max(GHOST_MIN_FLY, Math.min(GHOST_MAX_FLY, segLen / GHOST_FLIGHT_SPEED));
      const pause = 1500 + rng() * 650; // ~1.5–2.2s lining up before each throw
      segs.push({ from: a, to: b, ctrl: ghostAvoidTree(a, b, hole.trees), pause, fly, lift: Math.min(14, 4 + segLen * 0.05) });
    }
    return { name: rc.name, color: rc.color, segs, delay: gi * 500 + rng() * 700, holedFired: false };
  });
  return { holeIndex, startAt: now, ghosts };
}

// Tournament rivals: the best-skilled players still in the event (cut applied in
// round 3), with per-hole scores matching tournFieldHoles, as ghost discs.
function buildTournGhosts(t: Tournament, def: TournDef, holeIndex: number, hole: Hole, now: number): GhostState {
  const roundIdx = t.myTotals.length;
  const fieldHoles = tournFieldHoles(t.seed, roundIdx, tournRoundPlayHoles(t.seed, roundIdx, def.rounds[roundIdx]));
  const skills = tournSkills(t.seed);
  let active = TOURN_NAMES.map((_, i) => i);
  if (tournHasCut(def) && roundIdx === 2 && t.fieldTotals.length >= 2) {
    const line = tournCutLine(t);
    active = active.filter((i) => t.fieldTotals[0][i] + t.fieldTotals[1][i] <= line);
  }
  const rivals = [...active].sort((a, b) => skills[a] - skills[b]).slice(0, N_RIVALS);
  const racers: GhostRacer[] = rivals.map((idx, gi) => ({
    name: TOURN_NAMES[idx], color: GHOST_PALETTE[gi % GHOST_PALETTE.length], shots: Math.max(1, fieldHoles[idx]?.[holeIndex] ?? hole.par),
  }));
  return buildRacerGhosts((t.seed ^ (roundIdx * 99991)) >>> 0, holeIndex, hole, racers, now);
}

// Where a ghost is `elapsed` ms into the hole: walk its shots, each of which waits
// at the lie for `pause` ms then flies to the next spot over `fly` ms — curving
// along its bezier (around a tree) when one was set, otherwise straight.
function ghostPosAt(gh: TournGhost, elapsed: number): { x: number; y: number; lift: number; holed: boolean } {
  const segs = gh.segs;
  if (segs.length === 0) return { x: 0, y: 0, lift: 0, holed: true };
  if (elapsed < 0) return { x: segs[0].from.x, y: segs[0].from.y, lift: 0, holed: false };
  let acc = 0;
  for (const s of segs) {
    const dur = s.pause + s.fly;
    if (elapsed < acc + dur) {
      const within = elapsed - acc;
      if (within < s.pause) return { x: s.from.x, y: s.from.y, lift: 0, holed: false }; // standing over the disc
      const t = (within - s.pause) / s.fly;
      const e = t * t * (3 - 2 * t);
      let x: number, y: number;
      if (s.ctrl) {
        const u = 1 - e;
        x = u * u * s.from.x + 2 * u * e * s.ctrl.x + e * e * s.to.x;
        y = u * u * s.from.y + 2 * u * e * s.ctrl.y + e * e * s.to.y;
      } else {
        x = s.from.x + (s.to.x - s.from.x) * e;
        y = s.from.y + (s.to.y - s.from.y) * e;
      }
      return { x, y, lift: Math.sin(e * Math.PI) * s.lift, holed: false };
    }
    acc += dur;
  }
  const last = segs[segs.length - 1];
  return { x: last.to.x, y: last.to.y, lift: 0, holed: true };
}

export {
  W,
  H,
  DISC_R,
  CATCH_R,
  STOP_SPEED,
  GRAVITY,
  AIRBORNE_H,
  GROUND_FRICTION,
  MAX_DRAG,
  CANCEL_R,
  CANCEL_POWER,
  TEE,
  HOLE_TEMPLATES,
  DRIVE,
  TEE_BEHIND,
  worldHForPar,
  materializeHole,
  HOLES,
  TOTAL_PAR,
  WINTHROP_TEMPLATES,
  WINTHROP_HOLES,
  WINTHROP_PAR,
  leaderboardCourse,
  TOURN_KEY,
  TOURN_NAMES,
  TOURN_FIELD,
  TOURNAMENTS,
  tournDef,
  tournRoundHoles,
  tournRoundPlayHoles,
  tournRoundPar,
  tournHasCut,
  tournPlace,
  tournSkills,
  tournFieldHoles,
  tournFieldRound,
  tournLiveStandings,
  tournStandings,
  HOLE_ELEV,
  ACHIEVEMENTS,
  earnedAchievements,
  achievementReward,
  BOGEY_PREFIX,
  scoreLabel,
  courseStars,
  courseHoles,
  courseDifficulty,
  courseDifficultyOf,
  difficultyStars,
  courseStarDifficulty,
  tournDifficulty,
  tournStarDifficulty,
  STRAIGHT_SPEED_MUL,
  releaseSpeedMul,
  FAIRWAY_BASE,
  advDisc,
  ADV_DISCS,
  DISC_UNLOCKS,
  DISC_PRICE,
  DISC_LEVEL,
  isDiscUnlocked,
  discUnlockLevel,
  discAvailableAtLevel,
  levelUpChoices,
  validDiscIndex,
  DEFAULT_DISC_INDEX,
  BAG_MAX,
  discByKey,
  discIndexByKey,
  unlockedDiscKeys,
  reconcileBag,
  MAX_FADE_TURN,
  aimAt,
  camXFor,
  AudioEngine,
  inRect,
  inHazard,
  distToSeg,
  distToPath,
  offRibbons,
  inAnyOB,
  mulberry32,
  dailySeed,
  clampPin,
  seededWind,
  pointOnPath,
  genDailyHole,
  tourPars,
  tourCharacter,
  tourVenue,
  generateTourCourse,
  TOUR_COURSES,
  buildRound,
  SLOPE_PULL,
  elevGroundFriction,
  elevAt,
  vibrate,
  fullPowerRange,
  pxToFeet,
  distBetween,
  windAlong,
  autoDiscIndex,
  lastInBoundsLie,
  resolvePenalty,
  treesAtLie,
  stepFlight,
  buildTournGhosts,
  buildRacerGhosts,
  ghostPosAt,
};
export type {
  Vec,
  Tree,
  Water,
  Hole,
  Mode,
  Tournament,
  TournDef,
  TournRound,
  TournLiveRow,
  TournRow,
  Achievement,
  FlightPath,
  Release,
  Disc,
  Flight,
  StepStatus,
  Penalty,
  PenaltyKind,
  TournGhost,
  GhostState,
  GhostRacer,
};
