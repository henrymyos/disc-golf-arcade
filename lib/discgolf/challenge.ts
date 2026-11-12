// Challenge links: ?ch=<mode>.<seed>.<score>.<name> replays the exact same round
// (same pins + wind, derived from the seed) so two players can compare fairly.
// Shared by the game component (read + build), the home-page metadata, and the
// OG image route — so the parsing/formatting stays in one place.
import { TOTAL_PAR, WINTHROP_PAR, OLYMPUS_PAR, TOUR_COURSES, buildRound, isProTourSeed, proTourCourseBySeed, tourVenue, type Mode } from "./engine";
import { SEASON_2026 } from "./protour/season2026";

export type ParsedChallenge = {
  mode: Mode;
  seed: number;
  score: number;
  name: string;
  par: number;
  over: number;
  overStr: string;
  courseLabel: string;
  stop?: string;            // "Stop 14 · USWDGC" for a real Pro Tour course
};

// Tour links only name a known course (a real Pro Tour course or one of the
// Arcade's own tour venues), so a crafted seed can't make the server build
// arbitrary layouts for the preview.
export function isChallengeTourSeed(seed: number): boolean {
  return isProTourSeed(seed) || TOUR_COURSES.some((c) => c.seed >>> 0 === seed >>> 0);
}

export function proTourStop(seed: number): string | undefined {
  const pro = proTourCourseBySeed(seed);
  const row = pro && SEASON_2026.find((s) => s.courses.some((c) => c.id === pro.course.id));
  return row ? `Stop ${row.stop} · ${row.event}` : undefined;
}

const overLabel = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
export function courseLabelFor(mode: Mode): string {
  return mode === "course" ? "Glendoveer East" : mode === "winthrop" ? "Winthrop Lake" : mode === "olympus" ? "Olympus" : "the Daily Challenge";
}

// Par for a finished round on a course (the daily varies per seed).
export function parForChallenge(mode: Mode, seed: number): number {
  if (mode === "course") return TOTAL_PAR;
  if (mode === "winthrop") return WINTHROP_PAR;
  if (mode === "olympus") return OLYMPUS_PAR;
  if (mode === "tour") return buildRound(seed, "tour").reduce((s, h) => s + h.par, 0);
  return buildRound(seed, "daily").reduce((s, h) => s + h.par, 0);
}

export function parseChallenge(raw: string | null | undefined): ParsedChallenge | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length < 3) return null;
  const [m, seedS, scoreS] = parts;
  const nameS = parts.slice(3).join("."); // the name may itself contain dots
  const seed = Number(seedS);
  const score = Number(scoreS);
  if (m !== "course" && m !== "winthrop" && m !== "olympus" && m !== "daily" && m !== "tour") return null;
  if (!Number.isInteger(seed) || !Number.isInteger(score) || score <= 0 || score > 999) return null;
  if (m === "tour" && !isChallengeTourSeed(seed)) return null;
  // A crafted/garbled link can carry malformed percent-encoding, which makes
  // decodeURIComponent throw. parseChallenge runs server-side (page metadata +
  // OG image) so an unguarded throw would crash those routes — fall back safely.
  let name = "A friend";
  try {
    name = decodeURIComponent(nameS ?? "").slice(0, 16) || "A friend";
  } catch {
    name = "A friend";
  }
  const par = parForChallenge(m, seed);
  const over = score - par;
  const courseLabel = m === "tour" ? tourVenue(seed) : courseLabelFor(m);
  return { mode: m, seed, score, name, par, over, overStr: overLabel(over), courseLabel, ...(m === "tour" ? { stop: proTourStop(seed) } : {}) };
}

// Build the `ch` query value for a finished round.
export function challengeParam(mode: Mode, seed: number, score: number, name: string): string {
  const clean = (name || "A friend").trim().slice(0, 16) || "A friend";
  // encodeURIComponent leaves "." unescaped, which would collide with our field
  // delimiter and truncate dotted names — escape it so they survive round-trip.
  return `${mode}.${seed}.${score}.${encodeURIComponent(clean).replace(/\./g, "%2E")}`;
}
