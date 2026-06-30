import { describe, it, expect } from "vitest";
import {
  weekSeed,
  rankedCourseKey,
  placementRP,
  streakBonus,
  roundWeight,
  ROUND_WEIGHT_PEAK,
  ROUND_WEIGHT_FLOOR,
  ROUND_WEIGHT_HALFLIFE,
  rolloverSeason,
  seasonRewardCoins,
  earnedDivisions,
  SEASON_HISTORY_MAX,
  applyRankedRound,
  applyPlacementRound,
  rpFromRating,
  PLACEMENT_ROUNDS,
  PLACEMENT_EDGE,
  normalizeRanked,
  rankedFieldMean,
  tierFromRP,
  TIERS,
  EMPTY_RANKED,
  encodeToParScore,
  decodeToParScore,
  type RankedState,
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
  it("a 5-card pays top 2, neutral 3rd, and the bottom 2 lose — 1st/last the most", () => {
    expect(placementRP(1, 5)).toBe(50);   // 1st gains the most
    expect(placementRP(2, 5)).toBe(25);   // 2nd gains, but less
    expect(placementRP(3, 5)).toBe(0);    // 3rd is neutral
    expect(placementRP(4, 5)).toBe(-25);  // 4th loses
    expect(placementRP(5, 5)).toBe(-50);  // 5th loses the most
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
    const { state, result } = applyRankedRound(null, 1, 5, -4);
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
  it("consecutive top-2 finishes build a streak that pays an escalating bonus", () => {
    const s = applyRankedRound(null, 2, 5, 0).state; // 2nd → podium, streak 1
    const r2 = applyRankedRound(s, 1, 5, 1);         // 1st → podium, streak 2 → bonus
    expect(r2.result.streak).toBe(2);
    expect(r2.result.bonus).toBeGreaterThan(0);
    expect(r2.state.bestStreak).toBe(2);
    // A 3rd-or-worse finish isn't a podium, so it resets the streak.
    const r3 = applyRankedRound(r2.state, 4, 5, 6);
    expect(r3.result.podium).toBe(false);
    expect(r3.state.streak).toBe(0);
    expect(r3.state.bestStreak).toBe(2); // best is remembered
  });
  it("RP never falls below 0 — Bronze is the floor", () => {
    const low = applyRankedRound({ rp: 10, bestToPar: 0, rounds: 1, streak: 0, bestStreak: 0, wins: 0, podiums: 0, placed: true, placeEstimates: [], season: 1, lastSeasonRp: null, history: [] }, 5, 5, 18);
    expect(low.state.rp).toBe(0);
  });
  it("flags promotion when a result crosses a tier threshold", () => {
    const before = { ...EMPTY_RANKED, rp: TIERS[1].min - 10 }; // just below Silver
    const { result } = applyRankedRound(before, 1, 5, -8);
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
    // A pre-placement save normalizes with placed:false so it gets re-calibrated.
    expect(legacy).toEqual({ rp: 500, bestToPar: -2, rounds: 4, streak: 0, bestStreak: 0, wins: 0, podiums: 0, placed: false, placeEstimates: [], season: 0, lastSeasonRp: null, history: [] });
    expect(EMPTY_RANKED).toEqual({ rp: 0, bestToPar: null, rounds: 0, streak: 0, bestStreak: 0, wins: 0, podiums: 0, placed: false, placeEstimates: [], season: 0, lastSeasonRp: null, history: [] });
  });
});

describe("round-weight decay (settling-in K-factor)", () => {
  it("the first post-placement round counts ~2×, halving its boost every half-life toward 1×", () => {
    // While placing and on the first ranked round, weight sits at the peak.
    expect(roundWeight(0)).toBe(ROUND_WEIGHT_PEAK);
    expect(roundWeight(PLACEMENT_ROUNDS)).toBe(ROUND_WEIGHT_PEAK);
    // One half-life of post-placement rounds in → halfway between peak and floor.
    expect(roundWeight(PLACEMENT_ROUNDS + ROUND_WEIGHT_HALFLIFE)).toBeCloseTo((ROUND_WEIGHT_PEAK + ROUND_WEIGHT_FLOOR) / 2, 6);
    // Far out, it eases back to the established 1× balance.
    expect(roundWeight(PLACEMENT_ROUNDS + 1000)).toBeCloseTo(ROUND_WEIGHT_FLOOR, 1);
  });
  it("never increases as rounds accumulate", () => {
    for (let r = 0; r < 40; r++) expect(roundWeight(r + 1)).toBeLessThanOrEqual(roundWeight(r));
  });
  it("applyRankedRound scales RP by the round weight and reports it", () => {
    // Just past placement: a 1st-place 50-RP win swings ~2× → +100.
    const fresh = applyRankedRound({ ...EMPTY_RANKED, rp: 1500, placed: true, rounds: PLACEMENT_ROUNDS }, 1, 5, -8);
    expect(fresh.result.weight).toBe(ROUND_WEIGHT_PEAK);
    expect(fresh.result.rpDelta).toBe(100);
    // Hundreds of rounds in: the same win is back to its face value of +50.
    const settled = applyRankedRound({ ...EMPTY_RANKED, rp: 1500, placed: true, rounds: PLACEMENT_ROUNDS + 1000 }, 1, 5, -8);
    expect(settled.result.weight).toBeCloseTo(ROUND_WEIGHT_FLOOR, 1);
    expect(settled.result.rpDelta).toBe(50);
  });
});

describe("monthly seasons (rolloverSeason)", () => {
  it("is a no-op within the same season, and pays nothing", () => {
    const mid = { ...EMPTY_RANKED, season: 5, rp: 1500, placed: true, rounds: 10 };
    const { state, reward } = rolloverSeason(mid, 5);
    expect(state).toEqual(mid);
    expect(reward).toBeNull();
  });
  it("resets all rankings on a new month but remembers last season's finish", () => {
    const ended = { ...EMPTY_RANKED, season: 5, rp: 2750, placed: true, rounds: 12, wins: 4, podiums: 8, streak: 3, bestStreak: 5 };
    const { state: next } = rolloverSeason(ended, 6);
    expect(next.season).toBe(6);
    expect(next.rp).toBe(0);            // ladder resets
    expect(next.placed).toBe(false);    // placement must be redone
    expect(next.rounds).toBe(0);
    expect(next.wins).toBe(0);          // stats reset for the new season
    expect(next.streak).toBe(0);
    expect(next.lastSeasonRp).toBe(2750); // …but where you finished is carried forward
  });
  it("pays a division badge + gold when a real season ends, logged newest-first", () => {
    const ended = { ...EMPTY_RANKED, season: 5, rp: 2750, placed: true, rounds: 12 }; // 2750 RP = Platinum
    const { state: next, reward } = rolloverSeason(ended, 6);
    expect(reward).toEqual({ season: 5, rp: 2750, tierKey: "platinum", coins: seasonRewardCoins("platinum") });
    expect(next.history[0]).toEqual(reward);        // freshly logged at the front
    expect(earnedDivisions(next.history).has("platinum")).toBe(true);
  });
  it("does NOT pay out (or log) when the season ended mid-placement", () => {
    const unplaced = { ...EMPTY_RANKED, season: 5, rp: 800, placed: false, rounds: 1, lastSeasonRp: 1200 };
    const { state: next, reward } = rolloverSeason(unplaced, 6);
    expect(reward).toBeNull();
    expect(next.history).toEqual([]);
    expect(next.lastSeasonRp).toBe(1200); // keeps the older real prior, not the half-baked one
  });
  it("accumulates history across seasons, capped and newest-first", () => {
    let s: RankedState = { ...EMPTY_RANKED, season: 1, rp: 1000, placed: true, rounds: 5 };
    for (let m = 2; m <= SEASON_HISTORY_MAX + 4; m++) {
      s = { ...rolloverSeason(s, m).state, rp: 1000, placed: true, rounds: 5 };
    }
    expect(s.history.length).toBe(SEASON_HISTORY_MAX);        // capped
    expect(s.history[0].season).toBeGreaterThan(s.history[1].season); // newest first
  });
  it("normalizes a null/legacy state into a fresh season", () => {
    const { state: next, reward } = rolloverSeason(null, 7);
    expect(next).toEqual({ ...EMPTY_RANKED, season: 7, lastSeasonRp: null });
    expect(reward).toBeNull();
  });
});

describe("season payout scales with the division reached", () => {
  it("higher divisions pay strictly more gold", () => {
    const order = TIERS.map((t) => seasonRewardCoins(t.key));
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1]);
  });
  it("an unknown division key pays nothing", () => {
    expect(seasonRewardCoins("nope")).toBe(0);
  });
});

