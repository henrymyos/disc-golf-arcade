// Swenson Park A, Stockton CA: OTB Open (DGPT Elite+), May 21–24 2026.
// MPO, par 65, 10,950 ft (the A layout; the event also plays Swenson Park B).
// Facts from the public 2026 caddie book (Google Drive PDF, linked from the
// DGPT event page); each hole cites its MPO page (holes 2–5, 8–15, 17 and 18
// have separate FPO and MPO pages, FPO first). Hand-placed and rounded to 10 ft
// in our own format (see ./types). Nothing from the book's map art is copied,
// traced or stored; the game draws its own holes.
// Park course among golf greens and ponds: the traditional golf greens are OB
// (drawn as OB patches), roped lanes on 1, 2, 7, 10 and 18, water carries on
// 10, 12 and 17, the island green on 13, wooded tunnels 14 and 15 with no OB.
// No elevation is printed, so every hole is flat.
// Drop zones: 13 only (the book's MPO DZ behind the island, tee shots only).
// Off: the optional ("may proceed") DZs on 8, 10, 12 and 17 and every mando DZ
// (2, 3, 4, 5, 16, 18); the mandos stay as text.
// Balance: no levers. 100-round probe (Nov 12) +0.2 / −3.7 / +1.2 (Lv1 / Lv5 /
// Lv12) vs the +1.9 / −3.1 / +0.4 baseline: inside the advisory band. 12's
// ~380 ft carry plays +1.7 / +1.8 at Lv1 / Lv5. Lv1 aces 33% on the 323 ft 6.
import type { ProCourse, ProHole } from "./types";

const BOOK = "https://drive.google.com/file/d/1S_FvB7tjAtWO9iJG-apVI4W3w3qBFnEV/view";

