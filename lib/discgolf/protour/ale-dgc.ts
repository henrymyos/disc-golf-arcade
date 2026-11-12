// Ale Disc Golf Center (White Course), Nol, Sweden: Ale Open (DGPT Elite),
// Jul 3–5 2026. MPO, par 63, 9,782 ft (2,981 m). Facts from the public 2026
// caddie book (Google Drive PDF, linked from the DGPT event page); each hole
// cites its MPO page (holes 2, 7–10, 13, 17 and 18 have separate FPO and MPO
// pages, FPO first). Hand-placed and rounded to 10 ft in our own format (see
// ./types). Nothing from the book's map art is copied, traced or stored; the
// game draws its own holes.
// Units: the book is metric. Each page prints meters AND feet; lengthFt is the
// printed feet (the 18 sum to 9,782 ft = 2,981 m). Positions were measured on
// the page map and scaled by printed feet ÷ the drawn centerline. Slopes come
// from each page's elevation profile, net at the basket in meters, banded as on
// Brighton (under 15 ft / 4.6 m flat, 15–40 ft / 4.6–12.2 m ±1, over that ±2):
// 2 +10 m, 3 −8, 6 −10, 7 +8, 14 −6, 15 +8, 16 −12 (39 ft, so ±1); 1 −3, 5 +1,
// 9 −4, 10 +3, 11 +1, 12 +1, 13 −1, 17 +4, 18 −2 are flat; 4 and 8 print none.
// Woods with strung lanes (OB rough) on 1, 7, 10 and the island holes 3, 4 and
// 6 (3 and 4: two safe fairway islands, everything between is OB); OB pond
// carries on 8 and 12; the OB creek across 9; 18 is all hazard past the yellow
// line except the island green.
// Drop zones: tee shots only on 3, 4, 6 and 8 (the book's "after any throw from
// the tee"). 18's DZ is a mando-miss DZ, left off; the mandos stay as text.
// Balance: no levers. 100-round probe (Nov 12) −0.3 / −6.5 / +0.1 (Lv1 / Lv5 /
// Lv12) vs the +1.9 / −3.1 / +0.4 baseline. Lv5 runs 3.4 under: 4 plays −1.7
// because a 420 ft straight throw over the OB gap reaches the green island (the
// real line is blocked by woods the corridor model doesn't draw). Advisory only.
// Lv1 aces 31% on the 276 ft 11 and 28% on the island 6.
import type { ProCourse, ProHole } from "./types";

const BOOK = "https://drive.google.com/file/d/1g79jAJzuzxgF3GJZh3LGeqgwbctDWvnb/view";

