// Dev-only balance probe for the 2026 Pro Tour holes (no physics touched).
//
// Plays every hole with a bot that picks its line like the playability bot,
// then throws it with human-like error (Gaussian aim and power noise), at three
// bag levels. It runs the existing courses (Glendoveer East, Winthrop Lake,
// Olympus and the eight Tour Venues) as the difficulty baseline, then the 2026
// pilot courses, and logs score vs par, ace, birdie, bogey and OB rates per
// course and per pilot hole.
//
// Skipped in the normal suite. Run it with:
//   DGA_BALANCE=1 npx vitest run tests/protour-balance.test.ts
// Optional: DGA_BALANCE_ROUNDS=<n> (default 10), DGA_BALANCE_OUT=<file> (copy of
// the tables), DGA_BALANCE_ONLY=pilot|baseline (run one group),
// DGA_BALANCE_COURSE=<name> (one course, e.g. "Maple Hill").
import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import {
  PROTOUR_COURSES,
  TOUR_COURSES,
  buildRound,
  stepFlight,
  resolvePenalty,
  catchRFor,
  isTeeLie,
  CATCH_R,
  treesAtLie,
  fullPowerRange,
  distBetween,
  mulberry32,
  discByKey,
  STRAIGHT_SPEED_MUL,
} from "../lib/discgolf/engine";
import type { Hole, Vec, Flight, Disc, Mode } from "../lib/discgolf/engine";

const RUN = !!process.env.DGA_BALANCE;
const ROUNDS = Number(process.env.DGA_BALANCE_ROUNDS ?? 10);

// Bags a real player would carry (non-career play has no skill mods).
const BAGS: { label: string; keys: string[] }[] = [
  { label: "Lv1 starter (Aviar, Buzzz)", keys: ["aviar", "buzzz"] },
  { label: "Lv5 (+ Teebird, River, Firebird)", keys: ["aviar", "buzzz", "teebird", "river", "firebird"] },
  { label: "Lv12 (Aviar, Buzzz, Teebird, Destroyer, Wraith)", keys: ["aviar", "buzzz", "teebird", "destroyer", "wraith"] },
];
// Human-like error: σ of the release angle (rad) and of the power (0–1 scale).
const PROFILES = [
  { label: "human (σ 3°, power σ 0.07)", aim: 0.052, power: 0.07 },
];

const reach = (d: Disc) => fullPowerRange(d, 0, STRAIGHT_SPEED_MUL, 0);

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

const gauss = (rnd: () => number) => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());

// Plan the nominal best throw (no error), then throw it with noise.
function playHole(hole: Hole, bag: Disc[], prof: { aim: number; power: number }, rnd: () => number, cap: number): { strokes: number; ob: number } {
  const putter = bag.reduce((a, b) => (reach(b) < reach(a) ? b : a));
  const long = [...bag].sort((a, b) => reach(b) - reach(a)).slice(0, 2);
  let lie = { ...hole.tee }, strokes = 0, ob = 0;
  while (strokes < cap) {
    const putting = distBetween(lie, hole.basket) < reach(putter) * 0.9;
    const base = Math.atan2(hole.basket.y - lie.y, hole.basket.x - lie.x);
    const aims = [base];
    if (!putting) for (const frac of [0.3, 0.55, 0.8]) {
      const n = hole.fairway.length;
      const p = hole.fairway[Math.min(n - 1, Math.max(1, Math.round(frac * (n - 1))))];
      aims.push(Math.atan2(p.y - lie.y, p.x - lie.x));
    }
    let bestScore = Infinity, plan = { disc: putter, angle: base, power: 0.5 };
    for (const a0 of aims) for (const da of putting ? [-0.06, -0.03, 0, 0.03, 0.06] : [-0.2, -0.08, 0, 0.08, 0.2]) {
      for (const disc of putting ? [putter] : [...long, putter]) {
        for (const pw of putting ? [0.25, 0.4, 0.55, 0.7, 0.85, 1] : [0.5, 0.65, 0.8, 0.9, 1]) {
          const r = sim(hole, lie, disc, a0 + da, pw);
          const score = r.status === "hole" ? -1e9 : (r.strokes - 1) * 100 + remainingAlong(hole, r.lie);
          if (score < bestScore) { bestScore = score; plan = { disc, angle: a0 + da, power: pw }; }
        }
      }
    }
    const angle = plan.angle + gauss(rnd) * prof.aim;
    const power = Math.max(0.05, Math.min(1, plan.power + gauss(rnd) * prof.power));
    const r = sim(hole, lie, plan.disc, angle, power);
    strokes += r.strokes;
    ob += r.strokes - 1;
    if (r.status === "hole") return { strokes, ob };
    lie = r.lie;
  }
  return { strokes, ob };
}

type Course = { id: string; group: "baseline" | "pilot"; par: number; holes: (round: number) => Hole[] };
const fixed = (id: string, mode: Mode): Course => {
  const h0 = buildRound(1, mode);
  return { id, group: "baseline", par: h0.reduce((s, h) => s + h.par, 0), holes: (r) => buildRound(0x51ed + r * 7919, mode) };
};
const COURSES: Course[] = [
  fixed("Glendoveer East", "course"),
  fixed("Winthrop Lake", "winthrop"),
  fixed("Olympus", "olympus"),
  ...TOUR_COURSES.map((t): Course => ({ id: t.name, group: "baseline", par: t.par, holes: () => buildRound(t.seed, "tour") })),
  ...PROTOUR_COURSES.map((c): Course => ({ id: c.course.name, group: "pilot", par: c.par, holes: () => buildRound(c.seed, "tour") })),
].filter((c) => (!process.env.DGA_BALANCE_ONLY || c.group === process.env.DGA_BALANCE_ONLY) && (!process.env.DGA_BALANCE_COURSE || c.id === process.env.DGA_BALANCE_COURSE));

