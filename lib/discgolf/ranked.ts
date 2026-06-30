// Ranked ladder. Every ranked round is a FRESH 18-hole course played against a
// field of AI opponents whose strength scales with your tier — so each round is a
// real competition you place in, and you can play as many as you like. Your
// finishing POSITION drives your rank points (RP): win big, mid-pack treads water,
// the back half loses points. A persistent RP total maps to a climbing tier, and
// consecutive podium finishes build a streak for bonus RP. A single global
// best-to-par board (comparable across the fresh courses) is the secondary chase.

import { centralWeek } from "./time";

// The week bucket — rolls over at midnight Central on Sunday (see lib/discgolf/time).
// Kept for the weekly board-key shape + back-compat.
export function weekSeed(now: number): number {
  return centralWeek(now);
}

// Leaderboard key for a ranked week (mirrors leaderboardCourse's `daily-N`).
export function rankedCourseKey(week: number): string {
  return `ranked-${week}`;
}

// The single global ranked board is an ALL-TIME best-to-par board — comparable
// across the fresh per-round courses (raw strokes aren't). `ranked-0` reuses the
// allowed `ranked-N` key shape; to-par is stored as `toPar + OFFSET` so it lands
// in the board's positive stroke range and "lowest wins" still means best to-par.
export const RANKED_BOARD_KEY = "ranked-0";
export const RANKED_PAR_OFFSET = 100;
export function encodeToParScore(toPar: number): number { return Math.round(toPar) + RANKED_PAR_OFFSET; }
export function decodeToParScore(stored: number): number { return stored - RANKED_PAR_OFFSET; }

// A ranked round is a small CARD: you + this many AI opponents = a field of 5.
export const RANKED_FIELD = 4;

// ── Placement. Your first PLACEMENT_ROUNDS ranked rounds are calibration rounds:
// instead of grinding up from Bronze, you play a wide field that spans the whole
// ladder (ratings ~40–90, see rankedPlacementField), and where you FINISH maps
// straight back to a starting rank. So a strong player is placed near their true
// level immediately rather than farming a soft tier. A projected rank shows after
// round 1 and refines (running average) until it locks in. ──
export const PLACEMENT_ROUNDS = 3;
export const PLACEMENT_MIN_RATING = 40; // bottom of the round-1 calibration field's rating span
export const PLACEMENT_MAX_RATING = 90; // top of it — beat ~everyone here ⇒ Master
// Placement bots play this many strokes better than their rating implies, so a
// rank has to be earned: you must out-play the division you're tested against,
// not merely keep pace with it. Higher ⇒ harder to climb (esp. to Master).
export const PLACEMENT_EDGE = 7;

export type Tier = { key: string; name: string; emoji: string; color: string; min: number };

// Climbing tiers, each gated by a lifetime-RP threshold.
export const TIERS: Tier[] = [
  { key: "bronze", name: "Bronze", emoji: "🥉", color: "#cd7f32", min: 0 },
  { key: "silver", name: "Silver", emoji: "🥈", color: "#c0c0c0", min: 400 },
  { key: "gold", name: "Gold", emoji: "🥇", color: "#f5d24a", min: 1000 },
  { key: "platinum", name: "Platinum", emoji: "💠", color: "#5fe6d2", min: 2000 },
  { key: "diamond", name: "Diamond", emoji: "💎", color: "#6cb6ff", min: 3500 },
  { key: "master", name: "Master", emoji: "👑", color: "#c084fc", min: 5500 },
];

// Resolve lifetime RP into the current tier plus progress toward the next one
// (next is null at the top tier).
export function tierFromRP(rp: number): { tier: Tier; next: Tier | null; into: number; need: number } {
  const x = Math.max(0, rp);
  let idx = 0;
  for (let i = 0; i < TIERS.length; i++) if (x >= TIERS[i].min) idx = i;
  const tier = TIERS[idx];
  const next = TIERS[idx + 1] ?? null;
  const into = x - tier.min;
  const need = next ? next.min - tier.min : 0;
  return { tier, next, into, need };
}
function tierIndex(rp: number): number {
  return TIERS.indexOf(tierFromRP(rp).tier);
}

// Opponent field strength (mean rating, ~0..99) by tier — Bronze fields are
// beatable, Master fields are near-pro. So as you climb, the competition stiffens
// and your placement naturally settles at your real skill level (the ladder
// self-gates instead of letting anyone grind to the top).
export function rankedFieldMean(rp: number): number {
  const byTier: Record<string, number> = { bronze: 42, silver: 54, gold: 64, platinum: 72, diamond: 80, master: 88 };
  const t = tierFromRP(rp);
  const base = byTier[t.tier.key] ?? 60;
  // Nudge up within a tier as you near the next, so progress feels continuous.
  const within = t.need ? (t.into / t.need) * 4 : 0;
  return base + within;
}

