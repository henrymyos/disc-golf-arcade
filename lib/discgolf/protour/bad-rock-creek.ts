// Bad Rock Creek, Liberty MO: Kansas City Wide Open (DGPT Elite), Apr 24–26
// 2026. MPO, par 67, 10,678 ft. Facts from the public 2026 caddie book (Google
// Drive PDF); each hole cites its MPO page. Hand-placed and rounded to 10 ft in
// our own format (see ./types). Nothing from the book's map art is copied,
// traced or stored; the game draws its own holes.
// The tour's first prairie course: OB is tall grass, walking paths and fences
// rather than trees, so most holes are strung (OB rough). 5 (pond only), 13,
// 15 and 17 are hazard rough. 13 is the book's DOUBLE ISLAND: everything but a
// landing island and the green island is hazard, drawn as hazard bunkers
// covering the corridor (an island ribbon can't shrink the corridor). Woods
// line 5–7, 12 and 14–18 (mixed) and 9 is a wooded tunnel. 14 is a horseshoe
// round OB woods; its mando (not right of the turn tree) is text only. No
// elevation is printed, so every hole is flat.
// Drop zones: tee shots only on 1. The pond-only DZs on 15 and 16, the 14 mando
// DZ and the FPO island DZ on 2 are left to the engine's last-in-bounds default.
// Balance: width 150 on 2, 3, 5, 6, 8, 12, 14, 17; balanceTrees (r 20, not in
// the book): a pair ~50 ft short of the green on 2, 3, 5–8, 11, 12, 17. None on
// the signature holes 1, 4, 9, 13, 15, 16.
// Held (Oct 23): 400-round probe +0.4 / −3.1 / −5.3 (Lv1 / Lv5 / Lv12); Lv12 is
// 5.7 under the +0.4 baseline, outside ±1.5, so the stop shows as later.
import type { ProCourse, ProHole } from "./types";

const BOOK = "https://drive.google.com/file/d/1hLbMxFrJwJvQ5ApYm8HjzMXoxt8WK4m5/view";

