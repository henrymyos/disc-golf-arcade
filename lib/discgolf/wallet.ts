// ── Coins economy + daily rewards. Coins are a global currency (separate from
// the Career's cash) earned by playing, claiming the daily reward, and the
// practice mini-games, and spent in the disc shop. Pure + deterministic. ──

const DAY_MS = 86_400_000;
export function dayNumber(now: number): number {
  return Math.floor(now / DAY_MS);
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

// Coins earned for finishing a counting round, by how far under par you went.
export function coinsForRound(toPar: number, holes: number): number {
  const base = holes >= 18 ? 30 : 15;
  const under = Math.max(0, -toPar);
  return base + under * 6;
}

export function fmtCoins(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(0)}k`;
  return `${n}`;
}