const HOLES: ProHole[] = [
  { n: 1, par: 4, lengthFt: 688, line: [{ x: 0, y: 0 }, { x: -30, y: 420 }, { x: 10, y: 680 }], widthFt: 150, rough: "ob", obZones: [{ x: 10, y: 380, w: 80, h: 80 }, { x: 30, y: 460, w: 70, h: 250 }, { x: -120, y: 270, w: 40, h: 440 }, { x: 30, y: 30, w: 60, h: 70 }], trees: "mixed", note: "Up a lane that narrows past the big oaks, OB left, right and long", ref: { url: BOOK, page: 8 } },
  { n: 2, par: 4, lengthFt: 668, line: [{ x: 0, y: 0 }, { x: -200, y: 360 }, { x: -120, y: 600 }], widthFt: 150, rough: "ob", trees: "mixed", mando: "Not right of the 1st marked tree or left of the 2nd", note: "Up a roped lane to the left, then back right to a green with OB all round", ref: { url: BOOK, page: 10 } },
  { n: 3, par: 4, lengthFt: 744, line: [{ x: 0, y: 0 }, { x: -10, y: 420 }, { x: -40, y: 740 }], widthFt: 150, rough: "hazard", obZones: [{ x: -150, y: 800, w: 260, h: 50 }, { x: -150, y: 380, w: 30, h: 420 }, { x: -150, y: 170, w: 50, h: 210 }, { x: -150, y: -40, w: 90, h: 210 }], trees: "mixed", mando: "Not right of the marked flag pole", note: "Long straight lane with OB left and long, woods right", ref: { url: BOOK, page: 12 } },
  { n: 4, par: 3, lengthFt: 366, line: [{ x: 0, y: 0 }, { x: -20, y: 190 }, { x: -40, y: 360 }], widthFt: 150, rough: "hazard", obZones: [{ x: 90, y: -100, w: 20, h: 570 }], trees: "wooded", mando: "Not right of the 1st marked tree or left of the 2nd", note: "Wooded par 3 up a gap to the left, the driving range fence far right", ref: { url: BOOK, page: 14 } },
  { n: 5, par: 5, lengthFt: 1171, line: [{ x: 0, y: 0 }, { x: -70, y: 570 }, { x: -60, y: 860 }, { x: 40, y: 970 }, { x: 150, y: 1080 }], widthFt: 150, rough: "hazard", obZones: [{ x: -180, y: -70, w: 20, h: 880 }, { x: 60, y: 530, w: 150, h: 220 }, { x: -130, y: 670, w: 50, h: 60 }, { x: -120, y: 1020, w: 60, h: 60 }], trees: "mixed", mando: "Not right of the two marked trees", note: "1,171 ft up the fence line, then right past the maintenance yard to the green", ref: { url: BOOK, page: 16 } },
  { n: 6, par: 3, lengthFt: 323, line: [{ x: 0, y: 0 }, { x: 10, y: 170 }, { x: 10, y: 320 }], widthFt: 150, rough: "hazard", obZones: [{ x: -110, y: 280, w: 50, h: 150 }], trees: "mixed", note: "Short gap shot through the trees, OB left from about 280 ft", ref: { url: BOOK, page: 17 } },
  { n: 7, par: 4, lengthFt: 760, line: [{ x: 0, y: 0 }, { x: 30, y: 370 }, { x: 110, y: 750 }], widthFt: 170, rough: "ob", trees: "mixed", note: "Long lane between marked lines from about 330 ft out to the green", ref: { url: BOOK, page: 18 } },
  { n: 8, par: 3, lengthFt: 369, line: [{ x: 0, y: 0 }, { x: 0, y: 190 }, { x: 0, y: 360 }], widthFt: 190, rough: "hazard", water: [{ x: 0, y: 260, w: 70, h: 60 }], obZones: [{ x: -120, y: 300, w: 60, h: 80 }, { x: -100, y: 100, w: 90, h: 70 }, { x: 70, y: -90, w: 30, h: 340 }, { x: 40, y: 320, w: 60, h: 100 }], hazard: [{ x: -110, y: 400, d: 30 }, { x: -50, y: 460, rx: 30, ry: 20, rot: 0 }], trees: "mixed", note: "Golf greens OB left, the pond right of the green and sand long", ref: { url: BOOK, page: 20 } },
  { n: 9, par: 4, lengthFt: 790, line: [{ x: 0, y: 0 }, { x: -80, y: 390 }, { x: -60, y: 780 }], widthFt: 150, rough: "hazard", obZones: [{ x: -190, y: 260, w: 20, h: 60 }, { x: 20, y: 580, w: 40, h: 60 }, { x: -140, y: 740, w: 60, h: 60 }, { x: 20, y: -50, w: 40, h: 340 }], hazard: [{ x: -170, y: 750, d: 30 }, { x: 10, y: 580, d: 20 }], trees: "mixed", note: "Long par 4 up a tree-lined fairway, golf greens OB left, right and by the pin", ref: { url: BOOK, page: 22 } },
  { n: 10, par: 4, lengthFt: 723, line: [{ x: 0, y: 0 }, { x: -130, y: 240 }, { x: -100, y: 430 }, { x: -70, y: 530 }, { x: -40, y: 680 }], widthFt: 150, rough: "ob", water: [{ x: -210, y: 530, w: 310, h: 100 }], obZones: [{ x: -50, y: 200, w: 150, h: 330 }], trees: "mixed", note: "Carry into a narrow lane past OB right, then over the creek to the green", ref: { url: BOOK, page: 24 } },
  { n: 11, par: 3, lengthFt: 435, line: [{ x: 0, y: 0 }, { x: 0, y: 230 }, { x: 0, y: 430 }], widthFt: 230, rough: "hazard", water: [{ x: -110, y: 20, w: 120, h: 340 }, { x: -110, y: 370, w: 90, h: 200 }], obZones: [{ x: -20, y: 470, w: 110, h: 100 }], hazard: [{ x: 70, y: 360, rx: 80, ry: 30, rot: 50 }], trees: "open", note: "Straight up the edge of the pond to a green with a hazard area right", ref: { url: BOOK, page: 26 } },
  { n: 12, par: 4, lengthFt: 852, line: [{ x: 0, y: 0 }, { x: -60, y: 480 }, { x: -60, y: 650 }, { x: -60, y: 840 }], widthFt: 180, rough: "ob", water: [{ x: -70, y: 40, w: 160, h: 380 }, { x: -50, y: 610, w: 40, h: 140 }, { x: -10, y: 750, w: 120, h: 220 }], trees: "mixed", mando: "Not right of the marked flag pole", note: "Long carry over the pond, up the left of the creek to a green by the water", ref: { url: BOOK, page: 28 } },
  { n: 13, par: 3, lengthFt: 328, line: [{ x: 0, y: 0 }, { x: -10, y: 320 }], widthFt: 150, rough: "ob", water: [{ x: -110, y: 110, w: 220, h: 150 }], obZones: [{ x: -110, y: 20, w: 220, h: 90 }, { x: -110, y: 260, w: 70, h: 140 }, { x: 60, y: 260, w: 50, h: 140 }, { x: -40, y: 350, w: 100, h: 50 }], islandGreen: true, dropZone: { x: 40, y: 340 }, trees: "open", note: "Island green over the pond; a missed drive plays from the DZ at the back", ref: { url: BOOK, page: 30 } },
  { n: 14, par: 3, lengthFt: 378, line: [{ x: 0, y: 0 }, { x: -10, y: 190 }, { x: -30, y: 370 }], widthFt: 150, rough: "hazard", trees: "wooded", mando: "Not right of or above the marked tree off the tee (re-tee)", note: "Wooded tunnel par 3 with a mando tree off the tee", ref: { url: BOOK, page: 32 } },
  { n: 15, par: 3, lengthFt: 425, line: [{ x: 0, y: 0 }, { x: -30, y: 210 }, { x: -70, y: 410 }], widthFt: 150, rough: "hazard", trees: "wooded", mando: "Not right of the marked tree off the tee (re-tee)", note: "Wooded tunnel angling left to a green in the trees", ref: { url: BOOK, page: 34 } },
  { n: 16, par: 3, lengthFt: 347, line: [{ x: 0, y: 0 }, { x: 0, y: 170 }, { x: 10, y: 340 }], widthFt: 150, rough: "hazard", obZones: [{ x: -110, y: -60, w: 50, h: 230 }, { x: -110, y: 170, w: 70, h: 170 }, { x: -110, y: 340, w: 80, h: 110 }, { x: -30, y: 410, w: 110, h: 40 }, { x: 20, y: 260, w: 60, h: 80 }], trees: "mixed", mando: "Not right of the marked tree", note: "Short shot along the creek with OB left and long, a golf green right", ref: { url: BOOK, page: 35 } },
  { n: 17, par: 4, lengthFt: 846, line: [{ x: 0, y: 0 }, { x: 70, y: 450 }, { x: 70, y: 620 }, { x: -30, y: 820 }], widthFt: 180, rough: "ob", water: [{ x: -90, y: 520, w: 120, h: 140 }, { x: 30, y: 560, w: 90, h: 100 }], obZones: [{ x: -20, y: 320, w: 50, h: 80 }, { x: -100, y: 220, w: 80, h: 110 }, { x: -120, y: 690, w: 70, h: 190 }, { x: 40, y: 740, w: 60, h: 80 }, { x: 100, y: 660, w: 60, h: 80 }], trees: "mixed", mando: "Not right of or above the marked tree off the tee", note: "Tee shot past the golf greens, then over the creek to a narrow green lobe", ref: { url: BOOK, page: 37 } },
  { n: 18, par: 4, lengthFt: 737, line: [{ x: 0, y: 0 }, { x: 0, y: 370 }, { x: -20, y: 590 }, { x: 0, y: 730 }], widthFt: 150, rough: "ob", water: [{ x: 20, y: 500, w: 70, h: 200 }, { x: -130, y: 760, w: 240, h: 80 }], trees: "mixed", mando: "Not left of the marked tree", note: "Long lane up to a narrow green with the pond right and long", ref: { url: BOOK, page: 39 } },

];

export const SWENSON_PARK_A: ProCourse = {
  id: "swenson-park-a",
  name: "Swenson Park A",
  city: "Stockton, CA",
  layoutLabel: "MPO",
  theme: "classic",
  book: BOOK,
  holes: HOLES,
};
