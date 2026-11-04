import { describe, it, expect } from "vitest";
import {
  inHazard,
  inRings,
  distToRings,
  proHoleToHole,
  proHoleBoundsFt,
  resolvePenalty,
  offRibbons,
  PROTOUR_COURSES,
  proTourCourseById,
  DISC_R,
} from "../lib/discgolf/engine";
import type { Hazard, Hole } from "../lib/discgolf/engine";
import type { ProHole } from "../lib/discgolf/protour/types";

const FT = 1.8; // FEET_PER_PX
const sq = (x0: number, y0: number, s: number) => [{ x: x0, y: y0 }, { x: x0 + s, y: y0 }, { x: x0 + s, y: y0 + s }, { x: x0, y: y0 + s }];
const shaped = (...rings: { x: number; y: number }[][]): Hazard => {
  const xs = rings[0].map((p) => p.x), ys = rings[0].map((p) => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), rings };
};

describe("shaped hazards: hit-tests", () => {
  it("a square: inside with room for the disc counts, the edge band and outside don't", () => {
    const hz = shaped(sq(0, 0, 40));
    expect(inHazard(hz, 20, 20)).toBe(true);
    expect(inHazard(hz, DISC_R, 20)).toBe(true); // exactly a disc radius in
    expect(inHazard(hz, DISC_R - 0.5, 20)).toBe(false); // disc pokes over the edge
    expect(inHazard(hz, -5, 20)).toBe(false);
  });

  it("a point exactly on an edge or a corner is never in the sand", () => {
    const hz = shaped(sq(0, 0, 40));
    for (const [x, y] of [[0, 20], [40, 20], [20, 0], [20, 40], [0, 0], [40, 40]]) {
      expect(distToRings(hz.rings!, x, y)).toBe(0);
      expect(inHazard(hz, x, y)).toBe(false);
    }
  });

  it("a concave U: both arms are sand, the notch between them is not", () => {
    // U opening upward: arms x 0..20 and 40..60, base y 40..60.
    const u = shaped([{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 40 }, { x: 40, y: 40 }, { x: 40, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 60 }, { x: 0, y: 60 }]);
    expect(inHazard(u, 10, 10)).toBe(true);
    expect(inHazard(u, 50, 10)).toBe(true);
    expect(inHazard(u, 30, 50)).toBe(true);
    expect(inRings(u.rings!, 30, 20)).toBe(false); // the notch: inside the bounding box, outside the shape
    expect(inHazard(u, 30, 20)).toBe(false);
  });

  it("a grass island cut out of the sand is safe; the sand round it is not", () => {
    const hz = shaped(sq(0, 0, 100), sq(30, 30, 40));
    expect(inHazard(hz, 50, 50)).toBe(false); // on the island
    expect(inHazard(hz, 15, 50)).toBe(true); // sand left of it
    expect(inHazard(hz, 50, 85)).toBe(true); // sand below it
    expect(inHazard(hz, 50, 28)).toBe(false); // within a disc radius of the island's edge
  });

  it("round bunkers are untouched: same result as the original ellipse formula everywhere", () => {
    const old = (hz: { x: number; y: number; w: number; h: number }, x: number, y: number) => {
      const rx = hz.w / 2 - DISC_R, ry = hz.h / 2 - DISC_R;
      if (rx <= 0 || ry <= 0) return false;
      const nx = (x - (hz.x + hz.w / 2)) / rx, ny = (y - (hz.y + hz.h / 2)) / ry;
      return nx * nx + ny * ny <= 1;
    };
    const cases = [{ x: 10, y: 20, w: 40, h: 40 }, { x: 0, y: 0, w: 30, h: 18 }, { x: 5, y: 5, w: 4, h: 4 }];
    for (const hz of cases) for (let x = -5; x <= 60; x += 0.5) for (let y = -5; y <= 70; y += 0.5) expect(inHazard(hz, x, y)).toBe(old(hz, x, y));
    // …and every Pro Tour circle still converts to a plain round box with no rings.
    let n = 0;
    for (const c of PROTOUR_COURSES) c.course.holes.forEach((h, i) => (h.hazard ?? []).forEach((z, j) => {
      if (!("d" in z)) return;
      const g = c.holes[i].hazard![j];
      expect(g.rings).toBeUndefined();
      expect(g.w).toBeCloseTo(z.d / FT, 9);
      expect(g.h).toBeCloseTo(z.d / FT, 9);
      n++;
    }));
    expect(n).toBeGreaterThan(5);
  });
});

