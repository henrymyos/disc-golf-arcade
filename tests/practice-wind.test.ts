import { describe, expect, it } from "vitest";
import { buildRound, withWindMph } from "@/lib/discgolf/engine";

const mph = (m: number) => Math.round((m / 0.018) * 15); // the HUD's conversion

describe("withWindMph (Hole Practice wind)", () => {
  const hole = buildRound(7, "course")[3];

  it("sets the speed and keeps the hole's direction", () => {
    const h = withWindMph(hole, 22);
    expect(mph(h.windMag!)).toBe(22);
    expect(Math.hypot(h.wind!.x, h.wind!.y)).toBeCloseTo(h.windMag!, 10);
    if (hole.windMag) {
      expect(Math.atan2(h.wind!.y, h.wind!.x)).toBeCloseTo(Math.atan2(hole.wind!.y, hole.wind!.x), 10);
    }
    expect(h.par).toBe(hole.par);
    expect(hole.windMag).toBe(buildRound(7, "course")[3].windMag); // input untouched
  });

  it("calm is zero wind, and a calm hole gets a direction when wind is added", () => {
    const calm = withWindMph(hole, 0);
    expect(calm.windMag).toBe(0);
    expect(Math.hypot(calm.wind!.x, calm.wind!.y)).toBe(0);
    const back = withWindMph(calm, 15);
    expect(mph(back.windMag!)).toBe(15);
    expect(Number.isFinite(back.wind!.x)).toBe(true);
  });
});
