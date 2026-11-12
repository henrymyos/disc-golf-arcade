// Olympus, Brooksville FL: Supreme Flight Open (DGPT Elite), Feb 27–Mar 1 2026.
// MPO, par 65, 10,178 ft. Facts from the public 2026 caddie book (Google Drive
// PDF, linked from the DGPT event page); each hole cites its MPO page (holes 1,
// 2, 5, 7 and 13 have separate FPO and MPO pages, FPO first). Hand-placed and
// rounded to 10 ft in our own format (see ./types). Nothing from the book's map
// art is copied, traced or stored; the game draws its own holes.
// Florida woods on a cliff edge: OB is named and mostly one-sided (property
// lines, fairway dividers, the cliff), drawn as strips on that side; every other
// edge plays the woods as hazard rough. 16 is lined all round (OB rough). 18 is
// the island finish: everything outside the landing zone and the island green
// is OB, with the book's tee-shot DZ. No elevation is printed, so every hole is
// flat.
// Drop zones: tee shots only on 18. Off: the optional ("may proceed") DZ on 3
// and the mando DZs on 5 and 17. Not modelled: casual and required-relief areas.
// This course is a different layout from the game's own hand-made "Olympus"
// (buildRound "olympus"), which stays as it is.
// Balance: no levers. 100-round probe (Nov 12) −2.2 / −4.8 / −1.6 (Lv1 / Lv5 /
// Lv12) vs the +1.9 / −3.1 / +0.4 baseline: easier at Lv1, shipped anyway (the
// band is advisory since Henry's Oct 24 call). Par-3 aces 0 / 10 / 6%.
import type { ProCourse, ProHole } from "./types";

const BOOK = "https://drive.google.com/file/d/1n1-9BFG2nZSJVnAi_jX9tv11AsNYkPLx/view";

