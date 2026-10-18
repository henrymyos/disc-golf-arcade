// Black Locust South, Milford MI: Pro World Championships (Major), Aug 26–30
// 2026. MPO, par 65, 10,859 ft (the hole sum; the card prints 10,860). Facts
// from the public 2026 caddie book on Parkdly; each hole cites its PDF page.
// Hand-placed and rounded to 10 ft in our own format (see ./types). Nothing from
// the book's map art is copied, traced or stored; the game draws its own holes.
// Two halves: 2–11 are narrow wooded tunnels with no OB (hazard rough); 1, 13,
// 17 and 18 are strung OB on both sides and long, 7 and 12 are OB boxes the
// drive must carry into, and 15 crosses the lake to an island green. No
// elevation is printed, so every hole is flat.
// Drop zones: tee shots only on 7 (moved just inside the box) and 12 (the FPO
// tee inside the box). The mando re-tees on 13 and 16 and the conditional DZ on
// 15 are left to the engine's last-in-bounds default.
// Balance: widths 160–200 on the OB-heavy holes (1, 2, 6, 7, 9, 10, 11, 13, 17,
// 18) so the big-arm bag isn't punished far past the tour; balanceTrees (r 20,
// not in the book) on 1, 3, 4, 5, 6, 8, 9, 16 and 17.
import type { ProCourse, ProHole } from "./types";

const BOOK = "https://parkdly.com/share/bff7e504-e039-4668-9f0c-28632801be3b";

