import { describe, it, expect } from "vitest";
import { TIPS, TIPS_SEEN_KEY, TIP_WIND_MIN, claimTip, lieTips, setTipsOff, tipsOff } from "../lib/discgolf/tips";

function mem(): Pick<Storage, "getItem" | "setItem"> & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe("disc golf tips", () => {
  it("shows each tip once, one per moment, first unseen candidate first", () => {
    const s = mem();
    expect(claimTip(["shape", "headwind"], s)).toBe("shape");
    expect(claimTip(["shape", "headwind"], s)).toBe("headwind");
    expect(claimTip(["shape", "headwind"], s)).toBeNull();
    expect(JSON.parse(s.data.get(TIPS_SEEN_KEY)!)).toEqual(["shape", "headwind"]);
  });

  it("shows nothing when turned off, storage is missing, or there is no candidate", () => {
    const s = mem();
    setTipsOff(true, s);
    expect(tipsOff(s)).toBe(true);
    expect(claimTip(["ob"], s)).toBeNull();
    setTipsOff(false, s);
    expect(claimTip([], s)).toBeNull();
    expect(claimTip(["ob"], null)).toBeNull();
    expect(claimTip(["ob"], s)).toBe("ob");
  });

  it("survives a corrupt seen list", () => {
    const s = mem();
    s.setItem(TIPS_SEEN_KEY, "{not json");
    expect(claimTip(["hazard"], s)).toBe("hazard");
    s.setItem(TIPS_SEEN_KEY, JSON.stringify({ ob: true }));
    expect(claimTip(["ob"], s)).toBe("ob");
  });

  it("names wind only on the tee and only when it is strong", () => {
    const base = { firstTee: false, tee: true, distFt: 300 };
    expect(lieTips({ ...base, windAlong: -TIP_WIND_MIN })).toEqual(["headwind"]);
    expect(lieTips({ ...base, windAlong: TIP_WIND_MIN })).toEqual(["tailwind"]);
    expect(lieTips({ ...base, windAlong: TIP_WIND_MIN / 2 })).toEqual([]);
    expect(lieTips({ ...base, tee: false, windAlong: -0.02 })).toEqual([]);
    expect(lieTips({ ...base, firstTee: true, windAlong: -0.02 })).toEqual(["shape", "headwind"]);
  });

  it("offers Circle 1 only for a 10–33 ft lie off the tee", () => {
    const base = { firstTee: false, tee: false, windAlong: 0 };
    expect(lieTips({ ...base, distFt: 33 })).toEqual(["c1"]);
    expect(lieTips({ ...base, distFt: 10 })).toEqual([]);
    expect(lieTips({ ...base, distFt: 34 })).toEqual([]);
  });

  it("keeps every tip to one short line", () => {
    for (const t of Object.values(TIPS)) expect(t.length).toBeLessThanOrEqual(130);
  });
});