const HOLES: ProHole[] = [
  { n: 1, par: 3, lengthFt: 347, line: [{ x: 0, y: 0 }, { x: -30, y: 190 }, { x: 40, y: 340 }], widthFt: 150, rough: "hazard", obZones: [{ x: 80, y: 0, w: 70, h: 420 }, { x: -140, y: 420, w: 290, h: 30 }], trees: "wooded", note: "Bows left through the trees, then right to a green with OB right and long", ref: { url: BOOK, page: 8 } },
  { n: 2, par: 4, lengthFt: 785, line: [{ x: 0, y: 0 }, { x: -80, y: 380 }, { x: -130, y: 770 }], widthFt: 150, rough: "hazard", obZones: [{ x: 90, y: 0, w: 20, h: 200 }, { x: 50, y: 200, w: 60, h: 300 }, { x: 10, y: 500, w: 100, h: 290 }], trees: "mixed", note: "Long par 4 drifting left, with the property line OB right", ref: { url: BOOK, page: 10 } },
  { n: 3, par: 4, lengthFt: 540, line: [{ x: 0, y: 0 }, { x: 60, y: 220 }, { x: -40, y: 530 }], widthFt: 150, rough: "hazard", obZones: [{ x: -150, y: 20, w: 90, h: 150 }, { x: 110, y: 250, w: 60, h: 190 }, { x: 10, y: 440, w: 160, h: 200 }], trees: "wooded", note: "Right past the cliff OB, then back left to a green by the road", ref: { url: BOOK, page: 11 } },
  { n: 4, par: 4, lengthFt: 723, line: [{ x: 0, y: 0 }, { x: 80, y: 300 }, { x: 60, y: 520 }, { x: 0, y: 720 }], widthFt: 150, rough: "hazard", obZones: [{ x: 150, y: 250, w: 40, h: 300 }, { x: 70, y: 550, w: 120, h: 260 }], trees: "wooded", note: "Up the fence line OB on the right, then easing left to the green", ref: { url: BOOK, page: 12 } },
  { n: 5, par: 4, lengthFt: 630, line: [{ x: 0, y: 0 }, { x: 90, y: 300 }, { x: 70, y: 480 }, { x: 30, y: 620 }], widthFt: 150, rough: "hazard", obZones: [{ x: 150, y: 460, w: 50, h: 270 }], trees: "wooded", mando: "Not left of the marked tree mid-fairway", note: "Right off the tee past the mando tree, then up to a green on the cliff", ref: { url: BOOK, page: 14 } },
  { n: 6, par: 3, lengthFt: 320, line: [{ x: 0, y: 0 }, { x: 30, y: 160 }, { x: 60, y: 310 }], widthFt: 150, rough: "hazard", trees: "mixed", note: "Short par 3 out of the woods to a green in an open meadow", ref: { url: BOOK, page: 15 } },
  { n: 7, par: 3, lengthFt: 362, line: [{ x: 0, y: 0 }, { x: -10, y: 180 }, { x: 0, y: 360 }], widthFt: 150, rough: "hazard", obZones: [{ x: 50, y: 220, w: 60, h: 180 }], trees: "mixed", note: "Straight par 3 to a green with a marked OB area right of the basket", ref: { url: BOOK, page: 17 } },
  { n: 8, par: 3, lengthFt: 445, line: [{ x: 0, y: 0 }, { x: 10, y: 220 }, { x: 20, y: 440 }], widthFt: 150, rough: "hazard", obZones: [{ x: -110, y: 0, w: 40, h: 420 }], trees: "wooded", note: "Out of a narrow tree tunnel, with the 18 fairway divider OB left", ref: { url: BOOK, page: 18 } },
  { n: 9, par: 3, lengthFt: 478, line: [{ x: 0, y: 0 }, { x: -20, y: 240 }, { x: -30, y: 470 }], widthFt: 150, rough: "hazard", trees: "mixed", note: "Long par 3 up a lane to a green on the cliff grade", ref: { url: BOOK, page: 19 } },
  { n: 10, par: 3, lengthFt: 370, line: [{ x: 0, y: 0 }, { x: 10, y: 180 }, { x: 20, y: 360 }], widthFt: 150, rough: "hazard", obZones: [{ x: 50, y: 0, w: 80, h: 470 }], trees: "wooded", note: "Straight wooded par 3 with the property line OB tight right", ref: { url: BOOK, page: 20 } },
  { n: 11, par: 4, lengthFt: 545, line: [{ x: 0, y: 0 }, { x: 110, y: 280 }, { x: -10, y: 490 }], widthFt: 150, rough: "hazard", obZones: [{ x: -120, y: 220, w: 140, h: 130 }, { x: 150, y: 120, w: 70, h: 200 }, { x: 110, y: 350, w: 110, h: 250 }], trees: "wooded", note: "Out right, then hooking left past the cliff OB; property line right", ref: { url: BOOK, page: 21 } },
  { n: 12, par: 3, lengthFt: 530, line: [{ x: 0, y: 0 }, { x: 20, y: 260 }, { x: 40, y: 520 }], widthFt: 190, rough: "hazard", obZones: [{ x: -130, y: 40, w: 270, h: 60 }, { x: -130, y: 100, w: 30, h: 430 }], trees: "mixed", note: "Long open par 3: carry the OB line short, the fairway divider OB left", ref: { url: BOOK, page: 22 } },
  { n: 13, par: 3, lengthFt: 452, line: [{ x: 0, y: 0 }, { x: 0, y: 450 }], widthFt: 170, rough: "hazard", obZones: [{ x: -120, y: 0, w: 20, h: 520 }], trees: "wooded", note: "Diagonal tunnel to a tucked green, the 14 fairway divider OB left", ref: { url: BOOK, page: 24 } },
  { n: 14, par: 4, lengthFt: 764, line: [{ x: 0, y: 0 }, { x: -10, y: 230 }, { x: -120, y: 560 }, { x: -160, y: 740 }], widthFt: 150, rough: "hazard", obZones: [{ x: -140, y: 0, w: 100, h: 150 }, { x: -200, y: 150, w: 120, h: 150 }, { x: -200, y: 300, w: 80, h: 120 }, { x: -270, y: 420, w: 110, h: 130 }, { x: -270, y: 550, w: 70, h: 300 }], trees: "wooded", note: "Gentle left with the fairway-divider OB tight left all the way", ref: { url: BOOK, page: 25 } },
  { n: 15, par: 5, lengthFt: 962, line: [{ x: 0, y: 0 }, { x: -10, y: 480 }, { x: -40, y: 960 }], widthFt: 150, rough: "hazard", obZones: [{ x: 50, y: 550, w: 60, h: 510 }], trees: "mixed", note: "962 ft par 5 up a long fairway to a green on the cliff edge right", ref: { url: BOOK, page: 26 } },
  { n: 16, par: 4, lengthFt: 695, line: [{ x: 0, y: 0 }, { x: 160, y: 360 }, { x: 10, y: 620 }], widthFt: 150, rough: "ob", trees: "wooded", note: "Right up the lane, then back left; OB right, long and on the cliff left", ref: { url: BOOK, page: 27 } },
  { n: 17, par: 4, lengthFt: 550, line: [{ x: 0, y: 0 }, { x: 0, y: 270 }, { x: 10, y: 540 }], widthFt: 150, rough: "hazard", water: [{ x: -70, y: 240, w: 60, h: 110 }], obZones: [{ x: -110, y: 0, w: 40, h: 240 }, { x: -110, y: 350, w: 60, h: 130 }, { x: -110, y: 480, w: 70, h: 100 }, { x: -110, y: 580, w: 230, h: 60 }], trees: "wooded", mando: "MPO: not right of the marked tree by the pond", note: "Past the pond on the left to a green with the cliff OB left and long", ref: { url: BOOK, page: 28 } },
  { n: 18, par: 4, lengthFt: 680, line: [{ x: 0, y: 0 }, { x: -60, y: 350 }, { x: -50, y: 670 }], widthFt: 170, rough: "ob", obZones: [{ x: -180, y: 30, w: 300, h: 250 }, { x: -180, y: 580, w: 300, h: 50 }, { x: -180, y: 630, w: 70, h: 100 }, { x: 10, y: 630, w: 110, h: 100 }, { x: -180, y: 730, w: 300, h: 60 }], islandGreen: true, dropZone: { x: -100, y: 300 }, trees: "mixed", note: "Over OB to an island landing zone, then over OB again to the island green", ref: { url: BOOK, page: 29 } },
];

export const OLYMPUS: ProCourse = {
  id: "olympus",
  name: "Olympus",
  city: "Brooksville, FL",
  layoutLabel: "MPO",
  theme: "classic",
  book: BOOK,
  holes: HOLES,
};
