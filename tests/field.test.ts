import { describe, it, expect } from "vitest";
import { rankedFieldForRound } from "../lib/discgolf/career";
import { courseHoles } from "../lib/discgolf/engine";

describe("AI field hole-by-hole scores follow each hole's par", () => {
  it("across the field a par 4 costs about a stroke more than a par 3, and a par 5 more again", () => {
    const holes = courseHoles("olympus");
    const pars = holes.map((h) => h.par);
    expect(new Set(pars).size).toBeGreaterThan(1);
    const field = rankedFieldForRound(11, 75, 24, holes);
    const meanFor = (par: number) => {
      const xs: number[] = [];
      for (const p of field) p.holes.forEach((s, i) => { if (pars[i] === par) xs.push(s); });
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    };
    const p3 = meanFor(3), p4 = meanFor(4), p5 = meanFor(5);
    if (p3 != null && p4 != null) expect(p4 - p3).toBeGreaterThan(0.6);
    if (p4 != null && p5 != null) expect(p5 - p4).toBeGreaterThan(0.4);
    // and nobody bogeys every par 3 (the old flat-average bug put a par-3 at ~3.6)
    for (const p of field) {
      const on3 = p.holes.filter((_, i) => pars[i] === 3);
      if (on3.length) expect(Math.min(...on3)).toBeLessThanOrEqual(3);
    }
  });
});
