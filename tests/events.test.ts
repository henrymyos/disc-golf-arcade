import { describe, it, expect } from "vitest";
import {
  dailyChallenges,
  weeklyChallenges,
  roundsThisDay,
  roundsThisWeek,
  challengeDone,
  dailyClaimKey,
  eventClaimKey,
  type EventRound,
} from "../lib/discgolf/events";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

describe("weekly challenges", () => {
  it("surfaces exactly three distinct challenges, stable within a week", () => {
    const a = weeklyChallenges(100);
    const b = weeklyChallenges(100);
    expect(a).toHaveLength(3);
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id)); // stable
    expect(new Set(a.map((c) => c.id)).size).toBe(3); // distinct
  });
  it("rotates the set across weeks", () => {
    const ids = new Set<string>();
    for (let w = 0; w < 12; w++) weeklyChallenges(w).forEach((c) => ids.add(c.id));
    expect(ids.size).toBeGreaterThan(3); // more than one week's worth appears over time
  });
});

describe("progress from history", () => {
  it("only counts rounds inside the week window", () => {
    const week = 200;
    const start = week * WEEK_MS;
    const rows: EventRound[] = [
      { mode: "course", total: 54, date: start + 10 },
      { mode: "course", total: 54, date: start - 10 }, // last week
      { mode: "course", total: 54, date: start + WEEK_MS + 5 }, // next week
    ];
    expect(roundsThisWeek(rows, week)).toHaveLength(1);
  });
  it("evaluates birdie/ace/under-par goals from per-hole scores", () => {
    const rows: EventRound[] = [
      { mode: "course", total: 7, date: 0, scores: [1, 2, 4], pars: [3, 3, 3] }, // ace + birdie, under par (7<9)
    ];
    const birdie = { id: "b", emoji: "", title: "", desc: "", reward: 0, goal: 1, measure: (r: EventRound[]) => r.reduce((n, x) => n + (x.scores ?? []).filter((s, i) => s - (x.pars ?? [])[i] === -1).length, 0) };
    expect(challengeDone(birdie, rows)).toBe(true);
    const playFive = weeklyChallenges(0).find(() => true)!;
    expect(challengeDone({ ...playFive, goal: 2 }, rows)).toBe(false); // only one round
  });
});

describe("daily challenges", () => {
  it("surfaces three distinct challenges, stable within a day and rotating across days", () => {
    const a = dailyChallenges(500);
    expect(a).toHaveLength(3);
    expect(a.map((c) => c.id)).toEqual(dailyChallenges(500).map((c) => c.id)); // stable
    expect(new Set(a.map((c) => c.id)).size).toBe(3); // distinct
    const ids = new Set<string>();
    for (let d = 0; d < 20; d++) dailyChallenges(d).forEach((c) => ids.add(c.id));
    expect(ids.size).toBeGreaterThan(3);
  });
  it("daily and weekly draw from different pools", () => {
    const dailyIds = new Set<string>();
    const weeklyIds = new Set<string>();
    for (let i = 0; i < 30; i++) {
      dailyChallenges(i).forEach((c) => dailyIds.add(c.id));
      weeklyChallenges(i).forEach((c) => weeklyIds.add(c.id));
    }
    // No id appears in both pools (weekly ids are all prefixed differently).
    for (const id of weeklyIds) expect(dailyIds.has(id)).toBe(false);
  });
  it("only counts rounds inside the day window", () => {
    const day = 1000;
    const start = day * DAY_MS;
    const rows: EventRound[] = [
      { mode: "course", total: 54, date: start + 10 },
      { mode: "course", total: 54, date: start - 10 }, // yesterday
      { mode: "course", total: 54, date: start + DAY_MS + 5 }, // tomorrow
    ];
    expect(roundsThisDay(rows, day)).toHaveLength(1);
  });
});

describe("claim keys", () => {
  it("namespaces claims by window and id", () => {
    expect(eventClaimKey(7, "ace1")).toBe("event:7:ace1");
    expect(dailyClaimKey(9, "ace1")).toBe("daily:9:ace1");
  });
});
