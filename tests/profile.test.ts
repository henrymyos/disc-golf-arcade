import { describe, it, expect } from "vitest";
import {
  AVATARS,
  avatarOwnKey,
  avatarUnlocked,
  avatarByKey,
  playerXp,
  xpForLevel,
  levelFromXp,
} from "../lib/discgolf/profile";

describe("avatars", () => {
  it("free avatars are always unlocked; priced ones need their owned key", () => {
    const free = AVATARS.find((a) => a.price === 0)!;
    const paid = AVATARS.find((a) => a.price > 0)!;
    expect(avatarUnlocked(free, [])).toBe(true);
    expect(avatarUnlocked(paid, [])).toBe(false);
    expect(avatarUnlocked(paid, [avatarOwnKey(paid.key)])).toBe(true);
  });
  it("owned keys are namespaced so they don't collide with disc keys", () => {
    expect(avatarOwnKey("crown")).toBe("avatar:crown");
  });
  it("avatarByKey resolves known keys and rejects unknown ones", () => {
    expect(avatarByKey("disc")!.emoji).toBe("🥏");
    expect(avatarByKey("nope")).toBeUndefined();
  });
});

describe("level / xp", () => {
  it("xp rises with rounds (dominant), achievements and discs; never negative", () => {
    expect(playerXp(0, 0, 0)).toBe(0);
    expect(playerXp(1, 0, 0)).toBe(100); // one round
    expect(playerXp(1, 1, 1)).toBe(130); // + small bonuses
    expect(playerXp(-5, -5, -5)).toBe(0);
  });
  it("level 1 starts at 0 xp and each level needs progressively more", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBeGreaterThan(xpForLevel(1));
    expect(xpForLevel(3) - xpForLevel(2)).toBeGreaterThan(xpForLevel(2) - xpForLevel(1));
  });
  it("paces leveling by rounds: ~1 round to level 2, and L19→20 takes 5–8 rounds", () => {
    // A brand-new account: one full round (no achievements/discs yet) → level 2.
    expect(levelFromXp(playerXp(1, 0, 0)).level).toBe(2);
    // Even a strong first round (a fistful of achievements) shouldn't blow past level 2.
    expect(levelFromXp(playerXp(1, 6, 0)).level).toBe(2);
    // Each round is ~100 xp, so rounds-per-level = the level's xp increment / 100.
    const roundsFor = (lvl: number) => (xpForLevel(lvl) - xpForLevel(lvl - 1)) / 100;
    expect(roundsFor(2)).toBeCloseTo(1, 1); // ~1 round
    expect(roundsFor(20)).toBeGreaterThanOrEqual(5);
    expect(roundsFor(20)).toBeLessThanOrEqual(8);
    // Monotonically longer as you climb.
    expect(roundsFor(20)).toBeGreaterThan(roundsFor(10));
    expect(roundsFor(10)).toBeGreaterThan(roundsFor(2));
  });
  it("levelFromXp reports the right level and progress into it", () => {
    expect(levelFromXp(0).level).toBe(1);
    const atL2 = levelFromXp(xpForLevel(2));
    expect(atL2.level).toBe(2);
    expect(atL2.into).toBe(0);
    const mid = levelFromXp(xpForLevel(2) + 50);
    expect(mid.level).toBe(2);
    expect(mid.into).toBe(50);
    expect(mid.need).toBe(xpForLevel(3) - xpForLevel(2));
  });
});
