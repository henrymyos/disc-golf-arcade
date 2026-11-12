// Sunset Hills, Pekin IL: Ledgestone Open (DGPT Elite+), Jul 30–Aug 2 2026.
// FPO, par 61, 7,602 ft. The book is FPO only (the course is the event's FPO
// venue), so this is the second FPO layout after Brighton. Facts from the
// public 2026 caddie book (Google Drive PDF, linked from the DGPT event page,
// hole n = page n+6). Hand-placed and rounded to 10 ft in our own format (see
// ./types). Nothing from the book's map art is copied, traced or stored; the
// game draws its own holes.
// A golf course: the traditional golf greens, tee boxes and practice greens
// are OB (drawn as OB patches), sand traps are hazards, ponds on 4, 5, 6, 9, 11
// and 12, OB lines along cart paths and tall grass, the island green on 13
// with its tee-shot DZ. No elevation is printed, so every hole is flat.
// Balance: balanceTrees pairs (not in the book) ~40 ft short of 8's and 10's
// greens with a ~20 ft gap on the tee-to-basket line (hole-only probes: Lv1 aces
// 45% -> 16% and 43% -> 26%). 5 (246 ft over the pond) still gives Lv1 aces
// ~34%; the pond beside its green leaves no room for a pair. 100-round probe
// (Nov 12) −10.2 / −12.8 / −8.6 (Lv1 / Lv5 / Lv12) vs the +1.9 / −3.1 / +0.4
// baseline: an FPO layout ~2,000 ft shorter than the MPO courses, like Brighton
// (held). It ships because the band is advisory since Oct 24; Henry may hold it.
import type { ProCourse, ProHole } from "./types";

const BOOK = "https://drive.google.com/file/d/1YaClskK_mTv9PFWAKhjfept-LGNgm-3G/view";