// RP for finishing `place` in a ranked card of `field` (a card is 5 — you + 4).
// Symmetric around the middle place: the top half GAINS (1st the most), the exact
// middle is neutral, the bottom half LOSES (last the most). For a 5-card that's
// 1st +50, 2nd +25, 3rd 0, 4th −25, 5th −50.
export const RANKED_WIN_RP = 50;
export function placementRP(place: number, field: number): number {
  const mid = (field + 1) / 2; // the neutral place (3 in a 5-card)
  if (mid <= 1) return 0;
  const stepsFromMid = mid - place; // + above the middle, − below it
  return Math.round(stepsFromMid * (RANKED_WIN_RP / (mid - 1)));
}

// A podium (top-2 — the RP-gaining places) finish extends your streak; each
// consecutive one adds an escalating bonus (capped), rewarding hot runs.
// streak 1 → 0, 2 → +10 … cap +50.
export function streakBonus(streak: number): number {
  return Math.min(50, Math.max(0, streak - 1) * 10);
}

export type RankedState = {
  rp: number;            // lifetime rank points — rises with strong finishes, falls with weak ones (floored at 0)
  bestToPar: number | null; // best (lowest) to-par on any ranked round
  rounds: number;        // ranked rounds completed
  streak: number;        // current consecutive-podium (top-2) streak
  bestStreak: number;    // longest podium streak reached
  wins: number;          // 1st-place finishes
  podiums: number;       // top-2 finishes
  placed: boolean;       // true once placement (the calibration rounds) is complete
  placeEstimates: number[]; // per-placement-round RP estimates → the projected rank
};

export const EMPTY_RANKED: RankedState = { rp: 0, bestToPar: null, rounds: 0, streak: 0, bestStreak: 0, wins: 0, podiums: 0, placed: false, placeEstimates: [] };

// Fill in any fields a legacy/partial saved state is missing (older saves only had
// rp/bestToPar/rounds), so the ladder keeps working across the upgrade.
export function normalizeRanked(state: Partial<RankedState> | null | undefined): RankedState {
  const s = state ?? {};
  return {
    rp: Math.max(0, s.rp ?? 0),
    bestToPar: typeof s.bestToPar === "number" ? s.bestToPar : null,
    rounds: s.rounds ?? 0,
    streak: s.streak ?? 0,
    bestStreak: s.bestStreak ?? 0,
    wins: s.wins ?? 0,
    podiums: s.podiums ?? 0,
    // A save without the `placed` flag predates placement — re-run it so existing
    // players also get calibrated to their true rank (their stats are kept).
    placed: typeof s.placed === "boolean" ? s.placed : false,
    placeEstimates: Array.isArray(s.placeEstimates) ? s.placeEstimates.slice(0, PLACEMENT_ROUNDS) : [],
  };
}

export type RankedResult = {
  place: number;
  field: number;
  toPar: number;
  rpDelta: number;     // total RP change (placement + streak bonus)
  base: number;        // placement RP
  bonus: number;       // streak bonus
  podium: boolean;     // finished top 2 (gained RP)
  win: boolean;        // finished 1st
  streak: number;      // streak AFTER this round
  tierUp: boolean;     // crossed up into a new tier
  tierDown: boolean;   // dropped a tier
};

// Apply a finished ranked round (your `place` of `field`, and your `toPar`) to the
// ladder. RP can drop on a poor finish but never below 0 — Bronze is the floor.
export function applyRankedRound(state: RankedState | null, place: number, field: number, toPar: number): { state: RankedState; result: RankedResult } {
  const s = normalizeRanked(state);
  const podium = place <= 2; // top 2 gain RP — that's the "podium" on a 5-card
  const win = place === 1;
  const streak = podium ? s.streak + 1 : 0;
  const base = placementRP(place, field);
  const bonus = podium ? streakBonus(streak) : 0;
  const rpDelta = base + bonus;
  const beforeIdx = tierIndex(s.rp);
  const rp = Math.max(0, s.rp + rpDelta);
  const afterIdx = tierIndex(rp);
  const next: RankedState = {
    rp,
    bestToPar: s.bestToPar == null ? toPar : Math.min(s.bestToPar, toPar),
    rounds: s.rounds + 1,
    streak,
    bestStreak: Math.max(s.bestStreak, streak),
    wins: s.wins + (win ? 1 : 0),
    podiums: s.podiums + (podium ? 1 : 0),
    placed: s.placed, // already past placement when this runs
    placeEstimates: s.placeEstimates,
  };
  const result: RankedResult = {
    place, field, toPar, rpDelta, base, bonus, podium, win, streak,
    tierUp: afterIdx > beforeIdx,
    tierDown: afterIdx < beforeIdx,
  };
  return { state: next, result };
}

