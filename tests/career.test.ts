import { describe, it, expect } from "vitest";
import {
  newCareer,
  skillMods,
  momentumAfter,
  careerRating,
  careerYear,
  PDGA_MAX,
  seasonSchedule,
  genField,
  placeInField,
  simEvent,
  recordResult,
  advanceSeason,
  retire,
  seasonComplete,
  normalizeCareer,
  availableSponsors,
  signSponsor,
  unsignSponsor,
  sponsorBrandLock,
  trainingPointCost,
  buyTrainingPoint,
  seasonBaseTrain,
  spendSkillPoint,
  trainBonusFor,
  seasonEnergy,
  eventEnergyCost,
  canEnterEvent,
  careerFieldHoles,
  careerCard,
  careerCardRacers,
  careerLiveStandings,
  topRivals,
  rivalRating,
  SPONSOR_CAP,
  IDENTITY_MODS,
  SKILL_KEYS,
  CAREER_CORE_DISCS,
  CAREER_BAG_MAX,
  careerCoins,
  careerDiscShop,
  buyCareerDisc,
  toggleCareerBag,
  buyCareerCosmetic,
  equipCareerLook,
  DEFAULT_CAREER_LOOK,
  type Career,
  type CareerSkills,
} from "../lib/discgolf/career";
import { careerFieldForRound, rankedFieldForRound, rankedPlacementField, RANKED_EDGE } from "../lib/discgolf/career";
import { applyPlacementRound, EMPTY_RANKED } from "../lib/discgolf/ranked";
import { CATCH_R, buildRound, discByKey } from "../lib/discgolf/engine";

describe("newCareer", () => {
  it("starts a 14-year-old high-school freshman with headroom and a starter PDGA", () => {
    const c = newCareer("Kid", 123);
    expect(c.age).toBe(14);
    expect(c.stage).toBe("highschool");
    expect(c.retired).toBe(false);
    for (const k of ["power", "control", "putt", "stamina"] as (keyof CareerSkills)[]) {
      expect(c.skills[k]).toBeLessThan(45);
      expect(c.potential[k]).toBeGreaterThan(c.skills[k]);
    }
    expect(c.pdgaRating).toBeGreaterThanOrEqual(740); // a beginner-ish rating
    expect(c.pdgaRating).toBeLessThanOrEqual(860);
    expect(c.roundRatings).toEqual([]);
    // Starts with $1,000 seed cash and a season energy pool sized by Stamina.
    expect(c.cash).toBe(1000);
    expect(c.energy).toBe(seasonEnergy(c.skills.stamina));
  });
  it("is deterministic for a given name + seed", () => {
    expect(JSON.stringify(newCareer("A", 7))).toBe(JSON.stringify(newCareer("A", 7)));
  });
});

describe("skillMods", () => {
  it("maps each skill to its in-round effect — 99 plays like normal golf, lower is harder", () => {
    const low = skillMods({ power: 0, control: 0, putt: 0, stamina: 0 });
    const high = skillMods({ power: 99, control: 99, putt: 99, stamina: 99 });
    // Power → distance: 99 = full range, lower = shorter.
    expect(high.speedMul).toBeCloseTo(1, 1);
    expect(low.speedMul).toBeLessThan(1);
    // Putt → basket catch radius: 99 = 1.1× the normal circle, low = ~0.7× (smaller).
    expect(high.catchR).toBeGreaterThan(CATCH_R);
    expect(low.catchR).toBeLessThan(CATCH_R);
    // Control → aim cone: 99 = dead-on your line, lower = wider spread.
    expect(high.aimSpread).toBeCloseTo(0, 2);
    expect(low.aimSpread).toBeGreaterThan(high.aimSpread);
    // Stamina is an ENERGY stat — it has no in-round effect, so momentum is gone:
    // every player is tilt-proof with no birdie boost regardless of skills.
    expect(high.bogeyPenalty).toBe(0);
    expect(low.bogeyPenalty).toBe(0);
    expect(high.birdieBoost).toBe(0);
    expect(low.birdieBoost).toBe(0);
  });
  it("identity mods are neutral (normal play == maxed skills)", () => {
    expect(IDENTITY_MODS.speedMul).toBe(1);
    expect(IDENTITY_MODS.catchR).toBe(CATCH_R);
    expect(IDENTITY_MODS.aimSpread).toBe(0);
    expect(IDENTITY_MODS.birdieBoost).toBe(0);
    expect(IDENTITY_MODS.bogeyPenalty).toBe(0);
  });
  it("momentumAfter is retired — every hole plays neutral (always 1)", () => {
    const mods = skillMods({ power: 50, control: 50, putt: 50, stamina: 50 });
    expect(momentumAfter(mods, 2, 3)).toBe(1); // birdie → neutral
    expect(momentumAfter(mods, 4, 3)).toBe(1); // bogey → neutral
    expect(momentumAfter(mods, 3, 3)).toBe(1); // par → neutral
  });
});

describe("careerRating", () => {
  it("rises monotonically with skills and stays in range", () => {
    const lo = careerRating({ power: 10, control: 10, putt: 10, stamina: 10 });
    const hi = careerRating({ power: 90, control: 90, putt: 90, stamina: 90 });
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThanOrEqual(100);
    expect(hi).toBeGreaterThan(lo);
    // All three playing skills at 99 ⇒ Overall 99 (weights sum to 1).
    expect(careerRating({ power: 99, control: 99, putt: 99, stamina: 0 })).toBeCloseTo(99, 5);
  });
  it("ignores Stamina — it's an energy stat, not a playing skill", () => {
    const base = { power: 60, control: 60, putt: 60, stamina: 20 };
    expect(careerRating({ ...base, stamina: 99 })).toBe(careerRating(base)); // training stamina doesn't change rating
    expect(careerRating({ ...base, power: 80 })).toBeGreaterThan(careerRating(base)); // training power does
  });
});

describe("energy economy", () => {
  it("seasonEnergy grows with Stamina (more events you can enter)", () => {
    expect(seasonEnergy(99)).toBeGreaterThan(seasonEnergy(50));
    expect(seasonEnergy(50)).toBeGreaterThan(seasonEnergy(8));
    expect(seasonEnergy(20)).toBeGreaterThanOrEqual(8);
  });
  it("event energy cost scales with importance, and canEnterEvent gates on the pool", () => {
    const c = newCareer("E", 5);
    const sched = seasonSchedule({ ...c, stage: "pro" });
    const minor = sched.find((e) => e.importance === "minor")!;
    const champ = sched.find((e) => e.importance === "championship")!;
    expect(eventEnergyCost(champ)).toBeGreaterThan(eventEnergyCost(minor));
    expect(canEnterEvent({ ...c, energy: eventEnergyCost(champ) }, champ)).toBe(true);
    expect(canEnterEvent({ ...c, energy: eventEnergyCost(champ) - 1 }, champ)).toBe(false);
  });
  it("entering an event (played or simmed) spends its energy and never goes negative", () => {
    const c = { ...newCareer("E", 6), stage: "pro" as const, energy: 5 };
    const sched = seasonSchedule(c);
    const ev = sched.find((e) => e.importance === "minor")!; // costs 2
    const after = recordResult(c, ev, ev.par, false).career;
    expect(after.energy).toBe(5 - eventEnergyCost(ev));
    const drained = recordResult({ ...c, energy: 1 }, ev, ev.par, false).career;
    expect(drained.energy).toBe(0); // clamped, never below 0
  });
  it("advancing a season refills energy from the (newly trained) Stamina", () => {
    const c = { ...newCareer("Refill", 7), trainPts: 3, energy: 0 };
    const trained = spendSkillPoint(spendSkillPoint(spendSkillPoint(c, "stamina", 1), "stamina", 1), "stamina", 1);
    const next = advanceSeason(trained, {}).career;
    expect(next.energy).toBe(seasonEnergy(next.skills.stamina));
    expect(next.energy).toBeGreaterThan(0);
  });
});

