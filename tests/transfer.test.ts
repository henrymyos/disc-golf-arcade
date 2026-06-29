import { describe, it, expect } from "vitest";
import { encodeProgress, decodeProgress } from "../lib/discgolf/transfer";
import { mergeProgress, type Progress } from "../lib/progress";

const base: Progress = {
  best: null, winthropBest: null, holeBest: [], achievements: [], history: [], settings: null,
  career: null, coins: 0, daily: null, owned: [], profile: null, ranked: null, bag: [], bagSeen: [], levelRewarded: null,
};

describe("progress transfer token", () => {
  it("round-trips a full progress snapshot, including unicode profile names", () => {
    const p: Progress = {
      ...base,
      best: 54, winthropBest: 60, achievements: ["ace", "eagle"], coins: 1234,
      owned: ["destroyer", "trail:flame", "avatar:🦅"], history: [{ mode: "ranked", total: 49, date: 1719500000000, scores: [3, 2, 4], pars: [3, 3, 4] }],
      ranked: { rp: 820, bestToPar: -6, rounds: 12, streak: 2, bestStreak: 4, wins: 3, podiums: 7 },
      profile: { name: "Ærö 🥏" }, coinsEarned: 2000, coinsSpent: 766,
    };
    const back = decodeProgress(encodeProgress(p));
    expect(back).toEqual(p);
  });

  it("trims history to the most recent 100 rounds to bound the URL", () => {
    const history = Array.from({ length: 250 }, (_, i) => ({ mode: "course", total: 50 + (i % 5), date: i }));
    const back = decodeProgress(encodeProgress({ ...base, history }))!;
    expect(back.history).toHaveLength(100);
    expect(back.history[0].date).toBe(150); // kept the latest 100 (dates 150..249)
    expect(back.history[99].date).toBe(249);
  });

  it("decodes garbage to null instead of throwing", () => {
    expect(decodeProgress("not-base64-$$$")).toBeNull();
    expect(decodeProgress("")).toBeNull();
  });

  it("a decoded token merges loss-free with whatever's already on the new domain", () => {
    const incoming: Progress = { ...base, best: 52, coins: 500, coinsEarned: 500, achievements: ["ace"] };
    const here: Progress = { ...base, best: 58, coins: 100, coinsEarned: 100, achievements: ["birdie"] };
    const merged = mergeProgress(here, decodeProgress(encodeProgress(incoming))!);
    expect(merged.best).toBe(52); // lower (better) score wins
    expect(merged.achievements.sort()).toEqual(["ace", "birdie"]); // unioned
    expect(merged.coins).toBe(500); // monotonic earned wins (re-importing can't double coins)
  });
});
