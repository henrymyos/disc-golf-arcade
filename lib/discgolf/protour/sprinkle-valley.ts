// Sprinkle Valley, Austin TX: Open at Austin (DGPT Elite+), May 7–10 2026.
// MPO, par 66, 9,166 ft (the event also plays Harvey Penick). Facts from the
// public 2026 caddie book (Google Drive PDF, linked from the DGPT event page);
// each hole cites its MPO page (holes 4, 5, 7, 8, 12, 13, 15 and 18 have
// separate FPO and MPO pages, FPO first; 9's page puts the map on the left).
// Hand-placed and rounded to 10 ft in our own format (see ./types). Nothing
// from the book's map art is copied, traced or stored; the game draws its own
// holes.
// Dense wooded lanes with no OB on most holes (the creek on 4, 5 and 13 is a
// no-entry rule, not a penalty, so it isn't drawn); OB lines on 5 (plus the
// marked OB valley across the fairway), 9 (fence), 11 (the area inside the
// bend), 12 and 13; strung 16 and 18; the island green on 17. No elevation is
// printed, so every hole is flat.
// Drop zones: tee shots only on 17 (the island). Off: 18's optional ("may
// proceed") DZ and 1's mando DZ (the triple mando stays as text).
// Balance: no levers. 100-round probe (Nov 12) −5.7 / −5.3 / +0.6 (Lv1 / Lv5 /
// Lv12) vs the +1.9 / −3.1 / +0.4 baseline: short (9,166 ft) wooded par 66, so
// weak arms score low. Advisory only since Oct 24.
import type { ProCourse, ProHole } from "./types";

const BOOK = "https://drive.google.com/file/d/1pc3RMnZ8zYG_XeugKmu8awADkuSWIwtN/view";

