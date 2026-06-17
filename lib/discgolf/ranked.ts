// Async global ranked ladder. Rather than fragile real-time matchmaking, every
// player competes on the SAME procedurally-generated 18-hole course for a given
// week (seeded by the week number), and their scores land on a shared weekly
// leaderboard that resets each week. A persistent rank-point (RP) total carries
// across weeks and maps to a tier, giving a sense of climbing a ladder.

const WEEK_MS = 7 * 86_400_000;

// The week bucket (UTC) — everyone in the same week plays the same ranked course.
export function weekSeed(now: number): number {
  return Math.floor(now / WEEK_MS);
}

// Leaderboard key for a ranked week (mirrors leaderboardCourse's `daily-N`).
export function rankedCourseKey(week: number): string {
  return `ranked-${week}`;
}

// Per-round RP: a par round is worth a solid chunk; going low pays much more,
// blowing up still pays a little so a ranked attempt is never wasted.
export function roundRP(toPar: number): number {
  return Math.max(10, Math.round(60 - toPar * 12));
}

export type RankedState = {
  rp: number;            // lifetime rank points (only ever climbs)
  bestToPar: number | null; // best (lowest) to-par on any ranked round
  rounds: number;        // ranked rounds completed
};

export const EMPTY_RANKED: RankedState = { rp: 0, bestToPar: null, rounds: 0 };

// Apply a finished ranked round to a player's ranked state.
export function applyRankedRound(state: RankedState | null, toPar: number): RankedState {
  const s = state ?? EMPTY_RANKED;
  return {
    rp: s.rp + roundRP(toPar),
    bestToPar: s.bestToPar == null ? toPar : Math.min(s.bestToPar, toPar),
    rounds: s.rounds + 1,
  };
}

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
