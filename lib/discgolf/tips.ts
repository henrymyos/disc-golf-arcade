// Disc golf 101: one-line rules tips, each shown once per device the first time
// its moment comes up in a round. Settings › "Disc golf tips" turns them off.

export const TIPS_SEEN_KEY = "dga.tipsSeen"; // JSON array of tip ids already shown
export const TIPS_OFF_KEY = "dga.tipsOff"; // "1" = tips turned off

export const TIPS = {
  shape: "Hyzer (outer edge down) fades hard at the end; anhyzer (edge up) bends the other way. Flat shows the disc's own flight.",
  headwind: "Headwind: discs turn more and fly less stable. Club up to a more overstable disc or add hyzer.",
  tailwind: "Tailwind: discs fade early and drop. An understable disc or a touch of anhyzer carries further.",
  c1: "Inside 33 ft is Circle 1. Putts from 10–33 ft are C1X, the putting stat good players track.",
  ob: "Out of bounds (water counts): +1 stroke, then play from where the disc was last in bounds.",
  dz: "Drop zone: some holes send OB throws to a marked drop zone instead. Still +1 stroke.",
  hazard: "Hazard: +1 stroke, but unlike OB you play it from where it landed.",
} as const;
export type TipId = keyof typeof TIPS;

// Wind along the shot (engine `windAlong`, px/frame; holes deal 0.004–0.018)
// strong enough to name: below this the disc barely notices.
export const TIP_WIND_MIN = 0.008;

type Store = Pick<Storage, "getItem" | "setItem">;

function store(): Store | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function tipsOff(s: Store | null = store()): boolean {
  try {
    return s?.getItem(TIPS_OFF_KEY) === "1";
  } catch {
    return false;
  }
}

export function setTipsOff(off: boolean, s: Store | null = store()): void {
  try {
    s?.setItem(TIPS_OFF_KEY, off ? "1" : "0");
  } catch {
    /* storage blocked: the toggle just won't persist */
  }
}

function seenTips(s: Store): string[] {
  try {
    const v: unknown = JSON.parse(s.getItem(TIPS_SEEN_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// The tips that fit a fresh lie, in the order they should be offered.
export function lieTips(o: { firstTee: boolean; tee: boolean; windAlong: number; distFt: number }): TipId[] {
  const out: TipId[] = [];
  if (o.firstTee) out.push("shape");
  if (o.tee && o.windAlong <= -TIP_WIND_MIN) out.push("headwind");
  if (o.tee && o.windAlong >= TIP_WIND_MIN) out.push("tailwind");
  if (!o.tee && o.distFt > 10 && o.distFt <= 33) out.push("c1");
  return out;
}

// Pick the first candidate not yet shown and record it as shown. One tip per
// moment, so a windy first tee teaches shape now and wind on a later hole.
// Blocked storage or tips turned off means no tip (never repeat one every lie).
export function claimTip(candidates: readonly TipId[], s: Store | null = store()): TipId | null {
  if (!s || !candidates.length || tipsOff(s)) return null;
  const seen = seenTips(s);
  const id = candidates.find((c) => !seen.includes(c));
  if (!id) return null;
  try {
    s.setItem(TIPS_SEEN_KEY, JSON.stringify([...seen, id]));
  } catch {
    return null;
  }
  return id;
}
