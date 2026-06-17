import { describe, it, expect } from "vitest";
import {
  scoreLabel,
  earnedAchievements,
  buildRound,
  HOLES,
  WINTHROP_HOLES,
  TOTAL_PAR,
  WINTHROP_PAR,
  inHazard,
  inRect,
  distToSeg,
  fullPowerRange,
  DISCS,
  ADV_DISCS,
  validDiscIndex,
  isDiscUnlocked,
  DISC_PRICE,
  tournStandings,
  tournLiveStandings,
  TOURN_NAMES,
  materializeHole,
  tourPars,
  tourCharacter,
  generateTourCourse,
  buildTournGhosts,
  ghostPosAt,
  type Tournament,
} from "../lib/discgolf/engine";

describe("scoreLabel", () => {
  it("names a 1-throw hole an Ace regardless of par", () => {
    expect(scoreLabel(1, 3).name).toBe("Ace!");
    expect(scoreLabel(1, 5).tone).toBe("great");
  });
  it("names relative-to-par results", () => {
    expect(scoreLabel(2, 3).name).toBe("Birdie");
    expect(scoreLabel(3, 3).name).toBe("Par");
    expect(scoreLabel(1, 3).name).toBe("Ace!"); // 1 under a par 2 still Ace
    expect(scoreLabel(2, 4).name).toBe("Eagle");
    expect(scoreLabel(4, 3).name).toBe("Bogey");
    expect(scoreLabel(5, 3).name).toBe("Double Bogey");
  });
  it("falls back to +N for very high scores", () => {
    expect(scoreLabel(13, 3).name).toBe("+10");
  });
});

describe("earnedAchievements", () => {
  const pars = [3, 3, 3, 4, 4, 4, 4, 5, 5];
  it("detects ace, birdie, eagle and under/even par", () => {
    const scores = [1, 2, 3, 3, 4, 4, 4, 5, 5]; // ace, birdie, then pars
    const got = earnedAchievements(scores, pars, "course", 1);
    expect(got).toContain("ace");
    expect(got).toContain("birdie");
    expect(got).toContain("underpar");
    expect(got).toContain("evenpar");
  });
  it("awards bogey-free nine and not underpar when over par", () => {
    const scores = pars.map((p) => p + 1); // all bogeys
    const got = earnedAchievements(scores, pars, "course", 1);
    expect(got).not.toContain("bogeyfree9");
    expect(got).not.toContain("underpar");
    expect(got).not.toContain("evenpar");
  });
  it("tags daily rounds and the 5-round regular", () => {
    expect(earnedAchievements(pars, pars, "daily", 1)).toContain("daily");
    expect(earnedAchievements(pars, pars, "course", 5)).toContain("regular");
    expect(earnedAchievements(pars, pars, "course", 4)).not.toContain("regular");
  });
});

describe("course data", () => {
  it("has 18 holes per fixed course with the documented pars", () => {
    expect(HOLES).toHaveLength(18);
    expect(WINTHROP_HOLES).toHaveLength(18);
    expect(TOTAL_PAR).toBe(66);
    expect(WINTHROP_PAR).toBe(61);
  });
  it("stretches every hole's basket above its tee", () => {
    for (const h of [...HOLES, ...WINTHROP_HOLES]) {
      expect(h.basket.y).toBeLessThan(h.tee.y);
      expect(h.worldH).toBeGreaterThan(448);
    }
  });
});

