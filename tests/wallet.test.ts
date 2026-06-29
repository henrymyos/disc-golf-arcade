import { describe, it, expect } from "vitest";
import { dayNumber, dailyCoins, claimDailyReward, dailyAvailable, coinsForRound } from "../lib/discgolf/wallet";

describe("daily reward", () => {
  it("dayNumber rolls over at midnight Central, not UTC", () => {
    // 2026-06-28 00:00 Central = 05:00 UTC (summer CDT). The day flips there.
    const justBefore = Date.UTC(2026, 5, 28, 4, 59);
    const atMidnight = Date.UTC(2026, 5, 28, 5, 0);
    expect(dayNumber(atMidnight)).toBe(dayNumber(justBefore) + 1);
    // a timestamp later the same Central day stays in the same bucket
    expect(dayNumber(atMidnight + 12 * 3_600_000)).toBe(dayNumber(atMidnight));
  });
  it("first claim starts a 1-day streak", () => {
    const r = claimDailyReward(null, 100);
    expect(r).not.toBeNull();
    expect(r!.reward).toEqual({ day: 100, streak: 1 });
    expect(r!.coins).toBe(dailyCoins(1));
  });
  it("a consecutive day grows the streak; a gap resets it", () => {
    expect(claimDailyReward({ day: 100, streak: 3 }, 101)!.reward.streak).toBe(4);
    expect(claimDailyReward({ day: 100, streak: 3 }, 103)!.reward.streak).toBe(1); // missed days
  });
  it("can't claim twice in a day", () => {
    expect(claimDailyReward({ day: 100, streak: 1 }, 100)).toBeNull();
    expect(dailyAvailable({ day: 100, streak: 1 }, 100)).toBe(false);
    expect(dailyAvailable({ day: 100, streak: 1 }, 101)).toBe(true);
    expect(dailyAvailable(null, 5)).toBe(true);
  });
  it("streak grows the payout, with a weekly bonus", () => {
    expect(dailyCoins(2)).toBeGreaterThan(dailyCoins(1));
    expect(dailyCoins(7)).toBeGreaterThan(dailyCoins(6) + 50); // 7th-day bonus
  });
});

describe("coinsForRound", () => {
  it("pays more for an 18-hole round and for going under par", () => {
    expect(coinsForRound(0, 18)).toBeGreaterThan(coinsForRound(0, 9));
    expect(coinsForRound(-10, 18)).toBeGreaterThan(coinsForRound(0, 18));
    expect(coinsForRound(5, 18)).toBe(coinsForRound(0, 18)); // over par = no bonus, not negative
  });
});
