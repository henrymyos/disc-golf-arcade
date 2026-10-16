import { describe, it, expect } from "vitest";
import {
  proHoleToHole,
  proHoleBoundsFt,
  PROTOUR_COURSES,
  isProTourSeed,
  proTourCourseById,
  generateTourCourse,
  courseHoles,
  tourVenue,
  TOUR_COURSES,
  stepFlight,
  resolvePenalty,
  treesAtLie,
  fullPowerRange,
  distBetween,
  pathLengthPx,
  ADV_DISCS,
  STRAIGHT_SPEED_MUL,
  W,
  TEE_BEHIND,
} from "../lib/discgolf/engine";
import type { Hole, Vec, Flight, Disc } from "../lib/discgolf/engine";
import type { ProHole } from "../lib/discgolf/protour/types";
import { SEASON_2026, BUILT_COURSE_IDS } from "../lib/discgolf/protour/season2026";
import { MAPLE_HILL } from "../lib/discgolf/protour/maple-hill";
import { BREWSTER_RIDGE } from "../lib/discgolf/protour/brewster-ridge";
import { IDLEWILD } from "../lib/discgolf/protour/idlewild";

const FT = 1.8; // FEET_PER_PX

// The MPO scorecards from the three 2026 caddie books (spec §6), typed in by
// hand so a data edit can never silently drift from the books.
const CARDS: Record<string, { par: number[]; ft: number[]; totalPar: number; totalFt: number }> = {
  "maple-hill": {
    par: [4, 3, 3, 3, 3, 3, 3, 3, 5, 3, 4, 4, 3, 3, 3, 3, 4, 4],
    ft: [868, 381, 407, 277, 262, 385, 422, 364, 950, 327, 855, 710, 472, 445, 322, 476, 730, 640],
    totalPar: 61, totalFt: 9293,
  },
  "brewster-ridge": {
    par: [3, 4, 3, 4, 3, 3, 4, 5, 3, 3, 4, 3, 4, 3, 3, 3, 4, 3],
    ft: [385, 550, 320, 550, 305, 345, 575, 830, 375, 475, 665, 430, 570, 355, 400, 410, 715, 400],
    totalPar: 62, totalFt: 8655,
  },
  idlewild: {
    par: [4, 4, 4, 4, 3, 4, 4, 4, 3, 3, 3, 4, 4, 4, 4, 5, 3, 4],
    ft: [638, 601, 656, 722, 432, 555, 484, 576, 258, 368, 242, 564, 584, 556, 487, 969, 287, 650],
    totalPar: 68, totalFt: 9629,
  },
};
const COURSES = [MAPLE_HILL, BREWSTER_RIDGE, IDLEWILD];
const lineFt = (h: ProHole) => h.line.reduce((s, p, i) => (i ? s + Math.hypot(p.x - h.line[i - 1].x, p.y - h.line[i - 1].y) : 0), 0);

