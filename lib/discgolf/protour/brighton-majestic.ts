// Brighton "Majestic", Brighton ski resort UT: US Women's Disc Golf
// Championship (Major), Jul 16–19 2026. FPO (the event is FPO-only), par 62,
// 7,375 ft: the tour's first FPO layout and its mountain course. Facts from the
// public 2026 caddie book on Parkdly; each hole cites its PDF page. Hand-placed
// and rounded to 10 ft in our own format (see ./types). Nothing from the book's
// map art is copied, traced or stored; the game draws its own holes.
// Slopes from each page's printed elevation change (under 15 ft flat, 15–40 ft
// ±1, over 40 ft ±2): 9 climbs; 10, 13, 15 and 17 drop hard. 18 prints none.
// OB: strung lanes (rough OB) on 10, 12 and 18; the island green on 14; an OB
// island mid-fairway on 6 and an OB area at the elbow of 7; one-sided strips
// elsewhere, with the woods as hazard rough. The creek on 1 is a relief area
// (hazard), not OB. Drop zones: dzAll on 6; tee shots only on 7 (the FP40 pad),
// 14 (moved onto the island's edge) and 18 (DZ2). Mando and lost-disc DZs are off.
// balanceTrees (r 20, approach trees not in the book): 1, 2, 3, 4, 5, 7, 8, 11,
// 12, 13, 15 and 16; none on the signature holes 6, 9, 10, 14, 17 and 18.
// Every corridor is already at the 150 ft minimum. Even so this short FPO course
// plays well under par for the arcade golfer (see the wave 3 hand-back).
import type { ProCourse, ProHole } from "./types";

const BOOK = "https://parkdly.com/p/uswdgc/brighton-caddie-book";

