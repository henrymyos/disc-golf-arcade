// The weekly server action is the trust boundary: it must pick the course from
// the week itself, refuse closed weeks and implausible cards, and post the total.
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn(async () => ({ data: "ok", error: null }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc, from: () => ({ insert: async () => ({ error: null }) }), auth: { getUser: async () => ({ data: { user: null }, error: "bad" }) } }),
}));

const { submitWeeklyScore } = await import("../actions/arcade");
const { currentWeeklyStop } = await import("../lib/discgolf/weekly");
const { proTourCourseBySeed } = await import("../lib/discgolf/engine");

describe("submitWeeklyScore", () => {
  beforeEach(() => rpc.mockClear());
  const stop = currentWeeklyStop(Date.now());
  const pars = proTourCourseBySeed(stop.seed)!.proHoles.map((h) => h.par);

  it("posts a plausible card's total to this week's board", async () => {
    const card = pars.map((p, i) => (i < 4 ? p - 1 : p));
    const res = await submitWeeklyScore("Sam‮", stop.week, card);
    expect(res).toEqual({ ok: true, name: "Sam" });
    expect(rpc).toHaveBeenCalledWith("submit_arcade_score_v2", { p_name: "Sam", p_strokes: stop.par - 4, p_course: stop.key, p_user_id: null });
  });

  it("refuses other weeks, bad cards and expired sign-ins without writing", async () => {
    expect((await submitWeeklyScore("Sam", stop.week + 1, pars)).ok).toBe(false);
    expect((await submitWeeklyScore("Sam", stop.week - 5, pars)).ok).toBe(false);
    expect((await submitWeeklyScore("Sam", stop.week + 0.5, pars)).ok).toBe(false);
    expect((await submitWeeklyScore("Sam", stop.week, pars.map(() => 1))).error).toBe("Invalid score");
    expect((await submitWeeklyScore("Sam", stop.week, pars.slice(1))).error).toBe("Invalid score");
    expect((await submitWeeklyScore("Sam", stop.week, pars, "forged-token")).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});