describe("shaped hazards: Pro Tour format → world", () => {
  const base: ProHole = {
    n: 1, par: 3, lengthFt: 400, line: [{ x: 0, y: 0 }, { x: 0, y: 400 }], widthFt: 200, rough: "ob",
    trees: "wooded", note: "t", ref: { url: "x", page: 1 },
  };
  // feet → world, matching proHoleToHole's mapping for this hole
  const at = (g: Hole, x: number, y: number) => ({ x: g.tee.x + x / FT, y: g.tee.y - y / FT });

  it("ellipse: radii and rotation follow the feet frame", () => {
    const g = proHoleToHole({ ...base, hazard: [{ x: 0, y: 200, rx: 60, ry: 20, rot: 90 }] });
    const hz = g.hazard![0];
    // turned 90°, the long axis runs along the hole (feet y)
    let p = at(g, 0, 250);
    expect(inHazard(hz, p.x, p.y)).toBe(true);
    p = at(g, 50, 200);
    expect(inHazard(hz, p.x, p.y)).toBe(false);
    expect(hz.h * FT).toBeCloseTo(120, 0);
    expect(hz.w * FT).toBeCloseTo(40, 0);
  });

  it("rect: rotated 45° about its center, corners become diamond points", () => {
    const g = proHoleToHole({ ...base, hazard: [{ x: -40, y: 160, w: 80, h: 80, rot: 45 }] });
    const hz = g.hazard![0];
    expect(hz.w * FT).toBeCloseTo(80 * Math.SQRT2, 6);
    let p = at(g, 0, 230); // toward the diamond tip, well inside the turned square
    expect(inHazard(hz, p.x, p.y)).toBe(true);
    p = at(g, 35, 235); // was inside the unturned square's corner, now outside
    expect(inHazard(hz, p.x, p.y)).toBe(false);
  });

  it("polygon with holes: rings carry across, the HZ tag sits in the sand", () => {
    const g = proHoleToHole({ ...base, hazard: [{ poly: [{ x: -90, y: 100 }, { x: 90, y: 100 }, { x: 90, y: 300 }, { x: -90, y: 300 }], holes: [[{ x: -40, y: 150 }, { x: 40, y: 150 }, { x: 40, y: 250 }, { x: -40, y: 250 }]] }] });
    const hz = g.hazard![0];
    expect(hz.rings).toHaveLength(2);
    const c = at(g, 0, 200); // the box center is on the island
    expect(inHazard(hz, c.x, c.y)).toBe(false);
    expect(inHazard(hz, hz.tag!.x, hz.tag!.y)).toBe(true);
  });

  it("sand over the fairway or the green still costs +1 at rest, and the fairway outside it stays clean", () => {
    const g = proHoleToHole({ ...base, hazard: [{ poly: [{ x: -60, y: 340 }, { x: 60, y: 340 }, { x: 60, y: 380 }, { x: -60, y: 380 }] }] });
    const inSand = at(g, 0, 360); // on the fairway ribbon, 40 ft short of the basket
    expect(offRibbons(g, inSand.x, inSand.y)).toBe(false);
    expect(resolvePenalty("stop", g, inSand, [], g.tee).kind).toBe("sand");
    const clean = at(g, 0, 300);
    expect(resolvePenalty("stop", g, clean, [], g.tee).kind).toBe("none");
    // a bunker right round the basket (green-side sand) plays the same way
    const green = proHoleToHole({ ...base, hazard: [{ poly: [{ x: -50, y: 350 }, { x: 50, y: 350 }, { x: 50, y: 450 }, { x: -50, y: 450 }] }] });
    const nearPin = at(green, 20, 400);
    expect(resolvePenalty("stop", green, nearPin, [], green.tee).kind).toBe("sand");
  });

  it("no fill tree stands in or touches a shaped hazard", () => {
    const g = proHoleToHole({ ...base, hazard: [{ poly: [{ x: -100, y: 60 }, { x: 100, y: 60 }, { x: 0, y: 340 }] }] });
    expect(g.trees.length).toBeGreaterThan(0);
    for (const t of g.trees) {
      const rings = g.hazard![0].rings!;
      expect(inRings(rings, t.x, t.y) || distToRings(rings, t.x, t.y) < t.r).toBe(false);
    }
  });
});

describe("Bad Rock Creek 13: one sand area, two islands", () => {
  const h = proTourCourseById("bad-rock-creek")!;
  const src = h.course.holes[12];
  const g = h.holes[12];
  const at = (x: number, y: number) => ({ x: g.tee.x + x / FT, y: g.tee.y - y / FT });
  const sand = (x: number, y: number) => { const p = at(x, y); return g.hazard!.some((hz) => inHazard(hz, p.x, p.y)); };

  it("is a single polygon with a landing island and a green island cut out", () => {
    expect(g.hazard).toHaveLength(1);
    expect(g.hazard![0].rings).toHaveLength(3);
  });

  it("tee, landing island and basket are clear; the carry, the gap and behind the green are sand", () => {
    expect(sand(0, 0)).toBe(false); // tee
    expect(sand(20, 280)).toBe(false); // landing island
    expect(sand(40, 400)).toBe(false); // basket
    expect(sand(20, 120)).toBe(true); // the carry off the tee
    expect(sand(30, 350)).toBe(true); // between the islands
    expect(sand(40, 470)).toBe(true); // long
  });

  it("stays inside the hole's bounds, on the 10 ft grid", () => {
    const b = proHoleBoundsFt(src);
    for (const z of src.hazard ?? []) {
      if (!("poly" in z)) continue;
      for (const p of [...z.poly, ...(z.holes ?? []).flat()]) {
        expect(p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1).toBe(true);
        expect(Math.abs(p.x % 10) + Math.abs(p.y % 10)).toBe(0);
      }
    }
  });
});

describe("round 2: Pickard 7, Ivy Hill 11, Winthrop Gold 14, Harvey Penick 9", () => {
  const hole = (id: string, n: number) => proTourCourseById(id)!.holes[n - 1];
  const sandAt = (g: Hole, x: number, y: number) => g.hazard!.some((hz) => inHazard(hz, g.tee.x + x / FT, g.tee.y - y / FT));

  it("Pickard 7: one sand area round a hexagon island green; tee and green clear, the carry is sand", () => {
    const g = hole("pickard-park", 7);
    expect(g.hazard).toHaveLength(1);
    expect(g.hazard![0].rings).toHaveLength(2);
    expect(sandAt(g, 0, 0)).toBe(false); // tee
    expect(sandAt(g, 0, 340)).toBe(false); // basket, centre of the hexagon
    expect(sandAt(g, 30, 340)).toBe(false); // inside the hexagon's right point
    for (const [x, y] of [[0, 150], [-60, 275], [60, 275], [0, 410], [-60, 340]]) expect(sandAt(g, x, y), `${x},${y}`).toBe(true); // old seams are sand now
  });
});