const HOLES: ProHole[] = [
  { n: 1, par: 3, lengthFt: 476, line: [{ x: 0, y: 0 }, { x: 0, y: 240 }, { x: 0, y: 470 }], widthFt: 150, rough: "ob", trees: "mixed", note: "Straight up a strung lane to a green with OB all round", ref: { url: BOOK, page: 9 } },
  { n: 2, par: 4, lengthFt: 633, line: [{ x: 0, y: 0 }, { x: 70, y: 200 }, { x: 100, y: 380 }, { x: 70, y: 520 }, { x: 40, y: 610 }], widthFt: 200, rough: "hazard", obZones: [{ x: 220, y: 450, w: 20, h: 130 }], trees: "mixed", elev: 1, note: "Climbs 33 ft up a wide lane, past a path and the creek, OB far right", ref: { url: BOOK, page: 11 } },
  { n: 3, par: 3, lengthFt: 535, line: [{ x: 0, y: 0 }, { x: 0, y: 270 }, { x: -20, y: 530 }], widthFt: 150, rough: "ob", obZones: [{ x: -100, y: 30, w: 200, h: 110 }, { x: -80, y: 170, w: 80, h: 120 }], dropZone: { x: 70, y: 330 }, trees: "mixed", elev: -1, note: "Downhill carry to the first safe island, then onto the green island", ref: { url: BOOK, page: 12 } },
  { n: 4, par: 4, lengthFt: 656, line: [{ x: 0, y: 0 }, { x: 120, y: 110 }, { x: 220, y: 210 }, { x: 160, y: 370 }, { x: 60, y: 420 }, { x: -10, y: 420 }], widthFt: 150, rough: "ob", obZones: [{ x: 20, y: 40, w: 80, h: 160 }, { x: 80, y: 270, w: 120, h: 70 }], dropZone: { x: 220, y: 190 }, trees: "mixed", mando: "Not left of the marked tree off the tee (re-tee)", note: "Carry right onto the fairway island, then back left over OB to the green island", ref: { url: BOOK, page: 13 } },
  { n: 5, par: 3, lengthFt: 302, line: [{ x: 0, y: 0 }, { x: 0, y: 150 }, { x: -10, y: 300 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "Short wooded lane, no OB", ref: { url: BOOK, page: 14 } },
  { n: 6, par: 3, lengthFt: 338, line: [{ x: 0, y: 0 }, { x: -10, y: 170 }, { x: -10, y: 330 }], widthFt: 150, rough: "ob", obZones: [{ x: -90, y: 20, w: 180, h: 260 }, { x: -90, y: 280, w: 30, h: 110 }, { x: 20, y: 280, w: 30, h: 110 }, { x: -90, y: 390, w: 180, h: 30 }], islandGreen: true, dropZone: { x: 60, y: 330 }, trees: "mixed", elev: -1, note: "Downhill to an island green ringed by logs and the creek", ref: { url: BOOK, page: 15 } },
  { n: 7, par: 5, lengthFt: 961, line: [{ x: 0, y: 0 }, { x: 70, y: 220 }, { x: 160, y: 440 }, { x: 230, y: 600 }, { x: 200, y: 730 }, { x: 120, y: 780 }, { x: 30, y: 770 }], widthFt: 150, rough: "ob", trees: "mixed", elev: 1, note: "961 ft climbing between strung lines, right then back left to the pin", ref: { url: BOOK, page: 17 } },
  { n: 8, par: 3, lengthFt: 433, line: [{ x: 0, y: 0 }, { x: -50, y: 220 }, { x: -20, y: 430 }], widthFt: 150, rough: "hazard", water: [{ x: -30, y: 190, w: 80, h: 80 }], obZones: [{ x: 50, y: 140, w: 60, h: 200 }, { x: 60, y: 340, w: 50, h: 130 }], dropZone: { x: 10, y: 180 }, trees: "mixed", mando: "Not left of the marked tree", note: "Between the mando tree and the OB pond, then up to the green", ref: { url: BOOK, page: 19 } },
  { n: 9, par: 3, lengthFt: 479, line: [{ x: 0, y: 0 }, { x: 0, y: 260 }, { x: -10, y: 470 }], widthFt: 150, rough: "hazard", obZones: [{ x: -120, y: 250, w: 230, h: 30 }, { x: 90, y: 280, w: 20, h: 260 }, { x: -120, y: 530, w: 230, h: 50 }, { x: -120, y: 280, w: 60, h: 200 }, { x: -120, y: 480, w: 30, h: 50 }], trees: "mixed", note: "Over the OB creek across the fairway to a strung green", ref: { url: BOOK, page: 21 } },
  { n: 10, par: 3, lengthFt: 420, line: [{ x: 0, y: 0 }, { x: -30, y: 210 }, { x: -20, y: 340 }, { x: 0, y: 420 }], widthFt: 150, rough: "ob", trees: "wooded", note: "Narrow strung tunnel bending right at the green", ref: { url: BOOK, page: 23 } },
  { n: 11, par: 3, lengthFt: 276, line: [{ x: 0, y: 0 }, { x: -30, y: 130 }, { x: 0, y: 270 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "Short wooded gap, out left and back right, no OB", ref: { url: BOOK, page: 24 } },
  { n: 12, par: 4, lengthFt: 666, line: [{ x: 0, y: 0 }, { x: -10, y: 300 }, { x: -30, y: 460 }, { x: -90, y: 650 }], widthFt: 150, rough: "hazard", water: [{ x: -50, y: 80, w: 110, h: 100 }], trees: "wooded", note: "Over the OB pond off the tee, then up a wooded lane bending left", ref: { url: BOOK, page: 25 } },
  { n: 13, par: 5, lengthFt: 1017, line: [{ x: 0, y: 0 }, { x: -100, y: 220 }, { x: -200, y: 470 }, { x: -170, y: 720 }, { x: -80, y: 960 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "1,017 ft wooded par 5 out left and back right, no OB", ref: { url: BOOK, page: 27 } },
  { n: 14, par: 3, lengthFt: 358, line: [{ x: 0, y: 0 }, { x: -10, y: 180 }, { x: -10, y: 350 }], widthFt: 150, rough: "hazard", obZones: [{ x: -110, y: 400, w: 100, h: 40 }, { x: -10, y: 380, w: 50, h: 50 }, { x: 40, y: 340, w: 50, h: 80 }], trees: "wooded", elev: -1, note: "Downhill tunnel to a green with the log line OB long", ref: { url: BOOK, page: 28 } },
  { n: 15, par: 4, lengthFt: 591, line: [{ x: 0, y: 0 }, { x: -10, y: 190 }, { x: -30, y: 390 }, { x: -60, y: 580 }], widthFt: 150, rough: "hazard", trees: "wooded", elev: 1, note: "Climbing wooded par 4 drifting left, no OB", ref: { url: BOOK, page: 29 } },
  { n: 16, par: 3, lengthFt: 394, line: [{ x: 0, y: 0 }, { x: -40, y: 150 }, { x: -50, y: 280 }, { x: -30, y: 390 }], widthFt: 150, rough: "hazard", obZones: [{ x: -160, y: 230, w: 50, h: 100 }, { x: -160, y: 330, w: 60, h: 80 }, { x: -100, y: 410, w: 140, h: 40 }], trees: "mixed", elev: -1, note: "Drops 39 ft, out left then back right, OB left and long", ref: { url: BOOK, page: 30 } },
  { n: 17, par: 3, lengthFt: 361, line: [{ x: 0, y: 0 }, { x: -20, y: 180 }, { x: -30, y: 350 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "Straight wooded tunnel, no OB", ref: { url: BOOK, page: 32 } },
  { n: 18, par: 4, lengthFt: 886, line: [{ x: 0, y: 0 }, { x: -60, y: 230 }, { x: -120, y: 470 }, { x: -110, y: 680 }, { x: -70, y: 860 }], widthFt: 180, rough: "hazard", obZones: [{ x: -250, y: 730, w: 20, h: 140 }, { x: -230, y: 850, w: 110, h: 140 }, { x: -120, y: 920, w: 160, h: 70 }], islandGreen: true, hazard: [{ poly: [{ x: -250, y: 740 }, { x: -40, y: 680 }, { x: 40, y: 650 }, { x: 40, y: 920 }, { x: -30, y: 920 }, { x: -120, y: 850 }, { x: -200, y: 810 }], holes: [[{ x: -110, y: 860 }, { x: -90, y: 890 }, { x: -60, y: 900 }, { x: -20, y: 900 }, { x: -10, y: 870 }, { x: -10, y: 840 }, { x: -50, y: 820 }, { x: -90, y: 820 }, { x: -110, y: 840 }]] }], trees: "mixed", mando: "Not right of the marked tree", note: "Long finisher: past the yellow line it's all hazard but the island green", ref: { url: BOOK, page: 34 } },
];

export const ALE_DGC: ProCourse = {
  id: "ale-dgc",
  name: "Ale Disc Golf Center",
  city: "Nol, Sweden",
  layoutLabel: "MPO",
  theme: "classic",
  book: BOOK,
  holes: HOLES,
};
