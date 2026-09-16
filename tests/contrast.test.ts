import { describe, it, expect } from "vitest";
import { contrastRatio, discOutline, MIN_EDGE_CONTRAST } from "../lib/discgolf/contrast";
import { DISC_SKINS, GROUND_THEMES } from "../lib/discgolf/cosmetics";

describe("disc edge contrast", () => {
  it("contrastRatio matches WCAG reference values", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 1);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
    expect(contrastRatio("#ffffff", "#000000")).toBe(contrastRatio("#000000", "#ffffff"));
  });
  it("skips the outline when the body already reads at 3:1", () => {
    expect(discOutline("#ffffff", "#2c3443")).toBeNull(); // white on Night
  });
  it("every disc skin gets a ≥3:1 edge on every course surface", () => {
    for (const skin of DISC_SKINS) {
      for (const theme of GROUND_THEMES) {
        const ring = discOutline(skin.body, [theme.fairway, theme.stripe, theme.rough]);
        for (const surface of [theme.fairway, theme.stripe, theme.rough]) {
          // Without a ring the body must read on its own. With one, the two
          // rings contrast 21:1 with each other, so the edge is whichever ring
          // separates better from the ground.
          const edge = ring
            ? Math.max(contrastRatio(ring.inner, surface), contrastRatio(ring.outer, surface))
            : contrastRatio(skin.body, surface);
          expect(edge, `${skin.name} on ${theme.name} (${surface})`).toBeGreaterThanOrEqual(MIN_EDGE_CONTRAST);
        }
        if (ring) expect(contrastRatio(ring.inner, ring.outer)).toBeGreaterThan(20);
      }
    }
  });
});
