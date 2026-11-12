// Audit of every built Pro Tour hole's hazards, in world px (1 px = 1.8 ft).
// Sand areas must not overlap each other (one polygon per connected area), sand
// must never sit fully under water or OB (water/OB win the landing test and
// would hide it), and no hazard may be a duplicate. Slight overlaps of water and
// OB rects are fine (both play as OB) and are only listed with DGA_AUDIT=1.
import { describe, it, expect } from "vitest";
import { PROTOUR_COURSES, inRings, offRibbons, proHoleToHole } from "../lib/discgolf/engine";
import type { Hazard, Hole } from "../lib/discgolf/engine";

type Box = { x: number; y: number; w: number; h: number };
// Raw sand outline (no disc clearance): the drawn shape.
const inSand = (hz: Hazard, x: number, y: number) => {
  if (hz.rings) return inRings(hz.rings, x, y);
  const nx = (x - hz.x - hz.w / 2) / (hz.w / 2), ny = (y - hz.y - hz.h / 2) / (hz.h / 2);
  return nx * nx + ny * ny < 1;
};
const inBox = (r: Box, x: number, y: number) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
// Sample a hazard's area on a 0.5 px grid; returns the points inside it.
const samples = (hz: Hazard) => {
  const pts: [number, number][] = [];
  for (let x = hz.x + 0.25; x < hz.x + hz.w; x += 0.5) for (let y = hz.y + 0.25; y < hz.y + hz.h; y += 0.5) if (inSand(hz, x, y)) pts.push([x, y]);
  return pts;
};
const boxOverlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

function auditHole(g: Hole) {
  const sand = g.hazard ?? [];
  const pts = sand.map(samples);
  const rects = [...g.water.map((r) => ({ r, k: "water" })), ...(g.obZones ?? []).map((r) => ({ r, k: "OB" }))];
  const out = { sandOnSand: [] as string[], hidden: [] as string[], dupes: [] as string[], partlyCovered: [] as string[], deadOffRibbon: [] as string[], rectOverlaps: [] as string[] };
  for (let i = 0; i < sand.length; i++) {
    for (let j = i + 1; j < sand.length; j++) {
      if (JSON.stringify(sand[i]) === JSON.stringify(sand[j])) out.dupes.push(`sand ${i}=${j}`);
      const n = pts[i].filter(([x, y]) => inSand(sand[j], x, y)).length;
      if (n) out.sandOnSand.push(`sand ${i}×${j} ${(n * 0.25 * 3.24).toFixed(0)} sq ft`);
    }
    if (!pts[i].length) continue;
    const covered = pts[i].filter(([x, y]) => rects.some(({ r }) => inBox(r, x, y))).length / pts[i].length;
    if (covered > 0.99) out.hidden.push(`sand ${i} ${(covered * 100).toFixed(0)}% under water/OB`);
    else if (covered > 0.05) out.partlyCovered.push(`sand ${i} ${(covered * 100).toFixed(0)}% under water/OB`);
    // On an OB-rough hole, sand off the corridor plays as OB: it would be invisible.
    if (!g.roughIsHazard) {
      const off = pts[i].filter(([x, y]) => offRibbons(g, x, y)).length / pts[i].length;
      if (off > 0.99) out.deadOffRibbon.push(`sand ${i} ${(off * 100).toFixed(0)}% off the corridor (plays OB)`);
    }
  }
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j], o = boxOverlap(a.r, b.r);
    if (JSON.stringify(a.r) === JSON.stringify(b.r)) out.dupes.push(`${a.k} ${i}=${b.k} ${j}`);
    else if (o * 3.24 >= 1) out.rectOverlaps.push(`${a.k}×${b.k} ${(o * 3.24).toFixed(0)} sq ft${o >= Math.min(a.r.w * a.r.h, b.r.w * b.r.h) - 1e-6 ? " (one inside the other)" : ""}`);
  }
  return out;
}

const report = PROTOUR_COURSES.flatMap((c) => c.holes.map((g, i) => {
  const src = c.course.holes[i];
  // Key/balance trees whose trunk touches a hazard are dropped at build time
  // (populateTrees). Authored trees come first in the tree list, so build the hole
  // without hazards to get their world positions, then look for each one.
  const authored = proHoleToHole({ ...src, hazard: [], water: [], obZones: [] }).trees.slice(0, (src.keyTrees?.length ?? 0) + (src.balanceTrees?.length ?? 0));
  const dropped = authored.filter((t) => !g.trees.some((u) => Math.hypot(u.x - t.x, u.y - t.y) < 0.01)).length;
  return { id: `${c.course.name} ${src.n}`, ...auditHole(g), droppedTrees: dropped ? [`${dropped} of ${authored.length} authored trees dropped (in a hazard)`] : [] };
}));

describe("Pro Tour hazard audit (every course, every hole)", () => {
  it("no sand area overlaps another (one shape per connected sand area)", () => {
    expect(report.filter((r) => r.sandOnSand.length).map((r) => `${r.id}: ${r.sandOnSand.join(", ")}`)).toEqual([]);
  });

  it("no sand sits fully under water or OB, or fully off the corridor on an OB-rough hole", () => {
    expect(report.filter((r) => r.hidden.length || r.deadOffRibbon.length).map((r) => `${r.id}: ${[...r.hidden, ...r.deadOffRibbon].join(", ")}`)).toEqual([]);
  });

  it("no authored key or balance tree stands in a hazard (the build would silently drop it)", () => {
    expect(report.filter((r) => r.droppedTrees.length).map((r) => `${r.id}: ${r.droppedTrees.join(", ")}`)).toEqual([]);
  });

  it("no duplicate hazards, water or OB rects", () => {
    expect(report.filter((r) => r.dupes.length).map((r) => `${r.id}: ${r.dupes.join(", ")}`)).toEqual([]);
  });

  it.runIf(!!process.env.DGA_AUDIT)("prints the full report (DGA_AUDIT=1)", () => {
    for (const r of report) {
      const lines = [...r.sandOnSand, ...r.hidden, ...r.dupes, ...r.deadOffRibbon, ...r.partlyCovered, ...r.rectOverlaps, ...r.droppedTrees];
      if (lines.length) console.log(`${r.id}: ${lines.join("; ")}`);
    }
  });
});