describe("2026 season list", () => {
  it("lists all 23 stops in schedule order with dates, tier, city, courses and an event link", () => {
    expect(SEASON_2026).toHaveLength(23);
    SEASON_2026.forEach((s, i) => {
      expect(s.stop).toBe(i + 1);
      expect(s.event.length).toBeGreaterThan(3);
      expect(s.dates).toMatch(/^[A-Z][a-z]{2} \d/);
      expect(s.city).toMatch(/, /);
      expect(["Elite", "Elite+", "Playoffs", "Major"]).toContain(s.tier);
      expect(s.pdgaEventUrl).toMatch(/^https:\/\/www\.(pdga|dgpt)\.com\/(tour\/)?event\//);
      expect(s.courses.length).toBeGreaterThan(0);
    });
    expect(SEASON_2026.filter((s) => s.tier === "Major")).toHaveLength(5);
  });

  it("marks exactly the three pilot courses as built", () => {
    expect([...BUILT_COURSE_IDS].sort()).toEqual(["brewster-ridge", "idlewild", "maple-hill"]);
  });

  it("never shows a sponsor prefix or a tour mark in an event name", () => {
    for (const s of SEASON_2026) expect(s.event).not.toMatch(/\b(DGPT|PDGA|x OTB|Discraft|Barbasol|Innova|GRIPeq|Play it Again)\b/);
  });
});

describe.each(COURSES.map((c) => [c.id, c] as const))("%s data matches its caddie book", (id, course) => {
  const card = CARDS[id];

  it("has 18 holes with the book's par and length, hole by hole and in total", () => {
    expect(course.holes).toHaveLength(18);
    expect(course.holes.map((h) => h.n)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    expect(course.holes.map((h) => h.par)).toEqual(card.par);
    expect(course.holes.map((h) => h.lengthFt)).toEqual(card.ft);
    expect(course.holes.reduce((s, h) => s + h.par, 0)).toBe(card.totalPar);
    expect(course.holes.reduce((s, h) => s + h.lengthFt, 0)).toBe(card.totalFt);
  });

  it("keeps every centerline within ±5% of the book length (straight line never longer)", () => {
    for (const h of course.holes) {
      const len = lineFt(h);
      expect(Math.abs(len - h.lengthFt) / h.lengthFt, `hole ${h.n}`).toBeLessThanOrEqual(0.05);
      const b = h.line[h.line.length - 1];
      expect(Math.hypot(b.x, b.y), `hole ${h.n} straight line`).toBeLessThanOrEqual(h.lengthFt);
    }
  });

  it("follows the format rules: 2–8 line points from the tee, coarse 10 ft units, short notes, a book page", () => {
    for (const h of course.holes) {
      expect(h.line.length, `hole ${h.n}`).toBeGreaterThanOrEqual(2);
      expect(h.line.length, `hole ${h.n}`).toBeLessThanOrEqual(8);
      expect(h.line[0]).toEqual({ x: 0, y: 0 });
      expect(h.widthFt).toBeGreaterThanOrEqual(150);
      expect(h.widthFt).toBeLessThanOrEqual(230);
      expect((h.water ?? []).length).toBeLessThanOrEqual(6);
      expect(h.note.length, `hole ${h.n} note`).toBeLessThanOrEqual(90);
      expect(h.ref.page, `hole ${h.n}`).toBeGreaterThan(0);
      expect(h.ref.url).toBe(course.book);
      const nums: number[] = [
        ...h.line.flatMap((p) => [p.x, p.y]),
        ...[...(h.water ?? []), ...(h.obZones ?? [])].flatMap((r) => [r.x, r.y, r.w, r.h]),
        ...(h.walls ?? []).flatMap((w) => [w.x, w.y, w.w]),
        ...[...(h.keyTrees ?? []), ...(h.balanceTrees ?? [])].flatMap((t) => [t.x, t.y, t.r]),
        ...(h.dropZone ? [h.dropZone.x, h.dropZone.y] : []),
      ];
      for (const v of nums) expect(Math.abs(v % 10), `hole ${h.n}: ${v} is not rounded to 10 ft`).toBe(0);
    }
  });

  it("keeps every feature inside the hole's world bounds", () => {
    for (const h of course.holes) {
      const b = proHoleBoundsFt(h);
      const inX = (x: number) => x >= b.x0 && x <= b.x1;
      const inY = (y: number) => y >= b.y0 && y <= b.y1;
      for (const r of [...(h.water ?? []), ...(h.obZones ?? [])]) {
        expect(inX(r.x) && inX(r.x + r.w) && inY(r.y) && inY(r.y + r.h), `hole ${h.n} rect ${JSON.stringify(r)}`).toBe(true);
      }
      for (const w of h.walls ?? []) expect(inX(w.x) && inX(w.x + w.w) && inY(w.y), `hole ${h.n} wall`).toBe(true);
      for (const p of [...(h.keyTrees ?? []), ...(h.balanceTrees ?? []), ...(h.dropZone ? [h.dropZone] : [])]) expect(inX(p.x) && inY(p.y), `hole ${h.n} point`).toBe(true);
      // …and once converted, everything sits inside worldW × worldH.
      const g = proHoleToHole(h);
      const inside = (x: number, y: number) => x >= 0 && x <= (g.worldW ?? W) && y >= 0 && y <= g.worldH;
      for (const p of [g.tee, g.basket, ...g.fairway, ...g.trees, ...(g.dropZone ? [g.dropZone] : [])]) expect(inside(p.x, p.y), `hole ${h.n}`).toBe(true);
      for (const r of [...g.water, ...(g.obZones ?? [])]) expect(inside(r.x, r.y) && inside(r.x + r.w, r.y + r.h), `hole ${h.n} world rect`).toBe(true);
    }
  });

  it("puts the drop zone in bounds and never in water or roped OB", () => {
    for (const h of course.holes) {
      if (!h.dropZone) continue;
      const g = proHoleToHole(h);
      const dz = g.dropZone!;
      for (const r of [...g.water, ...(g.obZones ?? [])]) expect(dz.x > r.x && dz.x < r.x + r.w && dz.y > r.y && dz.y < r.y + r.h, `hole ${h.n}`).toBe(false);
    }
  });
});

describe("proHoleToHole (feet → world)", () => {
  const sample: ProHole = {
    n: 1, par: 4, lengthFt: 500,
    line: [{ x: 0, y: 0 }, { x: -90, y: 120 }, { x: 0, y: 300 }, { x: 180, y: 360 }],
    widthFt: 180, rough: "ob",
    water: [{ x: -40, y: 200, w: 60, h: 40 }],
    obZones: [{ x: 60, y: 300, w: 40, h: 30 }],
    islands: [[{ x: 170, y: 350 }, { x: 190, y: 370 }]],
    hazard: [{ x: 50, y: 100, d: 30 }],
    dropZone: { x: 30, y: 280 },
    walls: [{ x: -100, y: 150, w: 50 }],
    keyTrees: [{ x: 20, y: 150, r: 20 }],
    trees: "wooded",
    elevZones: [{ to: 0.5, elev: -1 }, { to: 1, elev: 2 }],
    note: "test", ref: { url: "x", page: 1 },
  };
  const g = proHoleToHole(sample);

  it("scales x and y by the same feet-per-px factor (no vertical-only stretch)", () => {
    const a = g.fairway[0], b = g.fairway[1], c = g.fairway[3];
    expect((b.x - a.x) * FT).toBeCloseTo(-90, 6);
    expect((a.y - b.y) * FT).toBeCloseTo(120, 6);
    expect((c.x - a.x) * FT).toBeCloseTo(180, 6);
    expect((a.y - c.y) * FT).toBeCloseTo(360, 6);
    // a doglegged centerline keeps its true length
    expect(pathLengthPx(g.fairway) * FT).toBeCloseTo(lineFt(sample), 6);
  });

  it("puts the tee TEE_BEHIND above the bottom and the world at least a viewport wide", () => {
    expect(g.tee.y).toBeCloseTo(g.worldH - TEE_BEHIND, 6);
    expect(g.worldW).toBeGreaterThanOrEqual(W);
    expect(g.basket).toEqual(g.fairway[g.fairway.length - 1]);
  });

  it("carries islands, drop zone, walls, slope zones, rough and book length across", () => {
    expect(g.fairways).toHaveLength(1);
    expect((g.fairways![0][1].x - g.fairways![0][0].x) * FT).toBeCloseTo(20, 6);
    expect(g.dropZone).toBeDefined();
    expect((g.dropZone!.x - g.tee.x) * FT).toBeCloseTo(30, 6);
    expect((g.tee.y - g.dropZone!.y) * FT).toBeCloseTo(280, 6);
    expect(g.elevZones).toEqual(sample.elevZones);
    expect(g.walls![0].w * FT).toBeCloseTo(50, 6);
    expect(g.fwWidth * FT).toBeCloseTo(180, 6);
    expect(g.roughIsHazard).toBeUndefined();
    expect(proHoleToHole({ ...sample, rough: "hazard" }).roughIsHazard).toBe(true);
    expect(g.treeMul).toBe(1.5);
    expect(g.bookFt).toBe(500);
    // a water rect keeps its size and its far edge maps to the smaller world y
    expect(g.water[0].w * FT).toBeCloseTo(60, 6);
    expect((g.tee.y - g.water[0].y) * FT).toBeCloseTo(240, 6);
    // the round bunker stays round
    expect(g.hazard![0].w).toBeCloseTo(g.hazard![0].h, 6);
  });

  it("keeps the key tree among the trees and fills the rest", () => {
    expect(g.trees.some((t) => Math.abs((t.x - g.tee.x) * FT - 20) < 1e-6 && Math.abs((g.tee.y - t.y) * FT - 150) < 1e-6)).toBe(true);
    expect(g.trees.length).toBeGreaterThan(1);
  });

  it("never shows a tee-to-pin distance longer than the book length", () => {
    for (const c of COURSES) {
      for (const h of c.holes) {
        const hh = proHoleToHole(h);
        expect(Math.round(distBetween(hh.tee, hh.basket) * FT), `${c.id} ${h.n}`).toBeLessThanOrEqual(h.lengthFt);
      }
    }
  });
});

describe("pro tour courses plug into the tour seed space", () => {
  it("each built course has a reserved seed that resolves to its 18 real holes", () => {
    expect(PROTOUR_COURSES.map((c) => c.course.id).sort()).toEqual(["brewster-ridge", "idlewild", "maple-hill"]);
    for (const c of PROTOUR_COURSES) {
      expect(isProTourSeed(c.seed)).toBe(true);
      expect(tourVenue(c.seed)).toBe(c.course.name);
      const holes = courseHoles("tour", c.seed);
      expect(holes).toHaveLength(18);
      expect(holes.map((h) => h.par)).toEqual(CARDS[c.course.id].par);
      expect(c.par).toBe(CARDS[c.course.id].totalPar);
      expect(c.lengthFt).toBe(CARDS[c.course.id].totalFt);
      expect(proTourCourseById(c.course.id)).toBe(c);
    }
  });

  it("is deterministic and leaves the procedural tour venues alone", () => {
    const c = PROTOUR_COURSES[0];
    expect(generateTourCourse(c.seed)).toEqual(generateTourCourse(c.seed));
    for (const t of TOUR_COURSES) expect(isProTourSeed(t.seed)).toBe(false);
  });
});

// ── Playability: a headless bot plays every hole with the real flight physics
// (stepFlight + resolvePenalty, wind included) and must hole out. It searches a
// small fan of aims, powers and discs each throw and keeps the one that leaves
// the least distance along the hole, so a hole fails only if no line through it
// exists (a blocked gate, an uncarryable pond, a drop zone in the water…).
const discs: Disc[] = ADV_DISCS;
const reach = (d: Disc) => fullPowerRange(d, 0, STRAIGHT_SPEED_MUL, 0);
const DRIVER = discs.reduce((a, b) => (reach(b) > reach(a) ? b : a));
const PUTTER = discs.reduce((a, b) => (reach(b) < reach(a) ? b : a));
const MID = [...discs].sort((a, b) => reach(a) - reach(b))[Math.floor(discs.length / 2)];

function remainingAlong(hole: Hole, p: Vec): number {
  const pts = hole.fairway;
  let best = Infinity, bestRem = 0, acc = 0;
  const segs: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) segs.push(Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y));
  const total = segs.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    const d = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    if (d < best) { best = d; bestRem = total - acc - t * segs[i]; }
    acc += segs[i];
  }
  return Math.min(bestRem + best * 0.5, distBetween(p, hole.basket) * 1.3);
}

