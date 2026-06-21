import { describe, it, expect } from "vitest";
import { TRAILS, DEFAULT_TRAIL, trailOwnKey, trailUnlocked, trailByKey } from "../lib/discgolf/trails";

describe("flight trails", () => {
  it("has a free default that's always unlocked", () => {
    const def = trailByKey(DEFAULT_TRAIL)!;
    expect(def).toBeTruthy();
    expect(def.price).toBe(0);
    expect(trailUnlocked(def, [])).toBe(true);
  });
  it("priced trails need their owned key", () => {
    const paid = TRAILS.find((t) => t.price > 0)!;
    expect(trailUnlocked(paid, [])).toBe(false);
    expect(trailUnlocked(paid, [trailOwnKey(paid.key)])).toBe(true);
  });
  it("namespaces owned keys so they don't collide with discs/avatars", () => {
    expect(trailOwnKey("fire")).toBe("trail:fire");
  });
  it("every trail has a unique key and a non-empty palette unless it's none/rainbow", () => {
    const keys = TRAILS.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of TRAILS) {
      if (t.kind !== "none" && t.kind !== "rainbow") expect(t.colors.length).toBeGreaterThan(0);
    }
  });
});
