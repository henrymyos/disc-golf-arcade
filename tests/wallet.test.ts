import { describe, it, expect } from "vitest";
import { dayNumber, dailyCoins, claimDailyReward, dailyAvailable, coinsForRound } from "../lib/discgolf/wallet";

describe("daily reward", () => {
  it("dayNumber buckets time into UTC days", () => {
    expect(dayNumber(0)).toBe(0);
    expect(dayNumber(86_400_000)).toBe(1);
    expect(dayNumber(86_400_000 * 5 + 1)).toBe(5);
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