function sim(hole: Hole, lie: Vec, disc: Disc, angle: number, power: number) {
  const speed = disc.power * (1.2 + power * 3.35) * STRAIGHT_SPEED_MUL;
  const f: Flight = { x: lie.x, y: lie.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, h: 0, vh: power * disc.arc, fadeTurn: 0 };
  const ghostTrees = treesAtLie(hole, lie.x, lie.y);
  const trail: Vec[] = [{ x: f.x, y: f.y }];
  for (let i = 0; i < 1200; i++) {
    const r = stepFlight(f, disc, -1, "straight", hole, "flat", { ghostTrees });
    trail.push({ x: f.x, y: f.y });
    if (r.status !== "fly") {
      const pen = resolvePenalty(r.status, hole, { x: f.x, y: f.y }, trail, lie);
      return { status: r.status, lie: pen.lie ?? { x: f.x, y: f.y }, strokes: 1 + pen.strokes };
    }
  }
  return { status: "stop" as const, lie: { x: f.x, y: f.y }, strokes: 1 };
}

function botPlay(hole: Hole, maxThrows: number, weak = false): { strokes: number; holed: boolean; penalties: number } {
  let lie = { ...hole.tee }, strokes = 0, penalties = 0;
  while (strokes < maxThrows) {
    const toPin = distBetween(lie, hole.basket);
    const putting = toPin < reach(PUTTER) * (weak ? 0.45 : 0.9);
    const base = Math.atan2(hole.basket.y - lie.y, hole.basket.x - lie.x);
    // aim points: the basket, and points further along the centerline
    const aims: number[] = [base];
    if (!putting) {
      for (const frac of [0.25, 0.4, 0.55, 0.7, 0.85]) {
        const total = hole.fairway.length;
        const p = hole.fairway[Math.min(total - 1, Math.max(1, Math.round(frac * (total - 1))))];
        aims.push(Math.atan2(p.y - lie.y, p.x - lie.x));
      }
    }
    let bestScore = Infinity;
    let best: ReturnType<typeof sim> | null = null;
    for (const a0 of aims) {
      for (const da of putting ? [-0.12, -0.06, -0.03, 0, 0.03, 0.06, 0.12] : [-0.3, -0.15, -0.05, 0, 0.05, 0.15, 0.3]) {
        for (const disc of putting ? [PUTTER, MID] : weak ? [MID] : [DRIVER, MID]) {
          for (const pw of putting ? [0.2, 0.3, 0.4, 0.5, 0.6, 0.75, 0.9, 1] : weak ? [0.3, 0.4, 0.5, 0.6] : [0.45, 0.6, 0.75, 0.9, 1]) {
            const r = sim(hole, lie, disc, a0 + da, pw);
            // The weak bot can't hole out from range: a throw-in only counts once putting.
            const holed = r.status === "hole" && (putting || !weak);
            const score = holed ? -1e9 + r.strokes : (r.strokes - 1) * 600 + (r.status === "hole" ? 0 : remainingAlong(hole, r.lie));
            if (score < bestScore) { bestScore = score; best = r; }
          }
        }
      }
    }
    strokes += best!.strokes;
    penalties += best!.strokes - 1;
    if (best!.status === "hole") return { strokes, holed: true, penalties };
    lie = best!.lie;
  }
  return { strokes, holed: false, penalties };
}

