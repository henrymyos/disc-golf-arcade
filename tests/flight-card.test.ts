import { describe, it, expect } from "vitest";
import { flightShapes, previewPath, OPEN_AIR, RELEASES, RHBH } from "../lib/discgolf/flight-card";
import { ADV_DISCS, STRAIGHT_SPEED_MUL, releaseSpeedMul, stepFlight, buildRound, type Flight, type Hole } from "../lib/discgolf/engine";

// The in-round aim line, as drawn in disc-golf-game.tsx (trace()): full power,
// straight up the screen, no career skill mods, from a real hole's tee.
function aimLine(hole: Hole, disc: (typeof ADV_DISCS)[number], release: (typeof RELEASES)[number]) {
  const speed = disc.power * (1.2 + 1 * 3.35) * STRAIGHT_SPEED_MUL * releaseSpeedMul(release);
  const ang = -Math.PI / 2;
  const f: Flight = { x: hole.tee.x, y: hole.tee.y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, h: 0, vh: disc.arc, fadeTurn: 0 };
  const out = [{ x: 0, y: 0 }];
  for (let i = 0; i < 360; i++) {
    const r = stepFlight(f, disc, RHBH, "straight", hole, release, { preview: true });
    out.push({ x: f.x - hole.tee.x, y: f.y - hole.tee.y });
    if (r.status !== "fly") break;
  }
  return out;
}

describe("flight-shape cards", () => {
  // A real Daily hole with its wind and slope taken away (the card is "no wind").
  const calm: Hole = { ...buildRound(0x2026b0d1, "daily")[0], wind: undefined, elev: 0, elevZones: undefined };

  it("match the in-round aim line for every disc and release (no wind)", () => {
    for (const disc of ADV_DISCS) for (const rel of RELEASES) {
      const line = aimLine(calm, disc, rel);
      const card = previewPath(disc, rel).slice(0, line.length);
      card.forEach((p, i) => {
        expect(p.x).toBeCloseTo(line[i].x, 6);
        expect(p.y).toBeCloseTo(line[i].y, 6);
      });
    }
  });

  it("end where a real throw in open air comes to rest", () => {
    const disc = ADV_DISCS.find((d) => d.key === "teebird")!;
    const end = previewPath(disc, "flat").at(-1)!;
    const speed = disc.power * 4.55 * STRAIGHT_SPEED_MUL;
    const f: Flight = { x: 5e4, y: 9e4, vx: 0, vy: -speed, h: 0, vh: disc.arc, fadeTurn: 0 };
    const hole = { ...OPEN_AIR, tee: { x: 5e4, y: 9e4 }, basket: { x: 5e4, y: 10 }, fairway: [{ x: 5e4, y: 9e4 }, { x: 5e4, y: 10 }] };
    let st = "fly";
    for (let i = 0; i < 1500 && st === "fly"; i++) st = stepFlight(f, disc, RHBH, "straight", hole, "flat").status;
    expect(st).toBe("stop");
    expect(f.x - 5e4).toBeCloseTo(end.x, 6);
    expect(f.y - 9e4).toBeCloseTo(end.y, 6);
  });

  it("righty backhand: hyzer finishes left, anhyzer right of flat", () => {
    for (const disc of ADV_DISCS) {
      const [hy, fl, an] = flightShapes(disc);
      expect(hy.sideFt).toBeLessThan(0);
      expect(hy.sideFt).toBeLessThanOrEqual(fl.sideFt + 5); // the most overstable discs fade about as hard flat (game physics)
      expect(an.sideFt).toBeGreaterThan(fl.sideFt);
      expect(fl.carryFt).toBeGreaterThan(50);
    }
  });

  it("is cached per disc", () => {
    expect(flightShapes(ADV_DISCS[0])).toBe(flightShapes(ADV_DISCS[0]));
  });
});
