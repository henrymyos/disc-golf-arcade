// Recurring challenges that pay coins. There are two cadences:
//   • DAILY  — three easy objectives that refresh every day.
//   • WEEKLY — three harder objectives that refresh every week.
// Which three show up is a deterministic function of the day/week number, and
// progress is read straight from saved round history — no extra per-challenge
// counters to persist. Claimed rewards live in the shared `owned` set under a
// "daily:<day>:<id>" / "event:<week>:<id>" key so they cloud-sync and can't be
// double-claimed.

import { centralDayRange, centralWeekRange } from "./time";

// A finished round as stored in history (the fields challenges care about).
export type EventRound = { mode: string; total: number; date: number; scores?: number[]; pars?: number[] };

export type Challenge = {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  reward: number;
  goal: number;
  // Progress toward the goal given the window's rounds (clamped by the caller).
  measure: (rows: EventRound[]) => number;
};
// Back-compat alias.
export type WeeklyChallenge = Challenge;

// Count holes across a window's rounds matching a per-hole predicate.
function countHoles(rows: EventRound[], pred: (score: number, par: number) => boolean): number {
  let n = 0;
  for (const r of rows) {
    if (!r.scores || !r.pars) continue;
    r.scores.forEach((s, i) => {
      const p = r.pars![i];
      if (typeof s === "number" && typeof p === "number" && pred(s, p)) n++;
    });
  }
  return n;
}

function toPar(r: EventRound): number | null {
  if (!r.pars) return null;
  const par = r.pars.reduce((s, n) => s + (n ?? 0), 0);
  return r.total - par;
}
function isUnderPar(r: EventRound): boolean {
  const d = toPar(r);
  return d != null && d < 0;
}

// ── Daily pool: three surfaced per day. (ids kept stable across difficulty
// tweaks so in-progress claims aren't disrupted.) ──
const DAILY_POOL: Challenge[] = [
  { id: "play2", emoji: "🏌", title: "Range Day", desc: "Play 4 rounds today", reward: 160, goal: 4, measure: (rows) => rows.length },
  { id: "play4", emoji: "💪", title: "Marathon", desc: "Play 8 rounds today", reward: 300, goal: 8, measure: (rows) => rows.length },
  { id: "underpar", emoji: "🔽", title: "Go Low", desc: "Finish 2 rounds under par", reward: 250, goal: 2, measure: (rows) => rows.filter(isUnderPar).length },
  { id: "evenpar", emoji: "🟢", title: "Steady", desc: "Finish 2 rounds at par or better", reward: 180, goal: 2, measure: (rows) => rows.filter((r) => { const d = toPar(r); return d != null && d <= 0; }).length },
  { id: "birdies3", emoji: "🐦", title: "Birdie Hunter", desc: "Card 6 birdies today", reward: 220, goal: 6, measure: (rows) => countHoles(rows, (s, p) => s - p === -1) },
  { id: "ace1", emoji: "🎯", title: "Sharpshooter", desc: "Throw 2 aces", reward: 500, goal: 2, measure: (rows) => countHoles(rows, (s) => s === 1) },
  { id: "eagle1", emoji: "🦅", title: "Soaring", desc: "Score 2 eagles or better", reward: 350, goal: 2, measure: (rows) => countHoles(rows, (s, p) => s - p <= -2) },
  { id: "ranked1", emoji: "🏅", title: "On the Ladder", desc: "Play 2 ranked rounds", reward: 200, goal: 2, measure: (rows) => rows.filter((r) => r.mode === "ranked").length },
  { id: "daily1", emoji: "🔥", title: "Daily Devotee", desc: "Play the Daily Challenge twice", reward: 200, goal: 2, measure: (rows) => rows.filter((r) => r.mode === "daily").length },
];

// ── Weekly pool: heavier, longer-haul objectives, three surfaced per week. ──
const WEEKLY_POOL: Challenge[] = [
  { id: "wplay10", emoji: "🏌", title: "Frequent Flyer", desc: "Play 20 rounds this week", reward: 800, goal: 20, measure: (rows) => rows.length },
  { id: "wplay20", emoji: "💪", title: "Iron Arm", desc: "Play 40 rounds this week", reward: 1600, goal: 40, measure: (rows) => rows.length },
  { id: "wunderpar3", emoji: "🔽", title: "Under Pressure", desc: "Finish 6 rounds under par this week", reward: 900, goal: 6, measure: (rows) => rows.filter(isUnderPar).length },
  { id: "wbirdies20", emoji: "🐦", title: "Birdie Machine", desc: "Card 40 birdies this week", reward: 1000, goal: 40, measure: (rows) => countHoles(rows, (s, p) => s - p === -1) },
  { id: "weagle3", emoji: "🦅", title: "Sky High", desc: "Score 6 eagles or better this week", reward: 1100, goal: 6, measure: (rows) => countHoles(rows, (s, p) => s - p <= -2) },
  { id: "wace2", emoji: "🎯", title: "Deadeye", desc: "Throw 4 aces this week", reward: 2000, goal: 4, measure: (rows) => countHoles(rows, (s) => s === 1) },
  { id: "wlow10", emoji: "💎", title: "Double Digits", desc: "Finish 2 rounds 10-under or better", reward: 1400, goal: 2, measure: (rows) => rows.filter((r) => { const d = toPar(r); return d != null && d <= -10; }).length },
  { id: "wranked3", emoji: "🏅", title: "Ladder Climber", desc: "Play 6 ranked rounds this week", reward: 750, goal: 6, measure: (rows) => rows.filter((r) => r.mode === "ranked").length },
  { id: "wdaily5", emoji: "🔥", title: "Daily Streak", desc: "Complete 10 Daily Challenges this week", reward: 1000, goal: 10, measure: (rows) => rows.filter((r) => r.mode === "daily").length },
];

// Deterministic small PRNG (same family as the engine's mulberry32).
function rng32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// Seeded pick of `n` distinct challenges from a pool (stable for a given seed).
function pick(pool: Challenge[], seed: number, n: number): Challenge[] {
  const rand = rng32(seed >>> 0);
  return pool
    .map((c) => ({ c, k: rand() }))
    .sort((a, b) => a.k - b.k)
    .slice(0, n)
    .map((o) => o.c);
}

// The three challenges for a given day / week (stable within that window).
export function dailyChallenges(day: number): Challenge[] {
  return pick(DAILY_POOL, (day ^ 0x85ebca6b) >>> 0, 3);
}
export function weeklyChallenges(week: number): Challenge[] {
  return pick(WEEKLY_POOL, (week ^ 0x9e3779b9) >>> 0, 3);
}

// Rounds played within the current Central day / week window, from history.
// `date`s are UTC epoch ms; the window bounds come from the Central-time clock.
export function roundsThisDay(history: EventRound[], day: number): EventRound[] {
  const { start, end } = centralDayRange(day);
  return history.filter((r) => typeof r.date === "number" && r.date >= start && r.date < end);
}
export function roundsThisWeek(history: EventRound[], week: number): EventRound[] {
  const { start, end } = centralWeekRange(week);
  return history.filter((r) => typeof r.date === "number" && r.date >= start && r.date < end);
}

export function challengeDone(c: Challenge, rows: EventRound[]): boolean {
  return c.measure(rows) >= c.goal;
}

// Owned-set keys marking a window's challenge reward as claimed.
export function dailyClaimKey(day: number, id: string): string {
  return `daily:${day}:${id}`;
}
export function eventClaimKey(week: number, id: string): string {
  return `event:${week}:${id}`;
}