describe("seasonSchedule", () => {
  it("gives stage-appropriate events with season-prefixed ids", () => {
    const c = newCareer("Kid", 9);
    const sched = seasonSchedule(c);
    expect(sched.length).toBeGreaterThanOrEqual(2);
    expect(sched.every((e) => e.id.startsWith("0-"))).toBe(true);
    expect(sched.some((e) => e.importance === "championship")).toBe(true);
  });
  it("offers a big, choosable slate that grows by stage (unique ids + names)", () => {
    const count = (stage: Career["stage"], season = 1) => seasonSchedule({ ...newCareer("S", 3), stage, season }).length;
    expect(count("youth")).toBeGreaterThanOrEqual(3); // ~4
    expect(count("highschool")).toBeGreaterThanOrEqual(5); // ~6
    expect(count("college")).toBeGreaterThanOrEqual(7); // ~8
    const pro = count("pro");
    expect(pro).toBeGreaterThanOrEqual(12);
    expect(pro).toBeLessThanOrEqual(15);
    // A pro slate is too big for even a maxed energy pool, so you must choose.
    const proSched = seasonSchedule({ ...newCareer("S", 3), stage: "pro", season: 1 });
    const totalCost = proSched.reduce((s, e) => s + eventEnergyCost(e), 0);
    expect(totalCost).toBeGreaterThan(seasonEnergy(99));
    expect(new Set(proSched.map((e) => e.id)).size).toBe(proSched.length); // ids unique
    expect(new Set(proSched.map((e) => e.name)).size).toBe(proSched.length); // names unique
  });
  it("college schedule includes Nationals at Winthrop", () => {
    const c: Career = { ...newCareer("U", 1), stage: "college", age: 19, season: 2 };
    const sched = seasonSchedule(c);
    const nats = sched.find((e) => e.name === "College Nationals");
    expect(nats).toBeTruthy();
    expect(nats!.mode).toBe("winthrop");
  });
  it("the pro tour visits multiple generated venues with real pars", () => {
    const c: Career = { ...newCareer("Pro", 1), stage: "pro", age: 26, season: 5 };
    const sched = seasonSchedule(c);
    const tour = sched.filter((e) => e.mode === "tour");
    expect(tour.length).toBeGreaterThanOrEqual(3);
    const venues = new Set(tour.map((e) => e.venue));
    expect(venues.size).toBeGreaterThanOrEqual(2); // distinct courses
    tour.forEach((e) => {
      expect(e.venue).toBeTruthy();
      expect(e.seed).toBeTypeOf("number");
      expect(e.holes).toBe(18);
      // A real generated par in the disc-golf band (59–68), not the par-70 placeholder.
      expect(e.par).toBeGreaterThanOrEqual(59);
      expect(e.par).toBeLessThanOrEqual(68);
    });
  });
});

describe("event simulation", () => {
  it("placement is within 1..field+1", () => {
    const c = newCareer("Kid", 4);
    const ev = seasonSchedule(c)[0];
    const field = genField(c, ev);
    const { placed, field: n } = placeInField(field, c.skills.power); // an absurdly low score
    expect(placed).toBeGreaterThanOrEqual(1);
    expect(placed).toBeLessThanOrEqual(n);
  });
  it("a great score wins; a terrible score loses", () => {
    const c = newCareer("Kid", 4);
    const ev = seasonSchedule(c)[0];
    expect(placeInField(genField(c, ev), 1).placed).toBe(1);
    expect(placeInField(genField(c, ev), 999).placed).toBe(ev.fieldSize + 1);
  });
  it("simEvent is deterministic", () => {
    const c = newCareer("Kid", 4);
    const ev = seasonSchedule(c)[0];
    expect(simEvent(c, ev).score).toBe(simEvent(c, ev).score);
  });
});

describe("recordResult", () => {
  it("records a win: title, points, and marks the event done", () => {
    const c = newCareer("Kid", 11);
    const ev = seasonSchedule(c)[1]; // the championship
    const { career, result } = recordResult(c, ev, 1, true); // ace everything → win
    expect(result.win).toBe(true);
    expect(result.placed).toBe(1);
    expect(career.titles).toHaveLength(1);
    expect(career.done).toContain(ev.id);
    expect(career.seasonPoints).toBeGreaterThan(0);
  });
});

describe("advanceSeason", () => {
  it("ages up and grows a young player's skills", () => {
    const c = newCareer("Kid", 21);
    const before = c.skills.power;
    const { career } = advanceSeason(c, { power: 6 });
    expect(career.age).toBe(15); // starts at 14 (high school)
    expect(career.season).toBe(1);
    expect(career.skills.power).toBe(before + 6); // 1:1 — six points spent, six skill gained
    expect(career.trainPts).toBe(seasonBaseTrain(15)); // refilled to the small season floor (rest is earned)
    expect(career.done).toHaveLength(0);
  });
  it("skills only move when you train them", () => {
    const c = newCareer("Kid", 33);
    const idle = advanceSeason(c, {}).career;
    expect(idle.skills).toEqual(c.skills); // no free yearly growth
    const trained = advanceSeason(c, { power: 4 }).career;
    expect(trained.skills.power).toBeGreaterThan(c.skills.power);
    expect(trained.skills.control).toBe(c.skills.control); // an untrained skill stays put
  });
  it("transitions youth → high school → college → pro at the right ages", () => {
    let c: Career = { ...newCareer("X", 3), age: 13, stage: "youth" };
    expect(advanceSeason(c, {}).career.stage).toBe("highschool");
    c = { ...newCareer("X", 3), age: 17, stage: "highschool" };
    expect(advanceSeason(c, {}).career.stage).toBe("college");
    c = { ...newCareer("X", 3), age: 21, stage: "college" };
    const pro = advanceSeason(c, {}).career;
    expect(pro.stage).toBe("pro");
    expect(pro.worldRank).toBeGreaterThanOrEqual(1);
  });
  it("declines an aging veteran's power", () => {
    const c: Career = {
      ...newCareer("Vet", 5), age: 36, stage: "pro",
      skills: { power: 90, control: 90, putt: 90, stamina: 90 },
      potential: { power: 95, control: 95, putt: 95, stamina: 95 },
    };
    const after = advanceSeason(c, {}).career.skills;
    expect(after.power).toBeLessThan(90); // power fades with age
  });
  it("auto-retires at 42", () => {
    const c: Career = { ...newCareer("Old", 5), age: 41, stage: "pro" };
    expect(advanceSeason(c, {}).career.retired).toBe(true);
  });
});

