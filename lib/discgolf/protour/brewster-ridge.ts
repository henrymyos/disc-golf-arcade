// Brewster Ridge, Smugglers' Notch VT: Green Mountain Championship (DGPT
// Playoffs), Sep 17–20 2026, rounds 1–2. MPO, par 62, 8,655 ft. The book has no
// elevation profiles, so every hole is flat here.
// Facts from the 2026 caddie book (version dated Sep 11); each hole cites its page.
// Hand-placed and rounded to 10 ft in our own format (see ./types). Nothing from
// the book's map art is copied, traced or stored; the game draws its own holes.
import type { ProCourse, ProHole } from "./types";

const BOOK = "https://drive.google.com/file/d/1V6q58lBR3laJjSAgAMfeDPDtrmZau_ub/view";

const HOLES: ProHole[] = [
  { n: 1, par: 3, lengthFt: 385, line: [{ x: 0, y: 0 }, { x: -40, y: 40 }, { x: -70, y: 120 }, { x: -90, y: 190 }, { x: -110, y: 260 }, { x: -100, y: 320 }, { x: -90, y: 360 }], widthFt: 160, rough: "ob", obZones: [{ x: -230, y: 340, w: 120, h: 70 }, { x: -230, y: 400, w: 350, h: 80 }], trees: "wooded", note: "Climbs up and left from a corner tee; the pathway is OB long and left", ref: { url: BOOK, page: 8 } },
  { n: 2, par: 4, lengthFt: 550, line: [{ x: 0, y: 0 }, { x: -10, y: 120 }, { x: -40, y: 250 }, { x: -60, y: 390 }, { x: -80, y: 540 }], widthFt: 160, rough: "ob", trees: "wooded", note: "Long climbing tunnel; the rock wall runs tight down the right", ref: { url: BOOK, page: 10 } },
  { n: 3, par: 3, lengthFt: 320, line: [{ x: 0, y: 0 }, { x: -10, y: 110 }, { x: -20, y: 220 }, { x: -10, y: 290 }, { x: 0, y: 320 }], widthFt: 160, rough: "ob", keyTrees: [{ x: 0, y: 240, r: 20 }], trees: "wooded", note: "Short tunnel; a tree clump guards the straight line, play left of it", ref: { url: BOOK, page: 12 } },
  { n: 4, par: 4, lengthFt: 550, line: [{ x: 0, y: 0 }, { x: -50, y: 90 }, { x: -90, y: 210 }, { x: -110, y: 320 }, { x: -110, y: 430 }, { x: -110, y: 530 }], widthFt: 160, rough: "ob", trees: "wooded", note: "Climbs up and left off the tee, then straight up the hill to the pin", ref: { url: BOOK, page: 14 } },
  { n: 5, par: 3, lengthFt: 305, line: [{ x: 0, y: 0 }, { x: -10, y: 80 }, { x: -30, y: 150 }, { x: -40, y: 220 }, { x: -30, y: 270 }, { x: -20, y: 300 }], widthFt: 160, rough: "ob", trees: "wooded", note: "Rock wall OB tight left and long; the green kicks right at the end", ref: { url: BOOK, page: 15 } },
  { n: 6, par: 3, lengthFt: 345, line: [{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 10, y: 190 }, { x: 10, y: 270 }, { x: -10, y: 340 }], widthFt: 160, rough: "ob", obZones: [{ x: -130, y: 260, w: 100, h: 80 }, { x: -130, y: 370, w: 260, h: 90 }], trees: "wooded", note: "Tunnel that bends to a green with OB short-left and long", ref: { url: BOOK, page: 16 } },
  { n: 7, par: 4, lengthFt: 575, line: [{ x: 0, y: 0 }, { x: 60, y: 90 }, { x: 110, y: 190 }, { x: 130, y: 290 }, { x: 100, y: 370 }, { x: 60, y: 440 }, { x: 20, y: 520 }], widthFt: 160, rough: "ob", trees: "wooded", note: "Big right-hand bow through the woods, then back left to a walled green", ref: { url: BOOK, page: 18 } },
  { n: 8, par: 5, lengthFt: 830, line: [{ x: 0, y: 0 }, { x: -50, y: 170 }, { x: -110, y: 380 }, { x: -170, y: 580 }, { x: -200, y: 700 }, { x: -220, y: 800 }], widthFt: 170, rough: "ob", trees: "wooded", note: "The long one: three throws up a straight wooded chute that leans left", ref: { url: BOOK, page: 20 } },
  { n: 9, par: 3, lengthFt: 375, line: [{ x: 0, y: 0 }, { x: 0, y: 90 }, { x: 0, y: 210 }, { x: -10, y: 290 }, { x: -10, y: 370 }], widthFt: 160, rough: "ob", trees: "wooded", note: "Straight tunnel with a slight left bow near the green", ref: { url: BOOK, page: 22 } },
  { n: 10, par: 3, lengthFt: 475, line: [{ x: 0, y: 0 }, { x: -10, y: 150 }, { x: -20, y: 290 }, { x: -30, y: 390 }, { x: -40, y: 470 }], widthFt: 170, rough: "ob", obZones: [{ x: -160, y: 380, w: 70, h: 200 }, { x: -160, y: 510, w: 280, h: 80 }], trees: "mixed", note: "Opens up toward a green with OB left and long", ref: { url: BOOK, page: 24 } },
  { n: 11, par: 4, lengthFt: 665, line: [{ x: 0, y: 0 }, { x: -30, y: 100 }, { x: -70, y: 200 }, { x: -100, y: 320 }, { x: -120, y: 420 }, { x: -160, y: 510 }, { x: -170, y: 640 }], widthFt: 160, rough: "ob", trees: "wooded", note: "Steady climb up and left through the trees; MPO pin at the back", ref: { url: BOOK, page: 25 } },
  { n: 12, par: 3, lengthFt: 430, line: [{ x: 0, y: 0 }, { x: 10, y: 100 }, { x: 30, y: 200 }, { x: 40, y: 290 }, { x: 50, y: 360 }, { x: 40, y: 420 }], widthFt: 160, rough: "ob", obZones: [{ x: -120, y: 460, w: 290, h: 80 }], trees: "wooded", note: "Drifts right to a green on the ridge; OB on the ridge edge long", ref: { url: BOOK, page: 27 } },
  { n: 13, par: 4, lengthFt: 570, line: [{ x: 0, y: 0 }, { x: -20, y: 100 }, { x: -40, y: 210 }, { x: -40, y: 320 }, { x: -20, y: 400 }, { x: 0, y: 460 }, { x: 40, y: 500 }, { x: 70, y: 530 }], widthFt: 160, rough: "ob", trees: "wooded", note: "Starts left, then hooks hard right at the top to a tucked green", ref: { url: BOOK, page: 28 } },
  { n: 14, par: 3, lengthFt: 355, line: [{ x: 0, y: 0 }, { x: 30, y: 90 }, { x: 70, y: 200 }, { x: 90, y: 280 }, { x: 110, y: 330 }], widthFt: 160, rough: "ob", trees: "wooded", note: "Diagonal tunnel running up and right", ref: { url: BOOK, page: 30 } },
  { n: 15, par: 3, lengthFt: 400, line: [{ x: 0, y: 0 }, { x: 30, y: 80 }, { x: 50, y: 150 }, { x: 40, y: 230 }, { x: 20, y: 300 }, { x: 0, y: 380 }], widthFt: 160, rough: "ob", obZones: [{ x: -120, y: 40, w: 290, h: 120 }], trees: "wooded", note: "Carry the OB ravine to the DZ corner, then left up to a walled green", ref: { url: BOOK, page: 32 } },
  { n: 16, par: 3, lengthFt: 410, line: [{ x: 0, y: 0 }, { x: -10, y: 100 }, { x: -10, y: 210 }, { x: 0, y: 300 }, { x: 20, y: 360 }, { x: 30, y: 400 }], widthFt: 160, rough: "ob", trees: "wooded", note: "Rock wall OB all down the left; the green sits up and right", ref: { url: BOOK, page: 33 } },
  { n: 17, par: 4, lengthFt: 715, line: [{ x: 0, y: 0 }, { x: 40, y: 120 }, { x: 70, y: 230 }, { x: 80, y: 370 }, { x: 80, y: 480 }, { x: 50, y: 570 }, { x: 20, y: 650 }, { x: 10, y: 690 }], widthFt: 160, rough: "ob", obZones: [{ x: -120, y: 620, w: 70, h: 190 }, { x: -120, y: 790, w: 320, h: 20 }], trees: "wooded", note: "Out right and up, then curls left to a green with OB left and long", ref: { url: BOOK, page: 35 } },
  { n: 18, par: 3, lengthFt: 400, line: [{ x: 0, y: 0 }, { x: 10, y: 120 }, { x: 0, y: 250 }, { x: 0, y: 320 }, { x: 0, y: 400 }], widthFt: 160, rough: "ob", trees: "wooded", note: "Straight tunnel across the meadow path to the closer", ref: { url: BOOK, page: 37 } },
];

export const BREWSTER_RIDGE: ProCourse = {
  id: "brewster-ridge",
  name: "Brewster Ridge",
  city: "Smugglers' Notch, VT",
  layoutLabel: "MPO · rounds 1–2",
  theme: "classic",
  book: BOOK,
  holes: HOLES,
};
