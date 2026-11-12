// Swenson Park B, Stockton CA: OTB Open (DGPT Elite+), May 21–24 2026.
// MPO, par 66, 10,993 ft (the B layout; the event also plays Swenson Park A).
// Facts from the public 2026 caddie book (Google Drive PDF, linked from the
// DGPT event page); each hole cites its MPO page (holes 2–5, 8, 10, 11 and
// 13–18 have separate FPO and MPO pages, FPO first). Hand-placed and rounded
// to 10 ft in our own format (see ./types). Nothing from the book's map art is
// copied, traced or stored; the game draws its own holes.
// Shared holes: 3, 5, 7, 8, 10, 11, 14, 17 and 18 are the same holes as
// Swenson Park A (the two books' MPO pages are pixel-identical), so they reuse
// A's data and cite this book's pages. The "B" holes (1, 2, 4, 6, 9, 12, 13,
// 15, 16) were placed from this book: 9's double mando is drawn as two walls
// with a ~50 ft gap; 12 runs up a strip between three ponds; 13 is the island
// green with its MPO DZ behind it (tee shots only). No elevation is printed.
// Off: the optional ("may proceed") DZs on 8, 10, 12 and 17 and every mando DZ.
// Balance: no levers. 100-round probe (Nov 12) +1.2 / −5.4 / −0.3 (Lv1 / Lv5 /
// Lv12) vs the +1.9 / −3.1 / +0.4 baseline; advisory only since Oct 24.
import type { ProCourse, ProHole } from "./types";

const BOOK = "https://drive.google.com/file/d/1UKlN19J1LkskUFmv3GGAjXpORMrsuvwH/view";

