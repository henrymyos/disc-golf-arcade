// Eureka Lake, Eureka IL: Ledgestone Open (DGPT Elite+), Jul 30–Aug 2 2026.
// MPO, par 63, 9,819 ft (a temporary course; the event also plays Sunset
// Hills and Northwood Black). Facts from the public 2026 caddie book (Google
// Drive PDF, linked from the DGPT event page, MPO only, hole n = page n+7).
// Hand-placed and rounded to 10 ft in our own format (see ./types). Nothing
// from the book's map art is copied, traced or stored; the game draws its own
// holes.
// Staked lanes through the woods round the lake: most holes are "outside the
// staked area is OB" (OB rough); the lake carries on 13 (peninsula) and 17
// (island green); 9 tees off a bridge over OB to a staked landing area; 12 is
// a staked oval green over an OB gap. No elevation is printed.
// Drop zones (tee shots only, as the book says): 1, 5, 9, 12, 13 and 17. The
// mando DZs (4, 15, 16) are off; 8's optional ("may proceed") DZ is off.
// Balance: one lever, as on Kippis 2: a balanceTrees pair (not in the book) ~50
// ft short of 11's green, off the creek (hole-only probe: Lv1 aces 35% -> 25%).
// 100-round probe (Nov 12) +0.0 / −4.7 / +2.2 (Lv1 / Lv5 / Lv12) vs the +1.9 /
// −3.1 / +0.4 baseline; advisory only since Oct 24.
import type { ProCourse, ProHole } from "./types";

const BOOK = "https://drive.google.com/file/d/1NjqPaUCWlPiG5uP6qFZcRxJoIe1b1nL6/view";