const HOLES: ProHole[] = [
  { n: 1, par: 4, lengthFt: 636, line: [{ x: 0, y: 0 }, { x: -20, y: 180 }, { x: -30, y: 370 }, { x: -50, y: 490 }, { x: -70, y: 630 }], widthFt: 200, rough: "hazard", obZones: [{ x: -190, y: -40, w: 130, h: 300 }, { x: -190, y: 260, w: 80, h: 150 }, { x: -190, y: 440, w: 10, h: 220 }], trees: "mixed", note: "Opener up an open fairway with the woods and lake OB down the left", ref: { url: BOOK, page: 7 } },
  { n: 2, par: 3, lengthFt: 313, line: [{ x: 0, y: 0 }, { x: 0, y: 160 }, { x: -10, y: 310 }], widthFt: 180, rough: "hazard", obZones: [{ x: -100, y: -50, w: 50, h: 420 }, { x: -50, y: -50, w: 40, h: 110 }, { x: -50, y: 370, w: 140, h: 70 }], trees: "mixed", note: "Short shot past scattered trees, the cart path OB left and long", ref: { url: BOOK, page: 8 } },
  { n: 3, par: 3, lengthFt: 384, line: [{ x: 0, y: 0 }, { x: 0, y: 190 }, { x: 0, y: 380 }], widthFt: 180, rough: "hazard", obZones: [{ x: -80, y: 420, w: 70, h: 60 }, { x: 40, y: 390, w: 80, h: 120 }, { x: 70, y: 270, w: 50, h: 120 }], hazard: [{ x: -40, y: 370, d: 30 }, { x: 10, y: 400, d: 20 }, { x: 10, y: 360, d: 20 }], trees: "mixed", note: "Straight to a green ringed by sand, a golf green OB long-left", ref: { url: BOOK, page: 9 } },
  { n: 4, par: 3, lengthFt: 345, line: [{ x: 0, y: 0 }, { x: 10, y: 180 }, { x: 10, y: 340 }], widthFt: 180, rough: "hazard", water: [{ x: -20, y: 240, w: 150, h: 40 }, { x: 50, y: 280, w: 80, h: 50 }, { x: 0, y: 280, w: 50, h: 20 }], obZones: [{ x: -70, y: 20, w: 60, h: 200 }, { x: 50, y: 370, w: 70, h: 70 }], hazard: [{ x: 50, y: 360, d: 20 }], trees: "mixed", note: "Over the pond to a green with a golf green OB long-right", ref: { url: BOOK, page: 10 } },
  { n: 5, par: 3, lengthFt: 246, line: [{ x: 0, y: 0 }, { x: 0, y: 120 }, { x: 0, y: 240 }], widthFt: 180, rough: "hazard", water: [{ x: -60, y: 30, w: 140, h: 120 }, { x: -90, y: 170, w: 70, h: 140 }], trees: "open", note: "Short carry over the big pond to a green between two ponds", ref: { url: BOOK, page: 11 } },
  { n: 6, par: 5, lengthFt: 712, line: [{ x: 0, y: 0 }, { x: -40, y: 160 }, { x: -100, y: 330 }, { x: -140, y: 470 }, { x: -150, y: 690 }], widthFt: 180, rough: "hazard", water: [{ x: -230, y: 510, w: 170, h: 150 }], obZones: [{ x: 10, y: 30, w: 60, h: 450 }, { x: -20, y: 480, w: 90, h: 180 }, { x: -110, y: 640, w: 40, h: 60 }], hazard: [{ x: -200, y: 760, d: 40 }], trees: "mixed", note: "Lay up to the pond's edge, then carry it to the green; cart path OB right", ref: { url: BOOK, page: 12 } },
  { n: 7, par: 4, lengthFt: 633, line: [{ x: 0, y: 0 }, { x: -30, y: 160 }, { x: -100, y: 330 }, { x: -120, y: 450 }, { x: -110, y: 610 }], widthFt: 170, rough: "ob", trees: "mixed", note: "Between marked OB lines left and right, drifting left to the green", ref: { url: BOOK, page: 13 } },
  { n: 8, par: 3, lengthFt: 292, line: [{ x: 0, y: 0 }, { x: -10, y: 150 }, { x: -30, y: 290 }], widthFt: 190, rough: "hazard", obZones: [{ x: 50, y: 10, w: 20, h: 230 }, { x: 20, y: 310, w: 50, h: 60 }], hazard: [{ x: 10, y: 300, d: 20 }, { x: 40, y: 280, d: 20 }, { x: -100, y: 230, d: 30 }], balanceTrees: [{ x: 0, y: 250, r: 20 }, { x: -60, y: 250, r: 20 }], trees: "mixed", note: "Open short par 3 with sand right of the green and OB right", ref: { url: BOOK, page: 14 } },
  { n: 9, par: 4, lengthFt: 533, line: [{ x: 0, y: 0 }, { x: -30, y: 150 }, { x: -50, y: 260 }, { x: -60, y: 370 }, { x: -70, y: 460 }, { x: -90, y: 520 }], widthFt: 150, rough: "hazard", water: [{ x: -120, y: 430, w: 70, h: 80 }, { x: -120, y: 370, w: 30, h: 60 }], obZones: [{ x: -40, y: 460, w: 10, h: 20 }, { x: -10, y: 460, w: 110, h: 70 }, { x: 30, y: 340, w: 70, h: 120 }, { x: -150, y: 290, w: 40, h: 70 }], trees: "mixed", note: "Up a tree-lined fairway to a green tucked behind a pond on the left", ref: { url: BOOK, page: 15 } },
  { n: 10, par: 3, lengthFt: 301, line: [{ x: 0, y: 0 }, { x: -30, y: 140 }, { x: -60, y: 250 }, { x: -80, y: 290 }], widthFt: 150, rough: "hazard", obZones: [{ x: -10, y: 200, w: 40, h: 80 }, { x: -120, y: 70, w: 40, h: 150 }, { x: -120, y: 340, w: 170, h: 60 }], balanceTrees: [{ x: -40, y: 260, r: 20 }, { x: -100, y: 240, r: 20 }], trees: "mixed", note: "Up and left past the barn (OB) to a green with backyards OB long", ref: { url: BOOK, page: 16 } },
  { n: 11, par: 3, lengthFt: 383, line: [{ x: 0, y: 0 }, { x: -20, y: 170 }, { x: -70, y: 370 }], widthFt: 180, rough: "hazard", water: [{ x: -60, y: 380, w: 60, h: 80 }], obZones: [{ x: -160, y: 290, w: 40, h: 50 }, { x: -160, y: 340, w: 70, h: 70 }, { x: -160, y: 460, w: 200, h: 40 }], trees: "open", note: "Open field shot to a green with a pond long-right, homes OB long", ref: { url: BOOK, page: 17 } },
  { n: 12, par: 3, lengthFt: 400, line: [{ x: 0, y: 0 }, { x: 30, y: 110 }, { x: 60, y: 200 }, { x: 90, y: 300 }, { x: 100, y: 380 }], widthFt: 180, rough: "hazard", water: [{ x: 120, y: 250, w: 50, h: 220 }], obZones: [{ x: 0, y: 280, w: 20, h: 30 }, { x: 10, y: 350, w: 40, h: 50 }], trees: "mixed", note: "Works right up toward the pond (OB right), practice greens OB left", ref: { url: BOOK, page: 18 } },
  { n: 13, par: 3, lengthFt: 280, line: [{ x: 0, y: 0 }, { x: -20, y: 140 }, { x: -50, y: 270 }], widthFt: 150, rough: "ob", obZones: [{ x: -120, y: 200, w: 160, h: 40 }, { x: -120, y: 240, w: 30, h: 70 }, { x: -20, y: 240, w: 60, h: 70 }, { x: -120, y: 310, w: 160, h: 40 }], islandGreen: true, dropZone: { x: -50, y: 190 }, trees: "open", note: "Island green ringed by OB tall grass; a missed tee shot plays from the DZ", ref: { url: BOOK, page: 19 } },
  { n: 14, par: 3, lengthFt: 329, line: [{ x: 0, y: 0 }, { x: -10, y: 110 }, { x: -20, y: 210 }, { x: -30, y: 280 }, { x: -40, y: 320 }], widthFt: 150, rough: "ob", trees: "mixed", note: "Narrow fairway with OB tall grass both sides to a wooded green", ref: { url: BOOK, page: 20 } },
  { n: 15, par: 4, lengthFt: 555, line: [{ x: 0, y: 0 }, { x: 70, y: 120 }, { x: 130, y: 230 }, { x: 140, y: 310 }, { x: 110, y: 390 }, { x: 40, y: 490 }], widthFt: 150, rough: "hazard", obZones: [{ x: -30, y: 50, w: 20, h: 70 }, { x: -30, y: 120, w: 60, h: 100 }, { x: -30, y: 220, w: 110, h: 80 }, { x: -30, y: 300, w: 140, h: 60 }, { x: 110, y: -40, w: 90, h: 120 }, { x: 160, y: 80, w: 40, h: 130 }, { x: 160, y: 420, w: 40, h: 120 }], trees: "mixed", note: "Up the right past the OB on the left, then back left to the green", ref: { url: BOOK, page: 21 } },
  { n: 16, par: 3, lengthFt: 352, line: [{ x: 0, y: 0 }, { x: -30, y: 150 }, { x: -60, y: 260 }, { x: -80, y: 340 }], widthFt: 150, rough: "hazard", obZones: [{ x: -150, y: 150, w: 40, h: 30 }, { x: -150, y: 90, w: 70, h: 60 }, { x: -150, y: 20, w: 100, h: 70 }, { x: -150, y: 180, w: 20, h: 170 }, { x: 10, y: 300, w: 20, h: 40 }], trees: "mixed", note: "Up and left past tall grass OB on the left to a wooded green", ref: { url: BOOK, page: 22 } },
  { n: 17, par: 4, lengthFt: 525, line: [{ x: 0, y: 0 }, { x: -30, y: 110 }, { x: -50, y: 230 }, { x: -40, y: 340 }, { x: -30, y: 420 }, { x: -10, y: 520 }], widthFt: 150, rough: "hazard", obZones: [{ x: 0, y: 40, w: 50, h: 140 }, { x: -160, y: 260, w: 20, h: 150 }, { x: -160, y: 150, w: 40, h: 110 }, { x: -160, y: 90, w: 80, h: 60 }], trees: "mixed", mando: "Left of the marked tree midway", note: "Up a lane with tall grass OB left, past a mando tree to the green", ref: { url: BOOK, page: 23 } },
  { n: 18, par: 3, lengthFt: 383, line: [{ x: 0, y: 0 }, { x: -20, y: 180 }, { x: -60, y: 370 }], widthFt: 180, rough: "hazard", obZones: [{ x: 10, y: 300, w: 50, h: 110 }, { x: -110, y: 260, w: 30, h: 30 }, { x: -30, y: 160, w: 60, h: 30 }], trees: "mixed", note: "Finisher over a practice green (OB) to a basket by the patio (OB right)", ref: { url: BOOK, page: 24 } },
];

export const SUNSET_HILLS: ProCourse = {
  id: "sunset-hills",
  name: "Sunset Hills",
  city: "Pekin, IL",
  layoutLabel: "FPO",
  theme: "classic",
  book: BOOK,
  holes: HOLES,
};