// Map an estimated internal skill rating (~40–90) to lifetime RP, anchored so a
// tier's mean rating lands mid-tier. Inverse-ish of rankedFieldMean — it turns a
// placement finish into a starting rank. Extends linearly past either end.
const RP_ANCHORS: [number, number][] = [
  [42, 200],  // Bronze mean → mid-Bronze
  [54, 700],  // Silver
  [64, 1500], // Gold
  [72, 2750], // Platinum
  [80, 4500], // Diamond
  [88, 6500], // Master
];
export function rpFromRating(rating: number): number {
  const a = RP_ANCHORS;
  const lerp = (r0: number, p0: number, r1: number, p1: number) => p0 + ((rating - r0) / (r1 - r0)) * (p1 - p0);
  if (rating <= a[0][0]) return Math.max(0, Math.round(lerp(a[0][0], a[0][1], a[1][0], a[1][1])));
  for (let i = 1; i < a.length; i++) if (rating <= a[i][0]) return Math.round(lerp(a[i - 1][0], a[i - 1][1], a[i][0], a[i][1]));
  const n = a.length;
  return Math.round(lerp(a[n - 2][0], a[n - 2][1], a[n - 1][0], a[n - 1][1]));
}

export type PlacementResult = {
  placement: true;     // discriminates this from a normal RankedResult
  round: number;       // which placement round this was (1..PLACEMENT_ROUNDS)
  rounds: number;      // PLACEMENT_ROUNDS (total)
  remaining: number;   // placement rounds left after this one
  placed: boolean;     // true once placement completed on this round
  place: number;
  field: number;
  toPar: number;
  projectedRp: number; // running-average RP estimate → the projected rank
  tier: Tier;          // the tier projectedRp falls in
};

// A placement (calibration) round. Read your level from where you finished in the
// wide calibration field — your finishing fraction maps straight back onto the
// field's rating span (PLACEMENT_*_RATING), so beating the weak third ≈ Bronze and
// beating nearly everyone ≈ Master. Fold the estimate into the running average and
// lock in a starting rank once PLACEMENT_ROUNDS are in. Streak stays dormant until
// you're ranked; wins/podiums and best-to-par still count.
// `lo`/`hi` are the rating span of the field you actually played: the full ladder
// [40, 90] on round 1, then your projected division's band (tier mean ±14) on the
// rounds after — so where you finish maps back onto that band. Because the bots
// carry PLACEMENT_EDGE, you out-finish fewer of them than your raw rating would,
// which is exactly what makes a high rank harder to reach.
export function applyPlacementRound(state: RankedState | null, place: number, field: number, toPar: number, lo = PLACEMENT_MIN_RATING, hi = PLACEMENT_MAX_RATING): { state: RankedState; result: PlacementResult } {
  const s = normalizeRanked(state);
  const frac = field <= 1 ? 1 : (field - place) / (field - 1); // 1 = beat everyone → 0 = last
  const estRating = lo + frac * (hi - lo);
  const estimate = rpFromRating(estRating);
  const placeEstimates = [...s.placeEstimates, estimate].slice(0, PLACEMENT_ROUNDS);
  const projectedRp = Math.round(placeEstimates.reduce((a, b) => a + b, 0) / placeEstimates.length);
  const placed = placeEstimates.length >= PLACEMENT_ROUNDS;
  const next: RankedState = {
    ...s,
    rp: projectedRp,
    placed,
    placeEstimates,
    rounds: s.rounds + 1,
    bestToPar: s.bestToPar == null ? toPar : Math.min(s.bestToPar, toPar),
    wins: s.wins + (place === 1 ? 1 : 0),
    podiums: s.podiums + (place <= 2 ? 1 : 0),
  };
  const result: PlacementResult = {
    placement: true,
    round: placeEstimates.length,
    rounds: PLACEMENT_ROUNDS,
    remaining: PLACEMENT_ROUNDS - placeEstimates.length,
    placed,
    place, field, toPar,
    projectedRp,
    tier: tierFromRP(projectedRp).tier,
  };
  return { state: next, result };
}