// Forced carries a weak arm can't make, exactly as on the real course:
// Idlewild 4's 240 ft tee pond has no drop zone (re-tee), and Maple Hill 1's
// pond fills the corridor, so a miss re-throws the ~180 ft carry from the DZ.
const FORCED_CARRY: Record<string, number[]> = { "maple-hill": [1], idlewild: [4] };

describe.each(PROTOUR_COURSES.map((c) => [c.course.id, c] as const))("%s is playable end to end", (_id, c) => {
  it("a bot holes out on all 18 holes (real physics and wind)", () => {
    const holes = generateTourCourse(c.seed);
    const results = holes.map((h, i) => ({ n: i + 1, par: h.par, ...botPlay(h, h.par + 10) }));
    const stuck = results.filter((r) => !r.holed);
    expect(stuck, `stuck on: ${stuck.map((r) => r.n).join(", ")}`).toEqual([]);
  }, 120_000);

  it("a weak-armed bot (midrange at ≤60% power, no throw-ins) also finishes every hole", () => {
    const holes = generateTourCourse(c.seed);
    const results = holes.map((h, i) => ({ n: i + 1, par: h.par, ...botPlay(h, h.par + 12, true) }));
    const stuck = results.filter((r) => !r.holed).map((r) => r.n);
    for (const n of stuck) expect(FORCED_CARRY[c.course.id] ?? [], `stuck on hole ${n}`).toContain(n);
  }, 120_000);
});
