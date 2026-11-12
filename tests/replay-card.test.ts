import { describe, it, expect } from "vitest";
import { buildRound, PROTOUR_COURSES } from "../lib/discgolf/engine";
import { buildReplay, type Replay } from "../lib/discgolf/replay";
import { replayCard, mapHoleIndex, replayHoleSvg, holeLabel } from "../lib/discgolf/replayCard";

// One straight throw per stroke from tee toward the basket, so every hole has paths.
function round(mode: Replay["mode"], seed: number, scores: (par: number, i: number) => number, extra: Partial<Parameters<typeof buildReplay>[0]> = {}): Replay {
  const holes = buildRound(seed, mode);
  const s = holes.map((h, i) => scores(h.par, i));
  return buildReplay({
    mode, seed, name: "Henry", scores: s, pars: holes.map((h) => h.par),
    paths: holes.map((h, i) => Array.from({ length: s[i] }, (_, k) => {
      const a = (k / s[i]), b = ((k + 1) / s[i]);
      const at = (t: number) => ({ x: h.tee.x + (h.basket.x - h.tee.x) * t, y: h.tee.y + (h.basket.y - h.tee.y) * t });
      return [at(a), at((a + b) / 2), at(b)];
    })),
    ...extra,
  });
}

describe("replay share card", () => {
  it("names the hole result", () => {
    expect([holeLabel(1, 3), holeLabel(2, 4), holeLabel(2, 3), holeLabel(3, 3), holeLabel(5, 3), holeLabel(7, 3)])
      .toEqual(["Ace", "Eagle", "Birdie", "Par", "Double bogey", "+4"]);
  });

  it("headlines the best hole, with Pro Tour stop and a playable course", () => {
    const brighton = PROTOUR_COURSES.find((c) => c.course.id.startsWith("brighton"))!;
    const r = round("tour", brighton.seed, (p, i) => (i === 6 ? p - 1 : i === 3 ? p + 1 : p));
    const c = replayCard(r);
    expect(c.headline).toBe("Birdie on Hole 7");
    expect(c.stop).toMatch(/^Stop 14 · /);
    expect(c.toPar).toBe("E");
    expect(c.title).toBe(`Henry: Birdie on Hole 7 at ${brighton.course.name}, even par`);
    expect(c.play).toEqual({ mode: "tour", seed: brighton.seed });
    expect(mapHoleIndex(r, c)).toBe(6);
  });

  it("prefers an ace and falls back to a plain round headline", () => {
    expect(replayCard(round("course", 1, (p, i) => (i === 4 ? p - 2 : i === 9 ? 1 : p))).headline).toBe("Ace on Hole 10");
    const over = replayCard(round("olympus", 1, (p, i) => p + (i % 2)));
    expect(over.headline).toBe(`Round of ${over.total}`);
    expect(over.toParWords).toBe("9 over");
    expect(replayCard(round("winthrop", 1, (p) => p)).headline).toBe("Bogey-free round");
  });

  it("doesn't offer a course that can't be replayed as-is", () => {
    expect(replayCard(round("daily", 99, (p) => p)).play).toBeUndefined();
    expect(replayCard(round("course", 1, (p) => p, { scale: 0.8 })).play).toBeUndefined();
  });

  it("draws the hole map with numbers only, and skips holes with no recorded throws", () => {
    const r = round("course", 1, (p, i) => (i === 2 ? p - 1 : p));
    r.name = '<script>"x"</script>';
    const svg = replayHoleSvg(r, 2)!;
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).not.toContain("script");
    r.paths[2] = [];
    const c = replayCard(r);
    expect(mapHoleIndex(r, c)).not.toBe(2);
    expect(replayHoleSvg(r, 2)).toBeNull();
  });
});
