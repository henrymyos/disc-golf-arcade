// Weekly Tour Stop: one real 2026 Pro Tour course per Central week (Sunday
// midnight Central, like the weekly goals), walking the built courses in season
// order, with its own leaderboard. Shared by the menu, the results screen and the
// server action that validates weekly posts (actions/arcade.ts).

import { proTourCourseById, type ProTourCourse } from "./engine";
import { SEASON_2026 } from "./protour/season2026";
import { centralWeek, centralWeekRange } from "./time";

// Week 2967 (Sun Nov 15 2026, Central) is stop 1 (Olympus).
const WEEKLY_EPOCH = 2967;
// A round that started before the Sunday rollover may still post to last
// week's board for this long after it closes.
export const WEEKLY_GRACE_MS = 60 * 60 * 1000;

// Built courses in season order (multi-course stops list every built course).
// shortcut: building a new course reshuffles the rotation from that deploy on;
// the board key carries the seed, so a mid-week change starts a fresh board
// instead of mixing two courses.
const ROTATION: ProTourCourse[] = SEASON_2026.flatMap((s) => s.courses.filter((c) => c.built))
  .map((c) => proTourCourseById(c.id))
  .filter((c): c is ProTourCourse => !!c);

export type WeeklyStop = {
  week: number;
  seed: number;
  name: string;
  city: string;
  par: number;
  key: string;    // leaderboard board key (the `course` column)
  start: number;  // UTC ms the week opens
  end: number;    // UTC ms it closes
};

export function weeklyStop(week: number): WeeklyStop {
  const n = ROTATION.length;
  const c = ROTATION[(((week - WEEKLY_EPOCH) % n) + n) % n];
  const { start, end } = centralWeekRange(week);
  return { week, seed: c.seed, name: c.course.name, city: c.course.city, par: c.par, key: `weekly-${week}-${c.seed}`, start, end };
}

export function currentWeeklyStop(now: number): WeeklyStop {
  return weeklyStop(centralWeek(now));
}

// The weekly board a round finished at `now` on `seed` posts to: this week's
// stop, or last week's within the grace hour. Null when the course isn't one.
export function weeklyStopForRound(seed: number | undefined, now: number): WeeklyStop | null {
  if (seed == null) return null;
  const cur = currentWeeklyStop(now);
  if (cur.seed === seed >>> 0) return cur;
  const prev = weeklyStop(cur.week - 1);
  return prev.seed === seed >>> 0 && now < prev.end + WEEKLY_GRACE_MS ? prev : null;
}

// Server check for a posted week: only this week's board, or last week's
// during the grace hour.
export function weekOpenForPosts(week: number, now: number): boolean {
  const cur = centralWeek(now);
  return week === cur || (week === cur - 1 && now < centralWeekRange(week).end + WEEKLY_GRACE_MS);
}

// Plausibility limits for a weekly card (a real round can't break these):
// one score per hole, each a whole number from 1 to MAX_HOLE, no hole more than
// 3 under par (an ace on a par 4), and at most 1.5 under par per hole overall.
// The game's best Daily rounds sit near 1 under per hole on short holes.
export const MAX_HOLE = 20;
export function weeklyCardError(scores: unknown, pars: number[]): string | null {
  if (!Array.isArray(scores) || scores.length !== pars.length) return "wrong hole count";
  for (let i = 0; i < pars.length; i++) {
    const s = scores[i];
    if (!Number.isInteger(s) || s < 1 || s > MAX_HOLE) return `hole ${i + 1} out of range`;
    if (s < pars[i] - 3) return `hole ${i + 1} too far under par`;
  }
  const toPar = (scores as number[]).reduce((a, b) => a + b, 0) - pars.reduce((a, b) => a + b, 0);
  if (toPar < -Math.floor(pars.length * 1.5)) return "total too far under par";
  return null;
}

// "3d 4h left" / "5h 12m left" / "12m left" until `end`; "closed" after it.
export function timeLeftLabel(end: number, now: number): string {
  if (now >= end) return "closed";
  const m = Math.floor((end - now) / 60_000);
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${mm}m left`;
  return `${mm}m left`;
}