describe("rivals", () => {
  it("a new career has a full generation of distinct named rivals", () => {
    const c = newCareer("Kid", 50);
    expect(c.rivals).toHaveLength(6);
    expect(new Set(c.rivals.map((r) => r.name)).size).toBe(6);
    c.rivals.forEach((r) => { expect(r.beat).toBe(0); expect(r.lost).toBe(0); });
  });
  it("rivals carry a comparable, tracked PDGA rating", () => {
    const c = newCareer("Kid", 4);
    c.rivals.forEach((r) => {
      expect(r.pdgaRating).toBeGreaterThan(700); // starter-level, like the player
      expect(r.pdgaRating).toBeLessThan(900);
      expect(r.roundRatings).toEqual([]);
    });
    // resolving an event records a round rating for each rival
    const ev = seasonSchedule(c)[0];
    const after = recordResult(c, ev, 40, false).career;
    after.rivals.forEach((r) => expect(r.roundRatings).toHaveLength(1));
  });
  it("recordResult updates head-to-head and tallies beaten rivals", () => {
    const c = newCareer("Kid", 50);
    const ev = seasonSchedule(c)[0];
    const winRes = recordResult(c, ev, 1, true); // ace it → beat everyone
    expect(winRes.result.beatRivals).toBe(6);
    winRes.career.rivals.forEach((r) => expect(r.beat).toBe(1));
    const loseRes = recordResult(c, ev, 999, true); // last → beat nobody
    expect(loseRes.result.beatRivals).toBe(0);
    loseRes.career.rivals.forEach((r) => expect(r.lost).toBe(1));
  });
  it("a rival can win the event and pick up a title", () => {
    const c = newCareer("Kid", 7);
    const ev = seasonSchedule(c)[0];
    const { career, result } = recordResult(c, ev, 999, false); // you bomb → someone else wins
    expect(result.win).toBe(false);
    // either a named rival or the anonymous field won; if a rival, they got a title
    if (result.winnerName) {
      const champ = career.rivals.find((r) => r.name === result.winnerName);
      expect(champ!.titles).toBe(1);
    }
  });
  it("rivals grow over a season and are sorted strongest-first", () => {
    const c = newCareer("Kid", 9);
    const before = rivalRating(topRivals(c)[0]);
    const after = advanceSeason(c, {}).career;
    expect(rivalRating(topRivals(after)[0])).toBeGreaterThan(before);
  });
  it("a strong finish grants bonus training points", () => {
    const c = newCareer("Kid", 6);
    const ev = seasonSchedule(c)[1]; // a major
    const winRes = recordResult(c, ev, 1, false); // win it
    expect(winRes.result.trainBonus).toBeGreaterThan(0);
    expect(winRes.career.trainPts).toBe(c.trainPts + winRes.result.trainBonus);
    const poor = recordResult(c, ev, 999, false); // dead last
    expect(poor.result.trainBonus).toBe(0);
    expect(poor.career.trainPts).toBe(c.trainPts);
  });
  it("careerCard is a group of 3 rivals; racers carry their hole scores", () => {
    const c = newCareer("Kid", 3);
    const ev = seasonSchedule(c)[0];
    const field = careerFieldHoles(c, ev);
    const card = careerCard(field);
    expect(card).toHaveLength(3);
    card.forEach((p) => expect(p.isRival).toBe(true));
    const racers = careerCardRacers(field, 0);
    expect(racers).toHaveLength(3);
    racers.forEach((r: { shots: number; name: string }) => { expect(r.shots).toBeGreaterThanOrEqual(1); expect(r.name).toBeTruthy(); });
  });
});

describe("career field + live standings", () => {
  const c = newCareer("Kid", 88);
  const ev = seasonSchedule(c)[1]; // championship, larger field
  const field = careerFieldHoles(c, ev);

  it("builds a full field with per-hole scores summing to each total", () => {
    expect(field).toHaveLength(ev.fieldSize);
    expect(field.filter((p) => p.isRival)).toHaveLength(c.rivals.length);
    for (const p of field) {
      expect(p.holes).toHaveLength(ev.holes);
      expect(p.holes.reduce((a, b) => a + b, 0)).toBe(p.total);
      expect(p.name).toBeTruthy();
    }
  });
  it("live standings rank you within the field and grow as holes complete", () => {
    const parThru = 3 * 4; // 3 holes, ~par 4 each (illustrative)
    const rows = careerLiveStandings(field, "Me (you)", [2, 2, 2], 3, parThru);
    expect(rows).toHaveLength(ev.fieldSize + 1);
    expect(rows.filter((r) => r.you)).toHaveLength(1);
    expect(rows[0].rank).toBe(1);
    // an ace-pace player should sit at or near the top
    expect(rows.find((r) => r.you)!.rank).toBeLessThanOrEqual(3);
    // sorted ascending by total
    for (let i = 1; i < rows.length; i++) expect(rows[i].total).toBeGreaterThanOrEqual(rows[i - 1].total);
  });
});

describe("field difficulty", () => {
  const c = newCareer("Pro", 5);
  const base = { name: "Event", mode: "course" as const, par: 66, holes: 18, fieldSize: 90, fieldMean: 70 };
  // Average winning score across many event seeds for an importance tier.
  const meanBest = (importance: "minor" | "major" | "championship") => {
    let s = 0;
    const n = 16;
    for (let i = 0; i < n; i++) {
      const f = careerFieldHoles(c, { ...base, id: `${importance}${i}`, importance });
      s += Math.min(...f.map((p) => p.total));
    }
    return s / n;
  };
  it("bigger events draw stronger fields (lower winning scores)", () => {
    const minor = meanBest("minor");
    const major = meanBest("major");
    const champ = meanBest("championship");
    expect(major).toBeLessThan(minor); // a major is harder than a minor
    expect(champ).toBeLessThan(major); // the championship is the hardest of all
  });
});

describe("field reacts to course conditions (wind / slope / hazards)", () => {
  const c = newCareer("Pro", 9);
  const holes = buildRound(123, "course");
  const ev = { id: "cond", name: "Conditions", mode: "course" as const, par: 66, holes: 18, fieldSize: 40, fieldMean: 70, importance: "minor" as const };
  // Basket sits at a lower y than the tee, so toward the basket is −y: a headwind
  // blows +y, a tailwind −y.
  const calm = holes.map((h) => ({ ...h, wind: { x: 0, y: 0 }, windMag: 0, elev: 0, elevZones: undefined, water: [], hazard: [] }));
  const stormy = holes.map((h) => ({ ...h, wind: { x: 0, y: 0.018 }, windMag: 0.018, elev: 2, elevZones: undefined, water: h.water, hazard: h.hazard }));
  const avgTotal = (f: ReturnType<typeof careerFieldForRound>) => f.reduce((s, p) => s + p.total, 0) / f.length;

  it("the same field scores worse into a headwind, uphill, with hazards", () => {
    const easy = avgTotal(careerFieldForRound(c, ev, calm));
    const hard = avgTotal(careerFieldForRound(c, ev, stormy));
    expect(hard).toBeGreaterThan(easy); // headwind + uphill + hazards cost the bots strokes too
  });

  it("downhill AND downwind helps the whole field, not just the human", () => {
    const downhillDownwind = holes.map((h) => ({ ...h, wind: { x: 0, y: -0.018 }, windMag: 0.018, elev: -2, elevZones: undefined, water: [], hazard: [] }));
    const kind = avgTotal(careerFieldForRound(c, ev, downhillDownwind));
    const neutral = avgTotal(careerFieldForRound(c, ev, calm));
    expect(kind).toBeLessThan(neutral); // a downhill, downwind hole plays easier for the bots like it does for you
  });
});

