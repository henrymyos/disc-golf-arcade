import { describe, it, expect, vi } from "vitest";
import { postScore, postMiniResult, postRoundResult, readBoardChoice, writeBoardChoice, BOARD_NAME_KEY, type BoardChoice } from "../lib/leaderboard/post";
import { writeScore, userIdFromToken, cleanName, RESERVED_NAME_ERROR, type AdminLike } from "../lib/leaderboard/server-core";

const guest = (choice: BoardChoice | null) => ({ signedIn: false, accountName: "", choice, getToken: vi.fn(async () => null) });
const okSend = () => vi.fn(async (name: string) => ({ ok: true, name }));

describe("postScore (client)", () => {
  it("guest who chose Skip: no call to the server action", async () => {
    const send = okSend();
    expect(await postScore({ ...guest({ kind: "skip" }), send })).toEqual({ status: "skipped" });
    expect(send).not.toHaveBeenCalled();
  });

  it("guest who hasn't chosen: asks for a name and sends nothing (never 'Player')", async () => {
    const send = okSend();
    expect(await postScore({ ...guest(null), send })).toEqual({ status: "ask" });
    expect(send).not.toHaveBeenCalled();
  });

  it("guest with a chosen name posts under it, with no token", async () => {
    const send = okSend();
    expect(await postScore({ ...guest({ kind: "name", name: "Ace" }), send })).toEqual({ status: "posted", as: "Ace" });
    expect(send).toHaveBeenCalledWith("Ace", null);
  });

  it("signed in: posts with the session token (keyed by the account), ignoring any guest choice", async () => {
    const send = okSend();
    const out = await postScore({ signedIn: true, accountName: "Henry", choice: { kind: "skip" }, getToken: async () => "jwt-123", send });
    expect(out).toEqual({ status: "posted", as: "Henry" });
    expect(send).toHaveBeenCalledWith("Henry", "jwt-123");
  });

  it("signed in without a usable session: error, nothing sent", async () => {
    const send = okSend();
    const out = await postScore({ signedIn: true, accountName: "Henry", choice: null, getToken: async () => null, send });
    expect(out.status).toBe("error");
    expect(send).not.toHaveBeenCalled();
  });

  it("a reserved name comes back flagged so the client can ask again", async () => {
    const send = vi.fn(async () => ({ ok: false, error: RESERVED_NAME_ERROR }));
    const out = await postScore({ ...guest({ kind: "name", name: "Henry" }), send });
    expect(out).toEqual({ status: "error", error: RESERVED_NAME_ERROR, reserved: true });
  });
});

describe("finished minigames and rounds", () => {
  it("a finished guest Putting run without a name makes no server call", async () => {
    const submitMini = vi.fn(async () => ({ ok: true }));
    const out = await postMiniResult({ kind: "putt", makes: 0, points: 0 }, guest(null), submitMini);
    expect(out.status).toBe("ask");
    expect(submitMini).not.toHaveBeenCalled();
  });

  it("posts the right score for each mini kind once a name is chosen", async () => {
    const submitMini = vi.fn(async (name: string) => ({ ok: true, name }));
    await postMiniResult({ kind: "putt", makes: 7, points: 0 }, guest({ kind: "name", name: "Ace" }), submitMini);
    await postMiniResult({ kind: "target", makes: 0, points: 420 }, guest({ kind: "name", name: "Ace" }), submitMini);
    expect(submitMini).toHaveBeenNthCalledWith(1, "Ace", 7, "putt", null);
    expect(submitMini).toHaveBeenNthCalledWith(2, "Ace", 420, "target", null);
  });

  it("a signed-in round goes out with the token", async () => {
    const submitRound = vi.fn(async (name: string) => ({ ok: true, name }));
    await postRoundResult({ strokes: 61, course: "glendoveer" }, { signedIn: true, accountName: "", choice: null, getToken: async () => "jwt" }, submitRound);
    expect(submitRound).toHaveBeenCalledWith("Player", 61, "glendoveer", "jwt");
  });
});

describe("remembered guest choice", () => {
  const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }; };
  it("round-trips name and skip, and clears", () => {
    const s = mem();
    expect(readBoardChoice(s)).toBeNull();
    writeBoardChoice(s, { kind: "name", name: "  Ace " });
    expect(readBoardChoice(s)).toEqual({ kind: "name", name: "Ace" });
    writeBoardChoice(s, { kind: "skip" });
    expect(readBoardChoice(s)).toEqual({ kind: "skip" });
    writeBoardChoice(s, null);
    expect(s.m.has(BOARD_NAME_KEY)).toBe(false);
  });
  it("ignores junk", () => {
    const s = mem();
    s.setItem(BOARD_NAME_KEY, "{not json");
    expect(readBoardChoice(s)).toBeNull();
    s.setItem(BOARD_NAME_KEY, JSON.stringify({ kind: "name", name: "   " }));
    expect(readBoardChoice(s)).toBeNull();
  });
});