type Stat = { n: number; toPar: number; aces: number; par3: number; aces3: number; birdies: number; bogeys: number; ob: number };
const blank = (): Stat => ({ n: 0, toPar: 0, aces: 0, par3: 0, aces3: 0, birdies: 0, bogeys: 0, ob: 0 });

describe.skipIf(!RUN)("Pro Tour balance probe (dev only)", () => {
  it("logs score vs par, ace, birdie, bogey and OB rates per course and bag level", () => {
    const prof = PROFILES[0];
    const course: Record<string, Record<string, Stat>> = {};
    const perHole: Record<string, Record<string, Stat[]>> = {};
    for (const bagDef of BAGS) {
      const bag = bagDef.keys.map((k) => discByKey(k)).filter((d): d is Disc => !!d);
      expect(bag).toHaveLength(bagDef.keys.length);
      for (const c of COURSES) {
        const rnd = mulberry32((c.par * 7919) ^ c.id.length ^ 0x5eed);
        const st = blank();
        const holesStat = Array.from({ length: 18 }, blank);
        for (let r = 0; r < ROUNDS; r++) {
          c.holes(r).forEach((h, i) => {
            const { strokes: s, ob } = playHole(h, bag, prof, rnd, h.par + 8);
            for (const x of [st, holesStat[i]]) {
              x.n++; x.toPar += s - h.par; x.ob += ob;
              if (s === 1) x.aces++;
              if (s < h.par) x.birdies++;
              if (s > h.par) x.bogeys++;
              if (h.par === 3) { x.par3++; if (s === 1) x.aces3++; }
            }
          });
        }
        (course[c.id] ??= {})[bagDef.label] = st;
        if (c.group === "pilot") (perHole[c.id] ??= {})[bagDef.label] = holesStat;
      }
    }
    const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : "-");
    const sgn = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`;
    const per18 = (x: Stat) => (x.toPar / x.n) * 18;
    const out: string[] = [`Pro Tour balance probe · ${prof.label} · ${ROUNDS} rounds per course per bag · physics and catch radius unchanged`, ""];
    out.push("| Course | Group | Bag | Avg vs par / 18 | Ace % (all) | Ace % (par 3s) | Birdie or better % | Bogey or worse % | OB per hole |", "|---|---|---|---|---|---|---|---|---|");
    for (const c of COURSES) for (const b of BAGS) {
      const x = course[c.id][b.label];
      out.push(`| ${c.id} | ${c.group} | ${b.label} | ${sgn(per18(x))} | ${pct(x.aces, x.n)} | ${pct(x.aces3, x.par3)} | ${pct(x.birdies, x.n)} | ${pct(x.bogeys, x.n)} | ${(x.ob / x.n).toFixed(2)} |`);
    }
    out.push("", "| Bag | Baseline avg vs par / 18 (range) | " + PROTOUR_COURSES.map((c) => c.course.name).join(" | ") + " |", "|---|---|" + PROTOUR_COURSES.map(() => "---|").join(""));
    const summary: Record<string, { baseline: number | null; pilots: Record<string, number> }> = {};
    for (const b of BAGS) {
      const base = COURSES.filter((c) => c.group === "baseline").map((c) => per18(course[c.id][b.label]));
      const mean = base.length ? base.reduce((s, v) => s + v, 0) / base.length : null;
      const pil = Object.fromEntries(COURSES.filter((c) => c.group === "pilot").map((c) => [c.id, per18(course[c.id][b.label])]));
      summary[b.label] = { baseline: mean, pilots: pil };
      out.push(`| ${b.label} | ${mean == null ? "-" : `${sgn(mean)} (${sgn(Math.min(...base))} to ${sgn(Math.max(...base))})`} | ` + PROTOUR_COURSES.map((c) => (pil[c.course.name] == null ? "-" : `${sgn(pil[c.course.name])}${mean == null ? "" : ` (Δ ${sgn(pil[c.course.name] - mean)})`}`)).join(" | ") + " |");
    }
    for (const [id, byBag] of Object.entries(perHole)) {
      out.push("", `${id}, avg vs par per hole`, "| Hole | " + BAGS.map((b) => b.label).join(" | ") + " |", "|---|" + BAGS.map(() => "---|").join(""));
      for (let i = 0; i < 18; i++) out.push(`| ${i + 1} | ` + BAGS.map((b) => { const x = byBag[b.label][i]; return `${sgn(x.toPar / x.n)} (ace ${pct(x.aces, x.n)}, OB ${(x.ob / x.n).toFixed(2)})`; }).join(" | ") + " |");
    }
    const text = out.join("\n");
    console.log(text);
    if (process.env.DGA_BALANCE_OUT) {
      writeFileSync(process.env.DGA_BALANCE_OUT, text + "\n");
      writeFileSync(process.env.DGA_BALANCE_OUT + ".json", JSON.stringify({ summary, course }, null, 1));
    }
    expect(Object.keys(course).length).toBe(COURSES.length);
  }, 3_600_000);
});
