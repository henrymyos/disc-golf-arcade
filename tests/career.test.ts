import { describe, it, expect } from "vitest";
import {
  newCareer,
  skillMods,
  careerRating,
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
  trainingPointCost,
  buyTrainingPoint,
  careerFieldHoles,
  careerCard,
  careerCardRacers,
  careerLiveStandings,
  topRivals,
  rivalRating,
  SPONSOR_CAP,
  IDENTITY_MODS,
  type Career,
  type CareerSkills,
} from "../lib/discgolf/career";
import { CATCH_R } from "../lib/discgolf/engine";

describe("newCareer", () => {
  it("starts a 10-year-old junior with low skills and headroom", () => {
    const c = newCareer("Kid", 123);
    expect(c.age).toBe(10);
    expect(c.stage).toBe("youth");
    expect(c.retired).toBe(false);
    for (const k of ["power", "control", "putt", "mental"] as (keyof CareerSkills)[]) {
      expect(c.skills[k]).toBeLessThan(35);
      expect(c.potential[k]).toBeGreaterThan(c.skills[k]);
    }
  });
  it("is deterministic for a given name + seed", () => {
    expect(JSON.stringify(newCareer("A", 7))).toBe(JSON.stringify(newCareer("A", 7)));
  });
});

describe("skillMods", () => {
  it("scales distance, catch radius and wind with the relevant skills", () => {
    const low = skillMods({ power: 0, control: 0, putt: 0, mental: 0 });
    const high = skillMods({ power: 100, control: 100, putt: 100, mental: 100 });
    expect(high.speedMul).toBeGreaterThan(low.speedMul); // more power = farther
    expect(high.catchR).toBeGreaterThan(low.catchR); // better putting = bigger catch
    expect(high.windMul).toBeLessThan(low.windMul); // more control = less wind push
    expect(low.catchR).toBeLessThan(CATCH_R); // a beginner has a smaller catch radius
  });
  it("identity mods are neutral", () => {
    expect(IDENTITY_MODS).toEqual({ speedMul: 1, catchR: CATCH_R, windMul: 1 });
  });
});

describe("careerRating", () => {
  it("rises monotonically with skills and stays in range", () => {
    const lo = careerRating({ power: 10, control: 10, putt: 10, mental: 10 });
    const hi = careerRating({ power: 90, control: 90, putt: 90, mental: 90 });
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThanOrEqual(100);
    expect(hi).toBeGreaterThan(lo);
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
  it("college schedule includes Nationals at Winthrop", () => {
    const c: Career = { ...newCareer("U", 1), stage: "college", age: 19, season: 2 };
    const sched = seasonSchedule(c);
    const nats = sched.find((e) => e.name === "College Nationals");
    expect(nats).toBeTruthy();
    expect(nats!.mode).toBe("winthrop");
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
    expect(career.age).toBe(11);
    expect(career.season).toBe(1);
    expect(career.skills.power).toBeGreaterThan(before); // youth + training grows it
    expect(career.trainPts).toBe(6); // refilled
    expect(career.done).toHaveLength(0);
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
      skills: { power: 90, control: 90, putt: 90, mental: 90 },
      potential: { power: 95, control: 95, putt: 95, mental: 95 },
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

describe("economy + sponsors", () => {
  it("a pro win pays prize money; amateur events do not", () => {
    const am = newCareer("Am", 11);
    const ev = seasonSchedule(am)[0];
    expect(recordResult(am, ev, 1, false).result.prize).toBe(0); // youth = amateur
    const pro: Career = { ...newCareer("Pro", 11), stage: "pro", age: 24 };
    const pev = seasonSchedule(pro)[0];
    const r = recordResult(pro, pev, 1, false);
    expect(r.result.prize).toBeGreaterThan(0);
    expect(r.career.cash).toBe(r.result.prize);
  });
  it("offers sponsors by stage + rating, caps signings, and pays a signing bonus", () => {
    const c: Career = { ...newCareer("HS", 12), stage: "highschool", age: 15, skills: { power: 50, control: 50, putt: 50, mental: 50 } };
    const offers = availableSponsors(c);
    expect(offers.length).toBeGreaterThan(0);
    const signed = signSponsor(c, offers[0].id);
    expect(signed.sponsors).toHaveLength(1);
    expect(signed.cash).toBe(offers[0].signing);
    // can't exceed the cap
    let s = signed;
    for (const o of availableSponsors(s)) s = signSponsor(s, o.id);
    expect(s.sponsors.length).toBeLessThanOrEqual(SPONSOR_CAP);
  });
  it("sponsor stipends + coaches pay out and add training at season's end", () => {
    let c: Career = { ...newCareer("Pro", 13), stage: "pro", age: 25, cash: 100000, skills: { power: 85, control: 85, putt: 85, mental: 85 } };
    const coach = availableSponsors(c).find((o) => o.coach)!;
    c = signSponsor(c, coach.id);
    const next = advanceSeason(c, {}).career;
    expect(next.cash).toBe(c.cash + coach.stipend);
    expect(next.trainPts).toBe(6 + 1); // base + one coach
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

describe("normalizeCareer (migration)", () => {
  it("backfills cash, sponsors and rivals on an old save", () => {
    const old = newCareer("Old", 20);
    // simulate a pre-economy save
    const stripped = { ...old, cash: undefined, sponsors: undefined, rivals: [] } as unknown as Career;
    const fixed = normalizeCareer(stripped);
    expect(fixed.cash).toBe(0);
    expect(fixed.sponsors).toEqual([]);
    expect(fixed.rivals).toHaveLength(6);
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
