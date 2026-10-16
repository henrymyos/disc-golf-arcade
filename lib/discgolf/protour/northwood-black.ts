// Northwood Black, Morton IL: Ledgestone Open (DGPT Elite+), Jul 30–Aug 2 2026.
// MPO, par 68, 10,499 ft. Facts from the public 2026 caddie book (Google Drive
// PDF); each hole cites its MPO page. Hand-placed and rounded to 10 ft in our own
// format (see ./types). Nothing from the book's map art is copied, traced or
// stored; the game draws its own holes.
// The woods course: OB is one-sided and named (stakes, fences, the road), drawn
// as strips on that side only; every other edge plays the woods as hazard rough.
// Drop zones: dzAll on 8 and 17 (any OB throw). Flat: no elevation.
import type { ProCourse, ProHole } from "./types";

const BOOK = "https://drive.google.com/file/d/1gFu0KFDA0nXHv4cqqwYYvXNsGtXAZTy-/view";

const HOLES: ProHole[] = [
  { n: 1, par: 3, lengthFt: 455, line: [{ x: 0, y: 0 }, { x: 10, y: 230 }, { x: 20, y: 450 }], widthFt: 150, rough: "hazard", obZones: [{ x: -110, y: 60, w: 50, h: 440 }, { x: -110, y: 520, w: 240, h: 40 }], trees: "wooded", note: "Straight wooded tunnel with the OB stakes left and long", ref: { url: BOOK, page: 7 } },
  { n: 2, par: 4, lengthFt: 580, line: [{ x: 0, y: 0 }, { x: -50, y: 140 }, { x: -90, y: 330 }, { x: -60, y: 450 }, { x: 10, y: 540 }], widthFt: 150, rough: "hazard", balanceTrees: [{ x: -40, y: 520, r: 20 }, { x: 10, y: 490, r: 20 }], trees: "wooded", note: "Bows left through the woods, then back right to the green", ref: { url: BOOK, page: 9 } },
  { n: 3, par: 4, lengthFt: 604, line: [{ x: 0, y: 0 }, { x: -70, y: 220 }, { x: -110, y: 350 }, { x: -100, y: 460 }, { x: -90, y: 590 }], widthFt: 150, rough: "hazard", balanceTrees: [{ x: -120, y: 550, r: 20 }, { x: -60, y: 540, r: 20 }], trees: "wooded", note: "Left off the tee, then straight up a long wooded tunnel", ref: { url: BOOK, page: 11 } },
  { n: 4, par: 4, lengthFt: 637, line: [{ x: 0, y: 0 }, { x: 50, y: 250 }, { x: 90, y: 420 }, { x: 60, y: 520 }, { x: 10, y: 610 }], widthFt: 150, rough: "hazard", balanceTrees: [{ x: 10, y: 560, r: 20 }, { x: 60, y: 590, r: 20 }], trees: "wooded", note: "Long tunnel bending right, then back left to the green", ref: { url: BOOK, page: 13 } },
  { n: 5, par: 4, lengthFt: 451, line: [{ x: 0, y: 0 }, { x: 60, y: 160 }, { x: 120, y: 260 }, { x: 40, y: 300 }, { x: 10, y: 370 }], widthFt: 150, rough: "hazard", balanceTrees: [{ x: 0, y: 320, r: 20 }, { x: 60, y: 340, r: 20 }], trees: "wooded", note: "Up and right, then a hard turn back left into the green", ref: { url: BOOK, page: 14 } },
  { n: 6, par: 5, lengthFt: 947, line: [{ x: 0, y: 0 }, { x: 160, y: 350 }, { x: 250, y: 520 }, { x: 210, y: 600 }, { x: 50, y: 620 }, { x: -70, y: 610 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "947 ft: a long right-leaning tunnel, then a hard left along the top", ref: { url: BOOK, page: 16 } },
  { n: 7, par: 3, lengthFt: 325, line: [{ x: 0, y: 0 }, { x: 0, y: 160 }, { x: 0, y: 320 }], widthFt: 150, rough: "hazard", obZones: [{ x: 50, y: 0, w: 60, h: 430 }], trees: "wooded", note: "Straight wooded par 3 with the OB stakes right the whole way", ref: { url: BOOK, page: 17 } },
  { n: 8, par: 3, lengthFt: 389, line: [{ x: 0, y: 0 }, { x: -10, y: 200 }, { x: -20, y: 380 }], widthFt: 150, rough: "hazard", water: [{ x: -20, y: 60, w: 20, h: 40 }], obZones: [{ x: 0, y: 20, w: 110, h: 20 }, { x: -40, y: 40, w: 150, h: 70 }, { x: -70, y: 110, w: 180, h: 60 }, { x: -40, y: 170, w: 150, h: 50 }, { x: -20, y: 220, w: 130, h: 50 }, { x: 10, y: 270, w: 100, h: 50 }, { x: 20, y: 320, w: 90, h: 100 }, { x: -130, y: 420, w: 240, h: 70 }], dropZone: { x: -40, y: 260 }, dzAll: true, trees: "wooded", note: "Carry the pond and the OB wedge right to a green with OB long", ref: { url: BOOK, page: 18 } },
  { n: 9, par: 4, lengthFt: 732, line: [{ x: 0, y: 0 }, { x: -80, y: 190 }, { x: -110, y: 460 }, { x: -130, y: 710 }], widthFt: 150, rough: "hazard", balanceTrees: [{ x: -160, y: 660, r: 20 }, { x: -100, y: 670, r: 20 }], trees: "wooded", note: "Long gentle left through a wooded tunnel", ref: { url: BOOK, page: 20 } },
  { n: 10, par: 3, lengthFt: 400, line: [{ x: 0, y: 0 }, { x: 40, y: 200 }, { x: 70, y: 390 }], widthFt: 150, rough: "hazard", obZones: [{ x: -110, y: 0, w: 90, h: 90 }, { x: -110, y: 90, w: 70, h: 90 }, { x: -110, y: 180, w: 50, h: 80 }], trees: "mixed", note: "Diagonal up and right through gaps in the woods; fenced OB left", ref: { url: BOOK, page: 22 } },
  { n: 11, par: 3, lengthFt: 380, line: [{ x: 0, y: 0 }, { x: -20, y: 190 }, { x: -40, y: 370 }], widthFt: 150, rough: "hazard", balanceTrees: [{ x: -60, y: 320, r: 20 }, { x: -10, y: 330, r: 20 }], trees: "wooded", note: "Straight, drifting left, down a wooded chute", ref: { url: BOOK, page: 24 } },
  { n: 12, par: 5, lengthFt: 1050, line: [{ x: 0, y: 0 }, { x: -100, y: 310 }, { x: -130, y: 630 }, { x: -80, y: 880 }, { x: -20, y: 1020 }], widthFt: 150, rough: "hazard", obZones: [{ x: -240, y: 1080, w: 350, h: 50 }], trees: "wooded", note: "1,050 ft through the woods, left then right, with the road OB long", ref: { url: BOOK, page: 26 } },
  { n: 13, par: 4, lengthFt: 653, line: [{ x: 0, y: 0 }, { x: 50, y: 300 }, { x: 40, y: 450 }, { x: 60, y: 540 }, { x: 140, y: 630 }], widthFt: 150, rough: "hazard", water: [{ x: 70, y: 550, w: 70, h: 50 }], trees: "wooded", note: "S-bend up the woods to a green guarded by a staked pond short", ref: { url: BOOK, page: 28 } },
  { n: 14, par: 5, lengthFt: 893, line: [{ x: 0, y: 0 }, { x: 220, y: 250 }, { x: 210, y: 430 }, { x: 70, y: 610 }, { x: -30, y: 730 }], widthFt: 150, rough: "hazard", obZones: [{ x: 270, y: 250, w: 60, h: 180 }, { x: 150, y: 430, w: 180, h: 180 }, { x: 90, y: 610, w: 240, h: 90 }, { x: 30, y: 700, w: 300, h: 70 }], trees: "wooded", note: "A long right sweep along the fence OB, then back left to the green", ref: { url: BOOK, page: 30 } },
  { n: 15, par: 4, lengthFt: 650, line: [{ x: 0, y: 0 }, { x: -20, y: 250 }, { x: -60, y: 480 }, { x: -80, y: 640 }], widthFt: 150, rough: "hazard", obZones: [{ x: -110, y: 0, w: 60, h: 330 }, { x: -150, y: 330, w: 60, h: 320 }], trees: "wooded", note: "Straight up the woods with the OB stake line tight left", ref: { url: BOOK, page: 32 } },
  { n: 16, par: 3, lengthFt: 330, line: [{ x: 0, y: 0 }, { x: -10, y: 170 }, { x: 0, y: 330 }], widthFt: 150, rough: "hazard", balanceTrees: [{ x: -30, y: 290, r: 20 }, { x: 30, y: 280, r: 20 }], trees: "wooded", note: "Straight wooded par 3 past the creek and boardwalk on the left", ref: { url: BOOK, page: 33 } },
  { n: 17, par: 3, lengthFt: 320, line: [{ x: 0, y: 0 }, { x: 0, y: 320 }], widthFt: 150, rough: "hazard", water: [{ x: -70, y: 260, w: 70, h: 20 }, { x: 0, y: 280, w: 70, h: 20 }], obZones: [{ x: -110, y: 0, w: 90, h: 280 }, { x: -110, y: 280, w: 60, h: 90 }, { x: -110, y: 370, w: 220, h: 40 }, { x: 40, y: 330, w: 70, h: 80 }], dropZone: { x: 20, y: 220 }, dzAll: true, trees: "mixed", note: "Over the creek to a green with OB stakes left and long", ref: { url: BOOK, page: 34 } },
  { n: 18, par: 4, lengthFt: 703, line: [{ x: 0, y: 0 }, { x: -50, y: 240 }, { x: -30, y: 440 }, { x: 40, y: 560 }, { x: 110, y: 680 }], widthFt: 150, rough: "hazard", obZones: [{ x: -140, y: 740, w: 360, h: 40 }, { x: 180, y: 570, w: 40, h: 170 }], balanceTrees: [{ x: 60, y: 660, r: 20 }, { x: 110, y: 630, r: 20 }], trees: "wooded", note: "S-bend through the woods to a green with the road and lot long", ref: { url: BOOK, page: 36 } },
];

export const NORTHWOOD_BLACK: ProCourse = {
  id: "northwood-black",
  name: "Northwood Black",
  city: "Morton, IL",
  layoutLabel: "MPO",
  theme: "classic",
  book: BOOK,
  holes: HOLES,
};
