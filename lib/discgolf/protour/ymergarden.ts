// Ymergården, Borås, Sweden: Swedish Open (DGPT Elite), Jun 26–28 2026.
// MPO, par 61, 8,291 ft (2,527 m; Ymergårdens DiscGolfCenter, the Gold layout).
// Facts from the public 2026 caddie book (Google Drive PDF, linked from the
// DGPT event page); each hole cites its MPO page (holes 1, 2, 7–9, 11, 12,
// 14–16 and 18 have separate FPO and MPO pages, FPO first). Hand-placed and
// rounded to 10 ft in our own format (see ./types). Nothing from the book's map
// art is copied, traced or stored; the game draws its own holes.
// Units: the book is metric. Each page prints the length in meters AND feet;
// lengthFt is the printed feet (m × 3.281, rounded; the 18 sum to 8,291 ft =
// 2,527 m). Positions were measured on the page map and scaled by printed feet
// ÷ the drawn tee-to-basket centerline, so no meter value is converted by hand.
// A Scandinavian forest course: wooded tunnels with no OB on 5, 6, 7, 9, 12
// and 13; strung lanes (OB rough) on 3, 4 and 16; one-sided OB lines on 1, 2,
// 8, 10, 14, 15 and 18 (15 crosses an OB road at ~320 ft); hazard left of the
// road on 11; 17 is a hazard island (only the green is safe). No elevation is
// printed, so every hole is flat.
// Drop zones: none. The book's DZs on 3, 7, 10 and 16 are mando-miss DZs, which
// the game leaves off; the mandos stay as text.
// Balance: no levers. 100-round probe (Nov 12) −2.8 / −2.7 / +2.9 (Lv1 / Lv5 /
// Lv12) vs the +1.9 / −3.1 / +0.4 baseline: a short course (8,291 ft) that is
// easy for weak arms and hard for big ones in the tight woods (Lv12 OB 0.59 a
// hole). Advisory only since Oct 24. Lv1 aces 27% on the 295 ft 3, Lv5 37% on 16.
import type { ProCourse, ProHole } from "./types";

const BOOK = "https://drive.google.com/file/d/1EDCv2IKNPqg1tt8TsS16BhPyGDJLjYCY/view";

