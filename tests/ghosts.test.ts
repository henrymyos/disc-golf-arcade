import { describe, it, expect } from "vitest";
import { buildRacerGhosts, ghostPosAt, type Hole } from "../lib/discgolf/engine";

// A straight, open hole: tee at the bottom, basket 420px up. Progress along the
// fairway is just "how much smaller y got", which makes the realism rules easy
// to check: every throw must move the rival closer to the basket.
const straight: Hole = {
  par: 4, worldH: 640, worldW: 320, tee: { x: 160, y: 560 }, basket: { x: 160, y: 140 },
  fairway: [{ x: 160, y: 560 }, { x: 160, y: 140 }], fwWidth: 120, trees: [], water: [], hazard: [], elev: 0,
} as unknown as Hole;

function landings(shots: number, seed: number) {
  const gh = buildRacerGhosts(seed, 3, straight, [{ name: "R", color: "#fff", shots }], 0).ghosts[0];
  return gh.segs.map((sg) => ({ y: sg.to.y, x: sg.to.x, walk: sg.lift === 0 && sg.pause < 1000 }));
}

describe("rival ghosts progress toward the basket", () => {
  it("never throws backwards, for any score from an ace to a blow-up", () => {
    const greenR = straight.fwWidth * 0.2;
    const distToBasket = (p: { x: number; y: number }) => Math.hypot(p.x - straight.basket.x, p.y - straight.basket.y);
    for (let seed = 1; seed <= 60; seed++) {
      for (let shots = 1; shots <= 10; shots++) {
        const pts = landings(shots, seed);
        // Down the fairway every lie is further along than the last; once on the
        // green every putt is closer to the cup than the one before.
        let y = straight.tee.y, onGreen = false, d = Infinity;
        for (const p of pts) {
          const tag = `shots=${shots} seed=${seed}`;
          if (!onGreen && distToBasket(p) <= greenR) onGreen = true;
          if (p.walk) { y = p.y; continue; } // carrying the disc back from OB is the one allowed retreat
          if (onGreen) {
            expect(distToBasket(p), tag).toBeLessThanOrEqual(d + 0.001);
            d = distToBasket(p);
          } else {
            expect(p.y, tag).toBeLessThanOrEqual(y + 0.001);
            y = p.y;
          }
        }
        expect(pts[pts.length - 1]).toMatchObject({ x: straight.basket.x, y: straight.basket.y });
      }
    }
  });
  it("shows at most one visible throw per stroke, and fewer when an OB penalty was paid", () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (let shots = 2; shots <= 9; shots++) {
        const pts = landings(shots, seed);
        const throws = pts.filter((p) => !p.walk).length;
        expect(throws).toBeLessThanOrEqual(shots);
        expect(throws).toBeGreaterThanOrEqual(Math.ceil(shots / 2) + 1);
      }
    }
  });
  it("keeps every lie near the hole — trouble is off the corridor, not across the map", () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const p of landings(8, seed)) expect(Math.abs(p.x - 160)).toBeLessThanOrEqual(straight.fwWidth * 1.1);
    }
  });
  it("an ace is one throw straight into the basket; a par-2 is drive + putt", () => {
    expect(landings(1, 5)).toHaveLength(1);
    const two = landings(2, 5);
    expect(two).toHaveLength(2);
    expect(Math.hypot(two[0].x - 160, two[0].y - 140)).toBeLessThan(straight.fwWidth * 0.2); // drive lands on the green
  });
  it("walks back from an OB throw before playing on, and still holes out", () => {
    // Enough seeds × strokes that at least one path includes an OB + walk.
    let sawWalk = false;
    for (let seed = 1; seed <= 40 && !sawWalk; seed++) sawWalk = landings(9, seed).some((p) => p.walk);
    expect(sawWalk).toBe(true);
    const gh = buildRacerGhosts(3, 0, straight, [{ name: "R", color: "#fff", shots: 9 }], 0).ghosts[0];
    expect(ghostPosAt(gh, 1e9).holed).toBe(true);
  });
});
