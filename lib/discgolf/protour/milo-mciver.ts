// Milo McIver (Riverbend Gold), Estacada OR: Northwest Championship (DGPT
// Elite+), Jun 4–7 2026. MPO, par 62, 9,823 ft (the event also plays
// Glendoveer East). Facts from the public 2026 caddie book (Google Drive PDF,
// linked from the DGPT event page); each hole cites its MPO page (holes 2–4, 6,
// 11, 13, 16 and 17 have separate FPO and MPO pages, FPO first). Hand-placed and
// rounded to 10 ft in our own format (see ./types). Nothing from the book's map
// art is copied, traced or stored; the game draws its own holes.
// Riverside state park: wooded lanes with the road, the parking lots and the
// Clackamas river as one-sided OB (strips on that side), roped lanes on 2, 4
// and 18, the thin OB strip in front of 6's green. Holes 7 and 13–15 have no
// OB. No elevation is printed, so every hole is flat. No drop zones or mandos
// in the book.
// Balance: no levers. 100-round probe (Nov 12) −1.8 / −3.7 / +0.7 (Lv1 / Lv5 /
// Lv12) vs the +1.9 / −3.1 / +0.4 baseline: easier at Lv1, shipped anyway (the
// band is advisory since Henry's Oct 24 call). Lv1 aces 30% on 13.
import type { ProCourse, ProHole } from "./types";

const BOOK = "https://drive.google.com/file/d/1jFGN4-HflNhcy5F7W2nFSO_J9joE1FVA/view";

