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

// How many AI opponents fill a ranked round (you make it a field of N+1).
export const RANKED_FIELD = 24;

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

// RP for finishing `place` of `field` (1 = win). A win is a big gain, mid-pack is
// roughly neutral, the back half bleeds points — so only consistently strong
// finishes climb. Range ≈ −35 (last) … +55 (a full-field win).
export function placementRP(place: number, field: number): number {
  const frac = field <= 1 ? 1 : (field - place) / (field - 1); // 1 at a win → 0 at last
  return Math.round(-35 + frac * 90);
}

// A podium (top-3) finish extends your streak; each consecutive one adds an
// escalating bonus (capped), rewarding hot runs. streak 1 → 0, 2 → +10 … cap +50.
export function streakBonus(streak: number): number {
  return Math.min(50, Math.max(0, streak - 1) * 10);
}

export type RankedState = {
  rp: number;            // lifetime rank points — rises with strong finishes, falls with weak ones (floored at 0)
  bestToPar: number | null; // best (lowest) to-par on any ranked round
  rounds: number;        // ranked rounds completed
  streak: number;        // current consecutive-podium (top-3) streak
  bestStreak: number;    // longest podium streak reached
  wins: number;          // 1st-place finishes
  podiums: number;       // top-3 finishes
};

export const EMPTY_RANKED: RankedState = { rp: 0, bestToPar: null, rounds: 0, streak: 0, bestStreak: 0, wins: 0, podiums: 0 };

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
  };
}

export type RankedResult = {
  place: number;
  field: number;
  toPar: number;
  rpDelta: number;     // total RP change (placement + streak bonus)
  base: number;        // placement RP
  bonus: number;       // streak bonus
  podium: boolean;     // finished top 3
  win: boolean;        // finished 1st
  streak: number;      // streak AFTER this round
  tierUp: boolean;     // crossed up into a new tier
  tierDown: boolean;   // dropped a tier
};

// Apply a finished ranked round (your `place` of `field`, and your `toPar`) to the
// ladder. RP can drop on a poor finish but never below 0 — Bronze is the floor.
export function applyRankedRound(state: RankedState | null, place: number, field: number, toPar: number): { state: RankedState; result: RankedResult } {
  const s = normalizeRanked(state);
  const podium = place <= 3;
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
  };
  const result: RankedResult = {
    place, field, toPar, rpDelta, base, bonus, podium, win, streak,
    tierUp: afterIdx > beforeIdx,
    tierDown: afterIdx < beforeIdx,
  };
  return { state: next, result };
}
