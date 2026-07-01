// ── Coins economy + daily rewards. Coins are a global currency (separate from
// the Career's cash) earned by playing, claiming the daily reward, and the
// practice mini-games, and spent in the disc shop. Pure + deterministic. ──
import type { Mode } from "./engine";
import { centralDay } from "./time";

// The current day number, rolling over at midnight Central (see lib/discgolf/time).
export function dayNumber(now: number): number {
  return centralDay(now);
}

export type DailyReward = { day: number; streak: number };

// Coins for a daily claim at a given streak length: base + a growing streak
// bonus (capped), with a chunky bonus every 7th day.
export function dailyCoins(streak: number): number {
  return 50 + Math.min(Math.max(0, streak - 1), 6) * 15 + (streak > 0 && streak % 7 === 0 ? 150 : 0);
}

// Resolve a daily-reward claim. Returns null if today's reward is already taken.
export function claimDailyReward(daily: DailyReward | null, today: number): { reward: DailyReward; coins: number } | null {
  if (daily && daily.day >= today) return null; // already claimed (or clock skew)
  const streak = daily && daily.day === today - 1 ? daily.streak + 1 : 1; // consecutive day keeps the streak
  return { reward: { day: today, streak }, coins: dailyCoins(streak) };
}
export function dailyAvailable(daily: DailyReward | null, today: number): boolean {
  return !daily || daily.day < today;
}

// Harder, competitive modes pay a coin premium so each mode has its own
// economic identity instead of every round paying the same flat rate.
export function modeCoinMult(mode: Mode): number {
  switch (mode) {
    case "ranked":
      return 1.5;
    case "winthrop":
      return 1.4;
    case "tour":
      return 1.3;
    default:
      return 1; // course + daily
  }
}

// Coins earned for finishing a counting round, by how far under par you went,
// scaled by an optional mode/difficulty multiplier. `toPar` is guarded so a
// stray NaN can never poison the wallet balance.
export function coinsForRound(toPar: number, holes: number, mult = 1): number {
  const safeToPar = Number.isFinite(toPar) ? toPar : 0;
  const base = holes >= 18 ? 30 : 15;
  const under = Math.max(0, -safeToPar);
  return Math.round((base + under * 6) * mult);
}

export function fmtCoins(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `${n}`;
}
