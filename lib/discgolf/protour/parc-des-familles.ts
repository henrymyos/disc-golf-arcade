// Parc des Familles (Grand Cypress Bayou), Jefferson Parish LA: Big Easy Open
// (DGPT Elite), Mar 13–15 2026. MPO, par 69, 12,370 ft: the longest course on
// the tour so far. Facts from the public 2026 caddie book (Google Drive PDF,
// linked from the DGPT event page); each hole cites its MPO page (every hole but
// 8, 17 and 18 has separate FPO and MPO pages, FPO first). Hand-placed and
// rounded to 10 ft in our own format (see ./types). Nothing from the book's map
// art is copied, traced or stored; the game draws its own holes.
// Flat bayou woods: long wooded lanes (several split by a tree island, drawn as
// one corridor), the canal OB along 3, 4, 14 and 16, marked ponds on 1, 4, 13
// and 14, and the road and sidewalk OB on 1, 5, 17 and 18. Holes 6, 7, 9–12 and
// 15 have no OB (hazard rough). No elevation is printed, so every hole is flat.
// The book has no drop zones and no mandatories.
// Balance: one balanceTrees pair (r 20, not in the book) 50 ft short of the
// green on 10, the 293 ft par 3 (Lv1 aces 37% without it). No other levers.
// 100-round probe (Nov 12) +3.4 / −0.8 / +4.5 (Lv1 / Lv5 / Lv12) vs the +1.9 /
// −3.1 / +0.4 baseline: the longest course plays hard, shipped anyway (band is
// advisory). With the pair, 10 aces 19 / 12 / 12% (300 rounds).
import type { ProCourse, ProHole } from "./types";

const BOOK = "https://drive.google.com/file/d/11x2oWbeplCAsbXxnF5Fou6yqit6xsNga/view";

