import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { claimSupportNudge, supportUrl, supportPromptsOff, setSupportPromptsOff, NUDGE_INTERVAL_MS, SUPPORT_NUDGE_KEY } from "../lib/support";
import { newCareer, normalizeCareer, type Career } from "../lib/discgolf/career";

function mem(): Storage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() { return data.size; },
  };
}
const URL = "https://ko-fi.com/test";
const DAY = 24 * 60 * 60 * 1000;

describe("support link config", () => {
  it("is hidden when NEXT_PUBLIC_SUPPORT_URL is unset, blank or not http(s)", () => {
    expect(supportUrl(undefined)).toBeNull();
    expect(supportUrl("")).toBeNull();
    expect(supportUrl("   ")).toBeNull();
    expect(supportUrl("javascript:alert(1)")).toBeNull();
    expect(supportUrl(` ${URL} `)).toBe(URL);
  });
  it("never nudges when the URL is unset", () => {
    const s = mem();
    expect(claimSupportNudge(1_000, null, s)).toBe(false);
    expect(s.data.size).toBe(0);
  });
});

describe("round-end nudge cadence", () => {
  it("shows at most once per 7 days per device", () => {
    const s = mem();
    const t0 = 1_800_000_000_000;
    expect(claimSupportNudge(t0, URL, s)).toBe(true);
    expect(s.getItem(SUPPORT_NUDGE_KEY)).toBe(String(t0));
    expect(claimSupportNudge(t0 + DAY, URL, s)).toBe(false);
    expect(claimSupportNudge(t0 + NUDGE_INTERVAL_MS - 1, URL, s)).toBe(false);
    expect(claimSupportNudge(t0 + NUDGE_INTERVAL_MS, URL, s)).toBe(true);
    expect(claimSupportNudge(t0 + NUDGE_INTERVAL_MS + DAY, URL, s)).toBe(false);
  });
  it("respects Settings › Hide support prompts", () => {
    const s = mem();
    setSupportPromptsOff(true, s);
    expect(supportPromptsOff(s)).toBe(true);
    expect(claimSupportNudge(1_000, URL, s)).toBe(false);
    setSupportPromptsOff(false, s);
    expect(claimSupportNudge(1_000, URL, s)).toBe(true);
  });
  it("stays quiet when storage throws", () => {
    const bad = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(claimSupportNudge(1_000, URL, bad)).toBe(false);
    expect(supportPromptsOff(bad)).toBe(false);
    expect(() => setSupportPromptsOff(true, bad)).not.toThrow();
  });
});

describe("fictional career sponsors", () => {
  it("an old save holding a real-brand sponsor loads with the new name and same money", () => {
    const c = newCareer("Old Save", 7);
    const old = { ...c, sponsors: [{ id: "skylinebank", name: "Nike", slot: "general", tier: 4, signing: 80000, stipend: 55000, coach: true, reqRating: 80, reqStage: "pro" }] } as Career;
    const loaded = normalizeCareer(old);
    expect(loaded.sponsors[0]).toMatchObject({ id: "skylinebank", name: "Skyline Bank", stipend: 55000, signing: 80000 });
  });
  it("no real non-manufacturer brand names remain in career.ts or the career panel", () => {
    const src = readFileSync("lib/discgolf/career.ts", "utf8") + readFileSync("components/panels/CareerPanel.tsx", "utf8");
    for (const b of ["Infinite Discs", "Dynamic Discs", "Friction Gloves", "GripEQ", "ZÜCA", "1st Phorm", "Red Bull", "Nike"]) expect(src).not.toContain(b);
    expect(src).not.toMatch(/name: "Discmania"/);
  });
});