const HOLES: ProHole[] = [
  { n: 1, par: 4, lengthFt: 570, line: [{ x: 0, y: 0 }, { x: -20, y: 100 }, { x: -70, y: 190 }, { x: -110, y: 310 }, { x: -130, y: 360 }, { x: -80, y: 460 }, { x: -30, y: 520 }], widthFt: 150, rough: "hazard", trees: "wooded", mando: "Through the triple mando gate off the tee", note: "Through a triple-mando gate, then a long S-bend up a wooded lane", ref: { url: BOOK, page: 7 } },
  { n: 2, par: 4, lengthFt: 618, line: [{ x: 0, y: 0 }, { x: -60, y: 130 }, { x: -100, y: 280 }, { x: -100, y: 420 }, { x: -80, y: 520 }, { x: -50, y: 590 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "Wooded lane bending left, then back right to the green, no OB", ref: { url: BOOK, page: 8 } },
  { n: 3, par: 3, lengthFt: 360, line: [{ x: 0, y: 0 }, { x: 20, y: 100 }, { x: 40, y: 210 }, { x: 20, y: 290 }, { x: 10, y: 350 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "Out right, then back left through the trees to a tucked green", ref: { url: BOOK, page: 9 } },
  { n: 4, par: 3, lengthFt: 364, line: [{ x: 0, y: 0 }, { x: -10, y: 170 }, { x: 10, y: 360 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "Straight wooded tunnel over the creek (no entry), no OB", ref: { url: BOOK, page: 11 } },
  { n: 5, par: 4, lengthFt: 500, line: [{ x: 0, y: 0 }, { x: -10, y: 120 }, { x: -40, y: 250 }, { x: -70, y: 340 }, { x: -40, y: 410 }, { x: -10, y: 480 }], widthFt: 150, rough: "hazard", obZones: [{ x: 0, y: 30, w: 80, h: 280 }, { x: 20, y: 310, w: 60, h: 180 }, { x: -100, y: 380, w: 120, h: 40 }], trees: "wooded", note: "Up the left of an OB line, then over a marked OB valley to the green", ref: { url: BOOK, page: 13 } },
  { n: 6, par: 3, lengthFt: 320, line: [{ x: 0, y: 0 }, { x: -10, y: 110 }, { x: -30, y: 210 }, { x: -10, y: 270 }, { x: 10, y: 310 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "Short wooded S-bend finishing right, no OB", ref: { url: BOOK, page: 14 } },
  { n: 7, par: 4, lengthFt: 640, line: [{ x: 0, y: 0 }, { x: 80, y: 190 }, { x: 140, y: 360 }, { x: 110, y: 480 }, { x: 40, y: 590 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "Out right up a wooded lane, then hooks back left to the green", ref: { url: BOOK, page: 16 } },
  { n: 8, par: 3, lengthFt: 385, line: [{ x: 0, y: 0 }, { x: -20, y: 170 }, { x: -30, y: 270 }, { x: -30, y: 380 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "Long wooded tunnel drifting left, no OB", ref: { url: BOOK, page: 18 } },
  { n: 9, par: 4, lengthFt: 470, line: [{ x: 0, y: 0 }, { x: 70, y: 100 }, { x: 120, y: 180 }, { x: 130, y: 260 }, { x: 80, y: 320 }, { x: 0, y: 370 }], widthFt: 150, rough: "hazard", obZones: [{ x: -110, y: 300, w: 10, h: 90 }, { x: -110, y: 390, w: 50, h: 70 }, { x: -60, y: 460, w: 60, h: 20 }], trees: "wooded", note: "Big right-to-left sweep through the woods, the fence OB long and left", ref: { url: BOOK, page: 19 } },
  { n: 10, par: 3, lengthFt: 290, line: [{ x: 0, y: 0 }, { x: 0, y: 150 }, { x: 10, y: 280 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "Short straight wooded shot, OB only behind the tee", ref: { url: BOOK, page: 20 } },
  { n: 11, par: 5, lengthFt: 829, line: [{ x: 0, y: 0 }, { x: -90, y: 120 }, { x: -140, y: 290 }, { x: -130, y: 460 }, { x: -70, y: 600 }, { x: 0, y: 670 }, { x: 60, y: 720 }], widthFt: 150, rough: "hazard", obZones: [{ x: -60, y: 290, w: 230, h: 270 }, { x: 0, y: 560, w: 170, h: 80 }, { x: 100, y: 640, w: 70, h: 150 }], trees: "mixed", mando: "Left of the marked tree off the tee", note: "Par 5 arcing left round a big OB area inside the bend, OB right of the green", ref: { url: BOOK, page: 21 } },
  { n: 12, par: 3, lengthFt: 370, line: [{ x: 0, y: 0 }, { x: 0, y: 190 }, { x: 0, y: 370 }], widthFt: 150, rough: "hazard", obZones: [{ x: -110, y: 400, w: 220, h: 80 }, { x: 70, y: 290, w: 40, h: 110 }], trees: "wooded", note: "Straight up a wooded lane to a green with OB long", ref: { url: BOOK, page: 23 } },
  { n: 13, par: 4, lengthFt: 630, line: [{ x: 0, y: 0 }, { x: -20, y: 150 }, { x: -60, y: 340 }, { x: -60, y: 460 }, { x: -20, y: 550 }, { x: 20, y: 610 }], widthFt: 150, rough: "hazard", obZones: [{ x: 20, y: -70, w: 80, h: 490 }, { x: 60, y: 420, w: 40, h: 210 }, { x: -90, y: 650, w: 190, h: 70 }], trees: "wooded", note: "Up the left of an OB line, then back right to a green with OB long", ref: { url: BOOK, page: 25 } },
  { n: 14, par: 3, lengthFt: 350, line: [{ x: 0, y: 0 }, { x: 0, y: 180 }, { x: -10, y: 340 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "Straight wooded par 3 off a tee above the creek bed (OB behind)", ref: { url: BOOK, page: 26 } },
  { n: 15, par: 4, lengthFt: 590, line: [{ x: 0, y: 0 }, { x: 80, y: 120 }, { x: 150, y: 250 }, { x: 170, y: 360 }, { x: 140, y: 430 }, { x: 90, y: 460 }, { x: 40, y: 480 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "Long wooded arc out right and back left to the green", ref: { url: BOOK, page: 28 } },
  { n: 16, par: 4, lengthFt: 650, line: [{ x: 0, y: 0 }, { x: -20, y: 170 }, { x: -40, y: 300 }, { x: -40, y: 460 }, { x: -50, y: 570 }, { x: -60, y: 640 }], widthFt: 150, rough: "ob", trees: "mixed", note: "Narrow strung fairway with OB left, right and round the green", ref: { url: BOOK, page: 29 } },
  { n: 17, par: 3, lengthFt: 330, line: [{ x: 0, y: 0 }, { x: 0, y: 170 }, { x: 0, y: 330 }], widthFt: 150, rough: "ob", obZones: [{ x: -110, y: 20, w: 200, h: 190 }, { x: -110, y: 210, w: 100, h: 50 }, { x: 10, y: 210, w: 80, h: 50 }, { x: -110, y: 260, w: 80, h: 110 }, { x: 20, y: 260, w: 70, h: 110 }, { x: -110, y: 350, w: 200, h: 70 }], islandGreen: true, dropZone: { x: 0, y: 230 }, trees: "open", note: "Island green; a tee shot that misses plays from the DZ in front of it", ref: { url: BOOK, page: 30 } },
  { n: 18, par: 5, lengthFt: 900, line: [{ x: 0, y: 0 }, { x: -60, y: 230 }, { x: -140, y: 480 }, { x: -200, y: 680 }, { x: -250, y: 860 }], widthFt: 150, rough: "ob", hazard: [{ poly: [{ x: -250, y: 830 }, { x: -190, y: 830 }, { x: -160, y: 700 }, { x: -220, y: 700 }] }], trees: "mixed", note: "Strung par 5 up a long diagonal fairway, a hazard strip short of the green", ref: { url: BOOK, page: 32 } },
];

export const SPRINKLE_VALLEY: ProCourse = {
  id: "sprinkle-valley",
  name: "Sprinkle Valley",
  city: "Austin, TX",
  layoutLabel: "MPO",
  theme: "classic",
  book: BOOK,
  holes: HOLES,
};
