import { describe, it, expect } from "vitest";
import {
  scoreLabel,
  courseStars,
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
  autoDiscIndex,
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

  it("Daily courses keep every tree, pond and bunker in play", () => {
    for (let seed = 0; seed < 60; seed++)
      buildRound(seed, "daily").forEach((h, i) => checkHole(h, `daily seed ${seed} hole ${i + 1}`));
  });
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
});

describe("hole length: which disc the drive needs", () => {
  const TIER: Record<string, string> = {
    aviar: "putter", zone: "putter", harp: "putter",
    buzzz: "mid", swarm: "mid", roc: "mid",
    teebird: "fairway", firebird: "fairway", river: "fairway", pd: "fairway",
    nukeos: "driver", destroyer: "driver", wraith: "driver", zeus: "driver",
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
