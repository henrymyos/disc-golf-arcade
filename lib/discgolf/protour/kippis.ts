// Kippis, Heinola, Finland: Heinola Open (DGPT Elite), Jul 10–12 2026. MPO,
// par 62, 8,850 ft (2,697 m; Kippis Championship DiscGolfPark at Kippasuo).
// Facts from the public 2026 caddie book (Google Drive PDF, linked from the
// DGPT event page, where the venue is "Kippis"); each hole cites its MPO page
// (holes 5, 10, 12, 13, 15 and 17 have separate FPO and MPO pages, FPO first).
// Hand-placed and rounded to 10 ft in our own format (see ./types). Nothing
// from the book's map art is copied, traced or stored; the game draws its own
// holes.
// Units: the book is metric. Each page prints meters AND feet; lengthFt is the
// printed feet (the 18 sum to 8,850 ft = 2,697 m). Positions were measured on
// the page map and scaled by printed feet ÷ the drawn centerline.
// Rocky forest lanes with no OB on 1, 7, 8 and 9 (1's road crossing is in
// bounds); strung lanes (OB rough) on 11, 15 and 18; one-sided OB lines
// elsewhere; the island green on 17; 16's triple mando is a wooden structure,
// drawn as two fence walls with a ~30 ft gap on the line; a hazard short of
// 18's green. No elevation is printed, so every hole is flat.
// Drop zones: tee shots only on 17 (the island). The DZs on 1 and 16 are
// mando-miss DZs, left off.
// Balance: one lever, as on Parc des Familles 10: a balanceTrees pair (not in
// the book) ~50 ft short of 2's green, a 30 ft gap on the line (hole-only probe:
// Lv1 aces 43% -> 22%). 12's OB area hugs the left of the approach, ~45 ft off
// the pin. 100-round probe (Nov 12) −5.9 / −3.8 / −0.7 (Lv1 / Lv5 / Lv12) vs
// the +1.9 / −3.1 / +0.4 baseline: short (8,850 ft) with five par 3s under
// 315 ft, so weak arms score low. Advisory only since Oct 24. Lv1 aces still
// 29–39% on 3, 6 and 16 (16 is the book's gate shot, left as is).
import type { ProCourse, ProHole } from "./types";

const BOOK = "https://drive.google.com/file/d/1ze3ZHbI6JTfw0NKx98p6mrdQVWTAqTLz/view";

