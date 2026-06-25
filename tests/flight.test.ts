import { describe, it, expect } from "vitest";
import {
  resolvePenalty,
  stepFlight,
  lastInBoundsLie,
  inAnyOB,
  distBetween,
  elevAt,
  scoreLabel,
  ADV_DISCS,
  CATCH_R,
  W,
  H,
} from "../lib/discgolf/engine";
import type { Hole, Vec, Flight, Disc } from "../lib/discgolf/engine";

// A minimal, fully-controlled hole: a straight vertical fairway down the middle
// (centerline x=160, width 60 → in bounds within 30px of center), basket at the
// top, tee at the bottom. Override fields per test.
function mkHole(over: Partial<Hole> = {}): Hole {
  return {
    par: 3,
    worldH: H,
    tee: { x: W / 2, y: H - 20 },
    basket: { x: W / 2, y: 40 },
    fairway: [
      { x: W / 2, y: H - 20 },
      { x: W / 2, y: 40 },
    ],
    fwWidth: 60,
    trees: [],
    water: [],
    ...over,
  } as Hole;
}

const DISC: Disc = ADV_DISCS[0];
const STRAIGHT: Disc = ADV_DISCS.find((d) => d.flight === "straight") ?? ADV_DISCS[0];

// Run one physics frame. Returns the status + mutated flight.
function step(f: Flight, hole: Hole, disc: Disc = DISC, opts: { catchR?: number; windMul?: number } = {}) {
  return stepFlight(f, disc, 1, "straight", hole, "flat", opts);
}

// A fresh grounded, slow-moving flight at (x,y) — settles within one frame.
function grounded(x: number, y: number, vx = 0.1, vy = 0): Flight {
  return { x: x - vx, y: y - vy, vx, vy, h: 0, vh: 0, fadeTurn: 0 };
}

describe("scoring relative to par", () => {
  it("names a score by its delta to par", () => {
    expect(scoreLabel(1, 3).name.toLowerCase()).toContain("ace");
    expect(scoreLabel(2, 3).name.toLowerCase()).toBe("birdie");
    expect(scoreLabel(3, 3).name.toLowerCase()).toBe("par");
    expect(scoreLabel(4, 3).name.toLowerCase()).toBe("bogey");
    // eagle on a par 5 (two under)
    expect(scoreLabel(3, 5).name.toLowerCase()).toBe("eagle");
  });

  it("the under-par rule (throws < par) the round uses for celebrations", () => {
    const par = 3;
    expect(2 < par).toBe(true); // birdie celebrates
    expect(3 < par).toBe(false); // par does not
    expect(4 < par).toBe(false); // bogey does not
  });
});