describe("economy + sponsors", () => {
  it("a pro win pays prize money; amateur events do not", () => {
    const am = newCareer("Am", 11);
    const ev = seasonSchedule(am)[0];
    expect(recordResult(am, ev, 1, false).result.prize).toBe(0); // youth = amateur
    const pro: Career = { ...newCareer("Pro", 11), stage: "pro", age: 24 };
    const pev = seasonSchedule(pro)[0];
    const r = recordResult(pro, pev, 1, false);
    expect(r.result.prize).toBeGreaterThan(0);
    expect(r.career.cash).toBe(pro.cash + r.result.prize); // prize added on top of seed cash
  });
  it("offers sponsors by stage + rating, caps signings, and pays a signing bonus", () => {
    const c: Career = { ...newCareer("HS", 12), stage: "highschool", age: 15, skills: { power: 50, control: 50, putt: 50, stamina: 50 } };
    const offers = availableSponsors(c);
    expect(offers.length).toBeGreaterThan(0);
    const signed = signSponsor(c, offers[0].id);
    expect(signed.sponsors).toHaveLength(1);
    expect(signed.cash).toBe(c.cash + offers[0].signing); // signing bonus added to seed cash
    // can't exceed the cap
    let s = signed;
    for (const o of availableSponsors(s)) s = signSponsor(s, o.id);
    expect(s.sponsors.length).toBeLessThanOrEqual(SPONSOR_CAP);
  });
  it("offers no sponsor at the very start of a career", () => {
    expect(availableSponsors(newCareer("Rook", 5))).toEqual([]); // earn your first by raising your rating
  });
  it("holds one deal per category slot; a higher-tier offer in that slot swaps it", () => {
    let c: Career = { ...newCareer("HS", 9), stage: "college", age: 18, skills: { power: 60, control: 60, putt: 60, stamina: 50 } };
    c = signSponsor(c, "localdisc"); // Disc slot, tier 1
    expect(c.sponsors.find((s) => s.slot === "disc")!.id).toBe("localdisc");
    const ids = availableSponsors(c).map((s) => s.id);
    expect(ids).toContain("apexdiscs"); // tier 2 in the Disc slot → worth swapping up
    expect(ids).not.toContain("localdisc"); // a downgrade isn't re-offered
    const up = signSponsor(c, "apexdiscs");
    expect(up.sponsors.filter((s) => s.slot === "disc")).toHaveLength(1); // still one Disc deal
    expect(up.sponsors.find((s) => s.slot === "disc")!.id).toBe("apexdiscs");
    expect(up.sponsors.map((s) => s.id)).not.toContain("localdisc"); // swapped out
    const withGear = signSponsor(up, "campusgear"); // a different category fills independently
    expect(withGear.sponsors).toHaveLength(2);
    expect(withGear.sponsors.map((s) => s.slot).sort()).toEqual(["disc", "gear"]);
  });
  it("sponsor stipends + coaches pay out and add training at season's end", () => {
    let c: Career = { ...newCareer("Pro", 13), stage: "pro", age: 25, cash: 100000, skills: { power: 85, control: 85, putt: 85, stamina: 85 } };
    const coach = availableSponsors(c).find((o) => o.coach)!;
    c = signSponsor(c, coach.id);
    const next = advanceSeason(c, {}).career;
    expect(next.cash).toBe(c.cash + coach.stipend);
    expect(next.trainPts).toBe(seasonBaseTrain(26) + 1); // season floor (age 26) + one coach
  });
  it("buying a training point costs escalating cash and adds a point", () => {
    const c: Career = { ...newCareer("Pro", 14), stage: "pro", age: 25, cash: 1_000_000 };
    const cost1 = trainingPointCost(c);
    const c2 = buyTrainingPoint(c);
    expect(c2.trainPts).toBe(c.trainPts + 1);
    expect(c2.cash).toBe(c.cash - cost1);
    expect(trainingPointCost(c2)).toBeGreaterThan(cost1); // next one costs more
  });
  it("can't buy training without enough cash", () => {
    const broke: Career = { ...newCareer("Broke", 15), cash: 0 };
    expect(buyTrainingPoint(broke).trainPts).toBe(broke.trainPts); // unchanged
  });
});

