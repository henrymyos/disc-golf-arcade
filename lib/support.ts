// "Support the Arcade" tip jar (Ko-fi). Ships dark: with NEXT_PUBLIC_SUPPORT_URL
// unset (or not an http(s) URL) every support link, nudge and setting is hidden.
// Tips are thanks only; nothing in the game is unlocked by them.

export const SUPPORT_NUDGE_KEY = "dga.supportNudgeAt"; // ms timestamp of the last round-end nudge
export const SUPPORT_OFF_KEY = "dga.supportNudgeOff"; // "1" = Settings › Hide support prompts
export const NUDGE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // at most once a week per device

type Store = Pick<Storage, "getItem" | "setItem">;

// NEXT_PUBLIC_ vars are inlined at build time, so the literal reference matters.
export function supportUrl(raw: string | undefined = process.env.NEXT_PUBLIC_SUPPORT_URL): string | null {
  const url = raw?.trim();
  return url && /^https?:\/\/\S+$/i.test(url) ? url : null;
}

function store(): Store | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function supportPromptsOff(s: Store | null = store()): boolean {
  try {
    return s?.getItem(SUPPORT_OFF_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSupportPromptsOff(off: boolean, s: Store | null = store()): void {
  try {
    s?.setItem(SUPPORT_OFF_KEY, off ? "1" : "0");
  } catch {
    /* storage blocked: the toggle just won't persist */
  }
}

// Decide whether to show the round-end nudge now, and if so record it. Any storage
// failure means "don't show" so a blocked localStorage can't nag every round.
export function claimSupportNudge(now: number, url: string | null = supportUrl(), s: Store | null = store()): boolean {
  if (!url || !s) return false;
  try {
    if (s.getItem(SUPPORT_OFF_KEY) === "1") return false;
    const last = Number(s.getItem(SUPPORT_NUDGE_KEY));
    if (Number.isFinite(last) && last > 0 && now - last < NUDGE_INTERVAL_MS && last <= now) return false;
    s.setItem(SUPPORT_NUDGE_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}
