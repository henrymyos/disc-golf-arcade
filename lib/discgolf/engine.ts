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
// Winthrop's personal best lives in its own key (WBEST_KEY, from @/lib/progress).
// Leaderboards are per course; each daily seed gets its own board.
function leaderboardCourse(mode: Mode, seed: number): string {
  return mode === "course" ? "glendoveer" : mode === "winthrop" ? "winthrop" : mode === "ranked" ? `ranked-${seed}` : mode === "tour" ? `tour-${seed}` : `daily-${seed}`;
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
// Full live leaderboard during a tournament round — everyone scored through the
// same number of holes (cut players dropped in the final round), sorted, with
// rank, to-par, and which row is you. `parThru` is par for the holes played so
// far (completed rounds + this round's first `holesPlayed` holes).
type TournLiveRow = { rank: number; name: string; total: number; toPar: number; you: boolean };
function tournLiveStandings(t: Tournament, myRoundSoFar: number, holesPlayed: number): TournLiveRow[] {
  const roundIdx = t.myTotals.length;
  const fieldHoles = tournFieldHoles(t.seed, roundIdx);
  let active = TOURN_NAMES.map((_, i) => i);
  if (roundIdx === 2 && t.fieldTotals.length >= 2) {
    const sums = [t.myTotals[0] + t.myTotals[1], ...t.fieldTotals[0].map((_, i) => t.fieldTotals[0][i] + t.fieldTotals[1][i])];
    const line = [...sums].sort((a, b) => a - b)[Math.floor(sums.length / 2) - 1];
    active = active.filter((i) => t.fieldTotals[0][i] + t.fieldTotals[1][i] <= line);
  }
  const parThru = roundIdx * WINTHROP_PAR + WINTHROP_HOLES.slice(0, holesPlayed).reduce((s, h) => s + h.par, 0);
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

// "tour" = a procedurally-generated 18-hole pro course (built from a seed; named
// venues live in the Career schedule). Lets the pro tour visit many courses.
// "ranked" = a weekly procedurally-generated 18-hole course shared by everyone
// that week (the async global ranked ladder); built like a tour course.
type Mode = "daily" | "course" | "winthrop" | "tour" | "ranked";

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
// "Ace"). `tone` drives the color shown on the hole-complete screen. Index 1 is
// the plain "Bogey" (no prefix); 2..7 add the Double/Triple/… prefix.
const BOGEY_PREFIX = ["", "", "Double ", "Triple ", "Quadruple ", "Quintuple ", "Sextuple ", "Septuple "];
function scoreLabel(throws: number, par: number): { name: string; emoji: string; tone: "great" | "good" | "even" | "bad" } {
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
  advDisc("harp", "Harp", "Westside", "#d6b85c", DISCS[0], "overstable", "3 / 1 / 0 / 4"),
  // Midrange — straight Buzzz vs overstable Swarm (mid tier)
  advDisc("buzzz", "Buzzz", "Discraft", "#f5d24a", DISCS[1], "straight", "5 / 4 / 0 / 1"),
  advDisc("swarm", "Swarm", "Discraft", "#b85cd6", DISCS[1], "overstable", "5 / 4 / 0 / 3"),
  advDisc("roc", "Roc3", "Innova", "#7ad17a", DISCS[1], "overstable", "5 / 4 / 0 / 3"),
  // Fairway / control — straight Teebird vs overstable Firebird (fairway tier)
  advDisc("teebird", "Teebird", "Innova", "#5fb0e8", FAIRWAY_BASE, "straight", "7 / 5 / 0 / 2"),
  advDisc("firebird", "Firebird", "Innova", "#e2453b", FAIRWAY_BASE, "overstable", "9 / 3 / 0 / 4"),
  advDisc("river", "River", "Latitude 64", "#5fd6c8", FAIRWAY_BASE, "straight", "7 / 7 / -1 / 1"),
  advDisc("pd", "PD", "Discmania", "#3b6fe2", FAIRWAY_BASE, "overstable", "9 / 4 / 0 / 3"),
  // Distance — overstable Nuke OS vs straight-flying Destroyer (driver tier)
  advDisc("nukeos", "Nuke OS", "Discraft", "#2f6fe0", DISCS[2], "overstable", "13 / 5 / 0 / 4"),
  advDisc("destroyer", "Destroyer", "Innova", "#e23b7b", DISCS[2], "straight", "12 / 5 / -1 / 3"),
  advDisc("wraith", "Wraith", "Innova", "#e2843b", DISCS[2], "straight", "11 / 5 / -1 / 3"),
  advDisc("zeus", "Zeus", "Discraft", "#9b3be2", DISCS[2], "overstable", "12 / 5 / -1 / 3"),
];
function activeDiscs(advanced: boolean): Disc[] {
  return advanced ? ADV_DISCS : DISCS;
}
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
// Player level at which each disc unlocks for free (just by playing). Discs not
// listed here and not priced are core — available from the very first round.
const DISC_LEVEL: Record<string, number> = {
  // Simple bag — start with Putter + Mid; the Driver is the first unlock.
  driver: 2,
  // Advanced bag — a steady climb from the Aviar/Buzzz core up to distance.
  zone: 2, harp: 3, teebird: 3, swarm: 4, roc: 4,
  firebird: 5, river: 5, pd: 6, wraith: 7, nukeos: 7, destroyer: 8, zeus: 9,
};
// Coin price to buy a disc in the shop (skips the level requirement). Every
// non-core disc is purchasable; achievement discs can also be bought to skip
// the grind.
const DISC_PRICE: Record<string, number> = {
  driver: 200,
  zone: 250, harp: 300, teebird: 350, swarm: 450, roc: 400,
  firebird: 650, river: 550, pd: 800, wraith: 1000, nukeos: 1100, destroyer: 1400, zeus: 1600,
};
// A disc is usable if it's core (no lock, price or level gate), already bought
// (`owned`), its achievement is earned, or the player has reached its level.
function isDiscUnlocked(disc: Disc, unlocked: string[], owned: string[] = [], level = 1): boolean {
  const lock = DISC_UNLOCKS[disc.key];
  const priced = DISC_PRICE[disc.key] != null;
  const lvl = DISC_LEVEL[disc.key];
  if (!lock && !priced && lvl == null) return true; // core
  if (owned.includes(disc.key)) return true; // bought
  if (lvl != null && level >= lvl) return true; // leveled up to it
  return !!lock && unlocked.includes(lock.ach); // earned via achievement
}
// Smallest player level that frees a disc (null if it has no level gate).
function discUnlockLevel(disc: Disc): number | null {
  return DISC_LEVEL[disc.key] ?? null;
}
// Clamp a remembered disc index to one that's both in range for this bag AND
// usable. Guards the reload case where the advanced bag is on but the saved
// index lands on a still-locked disc (its default index isn't restored), which
// would otherwise start a round with a locked disc selected.
function validDiscIndex(advanced: boolean, idx: number, unlocked: string[], owned: string[] = [], level = 1): number {
  const bag = activeDiscs(advanced);
  const i = Math.min(Math.max(0, idx | 0), bag.length - 1);
  if (isDiscUnlocked(bag[i], unlocked, owned, level)) return i;
  const def = advanced ? 3 : 1; // Buzzz / Mid — always usable (core)
  if (bag[def] && isDiscUnlocked(bag[def], unlocked, owned, level)) return def;
  const first = bag.findIndex((d) => isDiscUnlocked(d, unlocked, owned, level));
  return first >= 0 ? first : 0;
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
// of water, sand, or trees). With no opts, byte-for-byte the original daily-hole
// generator (so existing daily courses are unchanged).
type GenOpts = { par?: number; tighten?: number; waterChance?: number; waterMax?: number; hazardChance?: number; hazardMax?: number; extraTreesHi?: number };
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
  const nExtra = Math.floor(r(1, opts.extraTreesHi ?? (pro ? 4 : 3)));
  for (let k = 0; k < nExtra; k++) addTree(pointOnPath(pts, r(0.25, 0.8)), rng() < 0.5 ? 1 : -1, r(2, 16));

  const sideBox = (p: Vec, wMin: number, wMax: number, hMin: number, hMax: number, inset: number): Water => {
    const side = rng() < 0.5 ? 1 : -1;
    const w = Math.round(r(wMin, wMax));
    const h = Math.round(r(hMin, hMax));
    const cxp = p.x + side * (fwWidth / 2 - inset);
    const x = Math.round(Math.max(8, Math.min(300 - w, cxp - (side < 0 ? w : 0))));
    return { x, y: Math.round(p.y - h / 2), w, h };
  };
  // Default chances reproduce the original (single box) exactly; a venue style
  // can raise the chance and allow a second body of water / sand.
  const waterChance = opts.waterChance ?? (pro ? 0.4 : 0.35);
  const hazardChance = opts.hazardChance ?? (pro ? 0.42 : 0.32);
  const water: Water[] = [];
  for (let i = 0; i < (opts.waterMax ?? 1); i++) if (rng() < waterChance) water.push(sideBox(pointOnPath(pts, r(0.4, 0.72)), 46, 74, 26, 44, 6));
  const hazard: Water[] = [];
  for (let i = 0; i < (opts.hazardMax ?? 1); i++) if (rng() < hazardChance) hazard.push(sideBox(pointOnPath(pts, r(0.3, 0.78)), 24, 36, 18, 26, 10));

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
  { character: "Wooded", emoji: "🌲", gen: { tighten: 0.84, extraTreesHi: 6, waterChance: 0.18, hazardChance: 0.28 }, windMul: 0.65 },
  { character: "Water-laden", emoji: "💧", gen: { tighten: 0.96, waterChance: 0.72, waterMax: 2, hazardChance: 0.25, extraTreesHi: 3 }, windMul: 1.0 },
  { character: "Links (open & windy)", emoji: "🌬", gen: { tighten: 1.08, extraTreesHi: 2, waterChance: 0.2, hazardChance: 0.55, hazardMax: 2 }, windMul: 1.8 },
  { character: "Sandy", emoji: "🏜", gen: { tighten: 0.96, hazardChance: 0.82, hazardMax: 2, waterChance: 0.18, extraTreesHi: 3 }, windMul: 1.1 },
  { character: "Tight & technical", emoji: "🎯", gen: { tighten: 0.8, extraTreesHi: 5, waterChance: 0.35, hazardChance: 0.45 }, windMul: 0.85 },
  { character: "Parkland", emoji: "🏞", gen: { tighten: 0.92 }, windMul: 1.0 },
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
function generateTourCourse(seed: number): Hole[] {
  const pars = tourPars(seed);
  const style = tourStyle(seed);
  const rng = mulberry32((seed ^ 0x2545f491) >>> 0);
  return pars.map((par) => {
    const h = genDailyHole(rng, { par, ...style.gen });
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
// Build one playable round. Daily = a new 9-hole course; tour = a generated
// 18-hole pro course; course = the 18 fixed Glendoveer holes with seeded wind +
// a jittered pin. Same seed ⇒ same round.
function buildRound(seed: number, mode: Mode): Hole[] {
  const rng = mulberry32(seed);
  if (mode === "daily") return generateDailyCourse(rng);
  if (mode === "tour" || mode === "ranked") return generateTourCourse(seed);
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

// `opts` carries Career skill effects for the player's own flights: `windMul`
// scales how hard the wind shoves the disc (low control → blown around), and
// `catchR` widens/narrows the basket catch radius (putting skill). Both default
// to the neutral values, so non-career play is unchanged.
function stepFlight(f: Flight, disc: Disc, fadeSign: number, path: FlightPath, hole: Hole, release: Release = "flat", opts: { catchR?: number; windMul?: number } = {}): { status: StepStatus; treeHit: boolean } {
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
      if (Math.hypot(f.x - hole.basket.x, f.y - hole.basket.y) < catchR) return { status: "hole", treeHit };
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
type TournGhost = { idx: number; name: string; color: string; path: Vec[]; shotDur: number; pause: number; delay: number; holedFired: boolean };
type GhostState = { holeIndex: number; startAt: number; ghosts: TournGhost[] };
const GHOST_PALETTE = ["#e23b7b", "#5fb0e8", "#b85cd6", "#e2a13b"];
const N_RIVALS = 4;

// Generic ghost builder: turn a list of racers (name, color, shot count for THIS
// hole) into discs that play the hole tee → fairway landings → basket, one node
// per shot. Shared by tournament play and Career events.
type GhostRacer = { name: string; color: string; shots: number };
function buildRacerGhosts(seed: number, holeIndex: number, hole: Hole, racers: GhostRacer[], now: number): GhostState {
  const ghosts = racers.map((rc, gi) => {
    const s = Math.max(1, rc.shots);
    const rng = mulberry32((seed ^ (gi * 2654435761) ^ (holeIndex * 40503) ^ 0x77777) >>> 0);
    const path: Vec[] = [{ x: hole.tee.x, y: hole.tee.y }];
    for (let k = 1; k < s; k++) {
      const f = 1 - Math.pow(1 - k / s, 1.25); // cover more ground early
      const base = pointOnPath(hole.fairway, f);
      const ahead = pointOnPath(hole.fairway, Math.min(1, f + 0.02));
      const dx = ahead.x - base.x, dy = ahead.y - base.y;
      const len = Math.hypot(dx, dy) || 1;
      const j = (rng() * 2 - 1) * hole.fwWidth * 0.22; // lateral spread within the corridor
      path.push({ x: base.x + (-dy / len) * j, y: base.y + (dx / len) * j });
    }
    path.push({ x: hole.basket.x, y: hole.basket.y });
    // Each shot = a couple seconds standing over the disc, then a quick flight,
    // so the card plays at a believable, unhurried pace.
    const pause = 1800 + rng() * 700; // ~1.8–2.5s lining up before each throw
    const flightDur = 540 + rng() * 260; // ~0.5–0.8s in the air
    return { idx: gi, name: rc.name, color: rc.color, path, shotDur: pause + flightDur, pause, delay: gi * 500 + rng() * 700, holedFired: false };
  });
  return { holeIndex, startAt: now, ghosts };
}

// Tournament rivals: the best-skilled players still in the event (cut applied in
// round 3), with per-hole scores matching tournFieldHoles, as ghost discs.
function buildTournGhosts(t: Tournament, holeIndex: number, hole: Hole, now: number): GhostState {
  const roundIdx = t.myTotals.length;
  const fieldHoles = tournFieldHoles(t.seed, roundIdx);
  const skills = tournSkills(t.seed);
  let active = TOURN_NAMES.map((_, i) => i);
  if (roundIdx === 2 && t.fieldTotals.length >= 2) {
    const sums = [t.myTotals[0] + t.myTotals[1], ...t.fieldTotals[0].map((_, i) => t.fieldTotals[0][i] + t.fieldTotals[1][i])];
    const line = [...sums].sort((a, b) => a - b)[Math.floor(sums.length / 2) - 1];
    active = active.filter((i) => t.fieldTotals[0][i] + t.fieldTotals[1][i] <= line);
  }
  const rivals = [...active].sort((a, b) => skills[a] - skills[b]).slice(0, N_RIVALS);
  const racers: GhostRacer[] = rivals.map((idx, gi) => ({
    name: TOURN_NAMES[idx], color: GHOST_PALETTE[gi % GHOST_PALETTE.length], shots: Math.max(1, fieldHoles[idx]?.[holeIndex] ?? hole.par),
  }));
  return buildRacerGhosts((t.seed ^ (roundIdx * 99991)) >>> 0, holeIndex, hole, racers, now);
}

// Where a ghost is `elapsed` ms into the hole: each shot waits at the lie for
// `pause` ms, then flies to the next landing spot over the remaining time.
function ghostPosAt(gh: TournGhost, elapsed: number): { x: number; y: number; lift: number; holed: boolean } {
  const segs = gh.path.length - 1;
  if (segs <= 0) return { x: gh.path[0].x, y: gh.path[0].y, lift: 0, holed: true };
  if (elapsed < 0) return { x: gh.path[0].x, y: gh.path[0].y, lift: 0, holed: false };
  const total = segs * gh.shotDur;
  if (elapsed >= total) return { x: gh.path[segs].x, y: gh.path[segs].y, lift: 0, holed: true };
  const seg = Math.floor(elapsed / gh.shotDur);
  const within = elapsed - seg * gh.shotDur; // ms into this shot
  const a = gh.path[seg], b = gh.path[seg + 1];
  if (within < gh.pause) return { x: a.x, y: a.y, lift: 0, holed: false }; // standing over the disc
  const t = (within - gh.pause) / (gh.shotDur - gh.pause);
  const e = t * t * (3 - 2 * t);
  const segLen = Math.hypot(b.x - a.x, b.y - a.y);
  const lift = Math.sin(e * Math.PI) * Math.min(12, 3 + segLen * 0.06);
  return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, lift, holed: false };
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
  tournSkills,
  tournFieldHoles,
  tournFieldRound,
  tournLiveStandings,
  tournStandings,
  HOLE_ELEV,
  ACHIEVEMENTS,
  earnedAchievements,
  BOGEY_PREFIX,
  scoreLabel,
  STRAIGHT_SPEED_MUL,
  releaseSpeedMul,
  DISCS,
  FAIRWAY_BASE,
  advDisc,
  ADV_DISCS,
  activeDiscs,
  DISC_UNLOCKS,
  DISC_PRICE,
  DISC_LEVEL,
  isDiscUnlocked,
  discUnlockLevel,
  validDiscIndex,
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
  generateDailyCourse,
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
  lastInBoundsLie,
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
  TournLiveRow,
  TournRow,
  Achievement,
  FlightPath,
  Release,
  Disc,
  Flight,
  StepStatus,
  TournGhost,
  GhostState,
  GhostRacer,
};