describe("manufacturer sponsorships (brand-exclusive deals)", () => {
  const elitePro = (): Career => ({ ...newCareer("Ace", 77), stage: "pro", age: 27, skills: { power: 86, control: 86, putt: 86, stamina: 50 } });
  const brandOf = (k: string) => discByKey(k)?.brand;

  it("offers Innova/Discraft only to an elite pro", () => {
    const ids = availableSponsors(elitePro()).map((s) => s.id);
    expect(ids).toContain("innova");
    expect(ids).toContain("discraft");
    const mid = { ...elitePro(), skills: { power: 60, control: 60, putt: 60, stamina: 50 } };
    expect(availableSponsors(mid).map((s) => s.id)).not.toContain("innova"); // rating too low
    const am = { ...elitePro(), stage: "college" as const, age: 20 };
    expect(availableSponsors(am).map((s) => s.id)).not.toContain("discraft"); // not a pro yet
  });

  it("signing pays the bonus, grants the lineup, and rebuilds a brand-only bag", () => {
    const elite = elitePro();
    const signed = signSponsor(elite, "innova");
    expect(sponsorBrandLock(signed)).toBe("Innova");
    expect(signed.cash).toBe(elite.cash + 220000);
    expect(signed.bag.length).toBeGreaterThanOrEqual(4);
    expect(signed.bag.every((k) => brandOf(k) === "Innova")).toBe(true);
    expect(signed.discs).toContain("destroyer"); // granted Innova's plastic
  });

  it("locks the bag + shop to the brand — off-brand discs can't be bagged or bought", () => {
    const signed = signSponsor(elitePro(), "innova");
    const room = toggleCareerBag(signed, signed.bag[signed.bag.length - 1]); // free a slot
    expect(toggleCareerBag(room, "buzzz").bag).toEqual(room.bag); // Buzzz is Discraft → rejected
    const spare = room.discs.find((k) => brandOf(k) === "Innova" && !room.bag.includes(k))!;
    expect(toggleCareerBag(room, spare).bag).toContain(spare); // an Innova disc is fine
    const partial = { ...signed, discs: ["aviar"], bag: ["aviar"] }; // expose the shop filter
    const shop = careerDiscShop(partial);
    expect(shop.length).toBeGreaterThan(0);
    expect(shop.every((d) => brandOf(d.key) === "Innova")).toBe(true);
    expect(shop.map((d) => d.key)).not.toContain("zone"); // Discraft filtered out
    expect(buyCareerDisc(partial, "zone")).toBe(partial); // can't buy off-brand
  });

  it("switching manufacturers swaps the bag in place; each brand's bonus pays once", () => {
    const innova = signSponsor(elitePro(), "innova");
    const discraft = signSponsor(innova, "discraft");
    expect(sponsorBrandLock(discraft)).toBe("Discraft");
    expect(discraft.sponsors.filter((s) => s.brand)).toHaveLength(1); // still one manufacturer
    expect(discraft.sponsors.length).toBe(innova.sponsors.length); // no extra slot
    expect(discraft.cash).toBe(innova.cash + 220000); // first Discraft deal pays its bonus
    expect(discraft.bag.every((k) => brandOf(k) === "Discraft")).toBe(true);
    const back = signSponsor(discraft, "innova"); // already repped Innova
    expect(sponsorBrandLock(back)).toBe("Innova");
    expect(back.cash).toBe(discraft.cash); // no repeat bonus for a brand you've had
    expect(availableSponsors(innova).map((s) => s.id)).toContain("discraft"); // rival offered for switching
  });

  it("can drop a sponsor to switch, and re-signing it pays no second bonus", () => {
    const signed = signSponsor(elitePro(), "global"); // pays the signing bonus once
    expect(signed.sponsors.map((s) => s.id)).toContain("global");
    const dropped = unsignSponsor(signed, "global");
    expect(dropped.sponsors.map((s) => s.id)).not.toContain("global"); // slot freed
    expect(dropped.cash).toBe(signed.cash); // you keep cash already paid (no clawback)
    const resigned = signSponsor(dropped, "global");
    expect(resigned.sponsors.map((s) => s.id)).toContain("global"); // can re-sign
    expect(resigned.cash).toBe(dropped.cash); // …but no farmed second bonus
  });

  it("dropping a manufacturer deal lifts the brand lock", () => {
    const signed = signSponsor(elitePro(), "innova");
    expect(sponsorBrandLock(signed)).toBe("Innova");
    const dropped = unsignSponsor(signed, "innova");
    expect(sponsorBrandLock(dropped)).toBeNull(); // bag/shop reopen to every brand
    expect(toggleCareerBag({ ...dropped, bag: dropped.bag.slice(0, 1) }, "buzzz").bag).toContain("buzzz"); // off-brand allowed again
  });

  it("a manufacturer deal swaps the Disc slot, even with every slot full", () => {
    let c = elitePro();
    // Fill all three slots: Disc (summitdiscs), Gear (global), General (skylinebank).
    for (const id of ["summitdiscs", "global", "skylinebank"]) c = signSponsor(c, id);
    expect(c.sponsors).toHaveLength(SPONSOR_CAP);
    // Offers still show with full slots — Innova is offered and swaps the Disc deal.
    expect(availableSponsors(c).map((s) => s.id)).toContain("innova");
    const inn = signSponsor(c, "innova");
    expect(inn.sponsors).toHaveLength(SPONSOR_CAP); // swapped, not added
    expect(sponsorBrandLock(inn)).toBe("Innova");
    expect(inn.sponsors.find((s) => s.slot === "disc")!.id).toBe("innova"); // replaced summitdiscs
    expect(inn.sponsors.map((s) => s.id)).not.toContain("summitdiscs");
    expect(inn.sponsors.map((s) => s.id)).toEqual(expect.arrayContaining(["global", "skylinebank"])); // other slots untouched
  });
});

describe("PDGA rating", () => {
  it("climbs with strong rounds, dips with poor ones, and stays in a real range", () => {
    const c = newCareer("Kid", 200);
    const start = c.pdgaRating;
    expect(start).toBeGreaterThan(700);
    const ev = seasonSchedule(c).find((e) => e.holes === 18) ?? seasonSchedule(c)[0];

    let hot = c;
    for (let i = 0; i < 8; i++) hot = recordResult(hot, { ...ev, id: `h${i}` }, ev.par - 12, false).career;
    expect(hot.pdgaRating).toBeGreaterThan(start);
    expect(hot.pdgaRating).toBeLessThanOrEqual(PDGA_MAX);
    expect(hot.roundRatings.length).toBeGreaterThan(0);

    let cold = c;
    for (let i = 0; i < 8; i++) cold = recordResult(cold, { ...ev, id: `c${i}` }, ev.par + 15, false).career;
    expect(cold.pdgaRating).toBeLessThan(start);
    expect(cold.pdgaRating).toBeGreaterThanOrEqual(650);
  });
  it("moves slowly — one great round doesn't spike the rating", () => {
    const c = newCareer("Kid", 201);
    const ev = seasonSchedule(c).find((e) => e.holes === 18) ?? seasonSchedule(c)[0];
    const after = recordResult(c, ev, ev.par - 14, false).career;
    expect(after.pdgaRating - c.pdgaRating).toBeLessThan(120); // smoothed, not a jump to ~1050
    expect(after.pdgaRating).toBeGreaterThan(c.pdgaRating);
  });
  it("hard-caps every rating at 1070 — yours and every opponent's", () => {
    expect(PDGA_MAX).toBe(1070);
    // Hammer absurd, course-record rounds for many events: you can't break 1070.
    let c = newCareer("Phenom", 202);
    for (let s = 0; s < 6; s++) {
      for (const ev of seasonSchedule(c)) c = recordResult(c, ev, Math.round(ev.par * 0.5) - 30, false).career;
      c = advanceSeason(c, {}).career;
    }
    expect(c.pdgaRating).toBeLessThanOrEqual(1070);
    // Every rival's rating is capped too — nobody on tour climbs past 1070.
    expect(c.rivals.every((r) => r.pdgaRating <= 1070)).toBe(true);
    expect(c.rivals.every((r) => r.roundRatings.every((rr) => rr <= 1070))).toBe(true);
    expect(c.roundRatings.every((rr) => rr <= 1070)).toBe(true);
  });
});

describe("normalizeCareer (migration)", () => {
  it("backfills cash, sponsors and rivals on an old save", () => {
    const old = newCareer("Old", 20);
    // simulate a pre-economy save
    const stripped = { ...old, cash: undefined, sponsors: undefined, rivals: [], pdgaRating: undefined, roundRatings: undefined } as unknown as Career;
    const fixed = normalizeCareer(stripped);
    expect(fixed.cash).toBe(0);
    expect(fixed.sponsors).toEqual([]);
    expect(fixed.rivals).toHaveLength(6);
    expect(fixed.pdgaRating).toBeGreaterThan(700); // PDGA backfilled from skills
    expect(fixed.roundRatings).toEqual([]);
  });
  it("backfills the career disc collection, bag and ranking fields on a pre-disc save", () => {
    const old = newCareer("Old", 21);
    const stripped = { ...old, discs: undefined, bag: undefined, rankPoints: undefined, trainBought: undefined } as unknown as Career;
    const fixed = normalizeCareer(stripped);
    expect(fixed.discs).toEqual(CAREER_CORE_DISCS);
    expect(fixed.bag.length).toBeGreaterThan(0);
    expect(fixed.rankPoints).toBe(0);
    expect(fixed.trainBought).toBe(0);
  });
});