describe("placement carries last season as a fading prior", () => {
  it("pulls the projection toward last season's RP without overriding this season's play", () => {
    const withPrior = applyPlacementRound({ ...EMPTY_RANKED, season: 6, lastSeasonRp: 1500 }, 3, 5, 4).result.projectedRp;
    const noPrior = applyPlacementRound({ ...EMPTY_RANKED, season: 6, lastSeasonRp: null }, 3, 5, 4).result.projectedRp;
    expect(withPrior).toBeLessThan(noPrior);   // a 1500 prior tugs a higher estimate down
    expect(withPrior).toBeGreaterThan(1500);   // but a strong round still moves you off it
  });
  it("fades as more placement rounds land — by the third round it barely matters", () => {
    const low = { ...EMPTY_RANKED, season: 6, lastSeasonRp: 200 }; // a stale low prior
    const r1 = applyPlacementRound(low, 1, 5, -10);        // 1st of 5 → a high estimate
    const r2 = applyPlacementRound(r1.state, 1, 5, -10);
    const r3 = applyPlacementRound(r2.state, 1, 5, -10);
    expect(r2.result.projectedRp).toBeGreaterThan(r1.result.projectedRp);
    expect(r3.result.projectedRp).toBeGreaterThan(r2.result.projectedRp);
    expect(r3.result.placed).toBe(true);
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

describe("placement (calibration rounds)", () => {
  it("rpFromRating lands each tier's mean rating in that tier, monotonically", () => {
    expect(tierFromRP(rpFromRating(42)).tier.key).toBe("bronze");
    expect(tierFromRP(rpFromRating(54)).tier.key).toBe("silver");
    expect(tierFromRP(rpFromRating(64)).tier.key).toBe("gold");
    expect(tierFromRP(rpFromRating(72)).tier.key).toBe("platinum");
    expect(tierFromRP(rpFromRating(80)).tier.key).toBe("diamond");
    expect(tierFromRP(rpFromRating(90)).tier.key).toBe("master");
    expect(rpFromRating(50)).toBeLessThan(rpFromRating(70));
    expect(rpFromRating(30)).toBeGreaterThanOrEqual(0); // never negative
  });

  it("reads your level from where you finish in the wide calibration field", () => {
    // Round 1: a card of 5 (you + 4), evenly spread Bronze→Master.
    expect(applyPlacementRound(EMPTY_RANKED, 1, 5, -10).result.tier.key).toBe("master"); // beat everyone
    expect(applyPlacementRound(EMPTY_RANKED, 3, 5, 0).result.tier.key).toBe("gold");      // dead middle
    expect(applyPlacementRound(EMPTY_RANKED, 5, 5, 12).result.tier.key).toBe("bronze");   // finished last
  });

  it("later rounds test you within your projected division's band (tier mean ±14)", () => {
    // Projected Diamond → field spans ~[66, 94]. Holding mid keeps Diamond; a win
    // pushes toward Master; a poor round slips toward Gold/Platinum.
    const lo = 66, hi = 94;
    expect(applyPlacementRound(EMPTY_RANKED, 3, 5, 0, lo, hi).result.tier.key).toBe("diamond"); // mid → ~80
    expect(["diamond", "master"]).toContain(applyPlacementRound(EMPTY_RANKED, 1, 5, -8, lo, hi).result.tier.key);
    expect(["gold", "platinum"]).toContain(applyPlacementRound(EMPTY_RANKED, 5, 5, 6, lo, hi).result.tier.key);
  });

  it("placement bots carry a 7-stroke difficulty edge", () => {
    expect(PLACEMENT_EDGE).toBe(7);
  });

  it("projects a rank after round 1, adjusts to how you play, and locks in after PLACEMENT_ROUNDS", () => {
    const r1 = applyPlacementRound(EMPTY_RANKED, 3, 5, 0); // middling → projects Gold
    expect(r1.result.placement).toBe(true);
    expect(r1.result.round).toBe(1);
    expect(r1.result.remaining).toBe(PLACEMENT_ROUNDS - 1);
    expect(r1.result.placed).toBe(false);
    expect(r1.state.placed).toBe(false);
    expect(tierFromRP(r1.state.rp).tier.key).toBe("gold");

    const r2 = applyPlacementRound(r1.state, 1, 5, -9); // then dominate → projection climbs
    expect(r2.result.placed).toBe(false);
    expect(r2.state.rp).toBeGreaterThan(r1.state.rp);

    const r3 = applyPlacementRound(r2.state, 2, 5, -3);
    expect(r3.result.placed).toBe(true);
    expect(r3.state.placed).toBe(true);
    expect(r3.result.remaining).toBe(0);
    expect(r3.state.rounds).toBe(3);
    // Final RP is the average of the three round estimates.
    const avg = Math.round(r3.state.placeEstimates.reduce((a, b) => a + b, 0) / PLACEMENT_ROUNDS);
    expect(r3.state.rp).toBe(avg);
  });

  it("doesn't start a streak during placement, but does count wins/podiums + best to-par", () => {
    const w = applyPlacementRound(EMPTY_RANKED, 1, 5, -5);
    expect(w.state.streak).toBe(0);
    expect(w.state.wins).toBe(1);
    expect(w.state.podiums).toBe(1);
    expect(w.state.bestToPar).toBe(-5);
  });

  it("after placement, normal RP rounds take over and you stay placed", () => {
    const placedState = { ...EMPTY_RANKED, placed: true, rp: 1500, placeEstimates: [1500, 1500, 1500] };
    const after = applyRankedRound(placedState, 1, 5, -6);
    expect(after.state.placed).toBe(true);
    expect("placement" in after.result).toBe(false); // a normal RankedResult
    expect(after.result.rpDelta).toBeGreaterThan(0);
  });

  it("migrates saves: pre-placement saves re-calibrate, already-placed saves don't", () => {
    expect(normalizeRanked({ rp: 800, bestToPar: -3, rounds: 9 }).placed).toBe(false); // legacy → re-place
    expect(normalizeRanked({ ...EMPTY_RANKED, placed: true, rp: 800 }).placed).toBe(true); // keep placed
  });
});
