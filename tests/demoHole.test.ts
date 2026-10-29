import { describe, it, expect, vi } from "vitest";
import { createDemoHole } from "../components/game/demoHole";

// draw.ts imports through the "@/" alias, which vitest here doesn't resolve.
vi.mock("../components/game/draw", () => ({ drawTree: () => {}, drawBasket: () => {} }));

// A 2D context that accepts every call and property write and draws nothing.
const noopCtx = () => {
  const fn: () => unknown = () => noop;
  const noop: unknown = new Proxy(fn, { get: () => noop, set: () => true, apply: () => noop });
  return noop as CanvasRenderingContext2D;
};

describe("demo hole timeline", () => {
  it("the attract loop skips the control-teaching beats", () => {
    const full = createDemoHole(noopCtx());
    const attract = createDemoHole(noopCtx(), { teach: false });
    expect(full.total - attract.total).toBe(1500 + 1500 + 1600 + 1500);
    // The tee shot is in the air 2.5 s in instead of 7.1 s.
    expect(full.frame(2_600, 0, false)).toMatch(/^Pick your throw/);
    expect(attract.frame(2_600, 0, false)).toMatch(/^Release/);
    // The reduced-motion still frame (6.6 s) is the approach in flight.
    expect(attract.frame(6_600, 0, false)).toBe("Lay it up by the basket");
  });
  it("the How to Play panel keeps every beat", () => {
    const full = createDemoHole(noopCtx());
    expect(full.frame(1_000, 0, true)).toMatch(/^Tap a disc/);
    expect(full.frame(full.total - 1, 0, true)).toMatch(/^Hole complete/);
  });
});