describe("career disc progression (separate from the account)", () => {
  it("a new career starts bare-bones with the core discs in the bag", () => {
    const c = newCareer("Rook", 1);
    expect(c.discs).toEqual(CAREER_CORE_DISCS);
    expect(c.bag).toEqual(CAREER_CORE_DISCS);
  });
  it("offers every disc from the start — you just save up for them", () => {
    const hs = newCareer("HS", 2); // a 14-year-old freshman
    const shop = careerDiscShop(hs);
    const keys = shop.map((d) => d.key);
    expect(keys).toContain("destroyer"); // a top driver is on the shelf immediately — no stage gate
    expect(keys).toContain("zeus");
    expect(shop.map((d) => d.cost)).toEqual([...shop.map((d) => d.cost)].sort((a, b) => a - b)); // cheapest first
  });
  it("buying a disc spends cash, adds it to the collection, and drops it in the bag", () => {
    const c: Career = { ...newCareer("Buy", 3), cash: 1000 };
    const offer = careerDiscShop(c)[0];
    const after = buyCareerDisc(c, offer.key);
    expect(after.discs).toContain(offer.key);
    expect(after.bag).toContain(offer.key);
    expect(after.cash).toBe(1000 - offer.cost);
  });
  it("can't buy without enough cash, but any disc is buyable once you can afford it", () => {
    const broke: Career = { ...newCareer("Broke", 4), cash: 0 };
    expect(buyCareerDisc(broke, careerDiscShop(broke)[0].key).discs).toEqual(CAREER_CORE_DISCS); // broke → no buy
    const hs: Career = { ...newCareer("HS", 5), cash: 999999 };
    expect(buyCareerDisc(hs, "destroyer").discs).toContain("destroyer"); // freshman with cash CAN buy a top driver
  });
  it("buying a disc when the bag is full swaps it in (a driver doesn't sit unused behind starters)", () => {
    // A full bag of starters (2 putters, 2 mids, 1 fairway), then buy a driver.
    let c: Career = { ...newCareer("Bagger", 31), cash: 100000, stage: "pro",
      discs: ["aviar", "zone", "buzzz", "swarm", "teebird", "destroyer"], bag: ["aviar", "zone", "buzzz", "swarm", "teebird"] };
    // mark destroyer as not-yet-owned for the buy path
    c = { ...c, discs: ["aviar", "zone", "buzzz", "swarm", "teebird"] };
    c = buyCareerDisc(c, "destroyer");
    expect(c.discs).toContain("destroyer");
    expect(c.bag).toContain("destroyer"); // auto-bagged
    expect(c.bag.length).toBe(CAREER_BAG_MAX); // still capped
  });
  it("bag curation keeps 1..MAX owned discs", () => {
    let c: Career = { ...newCareer("Bag", 7), cash: 100000, stage: "pro" };
    // own a full set
    for (const o of careerDiscShop(c)) c = buyCareerDisc(c, o.key);
    // can't exceed the cap
    const full = c.bag.length;
    expect(full).toBeLessThanOrEqual(CAREER_BAG_MAX);
    // removing down to one is fine; removing the last is refused
    let only = { ...c, bag: [c.discs[0]] };
    expect(toggleCareerBag(only, c.discs[0]).bag).toEqual([c.discs[0]]); // never empty
    // a disc you don't own can't be bagged
    only = { ...newCareer("X", 8) };
    expect(toggleCareerBag(only, "zeus").bag).toEqual(only.bag);
  });
});

describe("skill cap (99) + points-only growth", () => {
  it("training pushes a skill up to 99 but never past it", () => {
    let c: Career = { ...newCareer("Maxed", 9), age: 16, skills: { power: 90, control: 90, putt: 90, stamina: 90 }, potential: { power: 95, control: 95, putt: 95, stamina: 95 } };
    for (let i = 0; i < 8; i++) c = advanceSeason({ ...c, age: 16, trainPts: 12 }, { power: 12 }).career;
    expect(c.skills.power).toBe(99); // climbs to the cap...
    SKILL_KEYS.forEach((k) => expect(c.skills[k]).toBeLessThanOrEqual(99)); // ...and never beyond it
  });
  it("a skill only rises if you spend points on it", () => {
    const c = newCareer("Trainer", 12);
    const next = advanceSeason(c, { putt: 3 }).career;
    expect(next.skills.putt).toBeGreaterThan(c.skills.putt); // trained → up
    expect(next.skills.power).toBe(c.skills.power); // untrained → unchanged (young, no decline)
  });
});

describe("1:1 training + earned progression", () => {
  it("moves a skill EXACTLY 1:1 with the points spent", () => {
    const c = newCareer("Linear", 77); // age 14, every skill 20
    const before = c.skills.power;
    const after = advanceSeason(c, { power: 5 }).career;
    expect(after.skills.power).toBe(before + 5); // +5 points → +5 power, no curve
  });

  it("holds at 35 and only declines past it; training that skill offsets the loss", () => {
    const vet: Career = {
      ...newCareer("Vet", 5), age: 34, stage: "pro",
      skills: { power: 90, control: 90, putt: 90, stamina: 90 },
    };
    const at35 = advanceSeason(vet, {}).career; // age 34 → 35: no decline yet
    expect(at35.skills.power).toBe(90);
    const at36 = advanceSeason({ ...at35, age: 35 }, {}).career; // 35 → 36: now it slips
    expect(at36.skills.power).toBeLessThan(90);
    const trained = advanceSeason({ ...at35, age: 35 }, { power: 1 }).career; // spend on power
    expect(trained.skills.power).toBeGreaterThanOrEqual(90); // a point cancels the decline
  });

  it("aging alone never makes you good — the base floor peaks well below 90", () => {
    let c = newCareer("Drifter", 314);
    let peak = careerRating(c.skills);
    let guard = 0;
    while (!c.retired && guard++ < 60) {
      // spend only the per-season floor, spread across skills; never compete for bonuses
      const pts = c.trainPts, per = Math.floor(pts / 4);
      c = advanceSeason(c, { power: per, control: per, putt: per, stamina: pts - per * 3 }).career;
      peak = Math.max(peak, careerRating(c.skills));
    }
    expect(peak).toBeLessThan(70); // ~mid-40s on the floor alone — never a 90 pro on age
  });

  it("better finishes earn strictly more training points (you develop by playing well)", () => {
    const c = newCareer("Climber", 6);
    const minor = seasonSchedule(c).find((e) => e.importance === "minor")!;
    const champ = seasonSchedule(c).find((e) => e.importance === "championship")!;
    expect(recordResult(c, minor, 1, false).result.trainBonus).toBeGreaterThan(0); // win → points
    expect(recordResult(c, minor, 999, false).result.trainBonus).toBe(0); // dead last → nothing
    expect(recordResult(c, champ, 1, false).result.trainBonus)
      .toBeGreaterThan(recordResult(c, minor, 1, false).result.trainBonus); // a title develops you most
  });

  it("no talent gate: any career can train a skill all the way to 99", () => {
    // a deliberately low potential — under the old model this capped a player's growth
    const c: Career = { ...newCareer("Underdog", 4), age: 16, potential: { power: 55, control: 55, putt: 55, stamina: 55 } };
    let s = c;
    for (let i = 0; i < 10; i++) s = advanceSeason({ ...s, age: 16, trainPts: 12 }, { power: 12 }).career;
    expect(s.skills.power).toBe(99); // potential no longer blocks the player
  });
});

