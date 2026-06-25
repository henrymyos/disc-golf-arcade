import { describe, it, expect } from "vitest";
import {
  weekSeed,
  rankedCourseKey,
  roundRP,
  applyRankedRound,
  tierFromRP,
  TIERS,
  EMPTY_RANKED,
} from "../lib/discgolf/ranked";

describe("ranked weeks", () => {
  it("buckets time into 7-day weeks so a whole week shares one course", () => {
    const wk = 7 * 86_400_000;
    expect(weekSeed(0)).toBe(0);
    expect(weekSeed(wk - 1)).toBe(0);
    expect(weekSeed(wk)).toBe(1);
    expect(rankedCourseKey(weekSeed(wk))).toBe("ranked-1");
  });
});

describe("ranked RP", () => {
  it("rewards going low and penalizes blow-ups (signed, so RP can fall)", () => {
    expect(roundRP(-10)).toBeGreaterThan(roundRP(0));
    expect(roundRP(0)).toBeGreaterThan(roundRP(20));
    expect(roundRP(0)).toBeGreaterThan(0); // a par round still climbs
    expect(roundRP(10)).toBeLessThan(0); // a blow-up loses points (demotion)
  });
  it("a finished round applies the RP delta, tracks best to-par and counts the round", () => {
    const a = applyRankedRound(null, -3);
    expect(a.rp).toBe(roundRP(-3));
    expect(a.bestToPar).toBe(-3);
    expect(a.rounds).toBe(1);
    const b = applyRankedRound(a, 5); // a worse round subtracts RP but keeps best
    expect(b.rp).toBe(a.rp + roundRP(5));
    expect(b.bestToPar).toBe(-3);
    expect(b.rounds).toBe(2);
  });
  it("RP never falls below 0 — Bronze is the floor", () => {
    const low = applyRankedRound({ rp: 10, bestToPar: 0, rounds: 1 }, 20); // big penalty
    expect(low.rp).toBe(0);
  });
  it("EMPTY_RANKED is a usable zero state", () => {
    expect(EMPTY_RANKED).toEqual({ rp: 0, bestToPar: null, rounds: 0 });
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
    expect(bronze.tier.key).toBe("bronze");
    expect(bronze.into).toBe(50);
    expect(bronze.need).toBe(TIERS[1].min - TIERS[0].min);
    const top = tierFromRP(TIERS[TIERS.length - 1].min + 100);
    expect(top.next).toBeNull();
    expect(top.need).toBe(0);
  });
});
