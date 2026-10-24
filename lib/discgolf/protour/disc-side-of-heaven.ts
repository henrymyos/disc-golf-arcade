// Disc Side of Heaven, Jonesboro AR: Jonesboro Open (DGPT Elite), Apr 17–19
// 2026. MPO, par 63, 9,918 ft. Facts from the public 2026 caddie book (Google
// Drive PDF); each hole cites its MPO page. Hand-placed and rounded to 10 ft in
// our own format (see ./types). Nothing from the book's map art is copied,
// traced or stored; the game draws its own holes.
// Open parkland of tree islands round one central pond, and the pond decides 1,
// 14, 15 and 18. Lines wrap 10 and 17 (OB rough); the road fence runs left of
// 12, 13 and long on 16. 2, 3, 5, 8, 9 and 11 have no OB (hazard rough; 9 has
// the book's hazard round the tree cluster left of the green). No elevation is
// printed, so every hole is flat.
// Drop zones: tee shots only on 15 (island green) and 18; dzAll on 14 at DZ1
// (any throw from short of the pond; DZ2 left off). The 6 mando DZ is left off.
// Balance: width 150 on 2–4, 6, 7, 9–11, 13, 16, 17; balanceTrees (r 20, not
// in the book): a pair ~50 ft short of the green on 2–8, 10, 11, 13, 16, 17, and
// a second pair in the drive zone (~220–280 ft) on 4, 6, 7, 10, 11, 13, 16, 17.
// None on the signature holes 1, 12, 14, 15, 18.
// Held (Oct 23): 400-round probe −1.8 / −2.6 / +1.8 (Lv1 / Lv5 / Lv12); Lv1 is
// 3.7 under the +1.9 baseline, outside ±1.5, so the stop shows as later.
import type { ProCourse, ProHole } from "./types";

const BOOK = "https://drive.google.com/file/d/1jCVsrmF6S9xPGmjTVFZPOLvcEix-Nlir/view";

