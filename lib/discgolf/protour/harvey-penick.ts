// Harvey Penick, Austin TX: Open at Austin (DGPT Elite+), May 7–10 2026. MPO,
// par 63, 9,345 ft. Facts from the public 2026 caddie book (Google Drive PDF);
// each hole cites its MPO page. Hand-placed and rounded to 10 ft in our own
// format (see ./types). Nothing from the book's map art is copied, traced or
// stored; the game draws its own holes.
// Creek golf: the creek is OB on 1, 2, 7 and 13 (water here), and the book's
// marked lines make most holes OB rough. Slopes from the book's elevation
// profiles (3: +26 ft, 4: −53, 9: +31 late, 10: −34, 11: −35); holes whose page
// shows no profile stay flat.
// Drop zones: tee shots only on 2, 5 (FPO tee), 9 and 10 (island green); dzAll on
// 13 (OB creek or left before the gap). Mando and re-tee DZs are left off.
import type { ProCourse, ProHole } from "./types";

const BOOK = "https://drive.google.com/file/d/12NcwTuWemS-b02K3sGvwGMPc_j_M80yy/view";

const HOLES: ProHole[] = [
  { n: 1, par: 3, lengthFt: 410, line: [{ x: 0, y: 0 }, { x: -20, y: 200 }, { x: -50, y: 330 }, { x: -80, y: 400 }], widthFt: 150, rough: "ob", water: [{ x: -190, y: 140, w: 300, h: 120 }], obZones: [{ x: -190, y: 450, w: 300, h: 60 }], trees: "mixed", note: "Over the creek-bed OB to a green tucked left in the trees", ref: { url: BOOK, page: 12 } },
  { n: 2, par: 4, lengthFt: 740, line: [{ x: 0, y: 0 }, { x: -70, y: 280 }, { x: 0, y: 510 }, { x: 100, y: 700 }], widthFt: 150, rough: "ob", water: [{ x: -40, y: 20, w: 30, h: 300 }, { x: -90, y: 580, w: 110, h: 90 }], obZones: [{ x: -10, y: 60, w: 220, h: 260 }], dropZone: { x: -90, y: 120 }, trees: "mixed", note: "Across the creek off the tee, up the left side, then right past the pond", ref: { url: BOOK, page: 13 } },
  { n: 3, par: 3, lengthFt: 360, line: [{ x: 0, y: 0 }, { x: 0, y: 360 }], widthFt: 150, rough: "ob", water: [{ x: -30, y: 130, w: 80, h: 110 }], obZones: [{ x: -110, y: 290, w: 40, h: 120 }, { x: -110, y: 410, w: 220, h: 60 }], balanceTrees: [{ x: -30, y: 320, r: 20 }, { x: 30, y: 320, r: 20 }], trees: "mixed", elev: 1, note: "Uphill past the marked pond to a green with the path OB left and long", ref: { url: BOOK, page: 14 } },
  { n: 4, par: 3, lengthFt: 460, line: [{ x: 0, y: 0 }, { x: 30, y: 240 }, { x: 40, y: 450 }], widthFt: 150, rough: "ob", water: [{ x: 50, y: 300, w: 50, h: 90 }], obZones: [{ x: -110, y: 100, w: 60, h: 250 }, { x: -110, y: 350, w: 80, h: 140 }, { x: -110, y: 490, w: 220, h: 60 }], trees: "mixed", elev: -2, note: "Down along the left line, past the pond short and right of the green", ref: { url: BOOK, page: 16 } },
  { n: 5, par: 4, lengthFt: 650, line: [{ x: 0, y: 0 }, { x: 130, y: 250 }, { x: 180, y: 450 }, { x: 150, y: 560 }, { x: 100, y: 600 }], widthFt: 150, rough: "ob", obZones: [{ x: -110, y: 140, w: 230, h: 150 }, { x: -110, y: 290, w: 240, h: 160 }, { x: -110, y: 450, w: 140, h: 110 }, { x: 240, y: 0, w: 50, h: 600 }, { x: -110, y: 650, w: 400, h: 60 }], dropZone: { x: 110, y: 80 }, trees: "wooded", note: "Diagonal carry right onto a narrow lane, then up and back left", ref: { url: BOOK, page: 18 } },
  { n: 6, par: 4, lengthFt: 535, line: [{ x: 0, y: 0 }, { x: -90, y: 240 }, { x: -70, y: 410 }, { x: 0, y: 490 }], widthFt: 150, rough: "hazard", obZones: [{ x: 50, y: 430, w: 60, h: 170 }, { x: -60, y: 550, w: 170, h: 50 }], balanceTrees: [{ x: -50, y: 480, r: 20 }, { x: -10, y: 440, r: 20 }], trees: "wooded", note: "Bends left up a wooded lane, then back right to a green above the creek", ref: { url: BOOK, page: 19 } },
  { n: 7, par: 3, lengthFt: 305, line: [{ x: 0, y: 0 }, { x: 0, y: 150 }, { x: 0, y: 300 }], widthFt: 150, rough: "hazard", water: [{ x: -110, y: 0, w: 70, h: 200 }, { x: -110, y: 200, w: 60, h: 210 }], balanceTrees: [{ x: -30, y: 260, r: 20 }, { x: 30, y: 260, r: 20 }], trees: "wooded", note: "Straight wooded par 3 with the creek OB along the left", ref: { url: BOOK, page: 20 } },
  { n: 8, par: 4, lengthFt: 580, line: [{ x: 0, y: 0 }, { x: -120, y: 290 }, { x: -30, y: 540 }], widthFt: 150, rough: "ob", balanceTrees: [{ x: -70, y: 510, r: 20 }], trees: "wooded", note: "Narrow lane bending left, then back right to the green", ref: { url: BOOK, page: 22 } },
  { n: 9, par: 4, lengthFt: 755, line: [{ x: 0, y: 0 }, { x: -120, y: 430 }, { x: -150, y: 730 }], widthFt: 150, rough: "ob", water: [{ x: -100, y: 470, w: 60, h: 90 }], obZones: [{ x: -260, y: 20, w: 370, h: 280 }, { x: -260, y: 640, w: 370, h: 20 }], hazard: [{ x: -70, y: 530, d: 30 }], dropZone: { x: -50, y: 310 }, trees: "mixed", elevZones: [{ to: 0.7, elev: 0 }, { to: 1, elev: 1 }], note: "Carry to the fairway island past the pond, then up to the green island", ref: { url: BOOK, page: 24 } },
  { n: 10, par: 3, lengthFt: 310, line: [{ x: 0, y: 0 }, { x: -10, y: 300 }], widthFt: 150, rough: "ob", obZones: [{ x: -120, y: 20, w: 230, h: 190 }, { x: 40, y: 210, w: 70, h: 130 }, { x: -120, y: 210, w: 60, h: 130 }, { x: -120, y: 340, w: 230, h: 60 }], islandGreen: true, dropZone: { x: -10, y: 260 }, trees: "mixed", elev: -1, note: "Downhill, all carry to the island green", ref: { url: BOOK, page: 25 } },
  { n: 11, par: 5, lengthFt: 1020, line: [{ x: 0, y: 0 }, { x: 20, y: 510 }, { x: -30, y: 850 }, { x: -120, y: 1010 }], widthFt: 150, rough: "ob", water: [{ x: -90, y: 790, w: 50, h: 90 }], hazard: [{ x: 0, y: 580, d: 40 }], trees: "mixed", elev: -1, note: "1,020 ft down a long lane, past the pond OB short of the green", ref: { url: BOOK, page: 27 } },
  { n: 12, par: 3, lengthFt: 375, line: [{ x: 0, y: 0 }, { x: 30, y: 180 }, { x: 0, y: 310 }, { x: -40, y: 350 }], widthFt: 150, rough: "hazard", obZones: [{ x: 60, y: 0, w: 50, h: 300 }, { x: -150, y: 400, w: 260, h: 60 }], balanceTrees: [{ x: -30, y: 300, r: 20 }, { x: 10, y: 340, r: 20 }], trees: "mixed", note: "Curls right, then back left around a tree clump; OB right and long", ref: { url: BOOK, page: 28 } },
  { n: 13, par: 3, lengthFt: 415, line: [{ x: 0, y: 0 }, { x: 10, y: 200 }, { x: 10, y: 410 }], widthFt: 150, rough: "ob", water: [{ x: -110, y: 230, w: 130, h: 150 }, { x: 20, y: 200, w: 50, h: 160 }, { x: 70, y: 170, w: 50, h: 150 }], obZones: [{ x: -110, y: 0, w: 100, h: 230 }], dropZone: { x: 70, y: 150 }, dzAll: true, trees: "mixed", note: "Over the OB creek that splits the fairway to a green just beyond it", ref: { url: BOOK, page: 30 } },
  { n: 14, par: 4, lengthFt: 560, line: [{ x: 0, y: 0 }, { x: 80, y: 290 }, { x: 40, y: 550 }], widthFt: 150, rough: "ob", obZones: [{ x: -110, y: 0, w: 100, h: 150 }, { x: -110, y: 150, w: 130, h: 100 }, { x: -110, y: 250, w: 140, h: 110 }, { x: 110, y: 0, w: 80, h: 260 }, { x: 90, y: 260, w: 100, h: 120 }, { x: 40, y: 380, w: 150, h: 90 }, { x: 70, y: 470, w: 120, h: 190 }], hazard: [{ x: 40, y: 520, d: 30 }], balanceTrees: [{ x: 20, y: 460, r: 20 }, { x: 20, y: 500, r: 20 }], trees: "wooded", note: "Up a tight lane, then over the OB corner on the right to the green", ref: { url: BOOK, page: 31 } },
  { n: 15, par: 3, lengthFt: 430, line: [{ x: 0, y: 0 }, { x: 60, y: 420 }], widthFt: 150, rough: "hazard", obZones: [{ x: 0, y: 490, w: 90, h: 40 }, { x: 90, y: 450, w: 80, h: 80 }], trees: "mixed", note: "Straight up the open slope with the paved path OB long", ref: { url: BOOK, page: 33 } },
  { n: 16, par: 3, lengthFt: 340, line: [{ x: 0, y: 0 }, { x: -10, y: 170 }, { x: 0, y: 340 }], widthFt: 150, rough: "hazard", balanceTrees: [{ x: -30, y: 300, r: 20 }, { x: 30, y: 290, r: 20 }], trees: "wooded", note: "Straight up a narrow wooded chute", ref: { url: BOOK, page: 34 } },
  { n: 17, par: 3, lengthFt: 415, line: [{ x: 0, y: 0 }, { x: 10, y: 410 }], widthFt: 150, rough: "hazard", obZones: [{ x: -110, y: 0, w: 40, h: 520 }], balanceTrees: [{ x: -20, y: 370, r: 20 }, { x: 40, y: 360, r: 20 }], trees: "wooded", note: "Straight wooded par 3 with the creek-side OB line left", ref: { url: BOOK, page: 36 } },
  { n: 18, par: 4, lengthFt: 685, line: [{ x: 0, y: 0 }, { x: -80, y: 350 }, { x: -140, y: 670 }], widthFt: 150, rough: "ob", trees: "wooded", note: "Narrow lane between OB lines, drifting left to the green", ref: { url: BOOK, page: 38 } },
];

export const HARVEY_PENICK: ProCourse = {
  id: "harvey-penick",
  name: "Harvey Penick",
  city: "Austin, TX",
  layoutLabel: "MPO",
  theme: "classic",
  book: BOOK,
  holes: HOLES,
};