const HOLES: ProHole[] = [
  { n: 1, par: 4, lengthFt: 568, line: [{ x: 0, y: 0 }, { x: -20, y: 130 }, { x: -50, y: 300 }, { x: -70, y: 430 }, { x: -110, y: 550 }], widthFt: 150, rough: "hazard", trees: "wooded", mando: "Between the two marked trees off the tee", note: "Through a double mando, over the road (in bounds) and up a rocky lane left", ref: { url: BOOK, page: 7 } },
  { n: 2, par: 3, lengthFt: 312, line: [{ x: 0, y: 0 }, { x: -10, y: 160 }, { x: -10, y: 310 }], widthFt: 150, rough: "hazard", obZones: [{ x: -110, y: 240, w: 40, h: 60 }, { x: -90, y: 300, w: 50, h: 40 }, { x: -50, y: 340, w: 40, h: 60 }], balanceTrees: [{ x: -50, y: 260, r: 20 }, { x: 20, y: 260, r: 20 }], trees: "mixed", note: "Short open shot to a stone-ringed green, the road OB long and left", ref: { url: BOOK, page: 8 } },
  { n: 3, par: 3, lengthFt: 308, line: [{ x: 0, y: 0 }, { x: -10, y: 150 }, { x: -20, y: 300 }], widthFt: 150, rough: "hazard", obZones: [{ x: 20, y: -10, w: 40, h: 160 }, { x: 40, y: 150, w: 20, h: 40 }, { x: -120, y: 70, w: 40, h: 80 }, { x: -120, y: -10, w: 70, h: 80 }], trees: "wooded", note: "Rocky wooded lane, the road OB far left and a marked line right", ref: { url: BOOK, page: 9 } },
  { n: 4, par: 3, lengthFt: 285, line: [{ x: 0, y: 0 }, { x: 0, y: 140 }, { x: -10, y: 280 }], widthFt: 150, rough: "hazard", obZones: [{ x: 70, y: -10, w: 20, h: 400 }], trees: "wooded", note: "Straight rocky tunnel off a raised wooden tee, OB far right", ref: { url: BOOK, page: 10 } },
  { n: 5, par: 3, lengthFt: 377, line: [{ x: 0, y: 0 }, { x: -70, y: 90 }, { x: -80, y: 170 }, { x: -40, y: 250 }, { x: 20, y: 320 }], widthFt: 150, rough: "hazard", obZones: [{ x: 50, y: -30, w: 20, h: 430 }, { x: 20, y: 400, w: 50, h: 30 }], trees: "wooded", note: "Out left, then back right up a rocky lane to the green, the fence OB right", ref: { url: BOOK, page: 12 } },
  { n: 6, par: 3, lengthFt: 289, line: [{ x: 0, y: 0 }, { x: -10, y: 140 }, { x: 0, y: 280 }], widthFt: 150, rough: "hazard", obZones: [{ x: -90, y: 230, w: 20, h: 110 }, { x: -90, y: 140, w: 40, h: 90 }, { x: -90, y: 60, w: 60, h: 80 }, { x: -90, y: -10, w: 80, h: 70 }], trees: "mixed", note: "Short shot up a lane with a marked OB line all down the left", ref: { url: BOOK, page: 13 } },
  { n: 7, par: 4, lengthFt: 656, line: [{ x: 0, y: 0 }, { x: 10, y: 170 }, { x: -10, y: 360 }, { x: -70, y: 530 }, { x: -110, y: 640 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "Long wooded par 4 up a rocky lane, bending left at the top, no OB", ref: { url: BOOK, page: 14 } },
  { n: 8, par: 3, lengthFt: 315, line: [{ x: 0, y: 0 }, { x: 0, y: 160 }, { x: 0, y: 310 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "Straight wooded tunnel to a rocky green, no OB", ref: { url: BOOK, page: 15 } },
  { n: 9, par: 4, lengthFt: 728, line: [{ x: 0, y: 0 }, { x: -20, y: 240 }, { x: -20, y: 420 }, { x: -80, y: 570 }, { x: -130, y: 710 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "728 ft up a rocky ridge lane, finishing left, no OB", ref: { url: BOOK, page: 16 } },
  { n: 10, par: 3, lengthFt: 351, line: [{ x: 0, y: 0 }, { x: -10, y: 130 }, { x: 0, y: 260 }, { x: -40, y: 340 }], widthFt: 150, rough: "hazard", obZones: [{ x: 10, y: -10, w: 80, h: 180 }, { x: 30, y: 170, w: 60, h: 20 }, { x: -110, y: 400, w: 150, h: 30 }, { x: 40, y: 370, w: 50, h: 50 }], trees: "wooded", note: "Up the canyon's edge (OB right) to a green with a marked line long", ref: { url: BOOK, page: 18 } },
  { n: 11, par: 4, lengthFt: 906, line: [{ x: 0, y: 0 }, { x: -20, y: 230 }, { x: -80, y: 430 }, { x: -70, y: 640 }, { x: -30, y: 840 }, { x: -10, y: 890 }], widthFt: 150, rough: "ob", trees: "wooded", note: "906 ft up a narrow lane strung OB both sides", ref: { url: BOOK, page: 19 } },
  { n: 12, par: 4, lengthFt: 742, line: [{ x: 0, y: 0 }, { x: 140, y: 160 }, { x: 160, y: 330 }, { x: 110, y: 530 }, { x: 30, y: 660 }], widthFt: 150, rough: "hazard", obZones: [{ x: -70, y: 330, w: 90, h: 220 }, { x: -70, y: 550, w: 50, h: 190 }], trees: "wooded", note: "Out right, then back left past the OB area late left", ref: { url: BOOK, page: 21 } },
  { n: 13, par: 4, lengthFt: 620, line: [{ x: 0, y: 0 }, { x: -40, y: 160 }, { x: -60, y: 350 }, { x: -100, y: 490 }, { x: -110, y: 610 }], widthFt: 150, rough: "hazard", obZones: [{ x: -20, y: 470, w: 90, h: 200 }, { x: -50, y: 670, w: 120, h: 50 }], trees: "wooded", note: "Up a rocky lane drifting left, OB late right", ref: { url: BOOK, page: 23 } },
  { n: 14, par: 3, lengthFt: 472, line: [{ x: 0, y: 0 }, { x: -30, y: 160 }, { x: -20, y: 330 }, { x: 10, y: 470 }], widthFt: 150, rough: "hazard", obZones: [{ x: -140, y: 400, w: 40, h: 180 }, { x: -140, y: 260, w: 10, h: 140 }, { x: -140, y: 110, w: 40, h: 150 }, { x: -140, y: 10, w: 80, h: 100 }], trees: "mixed", note: "Long par 3 around a tree island to a green right, OB left", ref: { url: BOOK, page: 24 } },
  { n: 15, par: 4, lengthFt: 719, line: [{ x: 0, y: 0 }, { x: -60, y: 190 }, { x: -110, y: 370 }, { x: -60, y: 510 }, { x: -20, y: 610 }, { x: -10, y: 690 }], widthFt: 150, rough: "ob", trees: "open", note: "Open strung fairway, then a narrow neck to a green with OB all round", ref: { url: BOOK, page: 26 } },
  { n: 16, par: 3, lengthFt: 299, line: [{ x: 0, y: 0 }, { x: 0, y: 150 }, { x: 0, y: 290 }], widthFt: 150, rough: "hazard", walls: [{ x: -110, y: 250, w: 100 }, { x: 20, y: 250, w: 80 }], trees: "open", mando: "Through the marked wooden structure", note: "Open field shot through a gap in the wooden structure (triple mando)", ref: { url: BOOK, page: 27 } },
  { n: 17, par: 3, lengthFt: 312, line: [{ x: 0, y: 0 }, { x: -10, y: 150 }, { x: -10, y: 310 }], widthFt: 150, rough: "ob", obZones: [{ x: -90, y: 20, w: 170, h: 200 }, { x: -90, y: 220, w: 50, h: 140 }, { x: -90, y: 340, w: 170, h: 50 }, { x: 40, y: 220, w: 40, h: 120 }], islandGreen: true, dropZone: { x: 30, y: 310 }, trees: "open", note: "Island green; a tee shot that misses plays from the DZ beside it", ref: { url: BOOK, page: 29 } },
  { n: 18, par: 4, lengthFt: 591, line: [{ x: 0, y: 0 }, { x: -10, y: 160 }, { x: -30, y: 310 }, { x: -70, y: 450 }, { x: -100, y: 580 }], widthFt: 150, rough: "ob", hazard: [{ poly: [{ x: -110, y: 540 }, { x: -100, y: 550 }, { x: -60, y: 550 }, { x: -70, y: 530 }, { x: -100, y: 530 }] }], trees: "mixed", note: "Strung finisher up to a green with a hazard short of it", ref: { url: BOOK, page: 30 } },
];

export const KIPPIS: ProCourse = {
  id: "kippasuo",
  name: "Kippis",
  city: "Heinola, Finland",
  layoutLabel: "MPO",
  theme: "classic",
  book: BOOK,
  holes: HOLES,
};
