// Client side of posting a score: decides whether a finished round or minigame
// goes to a leaderboard, and under which identity. Pure apart from the injected
// `send` (the server action) and `getToken`, so it is unit-tested directly.
//
//  * Signed in: always posts, keyed by the account (the server verifies the token).
//  * Guest who picked a name: posts under that name.
//  * Guest who chose Skip: never posts.
//  * Guest who hasn't chosen yet: nothing is sent; the caller asks for a name.

import { RESERVED_NAME_ERROR } from "./server-core";

export const BOARD_NAME_KEY = "discgolf.boardname.v1";

export type BoardChoice = { kind: "name"; name: string } | { kind: "skip" };

export type PostOutcome =
  | { status: "posted"; as: string }
  | { status: "ask" }
  | { status: "skipped" }
  | { status: "error"; error: string; reserved: boolean };

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readBoardChoice(storage: StorageLike | null | undefined): BoardChoice | null {
  try {
    const v = JSON.parse(storage?.getItem(BOARD_NAME_KEY) || "null");
    if (v?.kind === "skip") return { kind: "skip" };
    if (v?.kind === "name" && typeof v.name === "string" && v.name.trim()) return { kind: "name", name: v.name.trim().slice(0, 16) };
  } catch { /* fall through */ }
  return null;
}

export function writeBoardChoice(storage: StorageLike | null | undefined, choice: BoardChoice | null) {
  try {
    if (!choice) storage?.removeItem(BOARD_NAME_KEY);
    else storage?.setItem(BOARD_NAME_KEY, JSON.stringify(choice));
  } catch { /* ignore */ }
}

export async function postScore({ signedIn, accountName, choice, getToken, send }: {
  signedIn: boolean;
  accountName: string;             // the profile name, used for signed-in posts
  choice: BoardChoice | null;      // the guest's remembered choice
  getToken: () => Promise<string | null>;
  send: (name: string, token: string | null) => Promise<{ ok: boolean; error?: string; name?: string }>;
}): Promise<PostOutcome> {
  let name: string;
  let token: string | null = null;
  if (signedIn) {
    token = await getToken();
    if (!token) return { status: "error", error: "Couldn't confirm your sign-in — try again.", reserved: false };
    name = accountName.trim() || "Player";
  } else if (!choice) {
    return { status: "ask" };
  } else if (choice.kind === "skip") {
    return { status: "skipped" };
  } else {
    name = choice.name;
  }
  const res = await send(name, token);
  if (res.ok) return { status: "posted", as: res.name ?? name };
  const error = res.error ?? "Save failed";
  return { status: "error", error, reserved: error === RESERVED_NAME_ERROR };
}

type Who = { signedIn: boolean; accountName: string; choice: BoardChoice | null; getToken: () => Promise<string | null> };
type SendResult = Promise<{ ok: boolean; error?: string; name?: string }>;

// A finished Putting / Accuracy run → its mini board (putts made / points).
export function postMiniResult(
  result: { kind: "putt" | "target"; makes: number; points: number },
  who: Who,
  submitMini: (name: string, score: number, kind: string, token: string | null) => SendResult,
): Promise<PostOutcome> {
  const score = result.kind === "putt" ? result.makes : result.points;
  return postScore({ ...who, send: (name, token) => submitMini(name, score, result.kind, token) });
}

// A finished round → its course / daily / ranked board (strokes already encoded).
export function postRoundResult(
  round: { strokes: number; course: string },
  who: Who,
  submitRound: (name: string, strokes: number, course: string, token: string | null) => SendResult,
): Promise<PostOutcome> {
  return postScore({ ...who, send: (name, token) => submitRound(name, round.strokes, round.course, token) });
}
