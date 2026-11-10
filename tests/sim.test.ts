import { describe, it, expect } from "vitest";
import { simFrame, STEP_MS, FAST_FORWARD } from "../lib/discgolf/sim";
import {
  ADV_DISCS, STRAIGHT_SPEED_MUL, buildRound, stepFlight, resolvePenalty, isTeeLie, catchRFor, autoDiscIndex,
  distBetween, aimAt, mulberry32, CATCH_R,
} from "../lib/discgolf/engine";
import type { Flight, Hole, Vec } from "../lib/discgolf/engine";

const BAG = ["aviar", "buzzz", "teebird", "destroyer"];

// Play one hole with a fixed aim/power policy. Every flight is driven through
// the real frame scheduler (simFrame) with jittery frame times; `fast` decides
// whether the player tapped to fast-forward. Returns strokes + every rest point.
function playHole(hole: Hole, fast: boolean, frameSeed: number) {
  const jitter = mulberry32(frameSeed);
  let lie: Vec = { ...hole.tee };
  let strokes = 0;
  const rests: Vec[] = [];
  for (let t = 0; t < 12; t++) {
    const dist = distBetween(lie, hole.basket);
    const disc = ADV_DISCS[autoDiscIndex(dist, BAG)];
    const power = Math.min(1, 0.2 + dist / 450);
    const ang = aimAt(lie, hole.basket);
    const speed = disc.power * (1.2 + power * 3.35) * STRAIGHT_SPEED_MUL;
    const f: Flight = { x: lie.x, y: lie.y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, h: 0, vh: power * disc.arc, fadeTurn: 0 };
    const trail: Vec[] = [{ ...lie }];
    const catchR = catchRFor(hole, lie, CATCH_R);
    let status = "fly";
    let acc = 0;
    const step = () => {
      if (status !== "fly") return; // landed mid-frame: the rest of the frame idles, like update() off the fly phase
      status = stepFlight(f, disc, -1, "straight", hole, "flat", { catchR }).status;
      trail.push({ x: f.x, y: f.y });
    };
    for (let frame = 0; frame < 5000 && status === "fly"; frame++) {
      acc = simFrame(acc, 8 + jitter() * 30, step, () => fast && status === "fly");
    }
    strokes += 1;
    if (status === "hole") { rests.push({ ...hole.basket }); return { strokes, rests }; }
    const pen = resolvePenalty(status as "stop", hole, { x: f.x, y: f.y }, trail, lie, isTeeLie(hole, lie));
    strokes += pen.strokes;
    lie = pen.lie ?? { x: f.x, y: f.y };
    rests.push({ x: f.x, y: f.y });
  }
  return { strokes, rests };
}

describe("fast-forward (simFrame)", () => {
  it("runs FAST_FORWARD sim steps per real step only while fast", () => {
    let n = 0;
    let acc = simFrame(0, STEP_MS * 2 + 0.1, () => n++, () => false);
    expect(n).toBe(2);
    n = 0;
    acc = simFrame(acc, STEP_MS * 2, () => n++, () => true);
    expect(n).toBe(2 * FAST_FORWARD);
    expect(acc).toBeGreaterThanOrEqual(0);
  });

  it("caps catch-up at 4 real steps per frame (a long stall never bursts)", () => {
    let n = 0;
    simFrame(0, 5000, () => n++, () => false);
    expect(n).toBeLessThanOrEqual(4);
    expect(n).toBeGreaterThanOrEqual(3); // float rounding on the 4-step cap
  });

  it("a fast-forwarded round lands, strokes and scores exactly like a 1x round", () => {
    const holes = buildRound(0x2026b0d1, "daily"); // seeded wind + elevation
    let total1 = 0, total4 = 0;
    holes.forEach((hole, i) => {
      const a = playHole(hole, false, 100 + i);
      const b = playHole(hole, true, 900 + i); // different frame timing too
      expect(b.rests).toEqual(a.rests); // bit-identical rest points, throw by throw
      expect(b.strokes).toBe(a.strokes);
      total1 += a.strokes;
      total4 += b.strokes;
    });
    expect(total4).toBe(total1);
    expect(total1).toBeGreaterThan(holes.length); // real multi-throw holes, not a trivial pass
  });
});
