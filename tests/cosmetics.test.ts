import { describe, it, expect } from "vitest";
import {
  DISC_SKINS, BASKET_SKINS, AIM_STYLES, GROUND_THEMES, CELEBRATIONS,
  DEFAULT_DISC_SKIN, DEFAULT_BASKET_SKIN, DEFAULT_AIM_STYLE, DEFAULT_GROUND_THEME, DEFAULT_CELEBRATION,
  COSMETIC_PREFIX, cosmeticOwnKey, cosmeticUnlocked, cosmeticByKey,
} from "../lib/discgolf/cosmetics";

const CATEGORIES = [
  { list: DISC_SKINS, prefix: COSMETIC_PREFIX.discSkin, def: DEFAULT_DISC_SKIN },
  { list: BASKET_SKINS, prefix: COSMETIC_PREFIX.basket, def: DEFAULT_BASKET_SKIN },
  { list: AIM_STYLES, prefix: COSMETIC_PREFIX.aim, def: DEFAULT_AIM_STYLE },
  { list: GROUND_THEMES, prefix: COSMETIC_PREFIX.ground, def: DEFAULT_GROUND_THEME },
  { list: CELEBRATIONS, prefix: COSMETIC_PREFIX.celebration, def: DEFAULT_CELEBRATION },
];

describe("cosmetics", () => {
  it("each category has a free default that's always unlocked", () => {
    for (const { list, prefix, def } of CATEGORIES) {
      const d = cosmeticByKey(list, def)!;
      expect(d, `${prefix} default exists`).toBeTruthy();
      expect(d.price, `${prefix} default is free`).toBe(0);
      expect(cosmeticUnlocked(prefix, d, [])).toBe(true);
    }
  });
  it("priced items need their namespaced owned key", () => {
    for (const { list, prefix } of CATEGORIES) {
      const paid = list.find((i) => i.price > 0);
      if (!paid) continue;
      expect(cosmeticUnlocked(prefix, paid, [])).toBe(false);
      expect(cosmeticUnlocked(prefix, paid, [cosmeticOwnKey(prefix, paid.key)])).toBe(true);
    }
  });
  it("keys are unique within a category and prefixes are distinct", () => {
    for (const { list } of CATEGORIES) {
      const keys = list.map((i) => i.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
    const prefixes = Object.values(COSMETIC_PREFIX);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });
  it("celebrations carry sane burst parameters", () => {
    for (const c of CELEBRATIONS) {
      expect(c.colors.length).toBeGreaterThan(0);
      expect(c.count).toBeGreaterThan(0);
      expect(c.bursts === undefined || c.bursts >= 1).toBe(true);
    }
  });
});