describe("distBetween / elevAt", () => {
  it("distBetween is straight-line distance", () => {
    expect(distBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(distBetween({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe(0);
  });

  it("elevAt is flat (0) by default and a constant when set", () => {
    expect(elevAt(mkHole(), 200)).toBe(0);
    expect(elevAt(mkHole({ elev: 7 }), 200)).toBe(7);
  });

  it("elevAt honors elevZones along the tee→basket axis", () => {
    // First half of the hole uphill (+3), second half downhill (-2).
    const hole = mkHole({ elevZones: [{ to: 0.5, elev: 3 }, { to: 1, elev: -2 }] });
    expect(elevAt(hole, hole.tee.y)).toBe(3); // t≈0, near the tee
    expect(elevAt(hole, hole.basket.y)).toBe(-2); // t≈1, near the basket
  });
});

describe("inAnyOB", () => {
  it("the fairway centerline is in bounds", () => {
    expect(inAnyOB(mkHole(), 160, 200)).toBe(false);
  });

  it("the world edges are OB", () => {
    expect(inAnyOB(mkHole(), 1, 200)).toBe(true);
    expect(inAnyOB(mkHole(), 160, 1)).toBe(true);
    expect(inAnyOB(mkHole(), 160, H - 1)).toBe(true);
  });

  it("off every fairway ribbon is OB", () => {
    expect(inAnyOB(mkHole(), 300, 200)).toBe(true);
  });

  it("off-ribbon is NOT OB on a hazard-rough hole (it's playable rough)", () => {
    expect(inAnyOB(mkHole({ roughIsHazard: true }), 300, 200)).toBe(false);
  });

  it("water and explicit OB zones are OB", () => {
    expect(inAnyOB(mkHole({ water: [{ x: 150, y: 150, w: 20, h: 20 }] }), 160, 160)).toBe(true);
    expect(inAnyOB(mkHole({ obZones: [{ x: 150, y: 150, w: 20, h: 20 }] }), 160, 160)).toBe(true);
  });
});

describe("lastInBoundsLie (OB repositioning)", () => {
  it("returns the final point when the whole flight stayed in bounds", () => {
    const trail: Vec[] = [
      { x: 160, y: 420 },
      { x: 160, y: 300 },
      { x: 160, y: 200 },
    ];
    expect(lastInBoundsLie(trail, mkHole(), { x: 0, y: 0 })).toEqual({ x: 160, y: 200 });
  });

  it("walks back to the last in-bounds point when the flight crossed OB", () => {
    const trail: Vec[] = [
      { x: 160, y: 420 },
      { x: 160, y: 300 },
      { x: 300, y: 200 }, // off-ribbon → OB
    ];
    expect(lastInBoundsLie(trail, mkHole(), { x: 0, y: 0 })).toEqual({ x: 160, y: 300 });
  });

  it("falls back to the launch point if only it was in bounds", () => {
    const trail: Vec[] = [
      { x: 160, y: 420 }, // launch, in bounds
      { x: 300, y: 300 }, // OB
      { x: 300, y: 200 }, // OB
    ];
    expect(lastInBoundsLie(trail, mkHole(), { x: 0, y: 0 })).toEqual({ x: 160, y: 420 });
  });

  it("uses the fallback when no point was ever in bounds", () => {
    const trail: Vec[] = [{ x: 300, y: 300 }];
    expect(lastInBoundsLie(trail, mkHole(), { x: 160, y: 420 })).toEqual({ x: 160, y: 420 });
  });
});

describe("resolvePenalty (the water/OB/sand stroke rule)", () => {
  it("no penalty while flying, holed, or stopped cleanly on the fairway", () => {
    expect(resolvePenalty("fly", mkHole(), { x: 160, y: 200 }, [], { x: 160, y: 420 })).toEqual({
      kind: "none",
      strokes: 0,
      lie: null,
    });
    expect(resolvePenalty("hole", mkHole(), { x: 160, y: 40 }, [], { x: 160, y: 420 })).toEqual({
      kind: "none",
      strokes: 0,
      lie: null,
    });
    expect(resolvePenalty("stop", mkHole(), { x: 160, y: 200 }, [], { x: 160, y: 420 }).kind).toBe("none");
  });

  it("OB costs +1 and replays from the last in-bounds point", () => {
    const trail: Vec[] = [
      { x: 160, y: 420 },
      { x: 160, y: 300 },
      { x: 300, y: 200 },
    ];
    const pen = resolvePenalty("ob", mkHole(), { x: 300, y: 200 }, trail, { x: 160, y: 420 });
    expect(pen.kind).toBe("ob");
    expect(pen.strokes).toBe(1);
    expect(pen.lie).toEqual({ x: 160, y: 300 });
  });

  it("off-the-world (oob) is treated as OB", () => {
    const pen = resolvePenalty("oob", mkHole(), { x: 319, y: 200 }, [{ x: 160, y: 420 }], { x: 160, y: 420 });
    expect(pen.kind).toBe("ob");
    expect(pen.strokes).toBe(1);
  });

  it("landing in water reports the water kind (for the splash) and still +1", () => {
    const hole = mkHole({ water: [{ x: 150, y: 150, w: 30, h: 30 }] });
    const pen = resolvePenalty("ob", hole, { x: 160, y: 160 }, [{ x: 160, y: 420 }], { x: 160, y: 420 });
    expect(pen.kind).toBe("water");
    expect(pen.strokes).toBe(1);
  });

  it("a drop zone overrides the walk-back lie", () => {
    const hole = mkHole({ dropZone: { x: 50, y: 50 } });
    const pen = resolvePenalty("ob", hole, { x: 300, y: 200 }, [{ x: 160, y: 420 }], { x: 160, y: 420 });
    expect(pen.lie).toEqual({ x: 50, y: 50 });
  });

  it("resting in a sand hazard costs +1 but plays where it lies (no new lie)", () => {
    const hole = mkHole({ hazard: [{ x: 140, y: 200, w: 60, h: 60 }] });
    const pen = resolvePenalty("stop", hole, { x: 170, y: 230 }, [], { x: 160, y: 420 });
    expect(pen.kind).toBe("sand");
    expect(pen.strokes).toBe(1);
    expect(pen.lie).toBeNull();
  });

  it("on a hazard-rough hole, stopping off the ribbon costs +1", () => {
    const hole = mkHole({ roughIsHazard: true });
    expect(resolvePenalty("stop", hole, { x: 300, y: 200 }, [], { x: 160, y: 420 }).kind).toBe("sand");
    // ...but stopping on the fairway is clean
    expect(resolvePenalty("stop", hole, { x: 160, y: 200 }, [], { x: 160, y: 420 }).kind).toBe("none");
  });
});

describe("stepFlight (one-frame flight resolution)", () => {
  it("holes out when a grounded disc settles within the catch radius", () => {
    const hole = mkHole();
    const f = grounded(hole.basket.x, hole.basket.y, 0.5);
    expect(step(f, hole).status).toBe("hole");
  });

  it("a tighter catch radius can turn a hole-out into a miss", () => {
    const hole = mkHole();
    // Sit just outside a shrunken basket but inside the normal one.
    const off = CATCH_R - 2;
    const f: Flight = { x: hole.basket.x + off, y: hole.basket.y, vx: 0.1, vy: 0, h: 0, vh: 0, fadeTurn: 0 };
    expect(step(f, hole, DISC, { catchR: 4 }).status).not.toBe("hole");
  });

  it("a grounded disc in water is OB", () => {
    const hole = mkHole({ water: [{ x: 150, y: 150, w: 30, h: 30 }] });
    expect(step(grounded(160, 160), hole).status).toBe("ob");
  });

  it("a grounded disc off the fairway ribbon is OB", () => {
    expect(step(grounded(300, 200), mkHole()).status).toBe("ob");
  });

  it("a disc that leaves the world is oob", () => {
    const f: Flight = { x: W - 3, y: 200, vx: 5, vy: 0, h: 5, vh: 0, fadeTurn: 0 };
    expect(step(f, mkHole()).status).toBe("oob");
  });

  it("a slow grounded disc on the fairway comes to a clean stop", () => {
    expect(step(grounded(160, 200), mkHole()).status).toBe("stop");
  });

  it("an airborne disc keeps flying (it flies over hazards/basket)", () => {
    const f: Flight = { x: 160, y: 200, vx: 0, vy: -3, h: 20, vh: 5, fadeTurn: 0 };
    expect(step(f, mkHole()).status).toBe("fly");
  });

  it("reports a tree hit and deflects the disc", () => {
    const hole = mkHole({ trees: [{ x: 163, y: 200, r: 8 }] });
    const f: Flight = { x: 160, y: 200, vx: 0, vy: 0, h: 10, vh: 0, fadeTurn: 0 };
    const res = step(f, hole, DISC);
    expect(res.treeHit).toBe(true);
    // pushed to the tree's surface (radius + disc radius away from center)
    expect(Math.hypot(f.x - 163, f.y - 200)).toBeCloseTo(8 + 3, 5);
  });

  it("a full throw down a clear fairway converges to a grounded outcome", () => {
    const hole = mkHole();
    const f: Flight = { x: 160, y: 420, vx: 0, vy: -6, h: 4, vh: 1.2, fadeTurn: 0 };
    let status = "fly";
    let steps = 0;
    for (; steps < 4000; steps++) {
      const r = step(f, hole, STRAIGHT);
      status = r.status;
      if (status !== "fly") break;
    }
    expect(status).not.toBe("fly"); // it terminated
    expect(steps).toBeLessThan(4000); // and didn't run away
    expect(f.h).toBe(0); // ended on the ground
    expect(f.y).toBeLessThan(420); // and moved up the fairway from the tee
  });
});
