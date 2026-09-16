import { describe, it, expect } from "vitest";
import { isValidCourse, FIXED_COURSE_BOARDS } from "../lib/boards";
import { courseHoles } from "../lib/discgolf/engine";

describe("leaderboard board keys", () => {
  it("accepts every fixed course, including Olympus", () => {
    for (const c of ["glendoveer", "winthrop", "olympus"]) expect(isValidCourse(c), c).toBe(true);
  });
  it("accepts seeded boards and rejects junk", () => {
    expect(isValidCourse("daily-20603")).toBe(true);
    expect(isValidCourse("ranked-1")).toBe(true);
    expect(isValidCourse("tour-1234567890")).toBe(true);
    expect(isValidCourse("")).toBe(false);
    expect(isValidCourse("mars")).toBe(false);
    expect(isValidCourse("daily-")).toBe(false);
    expect(isValidCourse("olympus; drop table")).toBe(false);
  });
  it("every fixed board is a real 18-hole course in the engine", () => {
    const modeFor: Record<string, Parameters<typeof courseHoles>[0]> = { glendoveer: "course", winthrop: "winthrop", olympus: "olympus" };
    for (const b of FIXED_COURSE_BOARDS) expect(courseHoles(modeFor[b])).toHaveLength(18);
  });
});
