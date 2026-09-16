import { describe, it, expect } from "vitest";
import { buildRacerGhosts, ghostPosAt, CATCH_R, PUTT_RANGE, type Hole } from "../lib/discgolf/engine";

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
    const greenR = PUTT_RANGE; // inside putting range every throw is a putt
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
    expect(Math.hypot(two[0].x - 160, two[0].y - 140)).toBeLessThan(PUTT_RANGE); // drive lands inside putting range
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

describe("rival putting scales with skill", () => {
  // shots = reach + 3 on this hole: two strokes to spend beyond drive/approach/putt.
  const SHOTS = 6;
  function greenStats(skill: number, seeds = 1500) {
    let missed = 0, threePutt = 0, firstMissRun = 0, runs = 0;
    const greenR = PUTT_RANGE;
    for (let seed = 1; seed <= seeds; seed++) {
      const gh = buildRacerGhosts(seed, 1, straight, [{ name: "R", color: "#fff", shots: SHOTS, skill }], 0).ghosts[0];
      const onGreen = gh.segs.map((sg) => sg.to).filter((p) => Math.hypot(p.x - straight.basket.x, p.y - straight.basket.y) <= greenR);
      // on-green lies before the hole-out: approach [+ misses]
      const lies = onGreen.slice(0, -1);
      if (lies.length >= 2) { missed++; firstMissRun += Math.hypot(lies[1].x - straight.basket.x, lies[1].y - straight.basket.y); runs++; }
      if (lies.length >= 3) threePutt++;
    }
    return { miss: missed / seeds, three: threePutt / seeds, run: runs ? firstMissRun / runs : 0 };
  }
  it("a miss only runs a tap-in past the basket, closer for better players", () => {
    const weak = greenStats(0), elite = greenStats(1);
    expect(weak.run).toBeLessThanOrEqual(CATCH_R + 16);    // a few feet past the cage
    expect(elite.run).toBeLessThanOrEqual(CATCH_R + 7);    // barely out
    expect(elite.run).toBeLessThan(weak.run);
  });
  it("misses are uncommon and three-putts rare, both rarer with skill", () => {
    const weak = greenStats(0), elite = greenStats(1);
    expect(weak.miss).toBeLessThan(0.5);
    expect(elite.miss).toBeLessThan(weak.miss);
    expect(weak.three).toBeLessThan(0.05);
    expect(elite.three).toBeLessThan(0.01);
    // given a miss, the second putt goes in the vast majority of the time
    expect(weak.three / Math.max(weak.miss, 1e-9)).toBeLessThan(0.12);
  });
});

describe("a putt is any throw from inside putting range", () => {
  it("putting range is the auto-caddie's putter switch point (~117 ft)", () => {
    expect(PUTT_RANGE).toBeGreaterThan(50);
    expect(PUTT_RANGE).toBeLessThan(90);
  });
  it("fairway lies stay outside putting range; the approach lands inside it", () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const shots of [3, 5, 8]) {
        const pts = landings(shots, seed).filter((p) => !p.walk);
        const d = pts.map((p) => Math.hypot(p.x - 160, p.y - 140));
        const firstInside = d.findIndex((x) => x <= PUTT_RANGE);
        expect(firstInside, `shots=${shots} seed=${seed}`).toBeGreaterThan(0);
        for (let i = 0; i < firstInside; i++) expect(d[i]).toBeGreaterThan(PUTT_RANGE);
        for (let i = firstInside; i < d.length; i++) expect(d[i]).toBeLessThanOrEqual(PUTT_RANGE);
      }
    }
  });
  it("on a hole shorter than putting range every throw is a putt", () => {
    const tiny: Hole = { ...straight, tee: { x: 160, y: 190 }, fairway: [{ x: 160, y: 190 }, { x: 160, y: 140 }] } as unknown as Hole;
    const gh = buildRacerGhosts(4, 0, tiny, [{ name: "R", color: "#fff", shots: 3, skill: 0.5 }], 0).ghosts[0];
    expect(gh.segs).toHaveLength(3); // putt, miss, tap-in — no walks, no fairway throws
    let d = Infinity;
    for (const sg of gh.segs) { const x = Math.hypot(sg.to.x - 160, sg.to.y - 140); expect(x).toBeLessThanOrEqual(d); d = x; }
    expect(d).toBe(0);
  });
});
