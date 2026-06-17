// Recurring weekly events: a small rotating set of challenges that refreshes
// every week and pays coins. Which three show up is a deterministic function of
// the week number, and progress is read straight from saved round history — no
// extra per-event counters to persist. Claimed rewards live in the shared
// `owned` set under an "event:<week>:<id>" key so they cloud-sync and can't be
// double-claimed.

const WEEK_MS = 7 * 86_400_000;

// A finished round as stored in history (the fields events care about).
export type EventRound = { mode: string; total: number; date: number; scores?: number[]; pars?: number[] };

export type WeeklyChallenge = {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  reward: number;
  goal: number;
  // Progress toward the goal given this week's rounds (clamped by the caller).
  measure: (rows: EventRound[]) => number;
};

// Count holes across this week's rounds matching a per-hole predicate.
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

function isUnderPar(r: EventRound): boolean {
  if (!r.pars) return false;
  const par = r.pars.reduce((s, n) => s + (n ?? 0), 0);
  return r.total < par;
}

// The full pool; three are surfaced each week.
const POOL: WeeklyChallenge[] = [
  { id: "play3", emoji: "🏌", title: "Weekend Warrior", desc: "Play 3 rounds this week", reward: 150, goal: 3, measure: (rows) => rows.length },
  { id: "play5", emoji: "💪", title: "Grinder", desc: "Play 5 rounds this week", reward: 250, goal: 5, measure: (rows) => rows.length },
  { id: "underpar", emoji: "🔽", title: "Go Low", desc: "Finish a round under par", reward: 200, goal: 1, measure: (rows) => rows.filter(isUnderPar).length },
  { id: "birdies5", emoji: "🐦", title: "Birdie Hunter", desc: "Card 5 birdies this week", reward: 200, goal: 5, measure: (rows) => countHoles(rows, (s, p) => s - p === -1) },
  { id: "ace1", emoji: "🎯", title: "Hole in One", desc: "Throw an ace", reward: 350, goal: 1, measure: (rows) => countHoles(rows, (s) => s === 1) },
  { id: "eagle1", emoji: "🦅", title: "Soaring", desc: "Score an eagle or better", reward: 300, goal: 1, measure: (rows) => countHoles(rows, (s, p) => s - p <= -2) },
  { id: "ranked1", emoji: "🏅", title: "Enter the Ladder", desc: "Play a ranked round", reward: 150, goal: 1, measure: (rows) => rows.filter((r) => r.mode === "ranked").length },
  { id: "daily1", emoji: "🔥", title: "Daily Devotee", desc: "Complete a Daily Challenge", reward: 150, goal: 1, measure: (rows) => rows.filter((r) => r.mode === "daily").length },
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

// The three challenges for a given week (stable for that week, rotating across
// weeks via a seeded shuffle of the pool).
export function weeklyChallenges(week: number): WeeklyChallenge[] {
  const rand = rng32((week ^ 0x9e3779b9) >>> 0);
  const order = POOL.map((c, i) => ({ c, k: rand() + i * 0 }));
  order.sort((a, b) => a.k - b.k);
  return order.slice(0, 3).map((o) => o.c);
}

// Rounds played within the current week window (UTC), from history.
export function roundsThisWeek(history: EventRound[], week: number): EventRound[] {
  const start = week * WEEK_MS;
  const end = start + WEEK_MS;
  return history.filter((r) => typeof r.date === "number" && r.date >= start && r.date < end);
}

export function challengeDone(c: WeeklyChallenge, rows: EventRound[]): boolean {
  return c.measure(rows) >= c.goal;
}

// Owned-set key used to mark a week's challenge reward as claimed.
export function eventClaimKey(week: number, id: string): string {
  return `event:${week}:${id}`;
}