const HOLES: ProHole[] = [
  { n: 1, par: 3, lengthFt: 455, line: [{ x: 0, y: 0 }, { x: -20, y: 250 }, { x: -40, y: 450 }], widthFt: 150, rough: "hazard", obZones: [{ x: -50, y: 520, w: 150, h: 40 }, { x: -140, y: 480, w: 90, h: 80 }, { x: 40, y: -90, w: 60, h: 230 }, { x: 80, y: 140, w: 20, h: 380 }], trees: "mixed", note: "Open lane to a green with OB right and long, the river beyond", ref: { url: BOOK, page: 7 } },
  { n: 2, par: 5, lengthFt: 1196, line: [{ x: 0, y: 0 }, { x: -140, y: 460 }, { x: -70, y: 880 }, { x: 40, y: 1150 }], widthFt: 200, rough: "ob", trees: "mixed", note: "1,196 ft par 5 up a long lane between the road and the river", ref: { url: BOOK, page: 9 } },
  { n: 3, par: 3, lengthFt: 400, line: [{ x: 0, y: 0 }, { x: -10, y: 230 }, { x: -10, y: 390 }], widthFt: 150, rough: "hazard", obZones: [{ x: -120, y: 280, w: 50, h: 160 }, { x: -120, y: 70, w: 20, h: 210 }, { x: -70, y: 460, w: 180, h: 40 }, { x: -120, y: 440, w: 50, h: 60 }], trees: "wooded", note: "Straight gap through the trees, OB left along the road and long", ref: { url: BOOK, page: 11 } },
  { n: 4, par: 3, lengthFt: 375, line: [{ x: 0, y: 0 }, { x: -50, y: 180 }, { x: -90, y: 360 }], widthFt: 200, rough: "ob", obZones: [{ x: -50, y: 270, w: 130, h: 110 }, { x: -20, y: 130, w: 100, h: 140 }, { x: 20, y: -110, w: 60, h: 240 }, { x: -10, y: 380, w: 90, h: 120 }], trees: "mixed", note: "Up a narrow lane with OB right, the line tight right of the green", ref: { url: BOOK, page: 13 } },
  { n: 5, par: 4, lengthFt: 630, line: [{ x: 0, y: 0 }, { x: 140, y: 320 }, { x: 140, y: 420 }, { x: 50, y: 580 }], widthFt: 150, rough: "hazard", obZones: [{ x: -110, y: -80, w: 70, h: 200 }, { x: -110, y: 120, w: 120, h: 130 }, { x: -110, y: 250, w: 180, h: 110 }, { x: -110, y: 360, w: 210, h: 90 }, { x: -110, y: 450, w: 180, h: 80 }, { x: -110, y: 530, w: 140, h: 160 }, { x: 170, y: 210, w: 20, h: 40 }], trees: "mixed", note: "Up the right of the road OB, then back left to a green tucked by the road", ref: { url: BOOK, page: 14 } },
  { n: 6, par: 3, lengthFt: 445, line: [{ x: 0, y: 0 }, { x: -50, y: 220 }, { x: -100, y: 430 }], widthFt: 150, rough: "hazard", obZones: [{ x: -210, y: 130, w: 90, h: 240 }, { x: -210, y: 0, w: 50, h: 130 }, { x: -160, y: 380, w: 140, h: 20 }, { x: 20, y: -10, w: 60, h: 70 }], trees: "mixed", note: "Over a thin OB strip to the green, the restroom OB right of the tee", ref: { url: BOOK, page: 16 } },
  { n: 7, par: 3, lengthFt: 420, line: [{ x: 0, y: 0 }, { x: -30, y: 220 }, { x: -60, y: 410 }], widthFt: 150, rough: "hazard", trees: "mixed", note: "Out of the woods into an open field; the road OB is far left", ref: { url: BOOK, page: 17 } },
  { n: 8, par: 4, lengthFt: 850, line: [{ x: 0, y: 0 }, { x: 50, y: 360 }, { x: -20, y: 640 }, { x: -90, y: 830 }], widthFt: 150, rough: "hazard", obZones: [{ x: -200, y: 910, w: 360, h: 30 }, { x: 70, y: -80, w: 90, h: 220 }, { x: 130, y: 140, w: 30, h: 130 }], trees: "wooded", note: "Long wooded lane bending gently left, road OB right and long", ref: { url: BOOK, page: 18 } },
  { n: 9, par: 3, lengthFt: 442, line: [{ x: 0, y: 0 }, { x: -30, y: 230 }, { x: -50, y: 430 }], widthFt: 150, rough: "hazard", obZones: [{ x: -160, y: 290, w: 30, h: 110 }, { x: -160, y: 400, w: 70, h: 60 }, { x: -160, y: 460, w: 100, h: 40 }, { x: -160, y: 500, w: 100, h: 40 }], trees: "mixed", note: "Through a gap to a green with the river OB long and left", ref: { url: BOOK, page: 19 } },
  { n: 10, par: 3, lengthFt: 400, line: [{ x: 0, y: 0 }, { x: -30, y: 200 }, { x: -70, y: 390 }], widthFt: 150, rough: "hazard", obZones: [{ x: -180, y: 170, w: 70, h: 240 }, { x: -180, y: 110, w: 90, h: 70 }, { x: -180, y: 50, w: 130, h: 60 }, { x: -180, y: -110, w: 160, h: 160 }], trees: "mixed", note: "Up a gap with the river OB tight left all the way to the green", ref: { url: BOOK, page: 20 } },
  { n: 11, par: 4, lengthFt: 675, line: [{ x: 0, y: 0 }, { x: 70, y: 210 }, { x: 40, y: 410 }, { x: 60, y: 570 }, { x: 100, y: 650 }], widthFt: 150, rough: "hazard", obZones: [{ x: 170, y: -90, w: 40, h: 310 }], trees: "wooded", note: "S-bend through the woods: right off the tee, back left, then right", ref: { url: BOOK, page: 22 } },
  { n: 12, par: 3, lengthFt: 450, line: [{ x: 0, y: 0 }, { x: 40, y: 190 }, { x: 50, y: 440 }], widthFt: 150, rough: "hazard", trees: "mixed", note: "Out of the trees into an open meadow to a long green, the lot OB long", ref: { url: BOOK, page: 23 } },
  { n: 13, par: 3, lengthFt: 375, line: [{ x: 0, y: 0 }, { x: -80, y: 110 }, { x: -110, y: 200 }, { x: -80, y: 280 }, { x: -30, y: 310 }], widthFt: 150, rough: "hazard", trees: "mixed", note: "Sweeping lane bending left, then right around a big tree clump", ref: { url: BOOK, page: 25 } },
  { n: 14, par: 3, lengthFt: 385, line: [{ x: 0, y: 0 }, { x: -140, y: 200 }, { x: -50, y: 310 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "Up the open lane to the left, then back right into the trees to the pin", ref: { url: BOOK, page: 26 } },
  { n: 15, par: 3, lengthFt: 281, line: [{ x: 0, y: 0 }, { x: 50, y: 160 }, { x: 0, y: 260 }], widthFt: 150, rough: "hazard", trees: "wooded", note: "Narrow tunnel bending right, then back left to the pin", ref: { url: BOOK, page: 27 } },
  { n: 16, par: 3, lengthFt: 404, line: [{ x: 0, y: 0 }, { x: 0, y: 200 }, { x: 10, y: 400 }], widthFt: 150, rough: "hazard", obZones: [{ x: -110, y: 120, w: 60, h: 390 }, { x: -110, y: -90, w: 70, h: 210 }], trees: "mixed", note: "Straight up a lane to a green in the trees, OB left all the way", ref: { url: BOOK, page: 29 } },
  { n: 17, par: 4, lengthFt: 660, line: [{ x: 0, y: 0 }, { x: 80, y: 120 }, { x: 140, y: 280 }, { x: 90, y: 430 }, { x: 0, y: 530 }, { x: -30, y: 570 }], widthFt: 150, rough: "hazard", obZones: [{ x: -70, y: 590, w: 110, h: 90 }, { x: 40, y: 560, w: 80, h: 120 }, { x: 120, y: 530, w: 80, h: 150 }, { x: -120, y: 330, w: 40, h: 270 }], trees: "wooded", note: "Up and right around the woods, then back left to a green by the road", ref: { url: BOOK, page: 31 } },
  { n: 18, par: 5, lengthFt: 980, line: [{ x: 0, y: 0 }, { x: -20, y: 400 }, { x: -100, y: 700 }, { x: -120, y: 970 }], widthFt: 150, rough: "ob", obZones: [{ x: -80, y: -90, w: 40, h: 440 }, { x: -60, y: 560, w: 40, h: 340 }], trees: "mixed", note: "980 ft up the road, crossing it into a narrow chute to the green", ref: { url: BOOK, page: 32 } },

];

export const MILO_MCIVER: ProCourse = {
  id: "milo-mciver",
  name: "Milo McIver",
  city: "Estacada, OR",
  layoutLabel: "MPO",
  theme: "classic",
  book: BOOK,
  holes: HOLES,
};