const HOLES: ProHole[] = [
  { n: 1, par: 4, lengthFt: 659, line: [{ x: 0, y: 0 }, { x: 20, y: 330 }, { x: 110, y: 640 }], widthFt: 150, rough: "hazard", obZones: [{ x: -110, y: 20, w: 40, h: 250 }, { x: -100, y: 270, w: 50, h: 180 }, { x: -80, y: 450, w: 50, h: 100 }, { x: 0, y: 570, w: 50, h: 80 }], hazard: [{ x: -40, y: 320, d: 40 }, { x: 0, y: 320, d: 40 }, { x: 40, y: 320, d: 40 }, { x: 80, y: 320, d: 40 }], balanceTrees: [{ x: 130, y: 580, r: 20 }], trees: "mixed", elev: -1, note: "Down the lane with OB left, over the creek relief area at 335 ft, bending right", ref: { url: BOOK, page: 3 } },
  { n: 2, par: 3, lengthFt: 344, line: [{ x: 0, y: 0 }, { x: 10, y: 340 }], widthFt: 150, rough: "hazard", obZones: [{ x: 50, y: 40, w: 60, h: 250 }, { x: 60, y: 290, w: 60, h: 80 }], balanceTrees: [{ x: -20, y: 300, r: 20 }], trees: "mixed", note: "Straight downhill par 3 through the trees with OB right", ref: { url: BOOK, page: 4 } },
  { n: 3, par: 3, lengthFt: 269, line: [{ x: 0, y: 0 }, { x: -40, y: 260 }], widthFt: 150, rough: "hazard", obZones: [{ x: 40, y: 20, w: 60, h: 290 }], balanceTrees: [{ x: -60, y: 220, r: 20 }, { x: 0, y: 230, r: 20 }], trees: "mixed", note: "Short climb, drifting left, with the OB line right", ref: { url: BOOK, page: 5 } },
  { n: 4, par: 3, lengthFt: 269, line: [{ x: 0, y: 0 }, { x: 10, y: 130 }, { x: 40, y: 260 }], widthFt: 150, rough: "hazard", obZones: [{ x: 60, y: 40, w: 40, h: 240 }], balanceTrees: [{ x: 0, y: 230, r: 20 }], trees: "mixed", note: "Short par 3 fading right to a green by the creek; OB right", ref: { url: BOOK, page: 6 } },
  { n: 5, par: 4, lengthFt: 472, line: [{ x: 0, y: 0 }, { x: 0, y: 230 }, { x: 40, y: 340 }, { x: 150, y: 410 }], widthFt: 150, rough: "hazard", balanceTrees: [{ x: 90, y: 420, r: 20 }, { x: 130, y: 350, r: 20 }], trees: "mixed", note: "Straight up the lane from the FPO tee, then right to the green", ref: { url: BOOK, page: 7 } },
  { n: 6, par: 3, lengthFt: 282, line: [{ x: 0, y: 0 }, { x: 10, y: 280 }], widthFt: 150, rough: "hazard", obZones: [{ x: -40, y: 110, w: 90, h: 110 }], dropZone: { x: 30, y: 250 }, dzAll: true, trees: "mixed", note: "OB island in the middle of the fairway: go around it or over it", ref: { url: BOOK, page: 8 } },
  { n: 7, par: 5, lengthFt: 696, line: [{ x: 0, y: 0 }, { x: -240, y: 260 }, { x: -230, y: 330 }, { x: -70, y: 570 }], widthFt: 150, rough: "hazard", obZones: [{ x: -180, y: 20, w: 90, h: 50 }, { x: -260, y: 70, w: 100, h: 80 }], dropZone: { x: -250, y: 230 }, balanceTrees: [{ x: -120, y: 550, r: 20 }, { x: -70, y: 510, r: 20 }], trees: "mixed", mando: "Pass left of the marked tree", note: "Out left past the OB in the fairway, then a long sweep back right", ref: { url: BOOK, page: 9 } },
  { n: 8, par: 3, lengthFt: 256, line: [{ x: 0, y: 0 }, { x: -10, y: 90 }, { x: 90, y: 230 }], widthFt: 150, rough: "hazard", obZones: [{ x: 30, y: 20, w: 80, h: 90 }, { x: 80, y: 110, w: 60, h: 60 }, { x: 150, y: 190, w: 40, h: 110 }, { x: -60, y: 290, w: 240, h: 40 }], balanceTrees: [{ x: 40, y: 210, r: 20 }], trees: "mixed", elev: -1, note: "Up, then right around the corner to a green with OB right and long", ref: { url: BOOK, page: 10 } },
  { n: 9, par: 4, lengthFt: 338, line: [{ x: 0, y: 0 }, { x: 0, y: 150 }, { x: -30, y: 240 }, { x: -100, y: 310 }], widthFt: 150, rough: "hazard", obZones: [{ x: 60, y: 80, w: 50, h: 120 }, { x: 40, y: 200, w: 70, h: 120 }, { x: -60, y: 350, w: 170, h: 50 }], trees: "mixed", elev: 2, note: "Climbs 56 ft and hooks left, with OB on the outside of the bend", ref: { url: BOOK, page: 11 } },
  { n: 10, par: 3, lengthFt: 341, line: [{ x: 0, y: 0 }, { x: 0, y: 340 }], widthFt: 150, rough: "ob", trees: "open", elev: -2, note: "Drops 59 ft into a lane strung with OB on both sides and long", ref: { url: BOOK, page: 12 } },
  { n: 11, par: 3, lengthFt: 285, line: [{ x: 0, y: 0 }, { x: 0, y: 280 }], widthFt: 150, rough: "hazard", balanceTrees: [{ x: -30, y: 240, r: 20 }, { x: 30, y: 240, r: 20 }], trees: "mixed", mando: "Pass left of the marked tree", note: "Straight short par 3 past the mando tree to an open green", ref: { url: BOOK, page: 13 } },
  { n: 12, par: 3, lengthFt: 384, line: [{ x: 0, y: 0 }, { x: 0, y: 380 }], widthFt: 150, rough: "ob", balanceTrees: [{ x: -30, y: 330, r: 20 }, { x: 30, y: 330, r: 20 }], trees: "open", elev: -1, note: "Straight down an open ski run with OB on both sides and long", ref: { url: BOOK, page: 14 } },
  { n: 13, par: 4, lengthFt: 545, line: [{ x: 0, y: 0 }, { x: -10, y: 170 }, { x: 20, y: 340 }, { x: 180, y: 460 }], widthFt: 150, rough: "hazard", balanceTrees: [{ x: 120, y: 460, r: 20 }, { x: 160, y: 400, r: 20 }], trees: "mixed", elev: -2, mando: "Pass left of the marked tree", note: "Down past the mando, then a long sweep right to the green", ref: { url: BOOK, page: 15 } },
  { n: 14, par: 3, lengthFt: 292, line: [{ x: 0, y: 0 }, { x: 20, y: 290 }], widthFt: 150, rough: "ob", obZones: [{ x: -90, y: 20, w: 200, h: 170 }, { x: -90, y: 190, w: 60, h: 140 }, { x: 60, y: 190, w: 50, h: 140 }, { x: -90, y: 330, w: 200, h: 50 }], islandGreen: true, dropZone: { x: 40, y: 240 }, trees: "open", note: "Island green: only the island is in bounds off the tee", ref: { url: BOOK, page: 16 } },
  { n: 15, par: 3, lengthFt: 302, line: [{ x: 0, y: 0 }, { x: -10, y: 170 }, { x: 40, y: 290 }], widthFt: 150, rough: "hazard", obZones: [{ x: -80, y: 330, w: 200, h: 40 }, { x: 90, y: 240, w: 40, h: 90 }], balanceTrees: [{ x: -10, y: 270, r: 20 }, { x: 60, y: 240, r: 20 }], trees: "mixed", elev: -2, note: "Drops 72 ft, curling right to a green with OB long", ref: { url: BOOK, page: 17 } },
  { n: 16, par: 4, lengthFt: 640, line: [{ x: 0, y: 0 }, { x: -10, y: 320 }, { x: 0, y: 630 }], widthFt: 150, rough: "hazard", balanceTrees: [{ x: -30, y: 580, r: 20 }, { x: 30, y: 580, r: 20 }], trees: "mixed", elev: -1, note: "Long, nearly straight run down the mountain from the FPO tee", ref: { url: BOOK, page: 18 } },
  { n: 17, par: 3, lengthFt: 456, line: [{ x: 0, y: 0 }, { x: -10, y: 450 }], widthFt: 150, rough: "hazard", obZones: [{ x: 40, y: 40, w: 60, h: 120 }, { x: 60, y: 160, w: 50, h: 120 }, { x: 70, y: 280, w: 40, h: 120 }, { x: -50, y: 510, w: 160, h: 40 }], trees: "mixed", elev: -2, mando: "Pass left of the marked pole", note: "Drops 118 ft off the top with OB right and long; the postcard hole", ref: { url: BOOK, page: 19 } },
  { n: 18, par: 4, lengthFt: 545, line: [{ x: 0, y: 0 }, { x: -20, y: 220 }, { x: -100, y: 370 }, { x: -170, y: 510 }], widthFt: 150, rough: "ob", dropZone: { x: -40, y: 260 }, trees: "mixed", mando: "Pass right of the chairlift pole", note: "Up a chute strung with OB that pinches twice to the finishing green", ref: { url: BOOK, page: 20 } },
];

export const BRIGHTON_MAJESTIC: ProCourse = {
  id: "brighton-majestic",
  name: "Brighton \"Majestic\"",
  city: "Brighton, UT",
  layoutLabel: "FPO",
  theme: "classic",
  book: BOOK,
  holes: HOLES,
};
