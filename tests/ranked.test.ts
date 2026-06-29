import { describe, it, expect } from "vitest";
import {
  weekSeed,
  rankedCourseKey,
  placementRP,
  streakBonus,
  applyRankedRound,
  normalizeRanked,
  rankedFieldMean,
  tierFromRP,
  TIERS,
  EMPTY_RANKED,
  encodeToParScore,
  decodeToParScore,
} from "../lib/discgolf/ranked";

describe("ranked weeks + board key", () => {
  it("weeks roll over at midnight Central on Sunday, and the board key round-trips to-par", () => {
    // 2026-06-28 is a Sunday; its Central midnight is 05:00 UTC (summer CDT).
    const satNight = Date.UTC(2026, 5, 28, 4, 59);  // Sat 23:59 Central
    const sunMidnight = Date.UTC(2026, 5, 28, 5, 0); // Sun 00:00 Central
    expect(weekSeed(sunMidnight)).toBe(weekSeed(satNight) + 1);
    expect(weekSeed(sunMidnight + 3 * 86_400_000)).toBe(weekSeed(sunMidnight)); // same week mid-week
    expect(rankedCourseKey(1)).toBe("ranked-1");
    // best-to-par is encoded into the board's stroke range and decodes back.
    expect(decodeToParScore(encodeToParScore(-12))).toBe(-12);
    expect(encodeToParScore(-12)).toBeGreaterThan(0); // stays a valid positive "stroke"
  });
});

describe("placement RP", () => {
  it("a win gains the most, mid-pack is near-neutral, last loses points", () => {
    expect(placementRP(1, 25)).toBeGreaterThan(placementRP(13, 25));
    expect(placementRP(13, 25)).toBeGreaterThan(placementRP(25, 25));
    expect(placementRP(1, 25)).toBeGreaterThan(0); // winning climbs
    expect(placementRP(25, 25)).toBeLessThan(0); // last place drops
  });
  it("streak bonus only kicks in from a second consecutive podium and is capped", () => {
    expect(streakBonus(1)).toBe(0);
    expect(streakBonus(2)).toBeGreaterThan(0);
    expect(streakBonus(3)).toBeGreaterThan(streakBonus(2));
    expect(streakBonus(99)).toBe(streakBonus(6)); // capped
  });
});

describe("applyRankedRound", () => {
  it("a win climbs RP, counts the win, starts a podium streak, tracks best to-par", () => {
    const { state, result } = applyRankedRound(null, 1, 25, -4);
    expect(result.win).toBe(true);
    expect(result.podium).toBe(true);
    expect(result.rpDelta).toBeGreaterThan(0);
    expect(state.rp).toBe(result.rpDelta);
    expect(state.wins).toBe(1);
    expect(state.podiums).toBe(1);
    expect(state.streak).toBe(1);
    expect(state.bestToPar).toBe(-4);
    expect(state.rounds).toBe(1);
  });
  it("consecutive podiums build a streak that pays an escalating bonus", () => {
    const s = applyRankedRound(null, 2, 25, 0).state; // podium, streak 1
    const r2 = applyRankedRound(s, 3, 25, 1);         // podium, streak 2 → bonus
    expect(r2.result.streak).toBe(2);
    expect(r2.result.bonus).toBeGreaterThan(0);
    expect(r2.state.bestStreak).toBe(2);
    // A poor finish resets the streak.
    const r3 = applyRankedRound(r2.state, 20, 25, 6);
    expect(r3.result.podium).toBe(false);
    expect(r3.state.streak).toBe(0);
    expect(r3.state.bestStreak).toBe(2); // best is remembered
  });
  it("RP never falls below 0 — Bronze is the floor", () => {
    const low = applyRankedRound({ rp: 10, bestToPar: 0, rounds: 1, streak: 0, bestStreak: 0, wins: 0, podiums: 0 }, 25, 25, 18);
    expect(low.state.rp).toBe(0);
  });
  it("flags promotion when a result crosses a tier threshold", () => {
    const before = { ...EMPTY_RANKED, rp: TIERS[1].min - 10 }; // just below Silver
    const { result } = applyRankedRound(before, 1, 25, -8);
    expect(result.tierUp).toBe(true);
  });
});

describe("field strength + migration", () => {
  it("opponent strength rises with tier", () => {
    expect(rankedFieldMean(TIERS[0].min)).toBeLessThan(rankedFieldMean(TIERS[3].min));
    expect(rankedFieldMean(TIERS[3].min)).toBeLessThan(rankedFieldMean(TIERS[5].min));
  });
  it("normalizeRanked fills missing fields on a pre-upgrade save", () => {
    const legacy = normalizeRanked({ rp: 500, bestToPar: -2, rounds: 4 });
    expect(legacy).toEqual({ rp: 500, bestToPar: -2, rounds: 4, streak: 0, bestStreak: 0, wins: 0, podiums: 0 });
    expect(EMPTY_RANKED).toEqual({ rp: 0, bestToPar: null, rounds: 0, streak: 0, bestStreak: 0, wins: 0, podiums: 0 });
  });
});

describe("ranked tiers", () => {
  it("starts at the lowest tier and climbs through every threshold", () => {
    expect(tierFromRP(0).tier.key).toBe("bronze");
    for (const t of TIERS) expect(tierFromRP(t.min).tier.key).toBe(t.key);
    expect(tierFromRP(999999).tier).toBe(TIERS[TIERS.length - 1]);
  });
  it("reports progress toward the next tier, with no next at the top", () => {
    const bronze = tierFromRP(TIERS[0].min + 50);
    expect(bronze.into).toBe(50);
    expect(bronze.need).toBe(TIERS[1].min - TIERS[0].min);
    const top = tierFromRP(TIERS[TIERS.length - 1].min + 100);
    expect(top.next).toBeNull();
    expect(top.need).toBe(0);
  });
});
