import { describe, it, expect } from "vitest";
import type { Hole, Vec, Flight, Disc } from "../lib/discgolf/engine";
import { PROTOUR_COURSES, generateTourCourse, stepFlight, resolvePenalty, treesAtLie, fullPowerRange, distBetween, ADV_DISCS, STRAIGHT_SPEED_MUL, isTeeLie, catchRFor, CATCH_R } from "../lib/discgolf/engine";

// Shared by tests/protour-bot-*.test.ts: the bot playthrough is ~10 s of CPU, so
// it runs as shards (one file each) that vitest spreads across workers.

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
    const r = stepFlight(f, disc, -1, "straight", hole, "flat", { ghostTrees, catchR: catchRFor(hole, lie, CATCH_R) });
    trail.push({ x: f.x, y: f.y });
    if (r.status !== "fly") {
      const pen = resolvePenalty(r.status, hole, { x: f.x, y: f.y }, trail, lie, isTeeLie(hole, lie));
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
// Winthrop Gold 9 flies an OB field to a shelf green; the book's walk-around
// to the right exists (the bot below holes out), but this greedy weak bot only
// measures progress along the centerline, so it never takes the detour.
// Fox Run 12's tee shot must carry ~310 ft of OB to the dirt road; the book names
// no drop zone that takes every OB throw there, so a miss re-tees (as on ID4).
// Maple Hill 8's DZ is for tee shots only (book p5): a weak bot that lays up off
// the tee and then splashes plays again from the pond's edge, 290 ft of carry.
// Harvey Penick 13: the OB creek splits the fairway and its DZ (the FPO tee) is
// still a ~200 ft carry, so a weak arm can't get over it, as on the real course.
// Pickard Park 5: only the island green is in bounds, and the MPO DZ is the FPO
// tee, still a 275 ft carry over the pond (book p5).
// Swenson Park A 12: the tee shot carries ~380 ft of pond and OB; the book's DZ
// there is optional ("may proceed"), which the game leaves off, so a miss re-tees.
// The Preserve 8: all carry over the pond; the DZ (the FPO tee) still carries it.
// The Preserve 18: ~340 ft of pond off the tee; the layup strip on the left is
// in bounds (the bot above holes out), but as on Winthrop 9 the greedy weak bot
// never takes the detour once its first short throw leaves the tee.
// Eureka Lake 13: ~220 ft of lake off the tee onto the peninsula; 17: the island
// green sits ~290 ft over the lake. A weak arm can't carry either; the tee-shot
// DZ only helps a tee shot, and this greedy bot lays up short first.
const FORCED_CARRY: Record<string, number[]> = { "maple-hill": [1, 8], idlewild: [4], "winthrop-gold": [9], "fox-run-meadows": [12], "harvey-penick": [13], "pickard-park": [5], "swenson-park-a": [12], "the-preserve": [8, 18], "eureka-lake": [13, 17] };

export function describeBotPlay(shard: number, shards: number) {
  const mine = PROTOUR_COURSES.filter((_, i) => i % shards === shard);
  describe.each(mine.map((c) => [c.course.id, c] as const))("%s is playable end to end", (_id, c) => {
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
}
