import { describe, it, expect } from "vitest";
import { dailyStreak, finishedDailyDays, nextGoal, goalComplete, achievementProgress, type GoalProgress } from "../lib/discgolf/goals";
import { dayNumber } from "../lib/discgolf/wallet";

// Arizona is UTC-7 all year (no daylight saving).
const az = (y: number, m: number, d: number, hh: number, mm = 0) => Date.UTC(y, m - 1, d, hh + 7, mm);

describe("dailyStreak", () => {
  it("counts consecutive days ending today", () => {
    expect(dailyStreak([10, 11, 12], 12)).toBe(3);
  });
  it("keeps yesterday's streak alive until today's Daily is played", () => {
    expect(dailyStreak([10, 11, 12], 13)).toBe(3);
  });
  it("a missed day resets it", () => {
    expect(dailyStreak([10, 11, 12], 14)).toBe(0);           // missed day 13
    expect(dailyStreak([8, 9, 11, 12], 12)).toBe(2);         // gap at 10
    expect(dailyStreak([], 12)).toBe(0);
  });
  it("finished days come from daily bests plus earlier star records", () => {
    const days = finishedDailyDays({ "20740": -2, "20741": 1 }, { "20739": 2, "20738": 0 });
    expect([...days].sort()).toEqual([20739, 20740, 20741]);
    expect(dailyStreak(days, 20741)).toBe(3);
  });

  it("the day flips at midnight Central = 11 pm Arizona in winter", () => {
    const before = dayNumber(az(2026, 1, 15, 22, 59));
    const after = dayNumber(az(2026, 1, 15, 23, 0));
    expect(after).toBe(before + 1);
    // Arizona midnight is NOT a boundary: 11:00 pm and 12:30 am are the same Daily day.
    expect(dayNumber(az(2026, 1, 16, 0, 30))).toBe(after);
    // A Daily finished at 11:15 pm Arizona keeps a streak that ran through "today" (Jan 15 Central)…
    expect(dailyStreak([before - 1, before], after)).toBe(2);
    // …and one finished at 10:50 pm the next evening extends it.
    const nextEvening = dayNumber(az(2026, 1, 16, 22, 50));
    expect(nextEvening).toBe(after);
    expect(dailyStreak([before - 1, before, nextEvening], nextEvening)).toBe(3);
  });

  it("in summer (Central daylight time) it flips at 10 pm Arizona", () => {
    expect(dayNumber(az(2026, 7, 15, 22, 0))).toBe(dayNumber(az(2026, 7, 15, 21, 59)) + 1);
  });
});

const base: GoalProgress = { level: { level: 1, into: 0, need: 100 }, nextLevelHasDisc: true, achievements: [], rounds: [], roundsPlayed: 0, todayStars: 0 };

describe("nextGoal", () => {
  it("a brand-new player: ties go to today's Daily stars", () => {
    expect(nextGoal(base)?.kind).toBe("daily");
  });
  it("picks the level when it's the closest", () => {
    const g = nextGoal({ ...base, level: { level: 3, into: 90, need: 100 }, todayStars: 1 })!;
    expect(g.kind).toBe("level");
    expect(g.title).toBe("Reach level 4 and pick a new disc");
    expect(g.detail).toMatch(/^10 XP to go/);
  });
  it("picks a nearly-done achievement", () => {
    const g = nextGoal({ ...base, roundsPlayed: 4, level: { level: 2, into: 10, need: 200 }, todayStars: 3 })!;
    expect(g.id).toBe("ach-regular");
    expect(g.detail).toBe("4/5 rounds");
  });
  it("drops the Daily once all 3 stars are in, and skips earned achievements", () => {
    const g = nextGoal({ ...base, todayStars: 3, roundsPlayed: 4, achievements: ["regular"] })!;
    expect(g.kind).not.toBe("daily");
    expect(g.id).not.toBe("ach-regular");
  });
  it("goalComplete recognises each kind", () => {
    expect(goalComplete({ id: "ach-regular", kind: "achievement", emoji: "", title: "", detail: "", progress: 0 }, { ...base, achievements: ["regular"] })).toBe(true);
    expect(goalComplete({ id: "level-4", kind: "level", emoji: "", title: "", detail: "", progress: 0 }, { ...base, level: { level: 4, into: 0, need: 300 } })).toBe(true);
    expect(goalComplete({ id: "daily-stars-1", kind: "daily", emoji: "", title: "", detail: "", progress: 0 }, { ...base, todayStars: 1 })).toBe(false);
    expect(goalComplete({ id: "daily-stars-1", kind: "daily", emoji: "", title: "", detail: "", progress: 0 }, { ...base, todayStars: 2 })).toBe(true);
  });
});

describe("achievementProgress", () => {
  const round = (scores: number[], pars: number[]) => ({ mode: "course", total: scores.reduce((a, b) => a + b, 0), scores, pars });
  it("reads streaks and tallies from round history", () => {
    const r = round([2, 2, 3, 2, 4, 3], [3, 3, 3, 3, 3, 3]); // birdie, birdie, par, birdie, bogey, par
    const p = { rounds: [r], roundsPlayed: 1 };
    expect(achievementProgress("birdiestreak", p).progress).toBeCloseTo(2 / 3);
    expect(achievementProgress("fivebirdies", p).progress).toBeCloseTo(3 / 5);
    expect(achievementProgress("hotstart", p).progress).toBeCloseTo(2 / 3);
    expect(achievementProgress("bogeyfree9", p).progress).toBeCloseTo(4 / 9);
    expect(achievementProgress("ace", p).progress).toBe(0);
  });
  it("best to-par drives the round-total achievements", () => {
    const p = { rounds: [round([3, 3, 4], [3, 3, 3])], roundsPlayed: 1 }; // +1
    expect(achievementProgress("evenpar", p)).toEqual({ progress: 0.9, detail: "Best round +1, need E" });
  });
});
