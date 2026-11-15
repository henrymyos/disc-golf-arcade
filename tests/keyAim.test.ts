import { describe, it, expect } from "vitest";
import { keyAim, pullFor, KEY_AIM_TURN } from "../lib/discgolf/keyAim";

describe("keyboard aim", () => {
  it("arrows turn the aim and change power, clamped to 0..1", () => {
    expect(keyAim(1, 0.5, "ArrowLeft")).toEqual({ angle: 1 - KEY_AIM_TURN, power: 0.5 });
    expect(keyAim(1, 0.5, "ArrowRight")).toEqual({ angle: 1 + KEY_AIM_TURN, power: 0.5 });
    expect(keyAim(1, 0.98, "ArrowUp")!.power).toBe(1);
    expect(keyAim(1, 0.02, "ArrowDown")!.power).toBe(0);
    expect(keyAim(1, 0.5, "a")).toBeNull();
  });

  it("pull vector round-trips through the drag maths (power = |pull|/max, angle = atan2(-pull))", () => {
    const max = 95;
    for (const [a, p] of [[-Math.PI / 2, 0.5], [0.3, 1], [2.8, 0.25]]) {
      const v = pullFor(a, p, max);
      expect(Math.hypot(v.x, v.y) / max).toBeCloseTo(p, 9);
      expect(Math.atan2(-v.y, -v.x)).toBeCloseTo(a, 9);
    }
  });
});
