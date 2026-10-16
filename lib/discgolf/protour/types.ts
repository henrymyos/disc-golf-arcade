// Data format for the real 2026 Pro Tour courses. Every number here is a FACT
// read off the event's public caddie book (par, length, which way a hole bends,
// where the water / OB / drop zone sit), hand-placed in our own coarse units:
// FEET, rounded to 10 ft. No map art is copied — the game draws every hole in
// its own style from these few numbers (see proHoleToHole in ../engine).
//
// Coordinates: origin = the MPO tee, +y runs toward the basket, +x is to the
// RIGHT as seen from the tee. Rects are { x, y, w, h } with (x, y) the corner
// nearest the tee on the left, so a rect covers x..x+w and y..y+h.

export type FtPt = { x: number; y: number };
export type FtRect = { x: number; y: number; w: number; h: number };

export type ProHole = {
  n: number;
  par: number;
  lengthFt: number; // the caddie book's MPO length, exact
  layout?: "A" | "B"; // which pin/tee when the book has both
  line: FtPt[]; // tee → basket centerline, 2–8 points, ends at the basket
  widthFt: number; // game corridor width (playable 150–230; narrower = woodier)
  rough: "ob" | "hazard"; // outside the corridor: OB, or +1 hazard (roughIsHazard)
  water?: FtRect[]; // ≤ 6 per hole
  obZones?: FtRect[]; // marked OB inside the corridor
  islands?: FtPt[][]; // extra in-bounds ribbons (island / peninsula greens)
  hazard?: { x: number; y: number; d: number }[]; // round bunkers (center + diameter)
  dropZone?: FtPt; // the book's main DZ only (one per hole)
  walls?: { x: number; y: number; w: number }[]; // fences / gates that block at any height
  keyTrees?: { x: number; y: number; r: number }[]; // only trees the book makes matter
  trees: "open" | "mixed" | "wooded"; // tree density → treeMul 0.6 / 1 / 1.5
  elev?: number; // −2..+2 (uphill +)
  elevZones?: { to: number; elev: number }[]; // slope that changes along the hole
  mando?: string; // the book's mandatory, in our words (not enforced in v1)
  note: string; // ≤ 90 chars, our words
  ref: { url: string; page: number }; // the caddie-book page the facts came from
};

export type ProCourse = {
  id: string; // e.g. "maple-hill"
  name: string;
  city: string;
  layoutLabel: string; // e.g. "MPO Gold · A pins (final rounds)"
  theme: string; // GROUND_THEMES key the course is drawn in
  book: string; // the public caddie book the facts came from
  holes: ProHole[];
};