const HOLES: ProHole[] = [
  { n: 1, par: 3, lengthFt: 369, line: [{ x: 0, y: 0 }, { x: 0, y: 190 }, { x: -10, y: 360 }], widthFt: 150, rough: "hazard", obZones: [{ x: 50, y: 270, w: 30, h: 120 }, { x: 0, y: 390, w: 80, h: 80 }, { x: -110, y: 260, w: 20, h: 170 }, { x: -110, y: 450, w: 80, h: 20 }, { x: 10, y: 20, w: 70, h: 90 }], trees: "mixed", note: "Between the two big oaks to a green with OB left, right and long", ref: { url: BOOK, page: 8 } },
  { n: 2, par: 4, lengthFt: 719, line: [{ x: 0, y: 0 }, { x: -60, y: 140 }, { x: -130, y: 290 }, { x: -180, y: 370 }, { x: -170, y: 450 }, { x: -90, y: 520 }, { x: 20, y: 570 }], widthFt: 150, rough: "ob", trees: "mixed", mando: "Left of the 1st marked tree, right of the 2nd", note: "Up a roped lane to the left, then back right past two mando trees", ref: { url: BOOK, page: 10 } },
  { n: 3, par: 4, lengthFt: 744, line: [{ x: 0, y: 0 }, { x: -10, y: 420 }, { x: -40, y: 740 }], widthFt: 150, rough: "hazard", obZones: [{ x: -150, y: 800, w: 260, h: 50 }, { x: -150, y: 380, w: 30, h: 420 }, { x: -150, y: 170, w: 50, h: 210 }, { x: -150, y: -40, w: 90, h: 210 }], trees: "mixed", mando: "Not right of the marked flag pole", note: "Long straight lane with OB left and long, woods right", ref: { url: BOOK, page: 12 } },
  { n: 4, par: 3, lengthFt: 333, line: [{ x: 0, y: 0 }, { x: -10, y: 120 }, { x: -60, y: 220 }, { x: -70, y: 320 }], widthFt: 150, rough: "hazard", obZones: [{ x: 100, y: -60, w: 10, h: 440 }], trees: "wooded", mando: "Left of the 1st marked tree, right of the 2nd", note: "Wooded par 3 working left between two mando trees, range fence far right", ref: { url: BOOK, page: 14 } },
  { n: 5, par: 5, lengthFt: 1171, line: [{ x: 0, y: 0 }, { x: -70, y: 570 }, { x: -60, y: 860 }, { x: 40, y: 970 }, { x: 150, y: 1080 }], widthFt: 150, rough: "hazard", obZones: [{ x: -180, y: -70, w: 20, h: 880 }, { x: 60, y: 530, w: 150, h: 220 }, { x: -130, y: 670, w: 50, h: 60 }, { x: -120, y: 1020, w: 60, h: 60 }], trees: "mixed", mando: "Not right of the two marked trees", note: "1,171 ft up the fence line, then right past the maintenance yard to the green", ref: { url: BOOK, page: 16 } },
  { n: 6, par: 4, lengthFt: 673, line: [{ x: 0, y: 0 }, { x: 10, y: 160 }, { x: 60, y: 340 }, { x: 90, y: 470 }, { x: 110, y: 570 }, { x: 130, y: 660 }], widthFt: 150, rough: "hazard", water: [{ x: 100, y: 390, w: 80, h: 30 }], obZones: [{ x: -110, y: 260, w: 40, h: 420 }], trees: "mixed", mando: "Left of the marked tree midway", note: "Drifts right past a mando tree and a small pond, OB left from 280 ft", ref: { url: BOOK, page: 17 } },
  { n: 7, par: 4, lengthFt: 760, line: [{ x: 0, y: 0 }, { x: 30, y: 370 }, { x: 110, y: 750 }], widthFt: 170, rough: "ob", trees: "mixed", note: "Long lane between marked lines from about 330 ft out to the green", ref: { url: BOOK, page: 18 } },
  { n: 8, par: 3, lengthFt: 369, line: [{ x: 0, y: 0 }, { x: 0, y: 190 }, { x: 0, y: 360 }], widthFt: 190, rough: "hazard", water: [{ x: 0, y: 260, w: 70, h: 60 }], obZones: [{ x: -120, y: 300, w: 60, h: 80 }, { x: -100, y: 100, w: 90, h: 70 }, { x: 70, y: -90, w: 30, h: 340 }, { x: 40, y: 320, w: 60, h: 100 }], hazard: [{ x: -110, y: 400, d: 30 }, { x: -50, y: 460, rx: 30, ry: 20, rot: 0 }], trees: "mixed", note: "Golf greens OB left, the pond right of the green and sand long", ref: { url: BOOK, page: 20 } },
  { n: 9, par: 3, lengthFt: 396, line: [{ x: 0, y: 0 }, { x: 10, y: 180 }, { x: -40, y: 390 }], widthFt: 150, rough: "hazard", obZones: [{ x: -110, y: 110, w: 70, h: 60 }], walls: [{ x: -130, y: 180, w: 110 }, { x: 40, y: 180, w: 60 }], trees: "mixed", mando: "Between the two marked trees (double mando)", note: "Through a double-mando gap, then left to a green with golf greens OB", ref: { url: BOOK, page: 21 } },
  { n: 10, par: 4, lengthFt: 723, line: [{ x: 0, y: 0 }, { x: -130, y: 240 }, { x: -100, y: 430 }, { x: -70, y: 530 }, { x: -40, y: 680 }], widthFt: 150, rough: "ob", water: [{ x: -210, y: 530, w: 310, h: 100 }], obZones: [{ x: -50, y: 200, w: 150, h: 330 }], trees: "mixed", note: "Carry into a narrow lane past OB right, then over the creek to the green", ref: { url: BOOK, page: 23 } },
  { n: 11, par: 3, lengthFt: 435, line: [{ x: 0, y: 0 }, { x: 0, y: 230 }, { x: 0, y: 430 }], widthFt: 230, rough: "hazard", water: [{ x: -110, y: 20, w: 120, h: 340 }, { x: -110, y: 370, w: 90, h: 200 }], obZones: [{ x: -20, y: 470, w: 110, h: 100 }], hazard: [{ x: 70, y: 360, rx: 80, ry: 30, rot: 50 }], trees: "open", note: "Straight up the edge of the pond to a green with a hazard area right", ref: { url: BOOK, page: 25 } },
  { n: 12, par: 5, lengthFt: 928, line: [{ x: 0, y: 0 }, { x: -20, y: 180 }, { x: -30, y: 310 }, { x: -70, y: 490 }, { x: -90, y: 640 }, { x: -60, y: 800 }, { x: 10, y: 900 }], widthFt: 150, rough: "ob", water: [{ x: 20, y: 20, w: 90, h: 290 }, { x: -20, y: 440, w: 90, h: 390 }, { x: 40, y: 770, w: 70, h: 160 }], trees: "mixed", mando: "Left of the marked flag pole", note: "Par 5 up a strip between three ponds, water OB right the whole way", ref: { url: BOOK, page: 26 } },
  { n: 13, par: 3, lengthFt: 298, line: [{ x: 0, y: 0 }, { x: 10, y: 150 }, { x: 20, y: 290 }], widthFt: 150, rough: "ob", water: [{ x: -110, y: 120, w: 230, h: 150 }, { x: -110, y: 270, w: 70, h: 60 }], obZones: [{ x: -110, y: 20, w: 230, h: 100 }], islandGreen: true, dropZone: { x: 50, y: 350 }, trees: "open", note: "Island green over the pond; a tee shot that misses plays from the DZ", ref: { url: BOOK, page: 28 } },
  { n: 14, par: 3, lengthFt: 378, line: [{ x: 0, y: 0 }, { x: -10, y: 190 }, { x: -30, y: 370 }], widthFt: 150, rough: "hazard", trees: "wooded", mando: "Not right of or above the marked tree off the tee (re-tee)", note: "Wooded tunnel par 3 with a mando tree off the tee", ref: { url: BOOK, page: 30 } },
  { n: 15, par: 3, lengthFt: 379, line: [{ x: 0, y: 0 }, { x: -10, y: 180 }, { x: -40, y: 370 }], widthFt: 150, rough: "hazard", trees: "wooded", mando: "Left of the marked tree by the tee", note: "Wooded gap shot past a mando tree off the tee, no OB", ref: { url: BOOK, page: 32 } },
  { n: 16, par: 4, lengthFt: 735, line: [{ x: 0, y: 0 }, { x: 10, y: 210 }, { x: 20, y: 320 }, { x: 60, y: 500 }, { x: 50, y: 630 }, { x: 40, y: 730 }], widthFt: 150, rough: "hazard", obZones: [{ x: -110, y: -40, w: 100, h: 880 }, { x: -10, y: 830, w: 180, h: 10 }, { x: 60, y: 690, w: 70, h: 100 }], trees: "mixed", mando: "Left of the marked trees right of the fairway", note: "Up the creek line (OB left) past mando trees right, a golf green OB right", ref: { url: BOOK, page: 34 } },
  { n: 17, par: 4, lengthFt: 846, line: [{ x: 0, y: 0 }, { x: 70, y: 450 }, { x: 70, y: 620 }, { x: -30, y: 820 }], widthFt: 180, rough: "ob", water: [{ x: -90, y: 520, w: 120, h: 140 }, { x: 30, y: 560, w: 90, h: 100 }], obZones: [{ x: -20, y: 320, w: 50, h: 80 }, { x: -100, y: 220, w: 80, h: 110 }, { x: -120, y: 690, w: 70, h: 190 }, { x: 40, y: 740, w: 60, h: 80 }, { x: 100, y: 660, w: 60, h: 80 }], trees: "mixed", mando: "Not right of or above the marked tree off the tee", note: "Tee shot past the golf greens, then over the creek to a narrow green lobe", ref: { url: BOOK, page: 36 } },
  { n: 18, par: 4, lengthFt: 737, line: [{ x: 0, y: 0 }, { x: 0, y: 370 }, { x: -20, y: 590 }, { x: 0, y: 730 }], widthFt: 150, rough: "ob", water: [{ x: 20, y: 500, w: 70, h: 200 }, { x: -130, y: 760, w: 240, h: 80 }], trees: "mixed", mando: "Not left of the marked tree", note: "Long lane up to a narrow green with the pond right and long", ref: { url: BOOK, page: 38 } },
];

export const SWENSON_PARK_B: ProCourse = {
  id: "swenson-park-b",
  name: "Swenson Park B",
  city: "Stockton, CA",
  layoutLabel: "MPO",
  theme: "classic",
  book: BOOK,
  holes: HOLES,
};
