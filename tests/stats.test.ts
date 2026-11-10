import { describe, it, expect } from "vitest";
import { roundStats, totalStats, pctLabel } from "../lib/discgolf/stats";
import type { Vec } from "../lib/discgolf/engine";

// FEET_PER_PX is 1.8: a point `ft` feet straight below the basket.
const basket: Vec = { x: 100, y: 0 };
const at = (ft: number): Vec => ({ x: 100, y: ft / 1.8 });
const shot = (fromFt: number, toFt: number): Vec[] => [at(fromFt), at((fromFt + toFt) / 2), at(toFt)];

describe("roundStats (synthetic roundPaths)", () => {
  it("counts C1X / C2 putts, parked throws and penalty strokes", () => {
    const holes = [{ basket }, { basket }];
    const paths = [
      // Hole 1: drive parked at 5 ft, tap-in (a tap-in isn't a C1X putt).
      [shot(300, 5), shot(5, 0)],
      // Hole 2: drive to 50 ft, missed C2 to 20 ft, made C1X; one OB stroke on top.
      [shot(300, 50), shot(50, 20), shot(20, 0)],
    ];
    const s = roundStats(paths, holes, [2, 4]);
    expect(s.c1x).toEqual([1, 1]);
    expect(s.c2).toEqual([0, 1]);
    expect(s.parked).toBe(1);
    expect(s.penalties).toBe(1);
  });

  it("skips holes with no recorded paths (resumed rounds)", () => {
    const s = roundStats([[], [shot(40, 0)]], [{ basket }, { basket }], [3, 1]);
    expect(s).toEqual({ c1x: [0, 0], c2: [1, 1], parked: 0, penalties: 0 });
  });
});

describe("totalStats (history rows)", () => {
  it("sums rows with stats and ignores old or malformed rows", () => {
    const good = { stats: { c1x: [3, 4], c2: [1, 5], parked: 2, penalties: 1 } };
    const rows = [good, good, {}, { stats: null }, { stats: { c1x: "x" } }, { stats: { c1x: [1, 1], c2: [0, 0], parked: NaN, penalties: 0 } }];
    const t = totalStats(rows);
    expect(t.rounds).toBe(2);
    expect(t.stats).toEqual({ c1x: [6, 8], c2: [2, 10], parked: 4, penalties: 2 });
  });

  it("old saves with no stats at all load as zero rounds", () => {
    expect(totalStats([{ mode: "course", total: 60 } as { stats?: unknown }]).rounds).toBe(0);
  });

  it("labels percentages, or a dash with no attempts", () => {
    expect(pctLabel([7, 9])).toBe("7/9 · 78%");
    expect(pctLabel([0, 0])).toBe("–");
  });
});