describe("immediate skill allocation (spendSkillPoint)", () => {
  it("a new career starts with 0 points to spend — you earn them by playing", () => {
    expect(newCareer("Rookie", 1).trainPts).toBe(0);
  });
  it("spending a point raises the skill by exactly 1 and costs a point, on the spot", () => {
    const c: Career = { ...newCareer("Imm", 2), trainPts: 3 };
    const after = spendSkillPoint(c, "power", 1);
    expect(after.skills.power).toBe(c.skills.power + 1);
    expect(after.trainPts).toBe(2);
  });
  it("refunds a point when you take an addition back", () => {
    let c: Career = { ...newCareer("Imm", 3), trainPts: 2 };
    c = spendSkillPoint(c, "putt", 1);
    c = spendSkillPoint(c, "putt", -1);
    expect(c.skills.putt).toBe(newCareer("Imm", 3).skills.putt);
    expect(c.trainPts).toBe(2);
  });
  it("won't spend with no points, won't pass 99, won't refund below the floor", () => {
    const broke: Career = { ...newCareer("Imm", 4), trainPts: 0 };
    expect(spendSkillPoint(broke, "power", 1)).toBe(broke); // no points → unchanged
    const maxed: Career = { ...newCareer("Imm", 4), trainPts: 5, skills: { power: 99, control: 50, putt: 50, stamina: 50 } };
    expect(spendSkillPoint(maxed, "power", 1).skills.power).toBe(99); // capped at 99
    const floored: Career = { ...newCareer("Imm", 4), skills: { power: 8, control: 8, putt: 8, stamina: 8 } };
    expect(spendSkillPoint(floored, "power", -1)).toBe(floored); // can't drop below 8
  });
});

describe("trainBonusFor (reward preview) + early driver", () => {
  it("previews more points for better finishes and bigger events", () => {
    expect(trainBonusFor("championship", 1, 30)).toBe(9);
    expect(trainBonusFor("major", 1, 30)).toBe(6);
    expect(trainBonusFor("minor", 1, 30)).toBe(4);
    expect(trainBonusFor("minor", 3, 30)).toBe(3);
    expect(trainBonusFor("minor", 30, 30)).toBe(0); // dead last → nothing
  });
  it("bigger events develop you faster PER ENERGY at every placement tier", () => {
    // Entry costs 2/3/4 (minor/major/championship): each tier's points-per-energy
    // must never decrease as importance climbs, and must strictly climb at a win —
    // otherwise grinding minors would be the optimal training plan.
    const costs = { minor: 2, major: 3, championship: 4 } as const;
    const tiers = [1, 3, Math.ceil(30 * 0.1), Math.ceil(30 * 0.5)];
    for (const placed of tiers) {
      const per = (["minor", "major", "championship"] as const).map((im) => trainBonusFor(im, placed, 30) / costs[im]);
      expect(per[1]).toBeGreaterThanOrEqual(per[0]);
      expect(per[2]).toBeGreaterThanOrEqual(per[1]);
    }
    expect(trainBonusFor("championship", 1, 30) / 4).toBeGreaterThan(trainBonusFor("minor", 1, 30) / 2);
    // Coins climb per energy too — the marquee win is the efficient one.
    expect(careerCoins("championship", 1, 40) / 4).toBeGreaterThan(careerCoins("major", 1, 40) / 3);
    expect(careerCoins("major", 1, 40) / 3).toBeGreaterThan(careerCoins("minor", 1, 40) / 2);
  });
  it("matches what recordResult actually grants", () => {
    const c = newCareer("Match", 6);
    const ev = seasonSchedule(c).find((e) => e.importance === "championship")!;
    const res = recordResult(c, ev, 1, false); // win it
    expect(res.result.trainBonus).toBe(trainBonusFor(ev.importance, res.result.placed, res.result.field));
  });
  it("offers an early distance driver (sidewinder) in high school", () => {
    const hs = newCareer("HS", 9);
    expect(careerDiscShop(hs).map((d) => d.key)).toContain("sidewinder"); // reachable by year 2
  });
  it("careerCoins pays by placement: win > mid > last, and big events pay more", () => {
    const fieldN = 40;
    expect(careerCoins("minor", 1, fieldN)).toBeGreaterThan(careerCoins("minor", 20, fieldN)); // win beats mid-pack
    expect(careerCoins("minor", 20, fieldN)).toBeGreaterThan(careerCoins("minor", 40, fieldN)); // mid beats last
    expect(careerCoins("minor", 40, fieldN)).toBeGreaterThanOrEqual(0); // last still pays a token, never negative
    expect(careerCoins("championship", 1, fieldN)).toBeGreaterThan(careerCoins("minor", 1, fieldN)); // marquee win pays most
  });
});

describe("career cosmetics (post-max cash sink)", () => {
  it("starts with none owned and the default look", () => {
    const c = newCareer("Look", 41);
    expect(c.cosmetics).toEqual([]);
    expect(c.look).toEqual(DEFAULT_CAREER_LOOK);
  });
  it("buys a cosmetic for cash and refuses when broke or already owned", () => {
    const c: Career = { ...newCareer("Look", 42), cash: 50000 };
    const bought = buyCareerCosmetic(c, "discskin:gold", 16800);
    expect(bought.cosmetics).toContain("discskin:gold");
    expect(bought.cash).toBe(50000 - 16800);
    expect(buyCareerCosmetic(bought, "discskin:gold", 16800).cosmetics).toHaveLength(1); // no double-buy
    const broke: Career = { ...newCareer("Broke", 43), cash: 100 };
    expect(buyCareerCosmetic(broke, "discskin:gold", 16800).cosmetics).toEqual([]); // can't afford
  });
  it("equips a look slot, leaving the others", () => {
    const eq = equipCareerLook(newCareer("Look", 44), "trail", "fire");
    expect(eq.look.trail).toBe("fire");
    expect(eq.look.discSkin).toBe(DEFAULT_CAREER_LOOK.discSkin);
  });
});

