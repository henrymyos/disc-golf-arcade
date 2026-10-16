// What a season-list stop card shows. A stop can have more than one built course
// (Green Mountain: Brewster Ridge + Fox Run Meadows), so the card can't just read
// the first one: it says "2 courses" and shows the best of the course with the
// most stars (ties: the lowest score vs par), naming that course.
import { courseStars, proTourCourseById, type ProTourCourse } from "../engine";
import type { ProStop } from "./season2026";

export type StopSummary = {
  built: ProTourCourse[]; // playable courses, in the stop's listed order
  courseLabel: string | null; // "par 61 · 9,293 ft", or "2 courses"; null if nothing is built
  best: { course: ProTourCourse; best: number; stars: number } | null; // null: none played yet
  bestNamed: boolean; // name the course next to the best (multi-course stops)
};

export function builtCourses(s: ProStop): ProTourCourse[] {
  return s.courses.filter((c) => c.built).map((c) => proTourCourseById(c.id)).filter((c): c is ProTourCourse => !!c);
}

export function stopSummary(s: ProStop, bests: Record<number, number>): StopSummary {
  const built = builtCourses(s);
  const courseLabel = built.length === 0 ? null : built.length > 1 ? `${built.length} courses` : `par ${built[0].par} · ${built[0].lengthFt.toLocaleString("en-US")} ft`;
  let best: StopSummary["best"] = null;
  for (const c of built) {
    const b = bests[c.seed];
    if (b == null) continue;
    const stars = courseStars(b, c.par);
    if (!best || stars > best.stars || (stars === best.stars && b - c.par < best.best - best.course.par)) best = { course: c, best: b, stars };
  }
  return { built, courseLabel, best, bestNamed: built.length > 1 };
}