const HOLES: ProHole[] = [
  { n: 1, par: 3, lengthFt: 407, line: [{ x: 0, y: 0 }, { x: 0, y: 210 }, { x: 0, y: 400 }], widthFt: 150, rough: "hazard", obZones: [{ x: 20, y: -10, w: 60, h: 460 }, { x: -70, y: 440, w: 150, h: 50 }], trees: "wooded", note: "Straight up a wooded tunnel, OB right and long", ref: { url: BOOK, page: 8 } },
  { n: 2, par: 3, lengthFt: 358, line: [{ x: 0, y: 0 }, { x: 50, y: 140 }, { x: 70, y: 250 }, { x: 30, y: 340 }], widthFt: 150, rough: "hazard", obZones: [{ x: 110, y: 0, w: 50, h: 310 }, { x: -30, y: 380, w: 90, h: 40 }, { x: 60, y: 360, w: 70, h: 50 }, { x: 20, y: 220, w: 40, h: 40 }], trees: "mixed", note: "Up a wide lane bending back left, OB right and long, the fenced cell tower OB", ref: { url: BOOK, page: 10 } },
  { n: 3, par: 3, lengthFt: 295, line: [{ x: 0, y: 0 }, { x: 0, y: 150 }, { x: 0, y: 290 }], widthFt: 150, rough: "ob", trees: "wooded", mando: "Not right of the marked tree", note: "Short wooded lane strung OB both sides and long", ref: { url: BOOK, page: 11 } },
  { n: 4, par: 4, lengthFt: 607, line: [{ x: 0, y: 0 }, { x: -90, y: 130 }, { x: -150, y: 240 }, { x: -110, y: 320 }, { x: -50, y: 420 }, { x: 0, y: 530 }], widthFt: 150, rough: "ob", trees: "mixed", note: "Strung S-bend: up the lane to the left, then back right through the marsh", ref: { url: BOOK, page: 12 } },
  { n: 5, par: 4, lengthFt: 719, line: [{ x: 0, y: 0 }, { x: -40, y: 180 }, { x: -70, y: 330 }, { x: -120, y: 480 }, { x: -150, y: 620 }, { x: -170, y: 690 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "Long wooded par 4 drifting left up a narrow path, no OB", ref: { url: BOOK, page: 13 } },
  { n: 6, par: 3, lengthFt: 354, line: [{ x: 0, y: 0 }, { x: 0, y: 180 }, { x: 0, y: 350 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "Straight wooded tunnel to a raised green, no OB", ref: { url: BOOK, page: 14 } },
  { n: 7, par: 3, lengthFt: 367, line: [{ x: 0, y: 0 }, { x: 50, y: 90 }, { x: 80, y: 180 }, { x: 70, y: 270 }, { x: 40, y: 340 }], widthFt: 150, rough: "hazard", trees: "wooded", mando: "Not left of the marked tree", note: "Up a path bending right, then back left past the mando tree", ref: { url: BOOK, page: 16 } },
  { n: 8, par: 3, lengthFt: 335, line: [{ x: 0, y: 0 }, { x: 0, y: 170 }, { x: -10, y: 330 }], widthFt: 150, rough: "hazard", obZones: [{ x: 30, y: 130, w: 60, h: 190 }, { x: 10, y: -10, w: 80, h: 140 }, { x: 0, y: 320, w: 40, h: 60 }, { x: -70, y: 350, w: 70, h: 40 }, { x: -100, y: 220, w: 50, h: 100 }], trees: "mixed", note: "Open lane into a strung pocket, OB right, left and long", ref: { url: BOOK, page: 18 } },
  { n: 9, par: 4, lengthFt: 728, line: [{ x: 0, y: 0 }, { x: -80, y: 110 }, { x: -130, y: 250 }, { x: -110, y: 410 }, { x: -130, y: 560 }, { x: -170, y: 680 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "Long wooded tunnel snaking up and to the left, no OB", ref: { url: BOOK, page: 20 } },
  { n: 10, par: 4, lengthFt: 476, line: [{ x: 0, y: 0 }, { x: 30, y: 110 }, { x: 50, y: 240 }, { x: 20, y: 350 }, { x: -10, y: 460 }], widthFt: 150, rough: "hazard", obZones: [{ x: 20, y: 310, w: 130, h: 260 }, { x: -120, y: 500, w: 140, h: 70 }], trees: "wooded", mando: "Inside the two marked trees short of the green", note: "Wooded par 4 to a green tucked left of the OB corner, a double mando short", ref: { url: BOOK, page: 21 } },
  { n: 11, par: 3, lengthFt: 367, line: [{ x: 0, y: 0 }, { x: -30, y: 100 }, { x: -50, y: 190 }, { x: -50, y: 280 }, { x: -30, y: 360 }], widthFt: 150, rough: "hazard", hazard: [{ poly: [{ x: -140, y: 420 }, { x: -140, y: 410 }, { x: -90, y: 260 }, { x: -60, y: 150 }, { x: -40, y: 80 }, { x: -90, y: 60 }, { x: -140, y: 60 }] }], trees: "wooded", note: "Up the road edge with hazard left of the line, then right to the pin", ref: { url: BOOK, page: 23 } },
  { n: 12, par: 4, lengthFt: 587, line: [{ x: 0, y: 0 }, { x: -10, y: 140 }, { x: -50, y: 290 }, { x: -70, y: 430 }, { x: -80, y: 580 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "Long wooded path climbing gently left, no OB", ref: { url: BOOK, page: 25 } },
  { n: 13, par: 3, lengthFt: 381, line: [{ x: 0, y: 0 }, { x: 20, y: 200 }, { x: -20, y: 310 }, { x: -50, y: 370 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "Up a narrow gap, then left round the corner to the pin, no OB", ref: { url: BOOK, page: 26 } },
  { n: 14, par: 3, lengthFt: 322, line: [{ x: 0, y: 0 }, { x: -10, y: 170 }, { x: 10, y: 320 }], widthFt: 150, rough: "hazard", obZones: [{ x: 10, y: 280, w: 60, h: 70 }, { x: -30, y: 360, w: 50, h: 70 }], trees: "mixed", note: "Gap shot to an open green with the road OB long and right", ref: { url: BOOK, page: 28 } },
  { n: 15, par: 4, lengthFt: 587, line: [{ x: 0, y: 0 }, { x: 20, y: 250 }, { x: 50, y: 410 }, { x: 40, y: 580 }], widthFt: 150, rough: "hazard", obZones: [{ x: 70, y: 250, w: 70, h: 400 }, { x: 40, y: -10, w: 100, h: 260 }, { x: -40, y: 630, w: 100, h: 60 }, { x: -110, y: 560, w: 90, h: 60 }, { x: -110, y: 310, w: 170, h: 20 }], trees: "wooded", note: "Wooded par 4 over the OB road at about 320 ft, OB right and long", ref: { url: BOOK, page: 30 } },
  { n: 16, par: 3, lengthFt: 361, line: [{ x: 0, y: 0 }, { x: 0, y: 180 }, { x: 0, y: 360 }], widthFt: 150, rough: "ob", trees: "wooded", mando: "Not right of the marked tree", note: "Mando off the tee, then into a strung pocket around the green", ref: { url: BOOK, page: 32 } },
  { n: 17, par: 3, lengthFt: 269, line: [{ x: 0, y: 0 }, { x: -50, y: 130 }, { x: -90, y: 250 }], widthFt: 150, rough: "hazard", islandGreen: true, hazard: [{ poly: [{ x: -180, y: 360 }, { x: 50, y: 360 }, { x: 50, y: 30 }, { x: -180, y: 30 }], holes: [[{ x: -120, y: 270 }, { x: -110, y: 290 }, { x: -90, y: 300 }, { x: -70, y: 310 }, { x: -50, y: 300 }, { x: -40, y: 280 }, { x: -50, y: 250 }, { x: -70, y: 250 }, { x: -80, y: 230 }, { x: -100, y: 230 }, { x: -110, y: 240 }]] }], trees: "mixed", note: "Island green: everything but the green is hazard", ref: { url: BOOK, page: 33 } },
  { n: 18, par: 4, lengthFt: 771, line: [{ x: 0, y: 0 }, { x: 30, y: 210 }, { x: 80, y: 450 }, { x: 40, y: 640 }, { x: -30, y: 740 }], widthFt: 170, rough: "hazard", water: [{ x: -140, y: 550, w: 100, h: 140 }], obZones: [{ x: -140, y: 760, w: 340, h: 80 }, { x: 90, y: 610, w: 110, h: 150 }, { x: 140, y: 330, w: 60, h: 280 }, { x: 170, y: -10, w: 30, h: 340 }], trees: "mixed", note: "Long finisher up the path, OB right and long, a pond left of the green", ref: { url: BOOK, page: 35 } },
];

export const YMERGARDEN: ProCourse = {
  id: "ymergarden",
  name: "Ymergården",
  city: "Borås, Sweden",
  layoutLabel: "MPO",
  theme: "classic",
  book: BOOK,
  holes: HOLES,
};