describe("world ranking rewards winning", () => {
  it("a season of dominant results banks ranking points and ranks better than a quiet season", () => {
    const base: Career = { ...newCareer("Pro", 88), stage: "pro", age: 26, skills: { power: 80, control: 80, putt: 80, stamina: 80 } };
    const sched = seasonSchedule(base);
    // win everything
    let winner = base;
    for (const ev of sched) winner = recordResult(winner, ev, 1, false).career;
    // bomb everything
    let quiet = base;
    for (const ev of sched) quiet = recordResult(quiet, ev, 999, false).career;
    expect(winner.rankPoints).toBeGreaterThan(quiet.rankPoints);
    const winnerRank = advanceSeason(winner, {}).career.worldRank!;
    const quietRank = advanceSeason(quiet, {}).career.worldRank!;
    expect(winnerRank).toBeLessThan(quietRank); // dominating climbs the rankings
  });
});

describe("full career integration", () => {
  it("plays decades start-to-finish: kid → HS → college → pro → retired", () => {
    let c = newCareer("Journey", 2026);
    const stagesSeen = new Set<string>([c.stage]);
    let peakRating = 0;
    let guard = 0;
    while (!c.retired && guard++ < 60) {
      for (const ev of seasonSchedule(c)) {
        if (!c.done.includes(ev.id)) c = simEvent2(c, ev);
      }
      expect(seasonComplete(c)).toBe(true);
      peakRating = Math.max(peakRating, careerRating(c.skills));
      // spend training on whatever has the most headroom
      const alloc: Partial<CareerSkills> = { power: 2, control: 2, putt: 2 };
      c = advanceSeason(c, alloc).career;
      stagesSeen.add(c.stage);
    }
    expect(c.retired).toBe(true);
    expect(c.age).toBeGreaterThanOrEqual(22);
    expect(stagesSeen.has("highschool")).toBe(true);
    expect(stagesSeen.has("college")).toBe(true);
    expect(stagesSeen.has("pro")).toBe(true);
    expect(peakRating).toBeGreaterThan(careerRating(newCareer("Journey", 2026).skills)); // they improved
    expect(c.results.length).toBeGreaterThan(0);
  });
});

// sim + record helper for the integration test
function simEvent2(c: Career, ev: ReturnType<typeof seasonSchedule>[number]): Career {
  return recordResult(c, ev, simEvent(c, ev).score, false).career;
}

describe("retire + seasonComplete", () => {
  it("retire flags the career", () => {
    expect(retire(newCareer("Q", 1)).retired).toBe(true);
  });
  it("seasonComplete once every event is done", () => {
    let c = newCareer("Kid", 2);
    expect(seasonComplete(c)).toBe(false);
    for (const ev of seasonSchedule(c)) c = recordResult(c, ev, 40, false).career;
    expect(seasonComplete(c)).toBe(true);
  });
});

describe("pro tour — real current pros", () => {
  // normalizeCareer is what swaps the fictional amateur rivals for the real tour.
  const toPro = (seed: number, age = 22) => normalizeCareer({ ...newCareer("Me", seed), stage: "pro", age });

  it("your first pro season is 2026, then +1 each season", () => {
    expect(careerYear(toPro(1, 22))).toBe(2026);
    expect(careerYear(toPro(1, 25))).toBe(2029);
    expect(careerYear({ ...newCareer("Kid", 1) })).toBe(2026); // amateurs read as the present day
  });

  it("your pro rivals are real current pros — Gannon Buhr & co.", () => {
    const c = toPro(7);
    expect(c.rivals.map((r) => r.name)).toContain("Gannon Buhr");
    expect(c.rivals.every((r) => r.id.startsWith("pro"))).toBe(true);
  });

  it("names the field with real tour pros beyond your six rivals", () => {
    const c = toPro(7);
    const ev = seasonSchedule(c).find((e) => e.importance === "major")!;
    const names = careerFieldHoles(c, ev).map((p) => p.name);
    expect(names).toContain("Gannon Buhr");    // a marquee rival
    expect(names).toContain("Ezra Aderhold");  // a named, non-rival field pro
    expect(careerFieldHoles(c, ev).filter((p) => p.isRival).length).toBe(c.rivals.length);
  });

  it("simulates each year — young stars rise, veterans fade", () => {
    const rating = (name: string, age: number) =>
      careerRating(toPro(3, age).rivals.find((r) => r.name === name)!.skills);
    expect(rating("Gannon Buhr", 30)).toBeGreaterThan(rating("Gannon Buhr", 22)); // age 20 → 28: climbs
    expect(rating("Paul McBeth", 30)).toBeLessThan(rating("Paul McBeth", 22));    // age 36 → 44: declines
  });

  it("amateurs still face fictional peers, not pros", () => {
    const hs = normalizeCareer({ ...newCareer("Frosh", 9) }); // starts in high school
    expect(hs.rivals.some((r) => r.id.startsWith("pro"))).toBe(false);
    expect(hs.rivals.map((r) => r.name)).not.toContain("Gannon Buhr");
  });
});

describe("ranked placement field — calibrates you to your level", () => {
  it("finishing higher in the wide field projects a higher rank", () => {
    const holes = buildRound(13371337, "ranked");
    const field = rankedPlacementField(424242, 24, holes);
    const N = field.length;
    // The field is graded by index (member i ≈ rating 40 + i/(N-1)·50). Use a graded
    // member as a stand-in "player": their finish among the others should project
    // back toward their own level.
    const probe = (i: number) => {
      const me = field[i].total;
      const others = field.filter((_, j) => j !== i);
      const place = 1 + others.filter((p) => p.total < me).length;
      return applyPlacementRound(EMPTY_RANKED, place, others.length + 1, 0).result;
    };
    expect(probe(2).projectedRp).toBeLessThan(probe(N - 3).projectedRp); // weak < strong
    expect(["platinum", "diamond", "master"]).toContain(probe(N - 1).tier.key); // top of the field
    expect(["bronze", "silver", "gold"]).toContain(probe(0).tier.key); // bottom of the field
  });

  it("the bots carry the difficulty edge — a strong band plays well under par", () => {
    const holes = buildRound(909090, "ranked");
    const par = holes.reduce((s, h) => s + h.par, 0);
    // A high band (Diamond/Master ratings) sharpened by PLACEMENT_EDGE shoots
    // clearly under par — so out-finishing it (and ranking up) takes real play.
    const field = rankedPlacementField(55, 24, holes, 82, 92);
    const mean = field.reduce((s, p) => s + p.total, 0) / field.length;
    expect(mean).toBeLessThan(par - 6);
  });
});

describe("ranked field — sharpened to stay competitive", () => {
  it("the RANKED_EDGE makes the AI field play clearly under par at a mid tier", () => {
    let fieldToPar = 0;
    const runs = 20;
    for (let s = 1; s <= runs; s++) {
      const holes = buildRound(s * 101 + 7, "ranked");
      const par = holes.reduce((a, h) => a + h.par, 0);
      const field = rankedFieldForRound(s * 17 + 3, 60, 24, holes); // mid-tier mean (~60)
      fieldToPar += field.reduce((a, p) => a + p.total, 0) / field.length - par;
    }
    // A raw 60-rated field would hover near par on these courses; the +10 edge
    // drops the whole field several strokes under, keeping ranked a real contest.
    expect(fieldToPar / runs).toBeLessThan(-3);
    expect(RANKED_EDGE).toBe(10);
  });
});