const HOLES: ProHole[] = [
  { n: 1, par: 3, lengthFt: 520, line: [{ x: 0, y: 0 }, { x: -40, y: 250 }, { x: -100, y: 510 }], widthFt: 170, rough: "hazard", water: [{ x: 20, y: 400, w: 100, h: 180 }], obZones: [{ x: -170, y: 310, w: 280, h: 110 }], trees: "mixed", note: "Carry the OB band across the fairway to a green beside the pond", ref: { url: BOOK, page: 8 } },
  { n: 2, par: 3, lengthFt: 360, line: [{ x: 0, y: 0 }, { x: -30, y: 200 }, { x: -70, y: 350 }], widthFt: 150, rough: "hazard", balanceTrees: [{ x: -30, y: 310, r: 20 }, { x: -90, y: 290, r: 20 }], trees: "mixed", note: "Up a tree-lined lane, easing left to the MPO pin at the back", ref: { url: BOOK, page: 9 } },
  { n: 3, par: 3, lengthFt: 324, line: [{ x: 0, y: 0 }, { x: -30, y: 170 }, { x: -50, y: 320 }], widthFt: 150, rough: "hazard", balanceTrees: [{ x: -10, y: 270, r: 20 }, { x: -70, y: 270, r: 20 }], trees: "mixed", note: "Short par 3 drifting left to a green behind a tree island", ref: { url: BOOK, page: 10 } },
  { n: 4, par: 4, lengthFt: 765, line: [{ x: 0, y: 0 }, { x: -10, y: 280 }, { x: -60, y: 520 }, { x: -130, y: 750 }], widthFt: 150, rough: "hazard", water: [{ x: -110, y: 790, w: 70, h: 70 }], balanceTrees: [{ x: 30, y: 280, r: 20 }, { x: -50, y: 280, r: 20 }, { x: -80, y: 710, r: 20 }, { x: -150, y: 690, r: 20 }], trees: "mixed", note: "Straight off the tee, then bending left to a green with water long and right", ref: { url: BOOK, page: 12 } },
  { n: 5, par: 3, lengthFt: 360, line: [{ x: 0, y: 0 }, { x: 0, y: 360 }], widthFt: 150, rough: "hazard", balanceTrees: [{ x: 30, y: 310, r: 20 }, { x: -30, y: 310, r: 20 }], trees: "mixed", note: "Straight up a narrow lane into a tucked wooded green", ref: { url: BOOK, page: 13 } },
  { n: 6, par: 4, lengthFt: 570, line: [{ x: 0, y: 0 }, { x: 20, y: 170 }, { x: 40, y: 320 }, { x: -30, y: 460 }, { x: -20, y: 560 }], widthFt: 150, rough: "hazard", balanceTrees: [{ x: 70, y: 250, r: 20 }, { x: 0, y: 260, r: 20 }, { x: 10, y: 510, r: 20 }, { x: -60, y: 510, r: 20 }], trees: "mixed", mando: "Right of the tee sign, then left of the marked tree near the green", note: "An S-bend through the trees: right, then back left to the green", ref: { url: BOOK, page: 14 } },
  { n: 7, par: 4, lengthFt: 685, line: [{ x: 0, y: 0 }, { x: 0, y: 340 }, { x: 30, y: 680 }], widthFt: 150, rough: "hazard", obZones: [{ x: -110, y: 380, w: 240, h: 90 }], balanceTrees: [{ x: 40, y: 280, r: 20 }, { x: -40, y: 280, r: 20 }, { x: 60, y: 630, r: 20 }, { x: 0, y: 630, r: 20 }], trees: "mixed", note: "Long par 4 over a marked OB band crossing the fairway", ref: { url: BOOK, page: 16 } },
  { n: 8, par: 3, lengthFt: 353, line: [{ x: 0, y: 0 }, { x: 50, y: 190 }, { x: 20, y: 350 }], widthFt: 150, rough: "hazard", balanceTrees: [{ x: 60, y: 310, r: 20 }, { x: 0, y: 300, r: 20 }], trees: "wooded", note: "Right up the wooded lane, then back left to the green", ref: { url: BOOK, page: 18 } },
  { n: 9, par: 3, lengthFt: 385, line: [{ x: 0, y: 0 }, { x: -50, y: 140 }, { x: -80, y: 280 }, { x: -50, y: 380 }], widthFt: 150, rough: "hazard", hazard: [{ x: -110, y: 340, d: 80 }], trees: "mixed", note: "Up the lane to a green with a hazard tree cluster on the left", ref: { url: BOOK, page: 20 } },
  { n: 10, par: 4, lengthFt: 818, line: [{ x: 0, y: 0 }, { x: -100, y: 240 }, { x: -150, y: 520 }, { x: -200, y: 720 }, { x: -210, y: 790 }], widthFt: 150, rough: "ob", balanceTrees: [{ x: -70, y: 270, r: 20 }, { x: -140, y: 250, r: 20 }, { x: -170, y: 740, r: 20 }, { x: -230, y: 740, r: 20 }], trees: "open", note: "Long lane drifting left, fence left and a line right that wraps the green", ref: { url: BOOK, page: 21 } },
  { n: 11, par: 3, lengthFt: 470, line: [{ x: 0, y: 0 }, { x: -10, y: 230 }, { x: -10, y: 460 }], widthFt: 150, rough: "hazard", balanceTrees: [{ x: 30, y: 240, r: 20 }, { x: -50, y: 240, r: 20 }, { x: 20, y: 410, r: 20 }, { x: -40, y: 410, r: 20 }], trees: "mixed", note: "Long straight par 3 up an open meadow lane", ref: { url: BOOK, page: 22 } },
  { n: 12, par: 4, lengthFt: 820, line: [{ x: 0, y: 0 }, { x: -60, y: 330 }, { x: -70, y: 590 }, { x: 0, y: 820 }], widthFt: 170, rough: "hazard", obZones: [{ x: -180, y: 100, w: 50, h: 500 }, { x: -130, y: 620, w: 40, h: 200 }], trees: "open", note: "820 ft down the road fence on the left, turning right to the green", ref: { url: BOOK, page: 24 } },
  { n: 13, par: 3, lengthFt: 435, line: [{ x: 0, y: 0 }, { x: -10, y: 220 }, { x: 10, y: 430 }], widthFt: 150, rough: "hazard", obZones: [{ x: -120, y: 100, w: 40, h: 420 }], balanceTrees: [{ x: 30, y: 220, r: 20 }, { x: -50, y: 220, r: 20 }, { x: 40, y: 380, r: 20 }, { x: -20, y: 380, r: 20 }], trees: "mixed", note: "Long par 3 with the road fence OB all down the left", ref: { url: BOOK, page: 26 } },
  { n: 14, par: 5, lengthFt: 855, line: [{ x: 0, y: 0 }, { x: -80, y: 330 }, { x: -160, y: 580 }, { x: -190, y: 830 }], widthFt: 170, rough: "hazard", water: [{ x: -280, y: 630, w: 300, h: 120 }], obZones: [{ x: -160, y: 40, w: 70, h: 240 }, { x: -120, y: 750, w: 240, h: 200 }, { x: -310, y: 890, w: 190, h: 60 }], islandGreen: true, dropZone: { x: -160, y: 600 }, dzAll: true, trees: "mixed", mando: "Not left of the tree near hole 15's island green", note: "Up to the pond's edge, then across it to an island green", ref: { url: BOOK, page: 28 } },
  { n: 15, par: 3, lengthFt: 368, line: [{ x: 0, y: 0 }, { x: 0, y: 360 }], widthFt: 150, rough: "ob", water: [{ x: -110, y: 200, w: 220, h: 130 }], obZones: [{ x: -110, y: 20, w: 220, h: 150 }, { x: -110, y: 330, w: 60, h: 90 }, { x: 40, y: 330, w: 70, h: 90 }, { x: -110, y: 420, w: 220, h: 50 }], islandGreen: true, dropZone: { x: -30, y: 180 }, trees: "mixed", note: "Over the pond to a walled island green; a missed drive plays from the DZ", ref: { url: BOOK, page: 30 } },
  { n: 16, par: 4, lengthFt: 675, line: [{ x: 0, y: 0 }, { x: -30, y: 390 }, { x: -70, y: 670 }], widthFt: 150, rough: "hazard", obZones: [{ x: -170, y: 320, w: 90, h: 300 }, { x: -180, y: 740, w: 290, h: 40 }], balanceTrees: [{ x: 10, y: 280, r: 20 }, { x: -60, y: 280, r: 20 }, { x: -30, y: 620, r: 20 }, { x: -90, y: 620, r: 20 }], trees: "open", note: "Past the marked OB on the left of the fairway; the road fence is long", ref: { url: BOOK, page: 32 } },
  { n: 17, par: 4, lengthFt: 660, line: [{ x: 0, y: 0 }, { x: -60, y: 300 }, { x: -40, y: 510 }, { x: -30, y: 650 }], widthFt: 150, rough: "ob", balanceTrees: [{ x: -20, y: 280, r: 20 }, { x: -90, y: 270, r: 20 }, { x: 0, y: 600, r: 20 }, { x: -60, y: 600, r: 20 }], trees: "mixed", note: "Up a lane with the road fence left and painted lines left, long and right", ref: { url: BOOK, page: 34 } },
  { n: 18, par: 3, lengthFt: 495, line: [{ x: 0, y: 0 }, { x: 0, y: 490 }], widthFt: 170, rough: "hazard", water: [{ x: 30, y: 440, w: 90, h: 110 }], obZones: [{ x: -120, y: 410, w: 240, h: 20 }, { x: 80, y: 220, w: 40, h: 200 }], dropZone: { x: -60, y: 550 }, trees: "mixed", note: "Long finisher over an OB gap short of the green, the pond right", ref: { url: BOOK, page: 36 } },
];

export const DISC_SIDE_OF_HEAVEN: ProCourse = {
  id: "disc-side-of-heaven",
  name: "Disc Side of Heaven",
  city: "Jonesboro, AR",
  layoutLabel: "MPO",
  theme: "classic",
  book: BOOK,
  holes: HOLES,
};
