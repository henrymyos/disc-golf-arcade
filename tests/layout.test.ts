import { describe, it, expect } from "vitest";
import { roundLayout } from "../lib/discgolf/layout";

describe("roundLayout", () => {
  it.each([[1024, 768], [1280, 800], [1440, 900], [1366, 768], [1920, 1080], [1100, 650]])(
    "%ix%i: three columns, and the board is never narrower than the single column", (w, h) => {
      const l = roundLayout(w, h);
      expect(l.sides).toBe(true);
      expect(l.sidesBoardW).toBeGreaterThanOrEqual(l.singleBoardW);
    });
  it("1024x768 keeps the side columns flexible (board 537px, was 378px)", () => {
    const l = roundLayout(1024, 768);
    expect(l.left + l.right).toBeLessThanOrEqual(460);
    expect(Math.round(l.sidesBoardW)).toBe(537);
    expect(Math.round(l.singleBoardW)).toBe(421);
  });
  it("portrait tablets and phones stay single-column", () => {
    expect(roundLayout(1024, 1366).sides).toBe(false);
    expect(roundLayout(390, 844).sides).toBe(false);
    expect(roundLayout(820, 1180).sides).toBe(false);
  });
});
