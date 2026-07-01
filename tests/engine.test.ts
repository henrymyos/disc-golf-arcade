import { describe, it, expect } from "vitest";
import {
  scoreLabel,
  courseStars,
  courseHoles,
  courseDifficulty,
  difficultyStars,
  courseStarDifficulty,
  tournDifficulty,
  tournStarDifficulty,
  tournDivision,
  tournRoundPlayHoles,
  earnedAchievements,
  achievementReward,
  buildRound,
  HOLES,
  WINTHROP_HOLES,
  TOTAL_PAR,
  WINTHROP_PAR,
  inHazard,
  inRect,
  distToSeg,
  fullPowerRange,
  autoDiscIndex,
  windAlong,
  tournFieldRound,
  distBetween,
  pxToFeet,
  STRAIGHT_SPEED_MUL,
  ADV_DISCS,
  validDiscIndex,
  reconcileBag,
  unlockedDiscKeys,
  BAG_MAX,
  isDiscUnlocked,
  discUnlockLevel,
  discAvailableAtLevel,
  levelUpChoices,
  DISC_PRICE,
  DISC_LEVEL,
  TOUR_COURSES,
  tourVenue,
  offRibbons,
  leaderboardCourse,
  tournStandings,
  tournLiveStandings,
  tournPlace,
  TOURN_NAMES,
  TOURN_FIELD,
  TOURNAMENTS,
  tournDef,
  tournRoundHoles,
  materializeHole,
  tourPars,
  tourCharacter,
  generateTourCourse,
  buildTournGhosts,
  buildRacerGhosts,
  ghostPosAt,
  treesAtLie,
  stepFlight,
  type Tournament,
  type Hole,
  type Flight,
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

describe("courseStars", () => {
  const par = 54;
  it("awards no stars for an unplayed or over-par course", () => {
    expect(courseStars(null, par)).toBe(0);
    expect(courseStars(undefined, par)).toBe(0);
    expect(courseStars(par + 1, par)).toBe(0);
  });
  it("1★ at even par, 2★ at −9, 3★ at −18", () => {
    expect(courseStars(par, par)).toBe(1); // even
    expect(courseStars(par - 8, par)).toBe(1); // −8, not yet 2★
    expect(courseStars(par - 9, par)).toBe(2); // −9
    expect(courseStars(par - 17, par)).toBe(2); // −17, not yet 3★
    expect(courseStars(par - 18, par)).toBe(3); // −18
    expect(courseStars(par - 30, par)).toBe(3); // caps at 3
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
  it("detects albatross, birdie streaks, hot starts and barrages", () => {
    // First three holes birdied → hotstart + birdiestreak; an albatross on hole 4.
    const scores = [2, 2, 2, 1, 4, 4, 4, 5, 5];
    const got = earnedAchievements(scores, pars, "course", 1);
    expect(got).toContain("hotstart");
    expect(got).toContain("birdiestreak");
    expect(got).toContain("albatross"); // hole 4 is a par-4 aced (−3)
    // Five birdies-or-better across the round.
    const five = [2, 2, 2, 3, 3, 3, 3, 4, 4];
    expect(earnedAchievements(five, pars, "course", 1)).toContain("fivebirdies");
  });
  it("rewards going low and a clean 18, and tags tour/ranked modes", () => {
    const low = pars.map((p) => p - 1); // every hole birdied → 9-under on this nine
    expect(earnedAchievements(low, pars, "course", 1)).toContain("lowround");
    const par18 = [...pars, ...pars];
    expect(earnedAchievements(par18, par18, "course", 1)).toContain("bogeyfree18");
    expect(earnedAchievements(pars, pars, "tour", 1)).toContain("tourstop");
    expect(earnedAchievements(pars, pars, "ranked", 1)).toContain("ranked");
  });
  it("achievementReward sums the coin bounty for fresh ids", () => {
    expect(achievementReward([])).toBe(0);
    expect(achievementReward(["birdie"])).toBeGreaterThan(0);
    expect(achievementReward(["birdie", "ace"])).toBe(
      achievementReward(["birdie"]) + achievementReward(["ace"]),
    );
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
      expect(h.worldH).toBeGreaterThan(250); // short holes (lenMul) are still well-formed
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
  it("the par-3-heavy pool gives dailies more par 3s on average, but doesn't force a count", () => {
    let p3 = 0;
    const counts = new Set<number>();
    const runs = 200;
    for (let seed = 1; seed <= runs; seed++) {
      const c3 = buildRound(seed * 31 + 5, "daily").filter((h) => h.par === 3).length;
      p3 += c3;
      counts.add(c3);
    }
    expect(p3 / runs).toBeGreaterThan(4); // par-3-heavy pool lifts the average (was ~2.9)
    expect(counts.size).toBeGreaterThan(2); // still varies day to day — not a fixed quota
  });
  it("tour generates an 18-hole pro course, deterministic and pin-fair", () => {
    const a = buildRound(4242, "tour");
    expect(a).toHaveLength(18);
    expect(JSON.stringify(a)).toBe(JSON.stringify(buildRound(4242, "tour")));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(buildRound(4243, "tour")));
    for (const h of a) {
      expect(h.basket.y).toBeLessThan(h.tee.y);
      expect(h.worldH).toBeGreaterThan(250); // short holes (lenMul) are still well-formed
    }
  });
});

describe("tour course pars", () => {
  it("tourPars gives 18 par-3-heavy pars totaling par 59–68", () => {
    for (const seed of [777, 4242, 31337, 1, 99, 2024, 555, 800001, 6, 70007]) {
      const pars = tourPars(seed);
      expect(pars).toHaveLength(18);
      pars.forEach((p) => expect([3, 4, 5]).toContain(p));
      const sum = pars.reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThanOrEqual(59); // disc-golf courses stay in the 59–68 band
      expect(sum).toBeLessThanOrEqual(68);
      expect(pars.filter((p) => p === 3).length).toBeGreaterThanOrEqual(6); // par-3-heavy
      expect(pars.filter((p) => p === 5).length).toBeLessThanOrEqual(2); // at most a couple par 5s
    }
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

describe("generated obstacles stay in bounds", () => {
  // A box (water / sand) overlaps the in-bounds corridor if any sampled point on
  // it sits within fwWidth/2 of a fairway centerline (i.e. !offRibbons).
  const boxInCorridor = (hole: ReturnType<typeof generateTourCourse>[number], b: { x: number; y: number; w: number; h: number }) => {
    for (const fx of [0, 0.25, 0.5, 0.75, 1])
      for (const fy of [0, 0.25, 0.5, 0.75, 1])
        if (!offRibbons(hole, b.x + fx * b.w, b.y + fy * b.h)) return true;
    return false;
  };
  const checkHole = (hole: ReturnType<typeof generateTourCourse>[number], label: string) => {
    for (const t of hole.trees)
      expect(offRibbons(hole, t.x, t.y), `${label}: tree at ${t.x},${t.y} is out of bounds`).toBe(false);
    for (const w of hole.water)
      expect(boxInCorridor(hole, w), `${label}: a water box never reaches the in-bounds corridor`).toBe(true);
    for (const h of hole.hazard ?? [])
      expect(boxInCorridor(hole, h), `${label}: a sand box never reaches the in-bounds corridor`).toBe(true);
  };

  it("the listed pro-tour venues keep every obstacle in play", () => {
    for (const c of TOUR_COURSES)
      generateTourCourse(c.seed).forEach((h, i) => checkHole(h, `${c.name} hole ${i + 1}`));
  });
  it("tour & ranked courses keep obstacles in play across every venue style", () => {
    // generateTourCourse also backs Ranked (a weekly seed) — sweep many seeds so
    // all six venue characters and a wide spread of layouts are covered.
    for (let seed = 0; seed < 240; seed++)
      generateTourCourse(seed).forEach((h, i) => checkHole(h, `tour seed ${seed} hole ${i + 1}`));
  });
});

describe("Daily Challenge is assembled from real courses", () => {
  // The daily must serve holes that EXIST in the app's playable courses —
  // Glendoveer East, Winthrop Lake, and the eight pro-tour venues — never an
  // invented one. Signature = the fields that identify a hole's layout (wind is
  // re-seeded per day, so it's excluded).
  const sig = (h: Hole) => `${h.par}|${Math.round(h.tee.x)}|${h.worldH}|${Math.round(h.basket.x)}|${Math.round(h.basket.y)}|${h.trees.length}`;
  const pool = new Set<string>();
  HOLES.forEach((h) => pool.add(sig(h)));
  WINTHROP_HOLES.forEach((h) => pool.add(sig(h)));
  for (const c of TOUR_COURSES) generateTourCourse(c.seed).forEach((h) => pool.add(sig(h)));
  it("serves 9 holes a day, every one drawn from a real course", () => {
    for (let seed = 0; seed < 40; seed++) {
      const daily = buildRound(seed, "daily");
      expect(daily).toHaveLength(9);
      for (const h of daily)
        expect(pool.has(sig(h)), `daily seed ${seed}: a hole that belongs to no course`).toBe(true);
    }
  });
  it("is deterministic but varies across days", () => {
    expect(buildRound(7, "daily").map(sig)).toEqual(buildRound(7, "daily").map(sig));
    expect(buildRound(7, "daily").map(sig)).not.toEqual(buildRound(8, "daily").map(sig));
  });
  it("the early-Career 'academy' events are the same real holes, just shortened", () => {
    const len = (hs: Hole[]) => hs.reduce((s, h) => s + h.worldH, 0);
    for (let seed = 0; seed < 30; seed++) {
      const full = buildRound(seed, "academy", 1); // same picks at normal length
      const short = buildRound(seed, "academy", 0.74); // youth length-shrink
      expect(short).toHaveLength(9);
      for (const h of full)
        expect(pool.has(sig(h)), `academy seed ${seed}: a hole that belongs to no course`).toBe(true);
      expect(len(short)).toBeLessThan(len(full)); // shrunk so a beginner can reach greens
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

describe("round sand bunkers", () => {
  it("materializes hazards as circles, un-squashed even on a short hole", () => {
    const t = { par: 3 as const, lenMul: 0.5, tee: { x: 160, y: 416 }, basket: { x: 160, y: 100 }, fairway: [{ x: 160, y: 416 }, { x: 160, y: 100 }], fwWidth: 120, trees: [], water: [], hazard: [{ x: 130, y: 240, w: 40, h: 18 }] };
    const hz = materializeHole(t).hazard![0];
    expect(hz.w).toBe(hz.h); // a circle, not a flat ellipse
    expect(hz.w).toBe(40); // diameter = authored width, not shrunk by the short hole
  });
  it("generated bunkers are sizable circles you can actually land in", () => {
    // The procedural generator (tour/ranked) is what sandBox sizes — real authored
    // courses can carry smaller hazards, so we assert the size floor on generated holes.
    let n = 0;
    for (let seed = 0; seed < 60; seed++)
      for (const h of buildRound(seed, "tour"))
        for (const hz of h.hazard ?? []) {
          expect(hz.w).toBe(hz.h); // round
          expect(hz.w).toBeGreaterThanOrEqual(28); // big enough that inHazard (− discR) leaves a real target
          n++;
        }
    expect(n).toBeGreaterThan(0);
  });
});

describe("fullPowerRange", () => {
  const disc = (key: string) => ADV_DISCS.find((d) => d.key === key)!;
  it("a driver carries farther than a putter", () => {
    const putter = fullPowerRange(disc("aviar"), 0);
    const driver = fullPowerRange(disc("destroyer"), 0);
    expect(driver).toBeGreaterThan(putter);
  });
  it("uphill shortens carry, downhill lengthens it", () => {
    const flat = fullPowerRange(disc("destroyer"), 0);
    const uphill = fullPowerRange(disc("destroyer"), 2);
    const downhill = fullPowerRange(disc("destroyer"), -2);
    expect(uphill).toBeLessThan(flat);
    expect(downhill).toBeGreaterThan(flat);
  });
  it("a tailwind lengthens carry, a headwind shortens it", () => {
    const windless = fullPowerRange(disc("destroyer"), 0, 1, 0);
    const tail = fullPowerRange(disc("destroyer"), 0, 1, 0.01); // wind carries it on
    const head = fullPowerRange(disc("destroyer"), 0, 1, -0.01); // wind knocks it down
    expect(tail).toBeGreaterThan(windless);
    expect(head).toBeLessThan(windless);
  });
});

describe("disc unlocks", () => {
  it("treats core discs as always unlocked and locked ones as gated", () => {
    expect(isDiscUnlocked(ADV_DISCS[0], [])).toBe(true); // Aviar (core)
    const zone = ADV_DISCS.find((d) => d.key === "zone")!; // ach: birdie, min level 2
    expect(isDiscUnlocked(zone, [], [], 2)).toBe(false); // available but not yet earned/owned
    expect(isDiscUnlocked(zone, ["birdie"], [], 2)).toBe(true); // earned at/after its level
    expect(isDiscUnlocked(zone, ["birdie"], [], 1)).toBe(false); // earned but below its level
  });
  it("validDiscIndex keeps an index that's in the bag", () => {
    const bag = ["aviar", "buzzz"];
    const buzzz = ADV_DISCS.findIndex((d) => d.key === "buzzz");
    expect(validDiscIndex(buzzz, bag)).toBe(buzzz);
  });
  it("validDiscIndex falls back to a bagged disc when the saved one isn't carried", () => {
    const bag = ["buzzz"];
    const zone = ADV_DISCS.findIndex((d) => d.key === "zone"); // not in the bag
    expect(ADV_DISCS[validDiscIndex(zone, bag)].key).toBe("buzzz");
    expect(ADV_DISCS[validDiscIndex(99, bag)].key).toBe("buzzz"); // out of range too
  });
  it("a purchased (owned) disc counts as unlocked even with no achievements", () => {
    const zone = ADV_DISCS.find((d) => d.key === "zone")!;
    expect(isDiscUnlocked(zone, [], [])).toBe(false);
    expect(isDiscUnlocked(zone, [], ["zone"])).toBe(true);
  });
  it("every priced disc is a real disc that is gated by default", () => {
    for (const key of Object.keys(DISC_PRICE)) {
      const d = ADV_DISCS.find((x) => x.key === key)!;
      expect(d, `priced disc ${key} exists`).toBeTruthy();
      expect(DISC_PRICE[key]).toBeGreaterThan(0);
      expect(isDiscUnlocked(d, [], [], 1)).toBe(false); // not free at level 1
    }
  });
});

describe("auto-caddie disc selection", () => {
  const disc = (i: number) => ADV_DISCS[i];
  const reach = (key: string) => fullPowerRange(ADV_DISCS.find((d) => d.key === key)!, 0, STRAIGHT_SPEED_MUL);

  it("a starter bag (Aviar + Buzzz): putter when close, midrange when far", () => {
    const bag = ["aviar", "buzzz"];
    const beg = (rem: number) => disc(autoDiscIndex(rem, bag, 0)).key;
    expect(beg(reach("aviar") * 0.5)).toBe("aviar"); // really close → putter
    expect(beg(reach("buzzz") * 0.9)).toBe("buzzz"); // mid range → midrange
    expect(beg(900)).toBe("buzzz"); // long drive but no driver in the bag → their longest
  });

  it("a full straight bag: clubs up close→far and always picks a STRAIGHT disc", () => {
    const bag = ["aviar", "buzzz", "teebird", "destroyer", "zone"]; // includes an overstable disc
    const hi = (rem: number) => disc(autoDiscIndex(rem, bag, 0));
    expect(hi(reach("aviar") * 0.5).key).toBe("aviar"); // putter
    expect(hi((reach("aviar") + reach("buzzz")) / 2).key).toBe("buzzz"); // midrange
    const longDrive = hi(reach("teebird") + 20); // past the fairway tier's reach
    expect(longDrive.flight).toBe("straight");
    expect(longDrive.key).toBe("destroyer"); // the straight driver, not the overstable Zone
    expect(disc(autoDiscIndex(2000, bag, 0)).key).toBe("destroyer"); // unreachable → longest straight
  });

  it("never auto-equips an overstable disc when a straight one is in the bag", () => {
    const bag = ["aviar", "buzzz", "teebird", "destroyer", "zone"];
    for (let rem = 0; rem <= 600; rem += 15)
      expect(disc(autoDiscIndex(rem, bag, 0)).flight).toBe("straight");
  });

  it("falls back to an overstable disc only if the bag has no straight discs", () => {
    const bag = ["zone", "swarm"]; // both overstable
    expect(["zone", "swarm"]).toContain(disc(autoDiscIndex(20, bag, 0)).key);
  });

  it("clubs up into a headwind and not up with a tailwind", () => {
    const bag = ["aviar", "buzzz", "teebird", "destroyer"]; // putter→mid→fairway→distance
    // Windless reach of the chosen disc — bigger number = more disc.
    const wr = (i: number) => fullPowerRange(disc(i), 0, STRAIGHT_SPEED_MUL);
    const rem = reach("buzzz") * 0.98; // a shot the midrange just covers when it's calm
    const calm = autoDiscIndex(rem, bag, 0, 0);
    const head = autoDiscIndex(rem, bag, 0, -0.012); // into the wind
    const tail = autoDiscIndex(rem, bag, 0, 0.012); // downwind
    expect(disc(calm).key).toBe("buzzz");
    expect(wr(head)).toBeGreaterThan(wr(calm)); // headwind eats the carry → reach for more disc
    expect(wr(tail)).toBeLessThanOrEqual(wr(calm)); // downwind never needs more disc
  });

  it("pxToFeet reads realistic disc carries: mid ~300, fairway ~400, driver ~500 ft", () => {
    expect(pxToFeet(0)).toBe(0);
    expect(pxToFeet(100)).toBeLessThan(pxToFeet(200));
    const carry = (key: string) => pxToFeet(fullPowerRange(ADV_DISCS.find((d) => d.key === key)!, 0, STRAIGHT_SPEED_MUL));
    expect(carry("buzzz")).toBeGreaterThanOrEqual(270); // midrange ≈ 300
    expect(carry("buzzz")).toBeLessThanOrEqual(330);
    expect(carry("teebird")).toBeGreaterThanOrEqual(370); // fairway ≈ 400
    expect(carry("teebird")).toBeLessThanOrEqual(430);
    expect(carry("destroyer")).toBeGreaterThanOrEqual(490); // distance ≈ 500
    expect(carry("destroyer")).toBeLessThanOrEqual(560);
  });
});

describe("windAlong (wind sensed along the shot)", () => {
  // Basket sits at a lower y than the tee, so "toward the basket" is −y.
  const hole = { tee: { x: 0, y: 900 }, basket: { x: 0, y: 200 } } as never;
  const h = (wind: { x: number; y: number } | undefined) => ({ ...(hole as object), wind } as never);
  it("reads a tailwind positive, a headwind negative, and no wind as zero", () => {
    expect(windAlong(h({ x: 0, y: -0.01 }), { x: 0, y: 900 })).toBeGreaterThan(0); // blowing toward the basket
    expect(windAlong(h({ x: 0, y: 0.01 }), { x: 0, y: 900 })).toBeLessThan(0); // blowing back at the tee
    expect(windAlong(h(undefined), { x: 0, y: 900 })).toBe(0);
  });
});

describe("starting bag + disc availability", () => {
  it("a new player (level 1) starts with only a putter + a midrange", () => {
    const free = ADV_DISCS.filter((d) => isDiscUnlocked(d, [], [], 1)).map((d) => d.key);
    expect(free.sort()).toEqual(["aviar", "buzzz"]); // putter (Aviar) + mid (Buzzz)
  });
  it("reaching a level makes a disc AVAILABLE but does not hand it over for free", () => {
    const teebird = ADV_DISCS.find((d) => d.key === "teebird")!;
    expect(discAvailableAtLevel(teebird, 1)).toBe(false);
    expect(discAvailableAtLevel(teebird, DISC_LEVEL.teebird)).toBe(true);
    // available ≠ owned: you still have to draft or buy it
    expect(isDiscUnlocked(teebird, [], [], DISC_LEVEL.teebird)).toBe(false);
    expect(isDiscUnlocked(teebird, [], ["teebird"], 1)).toBe(true); // owned → yours
  });
  it("fairway drivers come early; distance drivers wait for ~level 10", () => {
    const fairway = ["teebird", "river", "firebird", "pd"];
    const distance = ["nukeos", "destroyer", "wraith", "zeus"];
    for (const k of fairway) expect(DISC_LEVEL[k]).toBeLessThanOrEqual(6);
    for (const k of distance) expect(DISC_LEVEL[k]).toBeGreaterThanOrEqual(10);
  });
  it("an achievement can't unlock a distance driver before its level", () => {
    const destroyer = ADV_DISCS.find((d) => d.key === "destroyer")!; // ach: underpar, lvl 10
    expect(isDiscUnlocked(destroyer, ["underpar"], [], 5)).toBe(false); // earned but too low
    expect(isDiscUnlocked(destroyer, ["underpar"], [], DISC_LEVEL.destroyer)).toBe(true);
  });
});

describe("level-up disc draft (levelUpChoices)", () => {
  it("offers two available, not-yet-owned discs that differ in flight", () => {
    const choices = levelUpChoices(3, [], []); // lvl 3: zone/swarm/harp/roc/teebird available
    expect(choices).toHaveLength(2);
    const discs = choices.map((k) => ADV_DISCS.find((d) => d.key === k)!);
    expect(discs[0].flight).not.toBe(discs[1].flight); // a straight vs an overstable pick
    for (const d of discs) expect(isDiscUnlocked(d, [], [], 3)).toBe(false);
  });
  it("never offers a distance driver before level 10", () => {
    for (let lvl = 2; lvl < 10; lvl++)
      for (const k of levelUpChoices(lvl, [], []))
        expect(["nukeos", "destroyer", "wraith", "zeus"]).not.toContain(k);
  });
  it("offers a distance driver once level 10+ and the earlier discs are owned", () => {
    const ownedEarly = ADV_DISCS.filter((d) => (DISC_LEVEL[d.key] ?? 0) < 10).map((d) => d.key);
    const choices = levelUpChoices(10, [], ownedEarly);
    expect(choices.length).toBeGreaterThan(0);
    expect(choices.some((k) => ["nukeos", "destroyer", "wraith", "zeus"].includes(k))).toBe(true);
  });
  it("returns nothing when everything available is already owned", () => {
    const all = ADV_DISCS.map((d) => d.key);
    expect(levelUpChoices(99, [], all)).toEqual([]);
  });
  it("the first level-up (lvl 2) always hands over a fairway driver", () => {
    const FAIRWAY = ["teebird", "river", "firebird", "pd", "leopard", "thunderbird"];
    const choices = levelUpChoices(2, [], []);
    expect(choices).toEqual(["teebird", "river"]); // both fairway drivers — pick = a driver
    for (const k of choices) expect(FAIRWAY).toContain(k);
    // if one's already owned (bought in the shop), the other fairway driver still leads
    expect(levelUpChoices(2, [], ["teebird"])[0]).toBe("river");
  });
});

describe("hole length: which disc the drive needs", () => {
  const TIER: Record<string, string> = {
    aviar: "putter", zone: "putter", harp: "putter", pure: "putter",
    buzzz: "mid", swarm: "mid", roc: "mid", mako: "mid",
    teebird: "fairway", firebird: "fairway", river: "fairway", pd: "fairway", leopard: "fairway", thunderbird: "fairway",
    nukeos: "driver", destroyer: "driver", wraith: "driver", zeus: "driver", sidewinder: "driver", boss: "driver",
  };
  const FULL_BAG = ADV_DISCS.map((d) => d.key);
  const driveTier = (hole: { tee: { x: number; y: number }; basket: { x: number; y: number }; elev?: number }) =>
    TIER[ADV_DISCS[autoDiscIndex(distBetween(hole.tee, hole.basket), FULL_BAG, hole.elev ?? 0)].key];

  it("Winthrop holes 4, 11, 15, 16 drive with only a midrange", () => {
    for (const h of [4, 11, 15, 16]) expect(driveTier(WINTHROP_HOLES[h - 1]), `hole ${h}`).toBe("mid");
  });
  it("Winthrop holes 3 and 12 drive with only a fairway", () => {
    for (const h of [3, 12]) expect(driveTier(WINTHROP_HOLES[h - 1]), `hole ${h}`).toBe("fairway");
  });
  it("Winthrop's long holes still need a driver off the tee", () => {
    for (const h of [1, 5, 8, 18]) expect(driveTier(WINTHROP_HOLES[h - 1]), `hole ${h}`).toBe("driver");
  });
  it("procedural courses mix in short mid/fairway holes — not all drivers", () => {
    let shortDrives = 0, total = 0;
    for (let seed = 0; seed < 30; seed++)
      for (const h of buildRound(seed, "daily")) {
        total++;
        const t = driveTier(h);
        if (t === "mid" || t === "fairway" || t === "putter") shortDrives++;
      }
    expect(shortDrives).toBeGreaterThan(total * 0.1); // a meaningful share are reachable without a driver
  });
  it("par 4 holes read ~650-900 ft and par 5 holes ~1000-1200 ft", () => {
    // Per-hole basket position spreads the length a little, so allow modest
    // slop around the 650–900 / 1000–1200 targets (a couple of hand-authored
    // designs sit right at the edges).
    const feetOf = (h: { tee: { x: number; y: number }; basket: { x: number; y: number } }) => pxToFeet(distBetween(h.tee, h.basket));
    const holes = [...HOLES, ...WINTHROP_HOLES, ...generateTourCourse(7), ...buildRound(99, "daily"), ...buildRound(3, "tour")];
    let p4 = 0, p5 = 0;
    for (const h of holes) {
      if (h.par === 4) { p4++; expect(feetOf(h), `par 4 = ${feetOf(h)}ft`).toBeGreaterThanOrEqual(620); expect(feetOf(h), `par 4 = ${feetOf(h)}ft`).toBeLessThanOrEqual(920); }
      if (h.par === 5) { p5++; expect(feetOf(h), `par 5 = ${feetOf(h)}ft`).toBeGreaterThanOrEqual(980); expect(feetOf(h), `par 5 = ${feetOf(h)}ft`).toBeLessThanOrEqual(1260); }
    }
    expect(p4).toBeGreaterThan(0);
    expect(p5).toBeGreaterThan(0);
  });
});

describe("bag auto-fill (reconcileBag)", () => {
  it("a new player's starter bag is just the two core discs", () => {
    const unlocked = unlockedDiscKeys([], [], 1); // Aviar + Buzzz
    const { bag, seen } = reconcileBag([], [], unlocked);
    expect(bag.sort()).toEqual(["aviar", "buzzz"]);
    expect(seen.sort()).toEqual(["aviar", "buzzz"]);
  });
  it("auto-adds newly-unlocked discs until the bag is full, then stops", () => {
    const all = ADV_DISCS.map((d) => d.key); // everything unlocked at once (e.g. migration)
    const { bag, seen } = reconcileBag([], [], all);
    expect(bag).toHaveLength(BAG_MAX);
    expect(bag).toContain("aviar"); // a straight putter
    expect(bag).toContain("destroyer"); // a straight driver
    expect(seen.sort()).toEqual([...all].sort()); // every unlock is marked processed
  });
  it("does not silently re-add a disc the player removed from the bag", () => {
    const all = ADV_DISCS.map((d) => d.key);
    // Player has seen everything and curated a 3-disc bag (removed two).
    const curated = ["aviar", "buzzz", "destroyer"];
    const { bag } = reconcileBag(curated, all, all);
    expect(bag).toEqual(curated); // unchanged — no auto-refill to 5
  });
  it("adds a freshly-unlocked disc when there's still room", () => {
    const seen = ["aviar", "buzzz"];
    const bag = ["aviar", "buzzz"];
    const nowUnlocked = ["aviar", "buzzz", "teebird"]; // teebird just unlocked
    const res = reconcileBag(bag, seen, nowUnlocked);
    expect(res.bag).toContain("teebird");
    expect(res.bag).toHaveLength(3);
  });
  it("a freshly-unlocked disc goes to the collection (not the bag) when full", () => {
    const seen = ["aviar", "buzzz", "teebird", "destroyer", "wraith"];
    const bag = ["aviar", "buzzz", "teebird", "destroyer", "wraith"]; // full
    const nowUnlocked = [...seen, "zone"]; // zone just unlocked
    const res = reconcileBag(bag, seen, nowUnlocked);
    expect(res.bag).toHaveLength(BAG_MAX);
    expect(res.bag).not.toContain("zone"); // stays in the collection
    expect(res.seen).toContain("zone"); // but is marked processed
  });
});

describe("pro-tour courses", () => {
  it("exposes a roster of distinct, real 18-hole venues", () => {
    expect(TOUR_COURSES.length).toBeGreaterThanOrEqual(6);
    expect(new Set(TOUR_COURSES.map((c) => c.name)).size).toBe(TOUR_COURSES.length); // distinct
    for (const c of TOUR_COURSES) {
      expect(c.holes).toBe(18);
      expect(c.par).toBeGreaterThan(50);
      expect(tourVenue(c.seed)).toBe(c.name); // name matches the seed's venue
    }
  });
  it("each tour course gets its own leaderboard board keyed by seed", () => {
    const c = TOUR_COURSES[0];
    expect(leaderboardCourse("tour", c.seed)).toBe(`tour-${c.seed}`);
  });
});

describe("course difficulty (1–5 stars)", () => {
  it("difficultyStars maps the score range onto 1–5 (5 = very hard)", () => {
    expect(difficultyStars(1.0)).toBe(1);
    expect(difficultyStars(5.0)).toBe(2);
    expect(difficultyStars(5.5)).toBe(3);
    expect(difficultyStars(6.0)).toBe(4);
    expect(difficultyStars(6.5)).toBe(5);
    expect(difficultyStars(99)).toBe(5);
  });
  it("rates a busier course harder than a wide-open one", () => {
    const open = [{ par: 3, fwWidth: 140, trees: [], water: [], hazard: [] }] as unknown as Parameters<typeof courseDifficulty>[0];
    const nasty = [{ par: 3, fwWidth: 80, trees: [{}, {}, {}, {}], water: [{}, {}], hazard: [{}], windMag: 0.03, elev: 2 }] as unknown as Parameters<typeof courseDifficulty>[0];
    expect(courseDifficulty(nasty)).toBeGreaterThan(courseDifficulty(open));
  });
  it("the play-courses span a real spread of star ratings", () => {
    const stars = new Set<number>();
    stars.add(courseStarDifficulty("course"));
    stars.add(courseStarDifficulty("winthrop"));
    for (const c of TOUR_COURSES) stars.add(courseStarDifficulty("tour", c.seed));
    expect(Math.max(...stars)).toBe(5); // at least one very-hard course
    expect(Math.min(...stars)).toBeLessThanOrEqual(2); // and an easy one
    expect(stars.size).toBeGreaterThanOrEqual(3); // a genuine spread
  });
  it("every fixed course resolves to 18 holes via courseHoles", () => {
    expect(courseHoles("course")).toHaveLength(18);
    expect(courseHoles("winthrop")).toHaveLength(18);
    expect(courseHoles("tour", TOUR_COURSES[0].seed)).toHaveLength(18);
  });
  it("a tournament's difficulty is the average of its courses", () => {
    const single = TOURNAMENTS.find((d) => d.id === "Winthrop Lake Classic")!;
    expect(tournStarDifficulty(single)).toBe(courseStarDifficulty("winthrop"));
    for (const d of TOURNAMENTS) {
      const avg = d.rounds.reduce((s, r) => s + courseDifficulty(courseHoles(r.mode, r.seed)), 0) / d.rounds.length;
      expect(tournDifficulty(d)).toBeCloseTo(avg, 5);
      expect(tournStarDifficulty(d)).toBeGreaterThanOrEqual(1);
      expect(tournStarDifficulty(d)).toBeLessThanOrEqual(5);
    }
  });
});

describe("tournament division scaling (Bronze → Master)", () => {
  const DIV_ORDER = ["bronze", "silver", "gold", "platinum", "diamond", "master"];
  const byDiff = [...TOURNAMENTS].sort((a, b) => tournDifficulty(a) - tournDifficulty(b));

  it("the easiest event fields a Bronze division and the hardest a Master one", () => {
    expect(tournDivision(byDiff[0]).key).toBe("bronze");
    expect(tournDivision(byDiff[byDiff.length - 1]).key).toBe("master");
  });

  it("division climbs monotonically with difficulty and spans the whole ladder", () => {
    const idx = byDiff.map((d) => DIV_ORDER.indexOf(tournDivision(d).key));
    expect(idx.every((i) => i >= 0)).toBe(true);                 // every event resolves to a known division
    for (let i = 1; i < idx.length; i++) expect(idx[i]).toBeGreaterThanOrEqual(idx[i - 1]);
    expect(new Set(idx).size).toBe(DIV_ORDER.length);            // Bronze through Master all represented
  });

  it("a higher-division field shoots lower on identical holes", () => {
    const bronze = byDiff[0], master = byDiff[byDiff.length - 1];
    // Score both fields on the SAME layout so only the division handicap differs —
    // the Master field, being stronger, posts a markedly lower field mean.
    const holes = tournRoundPlayHoles(bronze.seed, 0, bronze.rounds[0]);
    const mean = (seed: number) => { const f = tournFieldRound(seed, 0, holes); return f.reduce((a, b) => a + b, 0) / f.length; };
    expect(mean(master.seed)).toBeLessThan(mean(bronze.seed) - 6); // a clear, multi-stroke gap, not noise
  });
});

describe("tournament roster", () => {
  it("offers 10–20 named events, each 2–3 rounds on one or two courses", () => {
    expect(TOURNAMENTS.length).toBeGreaterThanOrEqual(10);
    expect(TOURNAMENTS.length).toBeLessThanOrEqual(20);
    const ids = new Set(TOURNAMENTS.map((d) => d.id));
    expect(ids.size).toBe(TOURNAMENTS.length); // unique
    for (const d of TOURNAMENTS) {
      expect(d.rounds.length).toBeGreaterThanOrEqual(2);
      expect(d.rounds.length).toBeLessThanOrEqual(3);
      const courses = new Set(d.rounds.map((r) => `${r.mode}:${r.seed ?? ""}`));
      expect(courses.size).toBeGreaterThanOrEqual(1);
      expect(courses.size).toBeLessThanOrEqual(2); // one or two distinct courses
      for (const r of d.rounds) expect(tournRoundHoles(r).length).toBe(18); // every round resolves
      expect(tournDef(d.id)).toBe(d);
    }
  });
});

describe("tournament", () => {
  const def = TOURNAMENTS.find((d) => d.id === "Winthrop Lake Classic")!; // 3 rounds, cut
  const seed = def.seed;
  // A tournament where two rounds have been played by everyone.
  const make = (myR1: number, myR2: number): Tournament => {
    const field0 = TOURN_NAMES.map((_, i) => 60 + (i % 7));
    const field1 = TOURN_NAMES.map((_, i) => 61 + (i % 5));
    return { id: def.id, seed, round: 2, myTotals: [myR1, myR2], fieldTotals: [field0, field1], madeCut: true, finished: false };
  };
  it("ranks the field and includes exactly one 'you' row", () => {
    const rows = tournStandings(make(58, 57), def);
    expect(rows).toHaveLength(TOURN_FIELD);
    expect(rows.filter((r) => r.you)).toHaveLength(1);
    const active = rows.filter((r) => !r.cut);
    for (let i = 1; i < active.length; i++) {
      expect(active[i].total).toBeGreaterThanOrEqual(active[i - 1].total);
    }
  });
  it("cuts roughly the top half after round 2", () => {
    const rows = tournStandings(make(80, 80), def); // a poor player
    const made = rows.filter((r) => !r.cut).length;
    expect(made).toBeGreaterThanOrEqual(18);
    expect(made).toBeLessThanOrEqual(TOURN_FIELD);
  });
  it("a strong player makes the cut and finishes high; a weak one misses it", () => {
    expect(tournStandings(make(50, 50), def).find((r) => r.you)!.cut).toBe(false);
    expect(tournStandings(make(120, 120), def).find((r) => r.you)!.cut).toBe(true);
    expect(tournPlace(make(40, 40), def)).toBeLessThan(tournPlace(make(120, 120), def));
  });
  it("a 2-round event has no cut", () => {
    const twoRound = TOURNAMENTS.find((d) => d.rounds.length === 2)!;
    expect(tournStandings({ ...make(120, 120), id: twoRound.id }, twoRound).find((r) => r.you)!.cut).toBe(false);
  });
  it("live standings rank you among the field through N holes", () => {
    const fresh: Tournament = { ...make(0, 0), round: 0, myTotals: [], fieldTotals: [] };
    const rows = tournLiveStandings(fresh, def, 10, 3); // 10 strokes thru 3 holes
    expect(rows.filter((r) => r.you)).toHaveLength(1);
    expect(rows[0].rank).toBe(1);
  });
});

describe("tournament field feels wind + elevation (everywhere, not just career)", () => {
  // The bots score on the same wind/elevation holes you play, so conditions move
  // the whole field — uphill/into-the-wind plays harder, downhill/downwind easier.
  const seed = 4242;
  const round = 0;
  const base = buildRound(seed, "course");
  const sum = (holes: typeof base) => tournFieldRound(seed, round, holes).reduce((a, b) => a + b, 0);

  it("an uphill course costs the field strokes a downhill one gives back", () => {
    const uphill = base.map((h) => ({ ...h, wind: undefined, windMag: 0, elev: 2, elevZones: undefined }));
    const downhill = base.map((h) => ({ ...h, wind: undefined, windMag: 0, elev: -2, elevZones: undefined }));
    expect(sum(uphill)).toBeGreaterThan(sum(downhill));
  });

  it("a headwind course plays tougher than the same course downwind", () => {
    // Same wind magnitude (so raw course difficulty is unchanged) — only the
    // DIRECTION flips, isolating the along-the-shot effect on the field.
    const headwind = base.map((h) => ({ ...h, wind: { x: 0, y: 0.012 }, windMag: 0.012, elev: 0, elevZones: undefined }));
    const tailwind = base.map((h) => ({ ...h, wind: { x: 0, y: -0.012 }, windMag: 0.012, elev: 0, elevZones: undefined }));
    expect(sum(headwind)).toBeGreaterThan(sum(tailwind));
  });
});

describe("tournament ghosts", () => {
  const def = TOURNAMENTS.find((d) => d.id === "Winthrop Lake Classic")!;
  const t: Tournament = { id: def.id, seed: def.seed, round: 0, myTotals: [], fieldTotals: [], madeCut: true, finished: false };
  const hole = WINTHROP_HOLES[0];

  it("builds the configured number of rivals with tee→basket paths", () => {
    const gs = buildTournGhosts(t, def, 0, hole, 1000);
    expect(gs.ghosts).toHaveLength(4);
    expect(gs.holeIndex).toBe(0);
    for (const gh of gs.ghosts) {
      expect(gh.segs.length).toBeGreaterThanOrEqual(1);
      expect(gh.segs[0].from).toEqual({ x: hole.tee.x, y: hole.tee.y });
      expect(gh.segs[gh.segs.length - 1].to).toEqual({ x: hole.basket.x, y: hole.basket.y });
    }
  });

  it("picks distinct in-field rivals", () => {
    const names = buildTournGhosts(t, def, 3, hole, 0).ghosts.map((g) => g.name);
    expect(new Set(names).size).toBe(names.length);
    names.forEach((n) => expect(TOURN_NAMES).toContain(n));
  });

  it("is deterministic for the same inputs", () => {
    const a = buildTournGhosts(t, def, 5, hole, 1).ghosts.map((g) => g.segs);
    const b = buildTournGhosts(t, def, 5, hole, 999).ghosts.map((g) => g.segs); // startAt differs, paths shouldn't
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("ghostPosAt sits at the tee before start and the basket once holed", () => {
    const gh = buildTournGhosts(t, def, 0, hole, 0).ghosts[0];
    const pre = ghostPosAt(gh, -50);
    expect(pre.holed).toBe(false);
    expect(pre).toMatchObject({ x: hole.tee.x, y: hole.tee.y });
    const done = ghostPosAt(gh, 1e9);
    expect(done.holed).toBe(true);
    expect(done).toMatchObject({ x: hole.basket.x, y: hole.basket.y });
  });

  it("rivals fly at the player's pace (≈0.2 px/ms) — long shots aren't faster", () => {
    // One 200px shot, no obstacles: flight time should be distance / player speed,
    // not a fixed duration, so a rival's disc never outruns yours.
    const open: Hole = { par: 3, worldH: 520, worldW: 320, tee: { x: 160, y: 360 }, basket: { x: 160, y: 160 }, fairway: [{ x: 160, y: 360 }, { x: 160, y: 160 }], fwWidth: 200, trees: [], water: [], hazard: [], elev: 0 } as unknown as Hole;
    const gh = buildRacerGhosts(7, 0, open, [{ name: "Sky", color: "#fff", shots: 1 }], 0).ghosts[0];
    const seg = gh.segs[0];
    const segLen = Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y);
    expect(seg.fly).toBeCloseTo(segLen / 0.2, 0); // 200px ⇒ ~1000ms in the air
    expect(seg.ctrl).toBeNull(); // nothing to curve around
  });

  it("rivals curve their shot around a tree instead of flying through it", () => {
    // A tree dead-center on the tee→basket line: the rival's flight must bow around
    // it and never pass through the trunk.
    const tree = { x: 160, y: 260, r: 10 };
    const blocked: Hole = { par: 3, worldH: 520, worldW: 320, tee: { x: 160, y: 360 }, basket: { x: 160, y: 160 }, fairway: [{ x: 160, y: 360 }, { x: 160, y: 160 }], fwWidth: 200, trees: [tree], water: [], hazard: [], elev: 0 } as unknown as Hole;
    const seg = buildRacerGhosts(7, 0, blocked, [{ name: "Sky", color: "#fff", shots: 1 }], 0).ghosts[0].segs[0];
    expect(seg.ctrl).not.toBeNull(); // a shaped shot, not a straight line
    let minD = Infinity;
    for (let e = 0; e <= 1; e += 0.01) {
      const u = 1 - e;
      const x = u * u * seg.from.x + 2 * u * e * seg.ctrl!.x + e * e * seg.to.x;
      const y = u * u * seg.from.y + 2 * u * e * seg.ctrl!.y + e * e * seg.to.y;
      minD = Math.min(minD, Math.hypot(x - tree.x, y - tree.y));
    }
    expect(minD).toBeGreaterThan(tree.r); // clears the trunk
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

describe("throw-through-a-tree-you're-behind", () => {
  // A long open hole with one tree right in front of the tee, directly on the
  // line to the basket — exactly the "stuck right behind a tree" situation.
  const hole: Hole = {
    par: 4, worldH: 2000, worldW: 320,
    tee: { x: 160, y: 1950 }, basket: { x: 160, y: 60 },
    fairway: [{ x: 160, y: 1950 }, { x: 160, y: 60 }], fwWidth: 600,
    trees: [{ x: 160, y: 1936, r: 10 }], water: [], hazard: [], elev: 0,
  };
  const tee = { x: 160, y: 1950 };

  it("treesAtLie flags a tree you're right up against and ignores far ones", () => {
    expect(treesAtLie(hole, tee.x, tee.y)).toEqual([hole.trees[0]]); // 14px away → flagged
    expect(treesAtLie(hole, 160, 1900)).toEqual([]);                 // 36px away → not flagged
  });

  it("a normal throw bounces off the tree, but a ghosted throw passes through it", () => {
    const launch = (): Flight => ({ x: tee.x, y: tee.y, vx: 0, vy: -14, h: 0, vh: 2.5, fadeTurn: 0 });
    const run = (ghost: boolean) => {
      const f = launch();
      let hit = false;
      for (let i = 0; i < 200; i++) {
        const r = stepFlight(f, ADV_DISCS[0], -1, "straight", hole, "flat", ghost ? { ghostTrees: hole.trees } : {});
        if (r.treeHit) hit = true;
        if (r.status !== "fly") break;
      }
      return { hit, y: f.y };
    };
    expect(run(false).hit).toBe(true);   // collides with the trunk it's behind
    const through = run(true);
    expect(through.hit).toBe(false);     // ghosted: no collision
    expect(through.y).toBeLessThan(1900); // and the disc actually flew on down the fairway
  });
});

describe("basket catch — swept path (no tunneling past the pin)", () => {
  const hole: Hole = {
    par: 3, worldH: 2000, worldW: 320,
    tee: { x: 160, y: 1950 }, basket: { x: 160, y: 60 },
    fairway: [{ x: 160, y: 1950 }, { x: 160, y: 60 }], fwWidth: 600,
    trees: [], water: [], hazard: [], elev: 0,
  };

  it("catches a fast, low disc whose single frame straddles the basket center", () => {
    // One step carries the disc from the near side of the pin (y=66) to the far
    // side (y=54): the END point sits 6px from the pin — outside the shrunk catch
    // radius of a screaming disc — but the swept segment runs dead through it, so
    // it drops instead of sliding past.
    const f: Flight = { x: 160, y: 66, vx: 0, vy: -12, h: 0, vh: 0, fadeTurn: 0 };
    expect(stepFlight(f, ADV_DISCS[0], -1, "straight", hole, "flat", {}).status).toBe("hole");
  });

  it("still misses a disc that passes wide of the basket", () => {
    const f: Flight = { x: 185, y: 66, vx: 0, vy: -12, h: 0, vh: 0, fadeTurn: 0 };
    let holed = false;
    for (let i = 0; i < 200; i++) {
      const r = stepFlight(f, ADV_DISCS[0], -1, "straight", hole, "flat", {});
      if (r.status === "hole") holed = true;
      if (r.status !== "fly") break;
    }
    expect(holed).toBe(false);
  });
});
