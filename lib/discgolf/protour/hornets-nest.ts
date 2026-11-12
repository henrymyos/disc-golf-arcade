// Hornets Nest, Charlotte NC: Queen City Classic (DGPT Elite), Mar 27–29 2026.
// MPO, par 62, 9,084 ft. Facts from the public 2026 caddie book (Google Drive
// PDF, linked from the DGPT event page); each hole cites its MPO page (holes 1,
// 5–7, 9, 10 and 13–17 have separate FPO and MPO pages, FPO first). Hand-placed
// and rounded to 10 ft in our own format (see ./types). Nothing from the book's
// map art is copied, traced or stored; the game draws its own holes.
// Wooded Piedmont park: tight tunnels (5–7, 9–11, 15) with no OB, roads and
// lots OB on 1–4, 12, 13 and 17, the open field on 14 strung left, right and
// long, the chute between fences on 18 (OB rough), and the signature island
// green on 16. No elevation is printed, so every hole is flat.
// Drop zones: 16 only, tee shots to DZ1 (the FPO tee), drive-only; the book's
// DZ1 → DZ2 chain is cut to its first link (a later miss plays from the last
// in-bounds lie). Off: the mando DZs on 11 and 13; the 4 mando re-tees.
// Balance: no levers. 100-round probe (Nov 12) −1.6 / −4.8 / +1.4 (Lv1 / Lv5 /
// Lv12) vs the +1.9 / −3.1 / +0.4 baseline: easier at Lv1, shipped anyway (band
// is advisory). Par-3 aces 0 / 7 / 3%.
import type { ProCourse, ProHole } from "./types";

const BOOK = "https://drive.google.com/file/d/1Ol_FrDwj2E7OHVOlxkUNuj20GY_OlGom/view";

