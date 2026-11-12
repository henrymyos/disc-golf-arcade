import { describe, expect, it } from "vitest";
import { parseChallenge, challengeParam, isChallengeTourSeed } from "@/lib/discgolf/challenge";
import { PROTOUR_COURSES, TOUR_COURSES, buildRound } from "@/lib/discgolf/engine";

describe("challenge links", () => {
  it("round-trips a fixed course and a dotted name", () => {
    const c = parseChallenge(challengeParam("course", 0, 60, "J.R."));
    expect(c).toMatchObject({ mode: "course", score: 60, name: "J.R.", courseLabel: "Glendoveer East" });
    expect(c?.stop).toBeUndefined();
  });

  it("supports real Pro Tour courses with their stop", () => {
    const pro = PROTOUR_COURSES.find((p) => p.course.id === "olympus" || p.course.name === "Olympus") ?? PROTOUR_COURSES[0];
    const c = parseChallenge(challengeParam("tour", pro.seed, pro.par - 3, "Henry"));
    expect(c).not.toBeNull();
    expect(c!.courseLabel).toBe(pro.course.name);
    expect(c!.par).toBe(pro.par);
    expect(c!.overStr).toBe("-3");
    expect(c!.stop).toMatch(/^Stop \d+ · /);
  });

  it("supports the Arcade's own tour venues", () => {
    const t = TOUR_COURSES[0];
    const c = parseChallenge(challengeParam("tour", t.seed, 50, "A"));
    expect(c?.courseLabel).toBe(t.name);
    expect(c?.par).toBe(buildRound(t.seed, "tour").reduce((s, h) => s + h.par, 0));
    expect(c?.stop).toBeUndefined();
  });

  it("rejects unknown tour seeds and bad input", () => {
    expect(isChallengeTourSeed(12345)).toBe(false);
    expect(parseChallenge("tour.12345.50.A")).toBeNull();
    expect(parseChallenge("ranked.1.50.A")).toBeNull();
    expect(parseChallenge("course.0.0.A")).toBeNull();
    expect(parseChallenge("course.0.50.%E0%A4%A")?.name).toBe("A friend");
  });
});