const HOLES: ProHole[] = [
  { n: 1, par: 4, lengthFt: 661, line: [{ x: 0, y: 0 }, { x: 40, y: 130 }, { x: 100, y: 320 }, { x: 110, y: 440 }, { x: 50, y: 540 }, { x: -40, y: 560 }], widthFt: 150, rough: "hazard", water: [{ x: -130, y: 150, w: 90, h: 390 }, { x: -40, y: 150, w: 70, h: 290 }, { x: 30, y: 160, w: 50, h: 160 }], dropZone: { x: 120, y: 170 }, trees: "mixed", mando: "Left of the marked tree off the tee", note: "Up the lake's right shore past a mando tree, then left to the green; the lake is OB", ref: { url: BOOK, page: 8 } },
  { n: 2, par: 4, lengthFt: 615, line: [{ x: 0, y: 0 }, { x: -70, y: 220 }, { x: -120, y: 390 }, { x: -140, y: 490 }, { x: -100, y: 590 }], widthFt: 150, rough: "ob", trees: "wooded", note: "Long wooded lane up the river's edge; road, pier and woods outside the stakes OB", ref: { url: BOOK, page: 9 } },
  { n: 3, par: 3, lengthFt: 293, line: [{ x: 0, y: 0 }, { x: 0, y: 150 }, { x: 0, y: 290 }], widthFt: 150, rough: "ob", trees: "wooded", note: "Straight staked tunnel; pavement left, OB right and long of the basket", ref: { url: BOOK, page: 10 } },
  { n: 4, par: 3, lengthFt: 423, line: [{ x: 0, y: 0 }, { x: -20, y: 200 }, { x: -50, y: 330 }, { x: -60, y: 410 }], widthFt: 150, rough: "hazard", obZones: [{ x: 40, y: 150, w: 40, h: 130 }, { x: 0, y: 280, w: 80, h: 150 }], trees: "wooded", mando: "Left of the marked tree midway", note: "Wooded lane drifting left past a mando tree, the path OB right", ref: { url: BOOK, page: 11 } },
  { n: 5, par: 3, lengthFt: 476, line: [{ x: 0, y: 0 }, { x: 80, y: 160 }, { x: 110, y: 250 }, { x: 60, y: 350 }, { x: -10, y: 410 }], widthFt: 150, rough: "ob", dropZone: { x: 180, y: 150 }, trees: "mixed", note: "Big hyzer around the baseball field (OB) inside the bend; tee-shot DZ", ref: { url: BOOK, page: 12 } },
  { n: 6, par: 4, lengthFt: 885, line: [{ x: 0, y: 0 }, { x: -60, y: 110 }, { x: -160, y: 310 }, { x: -190, y: 510 }, { x: -180, y: 710 }, { x: -140, y: 830 }], widthFt: 160, rough: "ob", trees: "mixed", note: "885 ft up a staked fairway bending left, then back right to the green", ref: { url: BOOK, page: 13 } },
  { n: 7, par: 3, lengthFt: 275, line: [{ x: 0, y: 0 }, { x: 0, y: 150 }, { x: 0, y: 270 }], widthFt: 150, rough: "ob", trees: "wooded", note: "Narrow tunnel with the creek OB left and the road OB right", ref: { url: BOOK, page: 14 } },
  { n: 8, par: 4, lengthFt: 793, line: [{ x: 0, y: 0 }, { x: -10, y: 210 }, { x: -20, y: 390 }, { x: -50, y: 570 }, { x: -110, y: 700 }, { x: -140, y: 770 }], widthFt: 220, rough: "ob", water: [{ x: -210, y: 670, w: 30, h: 160 }, { x: -90, y: 710, w: 50, h: 60 }], trees: "mixed", note: "Through a gap into an open field, then left to a green in a creek bend", ref: { url: BOOK, page: 15 } },
  { n: 9, par: 3, lengthFt: 354, line: [{ x: 0, y: 0 }, { x: 10, y: 180 }, { x: 30, y: 350 }], widthFt: 150, rough: "ob", obZones: [{ x: -70, y: 100, w: 180, h: 80 }, { x: 0, y: 180, w: 110, h: 130 }], dropZone: { x: 10, y: 90 }, trees: "open", note: "Off a bridge over OB to a staked landing area round the pin; tee-shot DZ", ref: { url: BOOK, page: 16 } },
  { n: 10, par: 3, lengthFt: 425, line: [{ x: 0, y: 0 }, { x: 10, y: 210 }, { x: 10, y: 420 }], widthFt: 220, rough: "ob", trees: "mixed", note: "Long open field shot past a tree clump right, woods OB all round", ref: { url: BOOK, page: 17 } },
  { n: 11, par: 3, lengthFt: 300, line: [{ x: 0, y: 0 }, { x: -10, y: 150 }, { x: -30, y: 290 }], widthFt: 150, rough: "ob", water: [{ x: 20, y: -40, w: 50, h: 390 }], balanceTrees: [{ x: 0, y: 250, r: 10 }, { x: -60, y: 240, r: 20 }], trees: "mixed", note: "Narrow staked strip with the creek OB down the right", ref: { url: BOOK, page: 18 } },
  { n: 12, par: 3, lengthFt: 364, line: [{ x: 0, y: 0 }, { x: -30, y: 180 }, { x: -70, y: 350 }], widthFt: 200, rough: "ob", obZones: [{ x: -140, y: 180, w: 180, h: 100 }], islandGreen: true, dropZone: { x: -50, y: 160 }, trees: "open", note: "Over an OB gap to a staked oval green; tee-shot DZ short of the gap", ref: { url: BOOK, page: 19 } },
  { n: 13, par: 5, lengthFt: 1105, line: [{ x: 0, y: 0 }, { x: -200, y: 300 }, { x: -240, y: 560 }, { x: -220, y: 760 }, { x: -180, y: 910 }, { x: -130, y: 1020 }], widthFt: 150, rough: "ob", water: [{ x: -180, y: 50, w: 170, h: 220 }, { x: -140, y: 300, w: 150, h: 650 }, { x: -80, y: 950, w: 90, h: 150 }], dropZone: { x: -220, y: 300 }, trees: "mixed", note: "Carry the lake onto a long peninsula, the water OB right to the green", ref: { url: BOOK, page: 20 } },
  { n: 14, par: 4, lengthFt: 850, line: [{ x: 0, y: 0 }, { x: -60, y: 150 }, { x: -150, y: 310 }, { x: -180, y: 500 }, { x: -160, y: 670 }, { x: -130, y: 800 }], widthFt: 160, rough: "ob", water: [{ x: -110, y: 320, w: 70, h: 350 }], trees: "wooded", note: "Bends left along the lake (OB right), staked woods left, to a tucked green", ref: { url: BOOK, page: 21 } },
  { n: 15, par: 3, lengthFt: 348, line: [{ x: 0, y: 0 }, { x: -10, y: 160 }, { x: -30, y: 260 }, { x: -40, y: 340 }], widthFt: 150, rough: "ob", trees: "mixed", mando: "Left of the marked pole midway", note: "Past a mando pole to a green ringed by woods; the bike path right is OB", ref: { url: BOOK, page: 22 } },
  { n: 16, par: 4, lengthFt: 606, line: [{ x: 0, y: 0 }, { x: -30, y: 160 }, { x: -90, y: 290 }, { x: -90, y: 400 }, { x: -60, y: 500 }, { x: -40, y: 580 }], widthFt: 160, rough: "ob", trees: "wooded", mando: "Left of the marked pole midway", note: "Winding wooded lane past a mando pole, the road OB right", ref: { url: BOOK, page: 23 } },
  { n: 17, par: 3, lengthFt: 335, line: [{ x: 0, y: 0 }, { x: 40, y: 170 }, { x: 70, y: 320 }], widthFt: 150, rough: "ob", water: [{ x: -70, y: 40, w: 250, h: 240 }], islandGreen: true, dropZone: { x: 100, y: 380 }, trees: "open", note: "Island green across the lake; a tee shot that misses plays from the DZ", ref: { url: BOOK, page: 24 } },
  { n: 18, par: 4, lengthFt: 711, line: [{ x: 0, y: 0 }, { x: 40, y: 130 }, { x: 50, y: 300 }, { x: 20, y: 460 }, { x: -20, y: 620 }, { x: -40, y: 690 }], widthFt: 180, rough: "ob", water: [{ x: -110, y: 90, w: 120, h: 490 }, { x: -110, y: 580, w: 40, h: 130 }], trees: "mixed", mando: "Left of the marked tree off the tee", note: "Finisher up the lake's right shore past a mando tree, water OB left", ref: { url: BOOK, page: 25 } },
];

export const EUREKA_LAKE: ProCourse = {
  id: "eureka-lake",
  name: "Eureka Lake",
  city: "Eureka, IL",
  layoutLabel: "MPO",
  theme: "classic",
  book: BOOK,
  holes: HOLES,
};
