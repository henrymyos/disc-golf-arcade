// Pickard Park (Gold), Indianola IA: Discmania Challenge (DGPT Elite), Aug 7–9
// 2026. MPO, par 64, 10,250 ft. Facts from the public 2026 caddie book (Google
// Drive PDF); each hole cites its MPO page. Hand-placed and rounded to 10 ft in
// our own format (see ./types). Nothing from the book's map art is copied,
// traced or stored; the game draws its own holes.
// Parkland with the pond at the front (3–5) and creek crossings at the back (9,
// 10, 12, 14), plus three island features: the island green on 5, the hexagon
// hazard island on 7 (hazard bunkers cover the rest of the corridor) and the
// island fairway and green on 17. Rope lines make most holes OB rough.
// Elev ft (book, net at the MPO basket):
//   1 +10, 2 −14, 3 −20 (−26 low), 4 −20, 5 ±0, 6 −20, 7 +29, 8 −46, 9 +29,
//   10 +25 (+43 mid-hole), 11 −16, 12 none printed, 13 none printed, 14 −15,
//   15 +25, 16 −8, 17 +35, 18 +35.
// 10 rises to +43 and then drops, so it gets elevZones; the rest use the net.
// Drop zones: tee shots only on 2, 5 (the FPO tee) and 10 (the FPO tee, moved
// just inside the rope); dzAll on 17 at DZ1 (any throw from the tee or fairway;
// DZ2 left off). The optional "may proceed" DZs on 4, 8, 9, 12 and 16 and the
// mando-only DZs on 1, 11 and 18 are left off.
// Balance: balanceTrees (r 20, not in the book): a pair ~50 ft short of the
// green on 3, 4, 8, 9 and 12 (short par 3s that aced too often). None on the
// signature holes 5, 6, 7, 10, 16, 17.
// Held (Oct 23): 400-round probe +2.7 / −3.8 / +6.7 (Lv1 / Lv5 / Lv12); Lv12 is
// 6.3 over the +0.4 baseline (17 +3.9, 5 +2.3), so the stop shows as later.
import type { ProCourse, ProHole } from "./types";

const BOOK = "https://drive.google.com/file/d/15jEswxw8RDkxWXj8dNDZWlMB1saEbsBI/view";

