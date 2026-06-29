import { describe, it, expect } from "vitest";
import { centralDay, centralWeek, centralWeekFromDay, centralDayRange, centralWeekRange } from "../lib/discgolf/time";

const H = 3_600_000;

describe("central-time day/week boundaries", () => {
  it("a new day starts at midnight Central (05:00 UTC during summer CDT)", () => {
    const justBefore = Date.UTC(2026, 5, 28, 4, 59); // 2026-06-27 23:59 Central
    const atMidnight = Date.UTC(2026, 5, 28, 5, 0);   // 2026-06-28 00:00 Central
    expect(centralDay(atMidnight)).toBe(centralDay(justBefore) + 1);
    const r = centralDayRange(centralDay(atMidnight));
    expect(r.start).toBe(atMidnight);     // the window opens exactly at Central midnight
    expect(r.end - r.start).toBe(24 * H);
  });

  it("a new week starts at midnight Central on Sunday", () => {
    // 2026-06-28 is a Sunday; its Central midnight is 05:00 UTC.
    const satNight = Date.UTC(2026, 5, 28, 4, 59);  // Sat 23:59 Central
    const sunMidnight = Date.UTC(2026, 5, 28, 5, 0); // Sun 00:00 Central
    expect(centralWeek(sunMidnight)).toBe(centralWeek(satNight) + 1);
    const r = centralWeekRange(centralWeek(sunMidnight));
    expect(r.start).toBe(sunMidnight);
    expect(r.end - r.start).toBe(7 * 24 * H);
  });

  it("day/week indices round-trip with their UTC ranges", () => {
    const now = Date.UTC(2026, 8, 15, 17, 30); // an arbitrary instant
    const d = centralDay(now);
    const dr = centralDayRange(d);
    expect(dr.start).toBeLessThanOrEqual(now);
    expect(now).toBeLessThan(dr.end);
    expect(centralDay(dr.start)).toBe(d);
    expect(centralDay(dr.end)).toBe(d + 1);

    const w = centralWeek(now);
    expect(centralWeekFromDay(d)).toBe(w);
    const wr = centralWeekRange(w);
    expect(wr.start).toBeLessThanOrEqual(now);
    expect(now).toBeLessThan(wr.end);
    expect(centralWeek(wr.start)).toBe(w);
    expect(centralDayRange(centralDay(wr.start)).start).toBe(wr.start); // a week begins on a day boundary
  });

  it("absorbs daylight-saving transitions (23h spring-forward day, 25h fall-back day)", () => {
    const springDay = centralDay(Date.UTC(2026, 2, 8, 18, 0)); // 2026-03-08, clocks jump 2am→3am
    const sr = centralDayRange(springDay);
    expect(sr.end - sr.start).toBe(23 * H);

    const fallDay = centralDay(Date.UTC(2026, 10, 1, 18, 0)); // 2026-11-01, clocks fall 2am→1am
    const fr = centralDayRange(fallDay);
    expect(fr.end - fr.start).toBe(25 * H);
  });
});