const HOLES: ProHole[] = [
  { n: 1, par: 3, lengthFt: 463, line: [{ x: 0, y: 0 }, { x: 10, y: 230 }, { x: 30, y: 460 }], widthFt: 170, rough: "ob", balanceTrees: [{ x: 0, y: 410, r: 20 }, { x: 60, y: 410, r: 20 }], trees: "wooded", note: "Wooded tunnel strung with OB left, right and long", ref: { url: BOOK, page: 2 } },
  { n: 2, par: 4, lengthFt: 774, line: [{ x: 0, y: 0 }, { x: -20, y: 180 }, { x: 50, y: 280 }, { x: 240, y: 610 }, { x: 220, y: 700 }], widthFt: 200, rough: "hazard", trees: "wooded", note: "Up the tunnel, then a long diagonal right before it turns up to the green", ref: { url: BOOK, page: 3 } },
  { n: 3, par: 3, lengthFt: 400, line: [{ x: 0, y: 0 }, { x: 0, y: 400 }], widthFt: 150, rough: "hazard", balanceTrees: [{ x: -30, y: 360, r: 20 }, { x: 30, y: 360, r: 20 }], trees: "wooded", note: "Dead straight 400 ft down a narrow wooded tunnel", ref: { url: BOOK, page: 4 } },
  { n: 4, par: 3, lengthFt: 390, line: [{ x: 0, y: 0 }, { x: 0, y: 390 }], widthFt: 150, rough: "hazard", balanceTrees: [{ x: -30, y: 350, r: 20 }, { x: 30, y: 350, r: 20 }], trees: "wooded", note: "Straight wooded par 3 to the MPO pin at the back", ref: { url: BOOK, page: 5 } },
  { n: 5, par: 3, lengthFt: 427, line: [{ x: 0, y: 0 }, { x: 0, y: 420 }], widthFt: 150, rough: "hazard", obZones: [{ x: -110, y: 470, w: 220, h: 40 }], balanceTrees: [{ x: -30, y: 370, r: 20 }, { x: 30, y: 370, r: 20 }], trees: "wooded", note: "Straight through the woods to a green with OB long", ref: { url: BOOK, page: 6 } },
  { n: 6, par: 5, lengthFt: 1007, line: [{ x: 0, y: 0 }, { x: -30, y: 450 }, { x: 20, y: 770 }, { x: 0, y: 1000 }], widthFt: 180, rough: "hazard", obZones: [{ x: -120, y: 20, w: 70, h: 200 }, { x: -140, y: 220, w: 50, h: 260 }], balanceTrees: [{ x: -20, y: 940, r: 20 }, { x: 40, y: 940, r: 20 }], trees: "wooded", note: "1,007 ft up a long tunnel with the fence OB out left", ref: { url: BOOK, page: 7 } },
  { n: 7, par: 3, lengthFt: 420, line: [{ x: 0, y: 0 }, { x: 10, y: 210 }, { x: 20, y: 410 }], widthFt: 190, rough: "ob", obZones: [{ x: -110, y: 20, w: 230, h: 170 }], islandGreen: true, dropZone: { x: -10, y: 210 }, trees: "wooded", note: "Carry 200 ft to an island box strung with OB; nothing short is safe", ref: { url: BOOK, page: 8 } },
  { n: 8, par: 3, lengthFt: 387, line: [{ x: 0, y: 0 }, { x: -10, y: 190 }, { x: 50, y: 380 }], widthFt: 150, rough: "hazard", balanceTrees: [{ x: 10, y: 350, r: 20 }, { x: 70, y: 330, r: 20 }], trees: "wooded", note: "Wooded tunnel easing right at the green", ref: { url: BOOK, page: 9 } },
  { n: 9, par: 3, lengthFt: 423, line: [{ x: 0, y: 0 }, { x: -10, y: 200 }, { x: 40, y: 420 }], widthFt: 160, rough: "hazard", balanceTrees: [{ x: 0, y: 380, r: 20 }, { x: 60, y: 360, r: 20 }], trees: "wooded", note: "Straight wooded par 3, drifting right late", ref: { url: BOOK, page: 10 } },
  { n: 10, par: 4, lengthFt: 866, line: [{ x: 0, y: 0 }, { x: -40, y: 260 }, { x: 50, y: 450 }, { x: 210, y: 540 }, { x: 360, y: 520 }, { x: 370, y: 460 }], widthFt: 170, rough: "hazard", trees: "wooded", note: "866 ft around a long right-hand horseshoe through the woods", ref: { url: BOOK, page: 11 } },
  { n: 11, par: 4, lengthFt: 676, line: [{ x: 0, y: 0 }, { x: -10, y: 180 }, { x: 0, y: 360 }, { x: 60, y: 480 }, { x: -30, y: 550 }, { x: -80, y: 590 }], widthFt: 170, rough: "hazard", trees: "wooded", note: "Long tunnel that kinks right, then back left to the green", ref: { url: BOOK, page: 12 } },
  { n: 12, par: 4, lengthFt: 722, line: [{ x: 0, y: 0 }, { x: 10, y: 240 }, { x: -40, y: 340 }, { x: -90, y: 400 }, { x: -120, y: 510 }, { x: -120, y: 690 }], widthFt: 150, rough: "ob", obZones: [{ x: -90, y: 20, w: 180, h: 120 }, { x: -40, y: 140, w: 130, h: 200 }], islands: [[{ x: -120, y: 150 }, { x: -120, y: 340 }]], dropZone: { x: -120, y: 180 }, trees: "mixed", note: "From outside the box, carry about 300 ft into the OB box, then up to the green", ref: { url: BOOK, page: 13 } },
  { n: 13, par: 5, lengthFt: 1165, line: [{ x: 0, y: 0 }, { x: -160, y: 250 }, { x: -130, y: 460 }, { x: 0, y: 660 }, { x: 100, y: 840 }, { x: 60, y: 960 }, { x: 0, y: 1030 }], widthFt: 190, rough: "ob", trees: "mixed", mando: "Stay left of the marked pole near the tee", note: "1,165 ft: left, then a long sweep right and back, OB on both sides", ref: { url: BOOK, page: 14 } },
  { n: 14, par: 3, lengthFt: 331, line: [{ x: 0, y: 0 }, { x: 0, y: 330 }], widthFt: 150, rough: "hazard", obZones: [{ x: 80, y: 240, w: 30, h: 140 }], trees: "mixed", note: "Straight par 3 with the OB string right near the green", ref: { url: BOOK, page: 15 } },
  { n: 15, par: 4, lengthFt: 610, line: [{ x: 0, y: 0 }, { x: 80, y: 230 }, { x: 40, y: 360 }, { x: -100, y: 540 }], widthFt: 150, rough: "ob", water: [{ x: -110, y: 380, w: 200, h: 110 }], obZones: [{ x: -180, y: 600, w: 160, h: 40 }], islandGreen: true, trees: "mixed", note: "Up an OB-strung lane, then over the lake to an island green", ref: { url: BOOK, page: 16 } },
  { n: 16, par: 3, lengthFt: 341, line: [{ x: 0, y: 0 }, { x: -10, y: 340 }], widthFt: 150, rough: "hazard", obZones: [{ x: 40, y: 20, w: 60, h: 180 }, { x: 60, y: 200, w: 50, h: 80 }], balanceTrees: [{ x: -40, y: 300, r: 20 }, { x: 20, y: 300, r: 20 }], trees: "mixed", mando: "Stay left of the marked tree", note: "Straight par 3 with the OB string right off the tee", ref: { url: BOOK, page: 17 } },
  { n: 17, par: 4, lengthFt: 673, line: [{ x: 0, y: 0 }, { x: -20, y: 190 }, { x: -10, y: 370 }, { x: -30, y: 500 }, { x: -100, y: 650 }], widthFt: 180, rough: "ob", balanceTrees: [{ x: -110, y: 590, r: 20 }, { x: -50, y: 620, r: 20 }], trees: "mixed", note: "Up a lane strung OB left, right and long, drifting left at the end", ref: { url: BOOK, page: 18 } },
  { n: 18, par: 4, lengthFt: 784, line: [{ x: 0, y: 0 }, { x: 20, y: 240 }, { x: -30, y: 500 }, { x: -40, y: 690 }, { x: -40, y: 780 }], widthFt: 200, rough: "ob", water: [{ x: 110, y: 300, w: 40, h: 400 }], trees: "mixed", note: "Lakeside finisher strung with OB, the lake just past it on the right", ref: { url: BOOK, page: 19 } },
];

export const BLACK_LOCUST_SOUTH: ProCourse = {
  id: "black-locust-south",
  name: "Black Locust South",
  city: "Milford, MI",
  layoutLabel: "MPO",
  theme: "classic",
  book: BOOK,
  holes: HOLES,
};