const HOLES: ProHole[] = [
  { n: 1, par: 4, lengthFt: 760, line: [{ x: 0, y: 0 }, { x: -30, y: 260 }, { x: -50, y: 500 }, { x: 80, y: 750 }], widthFt: 170, rough: "ob", hazard: [{ x: -30, y: 690, d: 100 }], trees: "open", mando: "Right of the pole and tree by the lot, left of the fairway tree", note: "Up a strung lane past the lot, then right past a hazard to the green", ref: { url: BOOK, page: 8 } },
  { n: 2, par: 4, lengthFt: 753, line: [{ x: 0, y: 0 }, { x: 170, y: 220 }, { x: 210, y: 480 }, { x: 220, y: 690 }], widthFt: 150, rough: "ob", dropZone: { x: 190, y: 300 }, trees: "open", note: "Down off the tee into a narrow roped lane running up to the green", ref: { url: BOOK, page: 10 } },
  { n: 3, par: 3, lengthFt: 320, line: [{ x: 0, y: 0 }, { x: -30, y: 160 }, { x: -50, y: 310 }], widthFt: 150, rough: "ob", water: [{ x: -20, y: 360, w: 130, h: 60 }, { x: 60, y: 200, w: 50, h: 160 }], balanceTrees: [{ x: -10, y: 270, r: 20 }, { x: -80, y: 260, r: 20 }], trees: "open", elev: -1, note: "Downhill through a roped gap to a green with the pond long and right", ref: { url: BOOK, page: 11 } },
  { n: 4, par: 3, lengthFt: 472, line: [{ x: 0, y: 0 }, { x: -70, y: 250 }, { x: -100, y: 460 }], widthFt: 150, rough: "ob", water: [{ x: -90, y: 220, w: 150, h: 170 }, { x: -50, y: 390, w: 110, h: 120 }], balanceTrees: [{ x: -80, y: 420, r: 20 }, { x: -150, y: 410, r: 20 }], trees: "open", elev: -1, note: "Downhill across the corner of the pond to a green roped left and long", ref: { url: BOOK, page: 13 } },
  { n: 5, par: 3, lengthFt: 330, line: [{ x: 0, y: 0 }, { x: -20, y: 320 }], widthFt: 150, rough: "ob", water: [{ x: -40, y: 40, w: 150, h: 260 }], obZones: [{ x: -110, y: 20, w: 220, h: 20 }, { x: -110, y: 70, w: 70, h: 230 }, { x: -110, y: 300, w: 60, h: 60 }, { x: 30, y: 300, w: 80, h: 60 }, { x: -110, y: 360, w: 220, h: 50 }], islandGreen: true, dropZone: { x: -60, y: 50 }, trees: "open", note: "All carry over the pond to the island green; a missed drive plays from the DZ", ref: { url: BOOK, page: 15 } },
  { n: 6, par: 4, lengthFt: 820, line: [{ x: 0, y: 0 }, { x: -180, y: 160 }, { x: -230, y: 360 }, { x: -140, y: 570 }, { x: -30, y: 670 }], widthFt: 180, rough: "ob", hazard: [{ x: -180, y: 320, d: 120 }], trees: "mixed", elev: -1, note: "A long left-hand arc past a hazard in the fairway, roped left", ref: { url: BOOK, page: 16 } },
  { n: 7, par: 3, lengthFt: 345, line: [{ x: 0, y: 0 }, { x: 0, y: 340 }], widthFt: 150, rough: "hazard", hazard: [{ x: -40, y: 80, d: 140 }, { x: 40, y: 80, d: 140 }, { x: -40, y: 190, d: 140 }, { x: 40, y: 190, d: 140 }, { x: -60, y: 275, d: 50 }, { x: -20, y: 275, d: 50 }, { x: 20, y: 275, d: 50 }, { x: 60, y: 275, d: 50 }, { x: -60, y: 320, d: 40 }, { x: -60, y: 360, d: 40 }, { x: 60, y: 320, d: 40 }, { x: 60, y: 360, d: 40 }, { x: -40, y: 410, d: 40 }, { x: 0, y: 410, d: 40 }, { x: 40, y: 410, d: 40 }], islandGreen: true, trees: "mixed", elev: 1, note: "Uphill to a hexagon island green; everything else is hazard", ref: { url: BOOK, page: 18 } },
  { n: 8, par: 3, lengthFt: 545, line: [{ x: 0, y: 0 }, { x: 0, y: 270 }, { x: -10, y: 540 }], widthFt: 170, rough: "ob", hazard: [{ x: 40, y: 330, d: 140 }, { x: 60, y: 210, d: 80 }], balanceTrees: [{ x: 30, y: 490, r: 20 }, { x: -40, y: 490, r: 20 }], trees: "mixed", elev: -2, note: "Long downhill par 3 past a hazard wedge, roped left and long", ref: { url: BOOK, page: 20 } },
  { n: 9, par: 3, lengthFt: 377, line: [{ x: 0, y: 0 }, { x: 10, y: 190 }, { x: 20, y: 370 }], widthFt: 150, rough: "ob", obZones: [{ x: -110, y: 80, w: 220, h: 40 }], balanceTrees: [{ x: 50, y: 320, r: 20 }, { x: -20, y: 320, r: 20 }], trees: "mixed", elev: 1, note: "Over the creek, then uphill up a strung lane to the green", ref: { url: BOOK, page: 22 } },
  { n: 10, par: 5, lengthFt: 1086, line: [{ x: 0, y: 0 }, { x: -120, y: 290 }, { x: -160, y: 550 }, { x: -90, y: 800 }, { x: -10, y: 970 }, { x: 30, y: 1030 }], widthFt: 160, rough: "ob", obZones: [{ x: -100, y: 980, w: 220, h: 20 }], dropZone: { x: -140, y: 230 }, trees: "wooded", elevZones: [{ to: 0.5, elev: 2 }, { to: 1, elev: -1 }], note: "1,086 ft up a strung lane over a hump, the creek in front of the green", ref: { url: BOOK, page: 24 } },
  { n: 11, par: 4, lengthFt: 745, line: [{ x: 0, y: 0 }, { x: 210, y: 210 }, { x: 170, y: 390 }, { x: 70, y: 530 }, { x: -10, y: 580 }], widthFt: 160, rough: "hazard", trees: "wooded", elev: -1, mando: "Not left of the marked pole", note: "Down right off the tee, then a long left-hand bend through the woods", ref: { url: BOOK, page: 25 } },
  { n: 12, par: 3, lengthFt: 399, line: [{ x: 0, y: 0 }, { x: 0, y: 200 }, { x: 20, y: 390 }], widthFt: 150, rough: "hazard", obZones: [{ x: -110, y: 140, w: 220, h: 40 }, { x: 60, y: 230, w: 50, h: 100 }], balanceTrees: [{ x: 50, y: 340, r: 20 }, { x: -20, y: 340, r: 20 }], trees: "wooded", mando: "Between the two marked trees past the creek", note: "Over the creek and through a double mando gap in the woods", ref: { url: BOOK, page: 26 } },
  { n: 13, par: 3, lengthFt: 435, line: [{ x: 0, y: 0 }, { x: -50, y: 220 }, { x: -100, y: 420 }], widthFt: 150, rough: "hazard", obZones: [{ x: -180, y: 250, w: 40, h: 220 }], trees: "wooded", note: "Long wooded par 3 drifting left, the rope OB left of the green", ref: { url: BOOK, page: 27 } },
  { n: 14, par: 4, lengthFt: 720, line: [{ x: 0, y: 0 }, { x: -70, y: 350 }, { x: -150, y: 700 }], widthFt: 150, rough: "hazard", obZones: [{ x: -230, y: 560, w: 280, h: 30 }, { x: -250, y: 600, w: 40, h: 180 }], trees: "wooded", elev: -1, note: "Down a wooded lane, over the creek bed to a green with the line left", ref: { url: BOOK, page: 29 } },
  { n: 15, par: 4, lengthFt: 600, line: [{ x: 0, y: 0 }, { x: 70, y: 220 }, { x: 20, y: 440 }, { x: -20, y: 580 }], widthFt: 160, rough: "hazard", obZones: [{ x: 120, y: 100, w: 40, h: 350 }, { x: -120, y: 640, w: 200, h: 30 }], trees: "wooded", elev: 1, note: "Uphill up a wooded lane with the rope right and long", ref: { url: BOOK, page: 30 } },
  { n: 16, par: 3, lengthFt: 330, line: [{ x: 0, y: 0 }, { x: -10, y: 320 }], widthFt: 150, rough: "ob", obZones: [{ x: -110, y: 20, w: 220, h: 30 }], trees: "wooded", note: "Off an island tee over the creek, up a strung wooded lane", ref: { url: BOOK, page: 31 } },
  { n: 17, par: 4, lengthFt: 603, line: [{ x: 0, y: 0 }, { x: -30, y: 330 }, { x: -40, y: 600 }], widthFt: 150, rough: "ob", obZones: [{ x: -150, y: 420, w: 260, h: 130 }, { x: -150, y: 550, w: 50, h: 90 }, { x: 20, y: 550, w: 90, h: 90 }, { x: -150, y: 640, w: 260, h: 60 }], islandGreen: true, dropZone: { x: -100, y: 410 }, dzAll: true, trees: "mixed", elev: 1, note: "Uphill to an island fairway, then over OB to the island green", ref: { url: BOOK, page: 33 } },
  { n: 18, par: 4, lengthFt: 610, line: [{ x: 0, y: 0 }, { x: 70, y: 230 }, { x: 60, y: 410 }, { x: 80, y: 600 }], widthFt: 170, rough: "ob", water: [{ x: 150, y: 340, w: 40, h: 80 }], trees: "mixed", elev: 1, mando: "Not right of the marked tree", note: "Uphill finisher, lines left and round the green, 5's island green right", ref: { url: BOOK, page: 35 } },
];

export const PICKARD_PARK: ProCourse = {
  id: "pickard-park",
  name: "Pickard Park",
  city: "Indianola, IA",
  layoutLabel: "MPO",
  theme: "classic",
  book: BOOK,
  holes: HOLES,
};