const HOLES: ProHole[] = [
  { n: 1, par: 4, lengthFt: 575, line: [{ x: 0, y: 0 }, { x: -10, y: 300 }, { x: -60, y: 460 }, { x: -10, y: 570 }], widthFt: 200, rough: "ob", water: [{ x: -40, y: 360, w: 150, h: 190 }], obZones: [{ x: -90, y: 100, w: 60, h: 200 }], dropZone: { x: 50, y: 320 }, trees: "open", note: "Past a tall-grass island, then around or over the pond to the green", ref: { url: BOOK, page: 10 } },
  { n: 2, par: 3, lengthFt: 359, line: [{ x: 0, y: 0 }, { x: 0, y: 350 }], widthFt: 150, rough: "ob", water: [{ x: 60, y: 0, w: 50, h: 100 }], balanceTrees: [{ x: 30, y: 300, r: 20 }, { x: -30, y: 300, r: 20 }], trees: "open", note: "Straight up an open strung lane, the pond right of the tee", ref: { url: BOOK, page: 12 } },
  { n: 3, par: 4, lengthFt: 605, line: [{ x: 0, y: 0 }, { x: 130, y: 180 }, { x: 80, y: 360 }, { x: 0, y: 540 }], widthFt: 150, rough: "ob", balanceTrees: [{ x: 50, y: 510, r: 20 }, { x: -10, y: 480, r: 20 }], trees: "open", mando: "Not left of the marked tree off the tee", note: "Right off the tee, then back left up a strung tall-grass fairway", ref: { url: BOOK, page: 13 } },
  { n: 4, par: 4, lengthFt: 939, line: [{ x: 0, y: 0 }, { x: -140, y: 320 }, { x: -100, y: 680 }, { x: -40, y: 930 }], widthFt: 180, rough: "ob", trees: "open", note: "939 ft: left off the tee, then a long strung lane up to the green", ref: { url: BOOK, page: 14 } },
  { n: 5, par: 4, lengthFt: 624, line: [{ x: 0, y: 0 }, { x: -140, y: 330 }, { x: -160, y: 450 }, { x: -100, y: 590 }], widthFt: 150, rough: "hazard", water: [{ x: -140, y: 390, w: 80, h: 100 }], balanceTrees: [{ x: -90, y: 530, r: 20 }, { x: -150, y: 560, r: 20 }], trees: "mixed", note: "Up a wooded lane bending left, past a small pond short of the green", ref: { url: BOOK, page: 15 } },
  { n: 6, par: 4, lengthFt: 658, line: [{ x: 0, y: 0 }, { x: 200, y: 250 }, { x: 100, y: 450 }, { x: 0, y: 510 }], widthFt: 150, rough: "hazard", obZones: [{ x: 270, y: 120, w: 40, h: 260 }, { x: 60, y: 560, w: 200, h: 40 }], balanceTrees: [{ x: 60, y: 520, r: 20 }, { x: 20, y: 450, r: 20 }], trees: "mixed", note: "Hard right off the tee, then hooking back left into the woods", ref: { url: BOOK, page: 17 } },
  { n: 7, par: 3, lengthFt: 420, line: [{ x: 0, y: 0 }, { x: -30, y: 200 }, { x: -50, y: 410 }], widthFt: 150, rough: "ob", balanceTrees: [{ x: -20, y: 360, r: 20 }, { x: -80, y: 360, r: 20 }], trees: "mixed", note: "Narrow wooded lane ringed by the walking path OB", ref: { url: BOOK, page: 19 } },
  { n: 8, par: 4, lengthFt: 756, line: [{ x: 0, y: 0 }, { x: -160, y: 330 }, { x: -100, y: 550 }, { x: 0, y: 680 }], widthFt: 150, rough: "ob", balanceTrees: [{ x: 0, y: 620, r: 20 }, { x: -60, y: 660, r: 20 }], trees: "open", note: "Out of the woods, left, then sweeping right to the green", ref: { url: BOOK, page: 20 } },
  { n: 9, par: 3, lengthFt: 268, line: [{ x: 0, y: 0 }, { x: 0, y: 260 }], widthFt: 150, rough: "ob", trees: "wooded", note: "Dead straight down a strung wooded tunnel", ref: { url: BOOK, page: 21 } },
  { n: 10, par: 3, lengthFt: 487, line: [{ x: 0, y: 0 }, { x: -10, y: 250 }, { x: -40, y: 480 }], widthFt: 170, rough: "ob", obZones: [{ x: -80, y: 340, w: 50, h: 110 }], trees: "open", note: "Long strung par 3 past a tall-grass OB island short left of the green", ref: { url: BOOK, page: 23 } },
  { n: 11, par: 3, lengthFt: 383, line: [{ x: 0, y: 0 }, { x: -30, y: 380 }], widthFt: 150, rough: "ob", obZones: [{ x: -110, y: 200, w: 60, h: 100 }, { x: 10, y: 200, w: 80, h: 100 }], balanceTrees: [{ x: 0, y: 330, r: 20 }, { x: -60, y: 330, r: 20 }], trees: "open", note: "Through a narrow tall-grass neck to a bulb-shaped green", ref: { url: BOOK, page: 25 } },
  { n: 12, par: 4, lengthFt: 652, line: [{ x: 0, y: 0 }, { x: -20, y: 370 }, { x: -110, y: 640 }], widthFt: 150, rough: "ob", balanceTrees: [{ x: -60, y: 600, r: 20 }, { x: -130, y: 580, r: 20 }], trees: "mixed", mando: "MPO: not left of the marked tree off the tee", note: "Straight up a wooded chute, then left to a green with the fence long", ref: { url: BOOK, page: 27 } },
  { n: 13, par: 3, lengthFt: 410, line: [{ x: 0, y: 0 }, { x: 20, y: 200 }, { x: 40, y: 400 }], widthFt: 150, rough: "hazard", hazard: [{ x: -40, y: 70, d: 120 }, { x: 20, y: 70, d: 120 }, { x: 80, y: 70, d: 120 }, { x: -40, y: 170, d: 120 }, { x: 20, y: 170, d: 120 }, { x: 80, y: 170, d: 120 }, { x: -40, y: 285, d: 60 }, { x: 95, y: 285, d: 70 }, { x: -20, y: 350, d: 50 }, { x: 25, y: 350, d: 50 }, { x: 70, y: 350, d: 50 }, { x: 110, y: 350, d: 50 }, { x: -20, y: 405, d: 60 }, { x: 100, y: 405, d: 60 }, { x: 40, y: 465, d: 60 }], islandGreen: true, trees: "open", note: "Double island: a landing island, then the green island; the rest is hazard", ref: { url: BOOK, page: 29 } },
  { n: 14, par: 4, lengthFt: 859, line: [{ x: 0, y: 0 }, { x: -180, y: 130 }, { x: -350, y: 260 }, { x: -210, y: 420 }, { x: 0, y: 420 }], widthFt: 150, rough: "ob", water: [{ x: 60, y: 370, w: 50, h: 120 }], trees: "mixed", mando: "Not right of the marked tree at the turn", note: "A horseshoe left around OB woods, then back right to a green by the pond", ref: { url: BOOK, page: 31 } },
  { n: 15, par: 3, lengthFt: 288, line: [{ x: 0, y: 0 }, { x: -10, y: 280 }], widthFt: 150, rough: "hazard", water: [{ x: -110, y: 140, w: 40, h: 70 }, { x: -110, y: 210, w: 90, h: 50 }, { x: -110, y: 260, w: 70, h: 80 }], obZones: [{ x: -110, y: 360, w: 220, h: 30 }], trees: "mixed", note: "Short par 3 with the pond all along the left and the fence long", ref: { url: BOOK, page: 32 } },
  { n: 16, par: 5, lengthFt: 959, line: [{ x: 0, y: 0 }, { x: -70, y: 310 }, { x: -150, y: 630 }, { x: -200, y: 930 }], widthFt: 170, rough: "ob", water: [{ x: -170, y: 0, w: 130, h: 110 }], trees: "mixed", note: "959 ft from a tee by the pond up a long strung chute", ref: { url: BOOK, page: 34 } },
  { n: 17, par: 4, lengthFt: 512, line: [{ x: 0, y: 0 }, { x: 10, y: 180 }, { x: -40, y: 340 }, { x: 0, y: 500 }], widthFt: 150, rough: "hazard", balanceTrees: [{ x: 20, y: 440, r: 20 }, { x: -40, y: 460, r: 20 }], trees: "mixed", note: "Short par 4 snaking through the woods, no OB", ref: { url: BOOK, page: 35 } },
  { n: 18, par: 5, lengthFt: 924, line: [{ x: 0, y: 0 }, { x: -280, y: 330 }, { x: -160, y: 610 }, { x: 0, y: 710 }], widthFt: 170, rough: "ob", trees: "mixed", note: "Left off the tee along the tall grass, then right around the woods", ref: { url: BOOK, page: 37 } },
];

export const BAD_ROCK_CREEK: ProCourse = {
  id: "bad-rock-creek",
  name: "Bad Rock Creek",
  city: "Liberty, MO",
  layoutLabel: "MPO",
  theme: "classic",
  book: BOOK,
  holes: HOLES,
};
