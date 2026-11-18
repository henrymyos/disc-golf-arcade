import { describe, it, expect } from "vitest";
import { weeklyStop, currentWeeklyStop, weeklyStopForRound, weekOpenForPosts, weeklyCardError, timeLeftLabel, WEEKLY_GRACE_MS } from "../lib/discgolf/weekly";
import { proTourCourseBySeed } from "../lib/discgolf/engine";
import { centralWeek } from "../lib/discgolf/time";
import { shareText, replayCard } from "../lib/discgolf/replayCard";
import { buildReplay } from "../lib/discgolf/replay";

const NOV18 = Date.UTC(2026, 10, 18, 18); // Wed Nov 18 2026, noon Central

describe("Weekly Tour Stop", () => {
  it("starts at Olympus (stop 1) the week of Nov 15 2026 and runs Sunday to Sunday", () => {
    const s = currentWeeklyStop(NOV18);
    expect(s.name).toBe("Olympus");
    expect(s.key).toBe(`weekly-${s.week}-${s.seed}`);
    expect(new Date(s.start).toISOString()).toBe("2026-11-15T06:00:00.000Z"); // Sun 00:00 CST
    expect(s.end - s.start).toBe(7 * 86_400_000);
    expect(weeklyStop(s.week + 1).name).toBe("Parc des Familles");
  });

  it("rotates through every built course before repeating", () => {
    const w = centralWeek(NOV18);
    const seeds = Array.from({ length: 60 }, (_, i) => weeklyStop(w + i).seed);
    const n = new Set(seeds).size;
    expect(n).toBeGreaterThanOrEqual(28);
    expect(seeds[n]).toBe(seeds[0]);
    for (const seed of seeds) expect(proTourCourseBySeed(seed)).toBeTruthy();
  });

  it("counts a round on this week's course, and last week's only in the grace hour", () => {
    const cur = currentWeeklyStop(NOV18);
    expect(weeklyStopForRound(cur.seed, NOV18)?.week).toBe(cur.week);
    expect(weeklyStopForRound(weeklyStop(cur.week + 1).seed, NOV18)).toBeNull();
    const prev = weeklyStop(cur.week - 1);
    expect(weeklyStopForRound(prev.seed, prev.end + WEEKLY_GRACE_MS - 1)?.week).toBe(prev.week);
    expect(weeklyStopForRound(prev.seed, prev.end + WEEKLY_GRACE_MS)).toBeNull();
    expect(weeklyStopForRound(undefined, NOV18)).toBeNull();
  });

  it("only takes posts for the open week", () => {
    const w = centralWeek(NOV18);
    expect(weekOpenForPosts(w, NOV18)).toBe(true);
    expect(weekOpenForPosts(w + 1, NOV18)).toBe(false);
    expect(weekOpenForPosts(w - 1, NOV18)).toBe(false);
    expect(weekOpenForPosts(w - 1, weeklyStop(w - 1).end + 60_000)).toBe(true);
  });

  it("rejects implausible cards", () => {
    const pars = proTourCourseBySeed(currentWeeklyStop(NOV18).seed)!.proHoles.map((h) => h.par);
    const even = pars.slice();
    expect(weeklyCardError(even, pars)).toBeNull();
    expect(weeklyCardError(pars.map((p) => p - 1), pars)).toBeNull(); // a birdie on every hole is allowed
    expect(weeklyCardError(even.slice(1), pars)).toMatch(/hole count/);
    expect(weeklyCardError("72", pars)).toMatch(/hole count/);
    expect(weeklyCardError(even.map((s, i) => (i === 0 ? 0 : s)), pars)).toMatch(/out of range/);
    expect(weeklyCardError(even.map((s, i) => (i === 0 ? 2.5 : s)), pars)).toMatch(/out of range/);
    expect(weeklyCardError(even.map((s, i) => (i === 0 ? 21 : s)), pars)).toMatch(/out of range/);
    expect(weeklyCardError(pars.map(() => 1), pars)).not.toBeNull(); // 18 aces
    expect(weeklyCardError(pars.map((p) => p - 2), pars)).toMatch(/total/);
  });

  it("labels the time left", () => {
    const end = NOV18 + 3 * 86_400_000 + 4 * 3_600_000 + 59_000;
    expect(timeLeftLabel(end, NOV18)).toBe("3d 4h left");
    expect(timeLeftLabel(NOV18 + 5 * 3_600_000 + 12 * 60_000, NOV18)).toBe("5h 12m left");
    expect(timeLeftLabel(NOV18 + 12 * 60_000, NOV18)).toBe("12m left");
    expect(timeLeftLabel(NOV18, NOV18)).toBe("closed");
  });

  it("shares a weekly result with the course, rank and link", () => {
    const s = currentWeeklyStop(NOV18);
    const pars = proTourCourseBySeed(s.seed)!.proHoles.map((h) => h.par);
    const r = buildReplay({ mode: "tour", seed: s.seed, name: "Sam", scores: pars.map((p) => p - 1), pars, paths: [] });
    const text = shareText(replayCard(r, 1), { link: "https://x.test/", weekly: { rank: 3 } });
    expect(text.split("\n")[0]).toBe("Disc Golf Arcade Weekly Tour Stop · Olympus");
    expect(text).toContain(`#3 this week`);
    expect(text).toContain("Beat it before Sunday: https://x.test/");
  });
});
