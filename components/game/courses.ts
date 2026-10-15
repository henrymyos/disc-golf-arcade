import { TOTAL_PAR, WINTHROP_PAR, OLYMPUS_PAR, TOUR_COURSES, type Mode } from "@/lib/discgolf/engine";


// Every fixed course in the app (shown on the "Challenge the Arcade" page). Add new
// hand-authored courses here. `seed` is set for procedural pro-tour venues
// (mode "tour"); the two hand-authored layouts need none.
export type CourseInfo = { mode: Mode; name: string; holes: number; par: number; blurb: string; seed?: number };
export const FIXED_COURSES: CourseInfo[] = [
  { mode: "course", name: "Glendoveer East", holes: 18, par: TOTAL_PAR, blurb: "The Northwest's championship test. A central pond squeezes the front nine, hard doglegs bend around mature firs, and tree-gate greens punish anything but a clean approach — precision off the tee is everything here." },
  { mode: "winthrop", name: "Winthrop Lake", holes: 18, par: WINTHROP_PAR, blurb: "Host of College Nationals. The lake hugs the entire front side and forces nervy water carries, while the middle stretch is rope-hazard golf where one stray throw costs a stroke. A run of long par-4s on the back decides it." },
  { mode: "olympus", name: "Olympus", holes: 18, par: OLYMPUS_PAR, blurb: "Home of the Supreme Flight Open, carved through Florida forest over a limestone quarry. Marked OB lines every corridor, cliff pockets flank the greens, and the round ends with a nervy carry to the island green on 18." },
];
// A character-driven opening line per venue style. The concrete hole stats
// (par mix, water/sand, length) get woven in below to finish the description.
export const TOUR_STYLE_INTRO: Record<string, string> = {
  "Wooded": "A tree-choked layout where every fairway threads tight gaps in the pines",
  "Water-laden": "Water is the constant here — forced carries and nervy layups around ponds at nearly every turn",
  "Links (open & windy)": "A wide-open links with almost no trees, where the gusting wind does all the defending",
  "Sandy": "A desert-style course raked with sand traps that swallow anything short or wide of the line",
  "Tight & technical": "A shot-maker's puzzle of narrow, tree-lined corridors that demand a precise line off every tee",
  "Parkland": "A classic parkland layout of rolling, generous fairways and well-guarded tree-gate greens",
};
// The standalone pro-tour venues — the same procedural courses the Career tour
// visits, now playable on their own. Each blurb is pure flavor: the venue's
// character vibe plus fabricated background — a founding note, an architect, and
// a reputation line — picked deterministically per seed so every stop reads like
// it has its own history. The real hole count + par live in the card header.
export const TOUR_FOUNDED = [
  "Carved out of a retired cattle ranch in 1971",
  "Laid along an old railway easement in 1985",
  "Opened to little fanfare in 1963 and quietly beloved ever since",
  "Built over reclaimed quarry land in 1978",
  "Grown from nine holes behind a lumber mill in 1958",
  "Stitched through a former apple orchard in 1990",
  "Founded by a co-op of local players in 1969",
  "Rebuilt from a storm-flattened parkland in 2004",
];
export const TOUR_ARCHITECT = [
  "its routing credited to pro-turned-designer Cal Rourke",
  "shaped at the drafting table of Marta Lindqvist",
  "given its teeth by old-school course-builder 'Big' Ted Halloran",
  "the final project of green-designer Idris Fontaine",
  "reworked into a championship test by the Vance & Ojeda firm",
  "bearing the bold, risk-reward signature of Priya Naganathan",
  "quietly redrawn by minimalist architect Sun-woo Park",
  "an unnamed groundskeeper's design the pros later fell for",
];
export const TOUR_REPUTATION = [
  "The tour circles it on the calendar and dreads the closing stretch.",
  "Locals swear its back nine has never given up an easy birdie.",
  "It has a habit of chewing up overnight leaders on Sunday.",
  "Careers are made and unmade on its signature island green.",
  "A fan favorite — loud, raucous, and unforgiving by the final round.",
  "Rain or shine it plays mean, a true ball-striker's proving ground.",
  "Clubhouse legend says no one has ever shot the course record twice.",
  "Every pro leaves here with a story about the one that got away.",
];
export const TOUR_COURSE_INFOS: CourseInfo[] = TOUR_COURSES.map((c) => {
  const intro = TOUR_STYLE_INTRO[c.character] ?? "A varied championship layout that rewards all-round play";
  const pick = (arr: string[], salt: number) => arr[((c.seed >>> salt) >>> 0) % arr.length];
  const blurb = `${intro}. ${pick(TOUR_FOUNDED, 0)}, ${pick(TOUR_ARCHITECT, 9)}. ${pick(TOUR_REPUTATION, 15)}`;
  return { mode: "tour" as Mode, name: c.name, holes: c.holes, par: c.par, seed: c.seed, blurb };
});
// Courses you can host in a Challenge Friends lobby: the two fixed venues plus
// every pro-tour course you've been given. The rotating Daily is intentionally
// excluded — it isn't a fixed, re-pickable venue, and a lobby needs a course the
// host can choose by name and broadcast to everyone.
export const CHALLENGE_COURSES: CourseInfo[] = [...FIXED_COURSES, ...TOUR_COURSE_INFOS];
export const challengeKey = (c: CourseInfo) => (c.seed != null ? `tour-${c.seed}` : c.mode);
