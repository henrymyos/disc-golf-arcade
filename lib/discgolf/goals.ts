// ── "Something to chase": the menu's Next-goal card and the Daily streak.
// Pure + deterministic (no storage, no clock): callers pass in the player's
// progress and today's day index. ──
import { ACHIEVEMENTS } from "./engine";

// ── Daily streak ─────────────────────────────────────────────────────────────
// Days are the Daily Challenge's own day index (lib/discgolf/time: it rolls
// over at midnight Central, i.e. 10 or 11 pm in Arizona), so a Daily finished
// late in the evening counts for the same day as the course it was played on.

// Days on which that day's own Daily was finished: the per-day best to-par
// record, plus any day with Daily stars (stars predate the bests record, so this
// backfills older saves).
export function finishedDailyDays(dailyBests: Record<string, number> | undefined, dailyStars?: Record<string, number>): Set<number> {
  const out = new Set<number>();
  for (const k of Object.keys(dailyBests ?? {})) if (Number.isFinite(Number(k))) out.add(Number(k));
  for (const [k, v] of Object.entries(dailyStars ?? {})) if (v > 0 && Number.isFinite(Number(k))) out.add(Number(k));
  return out;
}

// Days in a row with a finished Daily, counting back from today. Until today's
// Daily is played, a streak that ran through yesterday is still alive (and is
// what the button shows); one missed day resets it to 0.
export function dailyStreak(history: Iterable<number>, today: number): number {
  const days = new Set(history);
  let d = days.has(today) ? today : today - 1;
  let n = 0;
  while (days.has(d)) { n++; d--; }
  return n;
}

// ── Next goal ────────────────────────────────────────────────────────────────
export type GoalRound = { mode: string; total: number; scores?: number[]; pars?: number[] };

export type GoalProgress = {
  level: { level: number; into: number; need: number };
  nextLevelHasDisc: boolean;   // reaching the next level offers a disc pick
  achievements: string[];      // earned achievement ids
  rounds: GoalRound[];         // recorded full rounds (history)
  roundsPlayed: number;
  todayStars: number;          // 0–3 stars banked on today's Daily
  resetLabel?: string;         // e.g. "resets 10 PM your time"
};

export type Goal = {
  id: string;                  // stable per goal (changes when the goal moves on)
  kind: "level" | "achievement" | "daily";
  emoji: string;
  title: string;
  detail: string;
  progress: number;            // 0..1 toward this goal
};

const relOf = (r: GoalRound) => (r.scores ?? []).map((s, i) => (s != null && r.pars?.[i] != null ? s - r.pars[i] : 99));

// Progress (0..1) toward an achievement from what the player has already done.
// One-off feats (an ace, an eagle, finishing a tour course…) have no partial
// progress and count as 0.
export function achievementProgress(id: string, p: Pick<GoalProgress, "rounds" | "roundsPlayed">): { progress: number; detail: string } {
  const rounds = p.rounds.filter((r) => r.scores?.length && r.pars?.length);
  const best = (f: (r: GoalRound) => number) => rounds.reduce((m, r) => Math.max(m, f(r)), 0);
  const count = (n: number, target: number, unit: string) => ({ progress: Math.min(1, n / target), detail: `${Math.min(n, target)}/${target} ${unit}` });
  switch (id) {
    case "regular": return count(p.roundsPlayed, 5, "rounds");
    case "veteran": return count(p.roundsPlayed, 25, "rounds");
    case "centurion": return count(p.roundsPlayed, 100, "rounds");
    case "fivebirdies": return count(best((r) => relOf(r).filter((d) => d <= -1).length), 5, "birdies in a round (your best)");
    case "birdiestreak": return count(best((r) => { let run = 0, top = 0; for (const d of relOf(r)) { run = d <= -1 ? run + 1 : 0; top = Math.max(top, run); } return top; }), 3, "birdies in a row (your best)");
    case "hotstart": return count(best((r) => { let n = 0; for (const d of relOf(r).slice(0, 3)) { if (d <= -1) n++; else break; } return n; }), 3, "opening birdies (your best)");
    case "bogeyfree9":
    case "bogeyfree18": {
      const target = id === "bogeyfree9" ? 9 : 18;
      const run = best((r) => { let cur = 0, top = 0; for (const d of relOf(r)) { cur = d <= 0 ? cur + 1 : 0; top = Math.max(top, cur); } return top; });
      return count(run, target, "holes without a bogey (your best)");
    }
    case "evenpar": case "underpar": case "lowround": case "subten": {
      const target = { evenpar: 0, underpar: -1, lowround: -5, subten: -10 }[id];
      const toPars = rounds.map((r) => r.total - (r.pars ?? []).reduce((s, n) => s + n, 0));
      if (!toPars.length) return { progress: 0, detail: "Finish a round to start" };
      const b = Math.min(...toPars);
      const fmt = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
      // Within 10 strokes of the target counts as partial progress.
      return { progress: Math.max(0, Math.min(1, 1 - (b - target) / 10)), detail: `Best round ${fmt(b)}, need ${fmt(target)}` };
    }
    default: return { progress: 0, detail: "" };
  }
}

// The closest of: the next level reward, the nearest unearned achievement, and
// today's Daily stars still missing. "Closest" = most progress already made;
// ties go to the Daily (it resets tonight), then the level, then achievements.
export function nextGoal(p: GoalProgress): Goal | null {
  const cands: Goal[] = [];
  if (p.todayStars < 3) {
    const left = 3 - p.todayStars;
    cands.push({
      id: `daily-stars-${p.todayStars}`, kind: "daily", emoji: "⭐",
      title: p.todayStars === 0 ? "Earn today's Daily stars" : `${left} more Daily star${left === 1 ? "" : "s"} today`,
      detail: `${p.todayStars}/3 stars · ${p.resetLabel ?? "resets tonight"}`,
      progress: p.todayStars / 3,
    });
  }
  const next = p.level.level + 1;
  cands.push({
    id: `level-${next}`, kind: "level", emoji: "🆙",
    title: p.nextLevelHasDisc ? `Reach level ${next} and pick a new disc` : `Reach level ${next}`,
    detail: `${Math.max(0, p.level.need - p.level.into)} XP to go · about 100 XP a round`,
    progress: p.level.need > 0 ? Math.min(1, p.level.into / p.level.need) : 0,
  });
  let bestAch: Goal | null = null;
  for (const a of ACHIEVEMENTS) {
    if (p.achievements.includes(a.id)) continue;
    const ap = achievementProgress(a.id, p);
    if (!bestAch || ap.progress > bestAch.progress) {
      bestAch = { id: `ach-${a.id}`, kind: "achievement", emoji: a.emoji, title: a.name, detail: ap.detail || a.desc, progress: ap.progress };
    }
  }
  if (bestAch) cands.push(bestAch);
  const order: Goal["kind"][] = ["daily", "level", "achievement"];
  cands.sort((x, y) => y.progress - x.progress || order.indexOf(x.kind) - order.indexOf(y.kind));
  return cands[0] ?? null;
}

// Did the player just finish `goal`? (Used to toast a completed goal.)
export function goalComplete(goal: Goal, p: GoalProgress): boolean {
  if (goal.kind === "achievement") return p.achievements.includes(goal.id.slice(4));
  if (goal.kind === "level") return p.level.level >= Number(goal.id.slice(6));
  return p.todayStars > Number(goal.id.slice("daily-stars-".length));
}