describe("buildRound determinism", () => {
  it("is identical for the same seed + mode", () => {
    const a = buildRound(12345, "course");
    const b = buildRound(12345, "course");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it("differs for different seeds (pins/wind jittered)", () => {
    const a = buildRound(1, "winthrop");
    const b = buildRound(2, "winthrop");
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
  it("daily generates a 9-hole course", () => {
    expect(buildRound(999, "daily")).toHaveLength(9);
  });
  it("tour generates an 18-hole pro course, deterministic and pin-fair", () => {
    const a = buildRound(4242, "tour");
    expect(a).toHaveLength(18);
    expect(JSON.stringify(a)).toBe(JSON.stringify(buildRound(4242, "tour")));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(buildRound(4243, "tour")));
    for (const h of a) {
      expect(h.basket.y).toBeLessThan(h.tee.y);
      expect(h.worldH).toBeGreaterThan(448);
    }
  });
});

describe("tour course pars", () => {
  it("tourPars gives 18 pro pars (3–5) summing to a realistic total", () => {
    const pars = tourPars(777);
    expect(pars).toHaveLength(18);
    pars.forEach((p) => expect([3, 4, 5]).toContain(p));
    const sum = pars.reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThanOrEqual(62);
    expect(sum).toBeLessThanOrEqual(75);
  });
  it("a built tour course's hole pars match tourPars(seed)", () => {
    const seed = 31337;
    const built = generateTourCourse(seed).map((h) => h.par);
    expect(built).toEqual(tourPars(seed));
  });
  it("each venue has a character that actually shapes the course", () => {
    // seed 0 → Wooded style, seed 8 → Water-laden style ((seed>>>3) % 6).
    expect(tourCharacter(0).character).toBe("Wooded");
    expect(tourCharacter(8).character).toBe("Water-laden");
    expect(tourCharacter(8)).toEqual(tourCharacter(8)); // deterministic

    const wooded = generateTourCourse(0);
    const watery = generateTourCourse(8);
    const trees = (c: typeof wooded) => c.reduce((n, h) => n + h.trees.length, 0);
    const water = (c: typeof wooded) => c.reduce((n, h) => n + h.water.length, 0);
    expect(trees(wooded)).toBeGreaterThan(trees(watery)); // wooded = more trees
    expect(water(watery)).toBeGreaterThan(water(wooded)); // water-laden = more ponds
  });
  it("keeps jittered pins inside the fairway corridor", () => {
    const round = buildRound(777, "course");
    for (const h of round) {
      // basket must lie within half the corridor of the centerline
      const half = h.fwWidth / 2;
      let min = Infinity;
      for (let i = 0; i < h.fairway.length - 1; i++) {
        min = Math.min(min, distToSeg(h.basket.x, h.basket.y, h.fairway[i].x, h.fairway[i].y, h.fairway[i + 1].x, h.fairway[i + 1].y));
      }
      expect(min).toBeLessThanOrEqual(half);
    }
  });
});

describe("geometry", () => {
  it("inRect is an open-interval containment test", () => {
    const r = { x: 0, y: 0, w: 10, h: 10 };
    expect(inRect(r, 5, 5)).toBe(true);
    expect(inRect(r, 0, 5)).toBe(false);
    expect(inRect(r, 11, 5)).toBe(false);
  });
  it("inHazard only triggers when the disc fully fits the ellipse", () => {
    const hz = { x: 0, y: 0, w: 40, h: 40 };
    expect(inHazard(hz, 20, 20)).toBe(true); // dead center
    expect(inHazard(hz, 1, 1)).toBe(false); // clipping the corner
  });
  it("a hazard smaller than the disc can never contain it", () => {
    const tiny = { x: 0, y: 0, w: 4, h: 4 };
    expect(inHazard(tiny, 2, 2)).toBe(false);
  });
});

describe("fullPowerRange", () => {
  it("a driver carries farther than a putter", () => {
    const putter = fullPowerRange(DISCS[0], 0);
    const driver = fullPowerRange(DISCS[2], 0);
    expect(driver).toBeGreaterThan(putter);
  });
  it("uphill shortens carry, downhill lengthens it", () => {
    const flat = fullPowerRange(DISCS[2], 0);
    const uphill = fullPowerRange(DISCS[2], 2);
    const downhill = fullPowerRange(DISCS[2], -2);
    expect(uphill).toBeLessThan(flat);
    expect(downhill).toBeGreaterThan(flat);
  });
});

describe("disc unlocks", () => {
  it("treats core discs as always unlocked and locked ones as gated", () => {
    expect(isDiscUnlocked(ADV_DISCS[0], [])).toBe(true); // Aviar (core)
    const zone = ADV_DISCS.find((d) => d.key === "zone")!;
    expect(isDiscUnlocked(zone, [])).toBe(false);
    expect(isDiscUnlocked(zone, ["birdie"])).toBe(true);
  });
  it("validDiscIndex avoids a locked disc on the advanced bag", () => {
    // index 1 (Zone) is locked with no achievements -> falls back to an unlocked disc
    const idx = validDiscIndex(true, 1, []);
    expect(isDiscUnlocked(ADV_DISCS[idx], [])).toBe(true);
  });
  it("validDiscIndex clamps out-of-range indices", () => {
    expect(validDiscIndex(false, 99, [])).toBeLessThan(DISCS.length);
    expect(validDiscIndex(false, -5, [])).toBeGreaterThanOrEqual(0);
  });
  it("a purchased (owned) disc counts as unlocked even with no achievements", () => {
    const zone = ADV_DISCS.find((d) => d.key === "zone")!;
    expect(isDiscUnlocked(zone, [], [])).toBe(false);
    expect(isDiscUnlocked(zone, [], ["zone"])).toBe(true);
    // owning it keeps the selected index valid on the advanced bag
    const idx = ADV_DISCS.indexOf(zone);
    expect(validDiscIndex(true, idx, [], ["zone"])).toBe(idx);
  });
  it("every priced disc is a real advanced disc that is gated by default", () => {
    for (const key of Object.keys(DISC_PRICE)) {
      const d = ADV_DISCS.find((x) => x.key === key)!;
      expect(d, `priced disc ${key} exists in ADV_DISCS`).toBeTruthy();
      expect(DISC_PRICE[key]).toBeGreaterThan(0);
      expect(isDiscUnlocked(d, [], [])).toBe(false); // not free
    }
  });
});

describe("tournament", () => {
  const seed = 4242;
  // A tournament where two rounds have been played by everyone.
  const make = (myR1: number, myR2: number): Tournament => {
    const field0 = TOURN_NAMES.map((_, i) => 60 + (i % 7));
    const field1 = TOURN_NAMES.map((_, i) => 61 + (i % 5));
    return { seed, round: 2, myTotals: [myR1, myR2], fieldTotals: [field0, field1], madeCut: true, finished: false };
  };
  it("ranks the field and includes exactly one 'you' row", () => {
    const rows = tournStandings(make(58, 57));
    expect(rows).toHaveLength(TOURN_NAMES.length + 1);
    expect(rows.filter((r) => r.you)).toHaveLength(1);
    // sorted ascending by total among non-cut players
    const active = rows.filter((r) => !r.cut);
    for (let i = 1; i < active.length; i++) {
      expect(active[i].total).toBeGreaterThanOrEqual(active[i - 1].total);
    }
  });
  it("cuts roughly the top half after round 2", () => {
    const rows = tournStandings(make(80, 80)); // a poor player
    const made = rows.filter((r) => !r.cut).length;
    // 36 players -> top 18 advance (ties at the line included)
    expect(made).toBeGreaterThanOrEqual(18);
    expect(made).toBeLessThanOrEqual(TOURN_NAMES.length + 1);
  });
  it("a strong player makes the cut; a weak one misses it", () => {
    expect(tournStandings(make(50, 50)).find((r) => r.you)!.cut).toBe(false);
    expect(tournStandings(make(120, 120)).find((r) => r.you)!.cut).toBe(true);
  });
  it("live standings rank you among the field through N holes", () => {
    const t = make(0, 0); // round 3 in progress would use myTotals.length; emulate round 1
    const fresh: Tournament = { ...t, round: 0, myTotals: [], fieldTotals: [] };
    const rows = tournLiveStandings(fresh, 10, 3); // 10 strokes thru 3 holes
    expect(rows.filter((r) => r.you)).toHaveLength(1);
    expect(rows[0].rank).toBe(1);
  });
});

describe("tournament ghosts", () => {
  const t: Tournament = { seed: 7, round: 0, myTotals: [], fieldTotals: [], madeCut: true, finished: false };
  const hole = WINTHROP_HOLES[0];

  it("builds the configured number of rivals with tee→basket paths", () => {
    const gs = buildTournGhosts(t, 0, hole, 1000);
    expect(gs.ghosts).toHaveLength(4);
    expect(gs.holeIndex).toBe(0);
    for (const gh of gs.ghosts) {
      expect(gh.path.length).toBeGreaterThanOrEqual(2);
      expect(gh.path[0]).toEqual({ x: hole.tee.x, y: hole.tee.y });
      expect(gh.path[gh.path.length - 1]).toEqual({ x: hole.basket.x, y: hole.basket.y });
    }
  });

  it("picks distinct in-field rivals", () => {
    const ids = buildTournGhosts(t, 3, hole, 0).ghosts.map((g) => g.idx);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((i) => expect(i).toBeGreaterThanOrEqual(0));
    ids.forEach((i) => expect(i).toBeLessThan(TOURN_NAMES.length));
  });

  it("is deterministic for the same inputs", () => {
    const a = buildTournGhosts(t, 5, hole, 1).ghosts.map((g) => g.path);
    const b = buildTournGhosts(t, 5, hole, 999).ghosts.map((g) => g.path); // startAt differs, paths shouldn't
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("ghostPosAt sits at the tee before start and the basket once holed", () => {
    const gh = buildTournGhosts(t, 0, hole, 0).ghosts[0];
    const pre = ghostPosAt(gh, -50);
    expect(pre.holed).toBe(false);
    expect(pre).toMatchObject({ x: hole.tee.x, y: hole.tee.y });
    const done = ghostPosAt(gh, 1e9);
    expect(done.holed).toBe(true);
    expect(done).toMatchObject({ x: hole.basket.x, y: hole.basket.y });
  });
});

describe("materializeHole", () => {
  it("preserves par and scales the template into a full-length hole", () => {
    const t = { par: 3 as const, tee: { x: 160, y: 416 }, basket: { x: 160, y: 100 }, fairway: [{ x: 160, y: 416 }, { x: 160, y: 100 }], fwWidth: 100, trees: [], water: [] };
    const h = materializeHole(t);
    expect(h.par).toBe(3);
    expect(h.worldH).toBeGreaterThan(448);
    expect(h.tee.y).toBeGreaterThan(h.basket.y);
  });
});
