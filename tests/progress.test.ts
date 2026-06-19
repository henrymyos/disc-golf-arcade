import { describe, it, expect } from "vitest";
import { mergeProgress, type Progress } from "../lib/progress";

const base: Progress = { best: null, winthropBest: null, holeBest: [], achievements: [], history: [], settings: null, career: null, coins: 0, daily: null, owned: [], profile: null, ranked: null, bag: [], bagSeen: [] };

describe("mergeProgress", () => {
  it("keeps the lower (better) best score for each course", () => {
    const a: Progress = { ...base, best: 70, winthropBest: 65 };
    const b: Progress = { ...base, best: 68, winthropBest: 70 };
    const m = mergeProgress(a, b);
    expect(m.best).toBe(68);
    expect(m.winthropBest).toBe(65);
  });

  it("treats null as 'no score' rather than a best", () => {
    const a: Progress = { ...base, best: null };
    const b: Progress = { ...base, best: 72 };
    expect(mergeProgress(a, b).best).toBe(72);
    expect(mergeProgress(b, a).best).toBe(72);
  });

  it("takes the lower of each per-hole best, padding to 18", () => {
    const a: Progress = { ...base, holeBest: [3, null, 5] };
    const b: Progress = { ...base, holeBest: [4, 2, null] };
    const m = mergeProgress(a, b);
    expect(m.holeBest[0]).toBe(3);
    expect(m.holeBest[1]).toBe(2);
    expect(m.holeBest[2]).toBe(5);
    expect(m.holeBest).toHaveLength(18);
  });

  it("unions achievements", () => {
    const a: Progress = { ...base, achievements: ["ace", "birdie"] };
    const b: Progress = { ...base, achievements: ["birdie", "eagle"] };
    expect(mergeProgress(a, b).achievements.sort()).toEqual(["ace", "birdie", "eagle"]);
  });

  it("dedupes history by date|mode|total and sorts ascending by date", () => {
    const a: Progress = { ...base, history: [{ mode: "course", total: 70, date: 200 }, { mode: "course", total: 72, date: 100 }] };
    const b: Progress = { ...base, history: [{ mode: "course", total: 70, date: 200 }, { mode: "daily", total: 30, date: 300 }] };
    const m = mergeProgress(a, b);
    expect(m.history).toHaveLength(3); // the (200,course,70) duplicate collapses
    expect(m.history.map((h) => h.date)).toEqual([100, 200, 300]);
  });

  it("prefers cloud settings on conflict", () => {
    const local: Progress = { ...base, settings: { muted: false } };
    const cloud: Progress = { ...base, settings: { muted: true } };
    expect(mergeProgress(local, cloud).settings).toEqual({ muted: true });
  });

  it("keeps the more-advanced career save (more seasons)", () => {
    const early = { season: 2, results: [{}], careerPoints: 10 };
    const late = { season: 9, results: [{}, {}], careerPoints: 80 };
    const a: Progress = { ...base, career: early as unknown as Progress["career"] };
    const b: Progress = { ...base, career: late as unknown as Progress["career"] };
    expect(mergeProgress(a, b).career).toBe(b.career);
    expect(mergeProgress(b, a).career).toBe(b.career);
  });
  it("keeps the most ranked progress: highest rp, best to-par, most rounds", () => {
    const a: Progress = { ...base, ranked: { rp: 500, bestToPar: -2, rounds: 4 } };
    const b: Progress = { ...base, ranked: { rp: 300, bestToPar: -7, rounds: 6 } };
    const m = mergeProgress(a, b);
    expect(m.ranked).toEqual({ rp: 500, bestToPar: -7, rounds: 6 });
  });
  it("takes whichever ranked state exists when only one is present", () => {
    const only = { rp: 120, bestToPar: 1, rounds: 1 };
    expect(mergeProgress({ ...base, ranked: only }, base).ranked).toBe(only);
    expect(mergeProgress(base, { ...base, ranked: only }).ranked).toBe(only);
  });
  it("takes whichever career exists when only one is present", () => {
    const only = { season: 0, results: [], careerPoints: 0 } as unknown as Progress["career"];
    expect(mergeProgress({ ...base, career: only }, base).career).toBe(only);
    expect(mergeProgress(base, { ...base, career: only }).career).toBe(only);
  });
});