const HOLES: ProHole[] = [
  { n: 1, par: 4, lengthFt: 838, line: [{ x: 0, y: 0 }, { x: -50, y: 420 }, { x: -120, y: 820 }], widthFt: 190, rough: "hazard", water: [{ x: -10, y: 60, w: 120, h: 50 }, { x: -70, y: 110, w: 180, h: 100 }, { x: -50, y: 210, w: 160, h: 100 }, { x: -30, y: 310, w: 140, h: 100 }, { x: -170, y: 490, w: 170, h: 120 }], obZones: [{ x: 70, y: 430, w: 60, h: 200 }, { x: -40, y: 630, w: 150, h: 280 }, { x: -230, y: 700, w: 90, h: 180 }], trees: "mixed", note: "Over the pond and a marked pond island, the road OB right and long", ref: { url: BOOK, page: 7 } },
  { n: 2, par: 4, lengthFt: 825, line: [{ x: 0, y: 0 }, { x: 40, y: 410 }, { x: -10, y: 810 }], widthFt: 150, rough: "hazard", obZones: [{ x: 120, y: 100, w: 30, h: 350 }], trees: "wooded", note: "Long wooded lane split by a tree island, the property line OB right", ref: { url: BOOK, page: 9 } },
  { n: 3, par: 3, lengthFt: 333, line: [{ x: 0, y: 0 }, { x: -10, y: 170 }, { x: -20, y: 330 }], widthFt: 150, rough: "hazard", water: [{ x: -130, y: 370, w: 120, h: 70 }, { x: -10, y: 350, w: 120, h: 90 }], trees: "wooded", note: "Short wooded par 3 to a green just short of the canal OB", ref: { url: BOOK, page: 11 } },
  { n: 4, par: 5, lengthFt: 1046, line: [{ x: 0, y: 0 }, { x: -100, y: 520 }, { x: -200, y: 1020 }], widthFt: 150, rough: "hazard", water: [{ x: 70, y: 0, w: 40, h: 200 }, { x: 20, y: 200, w: 90, h: 200 }, { x: -30, y: 400, w: 140, h: 200 }, { x: -80, y: 600, w: 190, h: 200 }, { x: -130, y: 800, w: 240, h: 200 }, { x: -170, y: 1000, w: 280, h: 130 }], obZones: [{ x: -130, y: 400, w: 100, h: 50 }], trees: "mixed", note: "1,046 ft along the canal OB on the right, past a marked pond mid-fairway", ref: { url: BOOK, page: 13 } },
  { n: 5, par: 3, lengthFt: 398, line: [{ x: 0, y: 0 }, { x: 0, y: 200 }, { x: -10, y: 390 }], widthFt: 150, rough: "hazard", obZones: [{ x: -120, y: 0, w: 30, h: 500 }], trees: "wooded", note: "Straight wooded par 3 with the sidewalk OB left", ref: { url: BOOK, page: 15 } },
  { n: 6, par: 4, lengthFt: 714, line: [{ x: 0, y: 0 }, { x: -60, y: 350 }, { x: -140, y: 700 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "Long wooded par 4 drifting left, no OB", ref: { url: BOOK, page: 17 } },
  { n: 7, par: 5, lengthFt: 969, line: [{ x: 0, y: 0 }, { x: -80, y: 470 }, { x: -190, y: 940 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "969 ft par 5 up two lanes split by a long tree island", ref: { url: BOOK, page: 19 } },
  { n: 8, par: 4, lengthFt: 748, line: [{ x: 0, y: 0 }, { x: 100, y: 290 }, { x: 0, y: 470 }, { x: -10, y: 710 }], widthFt: 150, rough: "hazard", obZones: [{ x: 110, y: 140, w: 90, h: 90 }], trees: "mixed", note: "Right out to the clearing, then back left through the gap to the green", ref: { url: BOOK, page: 20 } },
  { n: 9, par: 3, lengthFt: 382, line: [{ x: 0, y: 0 }, { x: 0, y: 190 }, { x: 0, y: 380 }], widthFt: 150, rough: "hazard", trees: "mixed", note: "Straight up an open lane to a green inside the bend of a path", ref: { url: BOOK, page: 22 } },
  { n: 10, par: 3, lengthFt: 293, line: [{ x: 0, y: 0 }, { x: -10, y: 150 }, { x: -10, y: 290 }], widthFt: 150, rough: "hazard", balanceTrees: [{ x: 20, y: 240, r: 20 }, { x: -40, y: 240, r: 20 }], trees: "mixed", note: "Short par 3 up a widening lane", ref: { url: BOOK, page: 24 } },
  { n: 11, par: 3, lengthFt: 369, line: [{ x: 0, y: 0 }, { x: 0, y: 180 }, { x: 0, y: 360 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "Straight down a wooded tunnel", ref: { url: BOOK, page: 26 } },
  { n: 12, par: 5, lengthFt: 994, line: [{ x: 0, y: 0 }, { x: -100, y: 480 }, { x: -230, y: 960 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "994 ft par 5 up crossing wooded lanes, no OB", ref: { url: BOOK, page: 28 } },
  { n: 13, par: 4, lengthFt: 785, line: [{ x: 0, y: 0 }, { x: -10, y: 510 }, { x: -80, y: 720 }, { x: -130, y: 770 }], widthFt: 150, rough: "hazard", water: [{ x: -190, y: 790, w: 70, h: 50 }], obZones: [{ x: 20, y: 220, w: 90, h: 110 }], trees: "wooded", note: "Up the lane and left to a green with a marked pond just behind it", ref: { url: BOOK, page: 30 } },
  { n: 14, par: 4, lengthFt: 860, line: [{ x: 0, y: 0 }, { x: -110, y: 420 }, { x: -190, y: 610 }, { x: -160, y: 840 }], widthFt: 150, rough: "hazard", water: [{ x: -200, y: 0, w: 130, h: 80 }, { x: -300, y: 80, w: 140, h: 100 }, { x: -130, y: 330, w: 40, h: 100 }], trees: "wooded", note: "Off the canal OB, past a marked pond in the fairway, up a split lane", ref: { url: BOOK, page: 32 } },
  { n: 15, par: 3, lengthFt: 448, line: [{ x: 0, y: 0 }, { x: -20, y: 230 }, { x: -30, y: 440 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "Long par 3 up a wooded lane, no OB", ref: { url: BOOK, page: 34 } },
  { n: 16, par: 5, lengthFt: 1077, line: [{ x: 0, y: 0 }, { x: -30, y: 540 }, { x: -10, y: 1070 }], widthFt: 150, rough: "hazard", water: [{ x: -140, y: 950, w: 30, h: 230 }], trees: "wooded", note: "1,077 ft up the wooded lanes along the canal, OB left near the green", ref: { url: BOOK, page: 36 } },
  { n: 17, par: 3, lengthFt: 449, line: [{ x: 0, y: 0 }, { x: -10, y: 220 }, { x: -30, y: 440 }], widthFt: 150, rough: "hazard", obZones: [{ x: 50, y: 330, w: 60, h: 220 }], trees: "open", note: "Long open par 3 in the park, the sidewalk and lot OB right", ref: { url: BOOK, page: 37 } },
  { n: 18, par: 4, lengthFt: 842, line: [{ x: 0, y: 0 }, { x: -70, y: 430 }, { x: 30, y: 840 }], widthFt: 150, rough: "hazard", obZones: [{ x: 100, y: 150, w: 40, h: 300 }, { x: 60, y: 450, w: 80, h: 500 }], trees: "wooded", note: "Left up the lanes, then back right to a green by the sidewalk OB", ref: { url: BOOK, page: 38 } },
];

export const PARC_DES_FAMILLES: ProCourse = {
  id: "parc-des-familles",
  name: "Parc des Familles",
  city: "Jefferson Parish, LA",
  layoutLabel: "MPO",
  theme: "classic",
  book: BOOK,
  holes: HOLES,
};
