// Leaderboard board keys. Every course that can post a score must be listed
// here — the server action refuses anything else, so adding a course to the
// engine without adding it here silently breaks "save round" for that course
// (that's exactly what happened with Olympus).
export const FIXED_COURSE_BOARDS = ["glendoveer", "winthrop", "olympus"] as const;

export function isValidCourse(course: string): boolean {
  return (FIXED_COURSE_BOARDS as readonly string[]).includes(course)
    || /^daily-\d{1,7}$/.test(course)
    || /^ranked-\d{1,7}$/.test(course)
    || /^tour-\d{1,10}$/.test(course);
}