const HOLES: ProHole[] = [
  { n: 1, par: 3, lengthFt: 405, line: [{ x: 0, y: 0 }, { x: -40, y: 200 }, { x: -70, y: 390 }], widthFt: 150, rough: "ob", water: [{ x: -60, y: 440, w: 170, h: 60 }], trees: "mixed", note: "Up a roped lane between the road and the sidewalk, the pond long", ref: { url: BOOK, page: 8 } },
  { n: 2, par: 3, lengthFt: 480, line: [{ x: 0, y: 0 }, { x: -10, y: 240 }, { x: -20, y: 470 }], widthFt: 150, rough: "hazard", obZones: [{ x: 30, y: 0, w: 80, h: 580 }], trees: "mixed", note: "Long par 3 up an open lane with the road OB tight right", ref: { url: BOOK, page: 9 } },
  { n: 3, par: 4, lengthFt: 641, line: [{ x: 0, y: 0 }, { x: -20, y: 320 }, { x: 20, y: 640 }], widthFt: 150, rough: "hazard", obZones: [{ x: -130, y: 0, w: 120, h: 100 }, { x: -130, y: 100, w: 90, h: 200 }, { x: -130, y: 300, w: 70, h: 300 }, { x: -130, y: 600, w: 90, h: 150 }], trees: "mixed", note: "Long lane with the road OB down the whole left side", ref: { url: BOOK, page: 10 } },
  { n: 4, par: 4, lengthFt: 534, line: [{ x: 0, y: 0 }, { x: 130, y: 310 }, { x: 90, y: 500 }], widthFt: 150, rough: "hazard", obZones: [{ x: 80, y: 0, w: 160, h: 120 }, { x: 140, y: 120, w: 100, h: 160 }], trees: "wooded", mando: "Not right of the marked tree off the tee (re-tee)", note: "Up and right past the parking lot OB, then back left to the green", ref: { url: BOOK, page: 11 } },
  { n: 5, par: 3, lengthFt: 419, line: [{ x: 0, y: 0 }, { x: -10, y: 210 }, { x: 0, y: 410 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "Straight wooded tunnel, no OB", ref: { url: BOOK, page: 13 } },
  { n: 6, par: 3, lengthFt: 345, line: [{ x: 0, y: 0 }, { x: 10, y: 170 }, { x: 0, y: 340 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "Short wooded tunnel, no OB", ref: { url: BOOK, page: 15 } },
  { n: 7, par: 4, lengthFt: 651, line: [{ x: 0, y: 0 }, { x: -10, y: 320 }, { x: 0, y: 640 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "A long straight tunnel through the woods", ref: { url: BOOK, page: 17 } },
  { n: 8, par: 4, lengthFt: 819, line: [{ x: 0, y: 0 }, { x: -220, y: 400 }, { x: -160, y: 590 }, { x: -10, y: 670 }], widthFt: 150, rough: "hazard", trees: "mixed", note: "Up the open fairway to the left, then hooking back right into the woods", ref: { url: BOOK, page: 18 } },
  { n: 9, par: 3, lengthFt: 350, line: [{ x: 0, y: 0 }, { x: 30, y: 170 }, { x: 0, y: 340 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "A tunnel bowing right through the woods", ref: { url: BOOK, page: 20 } },
  { n: 10, par: 3, lengthFt: 415, line: [{ x: 0, y: 0 }, { x: -30, y: 210 }, { x: 0, y: 410 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "A tunnel bowing left through the woods", ref: { url: BOOK, page: 22 } },
  { n: 11, par: 3, lengthFt: 321, line: [{ x: 0, y: 0 }, { x: 0, y: 160 }, { x: -10, y: 320 }], widthFt: 150, rough: "hazard", trees: "wooded", mando: "Not left of the marked tree just off the tee", note: "Short tunnel past the mando tree to a green in a clearing", ref: { url: BOOK, page: 23 } },
  { n: 12, par: 3, lengthFt: 357, line: [{ x: 0, y: 0 }, { x: 30, y: 180 }, { x: 0, y: 350 }], widthFt: 150, rough: "hazard", obZones: [{ x: 60, y: 340, w: 80, h: 120 }], trees: "mixed", note: "Out of the field into the trees, a marked line right of the green", ref: { url: BOOK, page: 24 } },
  { n: 13, par: 5, lengthFt: 727, line: [{ x: 0, y: 0 }, { x: 180, y: 400 }, { x: 60, y: 660 }], widthFt: 150, rough: "hazard", obZones: [{ x: -110, y: 740, w: 400, h: 30 }], trees: "wooded", mando: "Not left of the marked tree at the bend", note: "Up and right, then back left past the mando tree; the greenway OB long", ref: { url: BOOK, page: 26 } },
  { n: 14, par: 3, lengthFt: 486, line: [{ x: 0, y: 0 }, { x: 10, y: 240 }, { x: 0, y: 480 }], widthFt: 170, rough: "hazard", obZones: [{ x: -120, y: 290, w: 40, h: 220 }, { x: 70, y: 380, w: 60, h: 130 }, { x: -120, y: 510, w: 250, h: 90 }], trees: "open", note: "Long par 3 up an open field, strung left, right and long", ref: { url: BOOK, page: 28 } },
  { n: 15, par: 3, lengthFt: 390, line: [{ x: 0, y: 0 }, { x: 0, y: 200 }, { x: -10, y: 380 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "Straight wooded tunnel, no OB", ref: { url: BOOK, page: 30 } },
  { n: 16, par: 3, lengthFt: 340, line: [{ x: 0, y: 0 }, { x: 0, y: 170 }, { x: 0, y: 340 }], widthFt: 150, rough: "ob", water: [{ x: -110, y: 160, w: 220, h: 120 }], obZones: [{ x: -110, y: 20, w: 220, h: 60 }, { x: -110, y: 80, w: 150, h: 80 }, { x: -110, y: 280, w: 60, h: 120 }, { x: 50, y: 280, w: 60, h: 120 }, { x: -110, y: 400, w: 220, h: 50 }], islandGreen: true, dropZone: { x: 70, y: 110 }, trees: "open", note: "All carry over the pond to the island green; a missed drive plays from the DZ", ref: { url: BOOK, page: 32 } },
  { n: 17, par: 4, lengthFt: 674, line: [{ x: 0, y: 0 }, { x: -120, y: 230 }, { x: -140, y: 390 }, { x: -90, y: 500 }, { x: -20, y: 520 }, { x: 30, y: 490 }], widthFt: 150, rough: "hazard", obZones: [{ x: -250, y: 570, w: 150, h: 60 }, { x: -100, y: 600, w: 180, h: 30 }], trees: "wooded", note: "A long horseshoe: left up the woods, then back right, the fence OB beyond", ref: { url: BOOK, page: 34 } },
  { n: 18, par: 4, lengthFt: 730, line: [{ x: 0, y: 0 }, { x: 110, y: 390 }, { x: 130, y: 560 }, { x: 170, y: 700 }], widthFt: 150, rough: "ob", trees: "mixed", note: "Up a roped chute between the ballfield fences and the line to the green", ref: { url: BOOK, page: 35 } },
];

export const HORNETS_NEST: ProCourse = {
  id: "hornets-nest",
  name: "Hornets Nest",
  city: "Charlotte, NC",
  layoutLabel: "MPO",
  theme: "classic",
  book: BOOK,
  holes: HOLES,
};