// A fake admin client: records RPC calls and answers from a script.
function fakeAdmin(rpcAnswers: Record<string, { data?: unknown; error: { code?: string; message?: string } | null }>, user: { id: string } | null = null) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const inserts: Record<string, unknown>[] = [];
  const admin: AdminLike = {
    rpc: async (fn, args) => { calls.push({ fn, args }); return rpcAnswers[fn] ?? { error: { code: "PGRST202" } }; },
    from: () => ({ insert: async (row) => { inserts.push(row); return { error: null }; } }),
    auth: { getUser: async (jwt) => ({ data: { user: jwt === "good" ? user : null }, error: jwt === "good" ? null : { message: "bad jwt" } }) },
  };
  return { admin, calls, inserts };
}

describe("writeScore (server)", () => {
  it("signed in → keyed by user id", async () => {
    const { admin, calls } = fakeAdmin({ submit_arcade_score_v2: { data: "ok", error: null } });
    const res = await writeScore(admin, { name: "Henry", strokes: 60, course: "glendoveer", userId: "u-1" });
    expect(res).toEqual({ ok: true, name: "Henry" });
    expect(calls).toEqual([{ fn: "submit_arcade_score_v2", args: { p_name: "Henry", p_strokes: 60, p_course: "glendoveer", p_user_id: "u-1" } }]);
  });

  it("a guest using a name owned by a signed-in player is refused", async () => {
    const { admin } = fakeAdmin({ submit_arcade_score_v2: { data: "name_reserved", error: null } });
    const res = await writeScore(admin, { name: "Henry", strokes: 60, course: "glendoveer", userId: null });
    expect(res).toEqual({ ok: false, error: RESERVED_NAME_ERROR });
  });

  it("guest names are cleaned before they reach the database", async () => {
    const { admin, calls } = fakeAdmin({ submit_arcade_score_v2: { data: "ok", error: null } });
    await writeScore(admin, { name: "  Ace​  Putter  ", strokes: 30, course: "putt", userId: null });
    expect(calls[0].args.p_name).toBe("Ace Putter");
  });

  it("before the migration: falls back to the old name-keyed RPC", async () => {
    const { admin, calls } = fakeAdmin({ submit_arcade_score: { error: null } });
    const res = await writeScore(admin, { name: "Ace", strokes: 55, course: "winthrop", userId: "u-1" });
    expect(res.ok).toBe(true);
    expect(calls.map((c) => c.fn)).toEqual(["submit_arcade_score_v2", "submit_arcade_score"]);
  });

  it("with neither RPC: plain insert, and the legacy Glendoveer-only column fallback", async () => {
    const { admin, inserts } = fakeAdmin({});
    const res = await writeScore(admin, { name: "Ace", strokes: 55, course: "glendoveer", userId: null }, true);
    expect(res.ok).toBe(true);
    expect(inserts).toEqual([{ name: "Ace", strokes: 55, course: "glendoveer" }]);
  });

  it("other database errors surface as a generic failure", async () => {
    const { admin } = fakeAdmin({ submit_arcade_score_v2: { error: { code: "23505", message: "dup" } } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await writeScore(admin, { name: "Ace", strokes: 55, course: "glendoveer", userId: null })).ok).toBe(false);
    spy.mockRestore();
  });
});

describe("userIdFromToken", () => {
  it("returns the user for a valid token and null otherwise", async () => {
    const { admin } = fakeAdmin({}, { id: "u-9" });
    expect(await userIdFromToken(admin, "good")).toBe("u-9");
    expect(await userIdFromToken(admin, "forged")).toBeNull();
    expect(await userIdFromToken(admin, null)).toBeNull();
  });
});

describe("cleanName", () => {
  it("strips control and zero-width characters, collapses spaces, clamps to 16, masks the blocklist", () => {
    expect(cleanName("a\u0007b‮c")).toBe("abc");
    expect(cleanName("x".repeat(30))).toHaveLength(16);
    expect(cleanName("   ")).toBe("Anon");
    expect(cleanName("shit putter")).toBe("**** putter");
  });
});
