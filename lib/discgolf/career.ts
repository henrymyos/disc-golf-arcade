// ── Career mode. Create a kid, grow four skills over decades, and climb from
// junior events through high school, college (the College Nationals at Winthrop
// Lake), and the pro tour. Events can be SIMULATED from your skills or PLAYED
// as real rounds (your skills change how the disc flies — see skillMods). All
// logic here is pure + deterministic so it's testable and resumes cleanly. ──
import { mulberry32, CATCH_R, TOTAL_PAR, WINTHROP_PAR, tourPars, tourCharacter, type Mode, type TournLiveRow, type GhostRacer } from "./engine";

export type CareerSkills = { power: number; control: number; putt: number; mental: number };
export const SKILL_KEYS: (keyof CareerSkills)[] = ["power", "control", "putt", "mental"];
export const SKILL_LABEL: Record<keyof CareerSkills, string> = {
  power: "Power", control: "Control", putt: "Putting", mental: "Mental",
};

// How skills bend the real game when you PLAY an event.
export type SkillMods = { speedMul: number; catchR: number; windMul: number };
export const IDENTITY_MODS: SkillMods = { speedMul: 1, catchR: CATCH_R, windMul: 1 };
export function skillMods(s: CareerSkills): SkillMods {
  return {
    speedMul: 0.8 + (clamp(s.power) / 100) * 0.42, // a kid carries ~30% short; a maxed pro bombs it
    catchR: CATCH_R * (0.7 + (clamp(s.putt) / 100) * 0.62), // small catch radius → harder to hole out
    windMul: 1.3 - (clamp(s.control) / 100) * 0.85, // low control → the wind shoves you around
  };
}

// One overall number (0..100) used for simulated results + world ranking.
export function careerRating(s: CareerSkills): number {
  return 0.32 * s.power + 0.26 * s.control + 0.3 * s.putt + 0.12 * s.mental;
}

export type CareerStage = "youth" | "highschool" | "college" | "pro" | "retired";
export const STAGE_LABEL: Record<CareerStage, string> = {
  youth: "Junior", highschool: "High School", college: "College", pro: "Pro Tour", retired: "Retired",
};

export type CareerEvent = {
  id: string;
  name: string;
  mode: Mode;       // course played if you choose to play it
  holes: number;    // 9 (daily) or 18
  par: number;
  importance: "minor" | "major" | "championship";
  fieldSize: number;
  fieldMean: number; // mean rating of the field
  seed?: number;    // course seed (for generated "tour" venues)
  venue?: string;   // venue name for generated tour courses
  character?: string; // venue personality (wooded, water-laden, links, …)
  emoji?: string;
};

export type EventResult = {
  eventId: string;
  name: string;
  season: number;
  age: number;
  stage: CareerStage;
  score: number;
  toPar: number;
  placed: number;
  field: number;
  played: boolean; // played manually vs simulated
  win: boolean;
  beatRivals: number; // how many of your recurring rivals you outscored
  rivalCount: number;
  winnerName?: string; // a rival's name if a rival took the event
  prize: number; // cash earned (pro events only)
};

// ── Recurring rivals: a fixed generation of named players who turn up at every
// event and grow alongside you across the decades. You build a head-to-head
// record, and when you PLAY an event they appear as ghost discs on the course. ──
export type Rival = {
  id: string;
  name: string;
  color: string;
  skills: CareerSkills;
  potential: CareerSkills;
  titles: number;
  beat: number; // events where you outscored them
  lost: number; // events where they outscored you
  pdgaRating: number;     // tracked just like yours (lagged round average) — comparable
  roundRatings: number[];
};

// ── Sponsorships + economy: prize money (pro), sponsor signing bonuses and
// per-season stipends, and cash you spend on extra training. ──
export type Sponsor = {
  id: string;
  name: string;
  tier: number; // 1 local … 4 global
  signing: number; // one-time cash on signing
  stipend: number; // cash per season
  coach: boolean; // grants +1 training point each season
  reqRating: number; // skill rating needed to be offered
  reqStage: CareerStage; // earliest stage offered
};

export type Career = {
  v: 1;
  name: string;
  seed: number;
  age: number;
  season: number; // 0-based seasons elapsed
  stage: CareerStage;
  skills: CareerSkills;
  potential: CareerSkills; // per-skill soft caps
  trainPts: number; // points to spend on training this season
  done: string[]; // event ids completed this season
  results: EventResult[]; // career history (capped)
  titles: { name: string; season: number; age: number; importance: CareerEvent["importance"] }[];
  seasonPoints: number;
  careerPoints: number;
  majors: number;
  worldRank: number | null;
  bestWorldRank: number | null;
  seasonsAtNo1: number;
  achievements: string[];
  retired: boolean;
  cash: number;
  sponsors: Sponsor[];
  rivals: Rival[];
  pdgaRating: number;     // official rating (≈700–1050), tracks recent rounds
  roundRatings: number[]; // recent rated rounds (oldest → newest)
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const TRAIN_PER_SEASON = 6;
const RESULT_CAP = 120;
const N_RIVALS = 6;
const RIVAL_NAMES = [
  "Mateo Cruz", "Jaylen Park", "Owen Fitch", "Diego Salas", "Kai Brennan", "Theo Vance",
  "Niko Adeyemi", "Cole Rasmussen", "Eli Tanaka", "Marcus Hale", "Felix Romero", "Asher Quinn",
];
const RIVAL_PALETTE = ["#e23b7b", "#5fb0e8", "#b85cd6", "#e2a13b", "#36D7B7", "#f5d24a"];

// Sponsors unlock by reputation (rating + stage). Sign up to 3.
const SPONSOR_CAP = 3;
const SPONSOR_POOL: Sponsor[] = [
  { id: "localdisc", name: "Hometown Disc Shop", tier: 1, signing: 200, stipend: 150, coach: false, reqRating: 0, reqStage: "highschool" },
  { id: "campusgear", name: "Campus Gear Co.", tier: 1, signing: 500, stipend: 400, coach: true, reqRating: 38, reqStage: "highschool" },
  { id: "fairwayfoods", name: "Fairway Foods", tier: 2, signing: 1500, stipend: 1200, coach: false, reqRating: 50, reqStage: "college" },
  { id: "apexdiscs", name: "Apex Discs", tier: 2, signing: 4000, stipend: 3000, coach: true, reqRating: 58, reqStage: "college" },
  { id: "voltathletic", name: "Volt Athletic", tier: 3, signing: 15000, stipend: 12000, coach: false, reqRating: 66, reqStage: "pro" },
  { id: "summitdiscs", name: "Summit Discs", tier: 3, signing: 30000, stipend: 22000, coach: true, reqRating: 72, reqStage: "pro" },
  { id: "global", name: "Global Sportswear", tier: 4, signing: 90000, stipend: 60000, coach: true, reqRating: 80, reqStage: "pro" },
];

// One generation of named rivals, born deterministically from the seed. A spread
// of ceilings: a couple are future stars, most are solid, a few are journeymen.
function generateRivals(seed: number): Rival[] {
  const rng = mulberry32((seed ^ 0x1d2c6f3b) >>> 0);
  const names = [...RIVAL_NAMES];
  // deterministic shuffle
  for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
  return Array.from({ length: N_RIVALS }, (_, i) => {
    const talent = rng(); // some rivals are simply more gifted
    const potBase = 50 + talent * 45; // 50..95 ceiling
    const pot = (b: number) => Math.round(clamp(potBase + (rng() * 2 - 1) * 8 + b, 40, 99));
    const start = (lo: number, hi: number) => Math.round(lo + rng() * (hi - lo));
    const skills: CareerSkills = { power: start(15, 26), control: start(15, 26), putt: start(15, 26), mental: start(18, 30) };
    const potential: CareerSkills = {
      power: Math.max(skills.power + 14, pot(2)), control: Math.max(skills.control + 14, pot(0)),
      putt: Math.max(skills.putt + 14, pot(0)), mental: Math.max(skills.mental + 12, pot(-4)),
    };
    return { id: `r${i}`, name: names[i], color: RIVAL_PALETTE[i % RIVAL_PALETTE.length], skills, potential, titles: 0, beat: 0, lost: 0, pdgaRating: pdgaFromInternal(careerRating(skills)), roundRatings: [] };
  });
}

// ── PDGA rating (real-world scale ≈ 700–1050). An internal 0–100 skill maps to
// a player rating; each rated round produces a round rating from your score, and
// the player rating is a recency-weighted average of recent rounds — so it
// climbs slowly as you post better tournament rounds, like the real thing. ──
const RATED_WINDOW = 16; // rounds kept in the rating window
// Internal skill (0–100) → PDGA rating, via anchor points tuned so a typical
// career hits the real milestones: ~800 starting high school (internal ~28),
// ~900 starting college (~64), ~1000 turning pro (~81), elite peaks ~1050.
const PDGA_ANCHORS: [number, number][] = [[0, 700], [28, 800], [48, 900], [70, 1000], [88, 1050], [105, 1075]];
function pdgaFromInternal(internal: number): number {
  const x = Math.max(0, internal);
  for (let i = 1; i < PDGA_ANCHORS.length; i++) {
    const [x1, y1] = PDGA_ANCHORS[i];
    if (x <= x1) {
      const [x0, y0] = PDGA_ANCHORS[i - 1];
      return Math.round(y0 + (y1 - y0) * (x - x0) / (x1 - x0));
    }
  }
  return PDGA_ANCHORS[PDGA_ANCHORS.length - 1][1];
}
// A single round's rating from how far under/over par you went (course "SSA" is
// implicit — every event is calibrated the same way).
function roundRating(toPar: number, holes: number): number {
  const effective = 50 - toPar / (0.28 * (holes / 18));
  return Math.max(650, Math.min(1085, pdgaFromInternal(effective)));
}
// Recency-weighted average of recent rounds (most-recent quarter double-weighted,
// PDGA-style); blended toward the skill estimate while you have few rounds.
function computePdga(rounds: number[], skillEstimate: number): number {
  if (rounds.length === 0) return skillEstimate;
  const n = rounds.length;
  const recent = Math.max(1, Math.round(n * 0.25));
  let sum = 0, w = 0;
  rounds.forEach((r, i) => { const weight = i >= n - recent ? 2 : 1; sum += r * weight; w += weight; });
  let avg = sum / w;
  if (n < 6) avg = (avg * n + skillEstimate * (6 - n)) / 6; // smooth the early career
  return Math.round(avg);
}

export function newCareer(name: string, seed: number): Career {
  const rng = mulberry32((seed ^ 0x5bd1e995) >>> 0);
  const talent = rng(); // 0..1 overall ceiling shift
  const pot = (base: number) => Math.round(clamp(base + talent * 26 + rng() * 16, 40, 99));
  const start = (lo: number, hi: number) => Math.round(lo + rng() * (hi - lo));
  // A high-school freshman: more developed than a 10-year-old, plenty of upside.
  const skills: CareerSkills = { power: start(22, 32), control: start(24, 34), putt: start(24, 34), mental: start(28, 38) };
  const potential: CareerSkills = {
    power: Math.max(skills.power + 15, pot(58)),
    control: Math.max(skills.control + 15, pot(58)),
    putt: Math.max(skills.putt + 15, pot(58)),
    mental: Math.max(skills.mental + 12, pot(55)),
  };
  return {
    v: 1, name: name.trim().slice(0, 16) || "Rookie", seed: seed >>> 0,
    age: 14, season: 0, stage: "highschool", skills, potential, trainPts: TRAIN_PER_SEASON,
    done: [], results: [], titles: [], seasonPoints: 0, careerPoints: 0, majors: 0,
    worldRank: null, bestWorldRank: null, seasonsAtNo1: 0, achievements: [], retired: false,
    cash: 0, sponsors: [], rivals: generateRivals(seed),
    pdgaRating: pdgaFromInternal(careerRating(skills)), roundRatings: [],
  };
}

// Backfill new fields on a save from before economy/rivals/PDGA existed.
export function normalizeCareer(c: Career): Career {
  let rivals = c.rivals;
  if (!rivals || rivals.length === 0) {
    rivals = generateRivals(c.seed);
    // age the rivals up to the career's current season so they're peers, not kids
    for (let s = 0; s < c.season; s++) rivals = rivals.map((r) => growRival(r, 11 + s));
  }
  rivals = rivals.map((r) => ({ ...r, pdgaRating: r.pdgaRating ?? pdgaFromInternal(rivalRating(r)), roundRatings: r.roundRatings ?? [] }));
  return {
    ...c, cash: c.cash ?? 0, sponsors: c.sponsors ?? [], rivals,
    pdgaRating: c.pdgaRating ?? pdgaFromInternal(careerRating(c.skills)),
    roundRatings: c.roundRatings ?? [],
  };
}

// PDGA rating expected for an internal skill level (used as the early-career seed).
export const pdgaEstimate = (s: CareerSkills): number => pdgaFromInternal(careerRating(s));

export const rivalRating = (r: Rival): number => careerRating(r.skills);

function parForMode(mode: Mode): { par: number; holes: number } {
  if (mode === "winthrop") return { par: WINTHROP_PAR, holes: 18 };
  if (mode === "course") return { par: TOTAL_PAR, holes: 18 };
  if (mode === "tour") return { par: 70, holes: 18 }; // placeholder; tour events set real par from the seed
  return { par: 27, holes: 9 }; // daily-style 9-hole event (par ~27)
}

// Named venues for generated pro "tour" courses. The seed picks one (and builds
// the actual 18 holes), so the pro tour visits many distinct courses a season.
const VENUE_NAMES = [
  "Pinecrest Ridge", "Granite Falls", "Harbor Pines", "Copperhead GC", "Whitetail Run",
  "Sandstone Mesa", "Cedar Hollow", "Iron Mountain", "Blue Heron Park", "Timber Ridge",
  "Cypress Bend", "Eagle Bluff", "Riverbend Commons", "Foxglove Meadows", "Lakeshore Links",
  "Birchwood Trace", "Coyote Canyon", "Maplewood Estate", "Silver Creek", "Thunder Valley",
  "Heron Marsh", "Oakmont Acres", "Sunset Dunes", "Wolf Ridge", "Aspen Glade", "Stonebriar",
];
function tourCourseSeed(careerSeed: number, fullId: string): number {
  return (careerSeed ^ hashId(fullId) ^ 0x51ed270b) >>> 0;
}
function tourVenue(seed: number): string {
  return VENUE_NAMES[seed % VENUE_NAMES.length];
}

// The events on offer this season, by stage. Deterministic from seed + season.
export function seasonSchedule(c: Career): CareerEvent[] {
  const rng = mulberry32((c.seed * 2654435761 + c.season * 40503) >>> 0);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)];
  const ev = (id: string, name: string, mode: Mode, importance: CareerEvent["importance"], fieldSize: number, fieldMean: number): CareerEvent => {
    const fullId = `${c.season}-${id}`;
    if (mode === "tour") {
      const seed = tourCourseSeed(c.seed, fullId);
      const par = tourPars(seed).reduce((a, b) => a + b, 0);
      const { character, emoji } = tourCharacter(seed);
      return { id: fullId, name, mode, holes: 18, par, importance, fieldSize, fieldMean, seed, venue: tourVenue(seed), character, emoji };
    }
    const { par, holes } = parForMode(mode);
    return { id: fullId, name, mode, holes, par, importance, fieldSize, fieldMean };
  };
  const ramp = c.season * 0.6; // the field slowly toughens season over season within a stage
  switch (c.stage) {
    case "youth":
      return [
        ev("jr1", "Junior Open", "daily", "minor", 12, 22 + ramp),
        ev("jrc", "Junior Championship", "daily", "championship", 16, 28 + ramp),
      ];
    case "highschool":
      return [
        ev("hs1", pick(["Eagle Invitational", "Hometown Classic", "Riverside Open"]), "daily", "minor", 20, 36 + ramp),
        ev("hs2", "Regional Qualifier", pick(["course", "daily"]) as Mode, "major", 24, 40 + ramp),
        ev("hss", "State Championship", "course", "championship", 28, 46 + ramp),
      ];
    case "college":
      return [
        ev("co1", pick(["Conference Opener", "Autumn Collegiate", "Sunbelt Showdown"]), "tour", "minor", 28, 50 + ramp),
        ev("co2", "Conference Championship", "winthrop", "major", 32, 55 + ramp),
        ev("con", "College Nationals", "winthrop", "championship", 36, 60 + ramp),
      ];
    case "pro": {
      // The pro tour rolls through a rotating slate of generated venues, with the
      // World Championship at classic Glendoveer every other season.
      const out: CareerEvent[] = [
        ev("pt1", pick(["Spring Open", "Maple Hill Tour Stop", "Emerald Cup", "Music City Open"]), "tour", "minor", 72, 66 + ramp * 0.4),
        ev("pt2", pick(["Ledgestone Open", "Discraft Classic", "Portland Open", "Las Vegas Challenge"]), "tour", "minor", 72, 68 + ramp * 0.4),
        ev("pt3", pick(["Jonesboro Open", "Texas States", "Kansas City Wide Open"]), "tour", "minor", 80, 70 + ramp * 0.4),
        ev("maj", pick(["The Memorial Major", "European Open", "Champions Cup"]), "tour", "major", 90, 72 + ramp * 0.4),
      ];
      // A World Championship lands every other season once you're established.
      if (c.season % 2 === 1) out.push(ev("wc", "World Championship", "course", "championship", 96, 76 + ramp * 0.4));
      return out;
    }
    default:
      return [];
  }
}

// Expected strokes for a rating on a course (better rating ⇒ lower), with noise.
function scoreFromRating(rating: number, ev: CareerEvent, rng: () => number): number {
  const toPar = (50 - rating) * 0.28 * (ev.holes / 18) + (rng() * 2 - 1) * 2.6;
  return Math.max(Math.round(ev.par * 0.5), Math.round(ev.par + toPar));
}

// The field's scores for an event (deterministic per career/season/event).
export function genField(c: Career, ev: CareerEvent): number[] {
  const rng = mulberry32((c.seed ^ hashId(ev.id) ^ 0x9e3779b9) >>> 0);
  const spread = 11;
  return Array.from({ length: ev.fieldSize }, () => {
    const r = clamp(ev.fieldMean + (rng() * 2 - 1) * spread, 5, 99);
    return scoreFromRating(r, ev, rng);
  });
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function placeInField(field: number[], yourScore: number): { placed: number; field: number } {
  const better = field.filter((s) => s < yourScore).length;
  return { placed: better + 1, field: field.length + 1 };
}

// Simulate an event from your skills (when you choose not to play it).
export function simEvent(c: Career, ev: CareerEvent): { score: number; field: number[] } {
  const rng = mulberry32((c.seed ^ hashId(ev.id) ^ 0x1234567) >>> 0);
  const score = scoreFromRating(careerRating(c.skills), ev, rng);
  return { score, field: genField(c, ev) };
}

// ── A simulated field with per-hole scores, so a Career event can show a live
// top-10 after each hole and an on-course "card" of playing partners, all
// consistent with the final placement (mirrors the tournament field). The
// rivals lead the array (in c.rivals order); anonymous pros fill the rest. ──
export type FieldPlayer = { name: string; isRival: boolean; color: string; holes: number[]; total: number };

const ANON_FIRST = ["A.", "B.", "C.", "D.", "E.", "G.", "H.", "J.", "K.", "L.", "M.", "N.", "P.", "R.", "S.", "T.", "V.", "W."];
const ANON_LAST = [
  "Holloway", "Nilsson", "Okafor", "Pereira", "Vasquez", "Hartman", "Lindberg", "Osei", "Behr", "Castellano",
  "Drummond", "Ferreira", "Grayson", "Halvorsen", "Ishikawa", "Koval", "Lindqvist", "Mensah", "Novak", "Pappas",
  "Quigley", "Rahman", "Solberg", "Tomlin", "Ueda", "Voss", "Whitaker", "Yamada", "Zielinski", "Abara",
  "Brandt", "Cienfuegos", "Dvorak", "Engel", "Fontaine", "Guerrero", "Haas", "Ibarra", "Jansen", "Kerr",
];
function anonName(seed: number, i: number): string {
  const h = (seed ^ Math.imul(i + 1, 2654435761)) >>> 0;
  return `${ANON_FIRST[h % ANON_FIRST.length]} ${ANON_LAST[(h >>> 5) % ANON_LAST.length]}`;
}
// Per-hole scores for a rating, summing to roughly scoreFromRating's total.
function simHoleScores(rating: number, ev: CareerEvent, rng: () => number): number[] {
  const parPerHole = ev.par / ev.holes;
  const perHoleToPar = (50 - rating) * 0.28 / 18;
  return Array.from({ length: ev.holes }, () => Math.max(1, Math.round(parPerHole + perHoleToPar + (rng() * 2 - 1) * 0.85)));
}
export function careerFieldHoles(c: Career, ev: CareerEvent): FieldPlayer[] {
  const field: FieldPlayer[] = c.rivals.map((r) => {
    const holes = simHoleScores(rivalRating(r), ev, mulberry32((c.seed ^ hashId(ev.id) ^ hashId(r.id)) >>> 0));
    return { name: r.name, isRival: true, color: r.color, holes, total: holes.reduce((a, b) => a + b, 0) };
  });
  const anonCount = Math.max(0, ev.fieldSize - c.rivals.length);
  const rng = mulberry32((c.seed ^ hashId(ev.id) ^ 0x9e3779b9) >>> 0);
  for (let i = 0; i < anonCount; i++) {
    const rating = clamp(ev.fieldMean + (rng() * 2 - 1) * 11, 5, 99);
    const holes = simHoleScores(rating, ev, rng);
    field.push({ name: anonName((c.seed ^ hashId(ev.id)) >>> 0, i), isRival: false, color: "#7a808a", holes, total: holes.reduce((a, b) => a + b, 0) });
  }
  return field;
}

// Your on-course "card": the three best-placed rivals you're grouped with.
export function careerCard(field: FieldPlayer[]): FieldPlayer[] {
  return field.filter((p) => p.isRival).sort((a, b) => a.total - b.total).slice(0, 3);
}
// The card as ghost racers for one hole (shot count = their score on that hole).
export function careerCardRacers(field: FieldPlayer[], holeIndex: number): GhostRacer[] {
  return careerCard(field).map((p) => ({ name: p.name.split(" ").pop() || p.name, color: p.color, shots: Math.max(1, p.holes[holeIndex] ?? 1) }));
}

// Live standings through `holesPlayed` holes (you + the whole field), sorted,
// to-par vs the actual cumulative par. Mirrors tournLiveStandings.
export function careerLiveStandings(field: FieldPlayer[], myName: string, myScores: number[], holesPlayed: number, parThru: number): TournLiveRow[] {
  const sum = (arr: number[]) => arr.slice(0, holesPlayed).reduce((a, b) => a + b, 0);
  const rows = [{ name: myName, total: myScores.slice(0, holesPlayed).reduce((a, b) => a + b, 0), you: true }];
  for (const p of field) rows.push({ name: p.name, total: sum(p.holes), you: false });
  rows.sort((a, b) => a.total - b.total);
  return rows.map((r, i) => ({ rank: i + 1, name: r.name, total: r.total, toPar: r.total - parThru, you: r.you }));
}

// Record a finished event (played or simmed). Folds in your recurring rivals
// (placement, head-to-head, who actually won), prize money, points + titles.
export function recordResult(c: Career, ev: CareerEvent, score: number, played: boolean): { career: Career; result: EventResult } {
  const field = careerFieldHoles(c, ev);
  const nRivals = c.rivals.length;
  const others = field.map((p) => p.total);
  const placed = 1 + others.filter((s) => s < score).length;
  const fieldN = others.length + 1;
  const win = placed === 1;
  const beatRivals = field.slice(0, nRivals).filter((p) => score < p.total).length;

  // Update each rival's head-to-head record; the event winner gets a title.
  const fieldMin = Math.min(score, ...others);
  let winnerName: string | undefined;
  let titleGiven = false;
  const rivals = c.rivals.map((r, i) => {
    const rTotal = field[i].total;
    const youBeat = score < rTotal;
    let titles = r.titles;
    if (!win && !titleGiven && rTotal === fieldMin && rTotal < score) { titles += 1; winnerName = r.name; titleGiven = true; }
    // Track each rival's PDGA the same way as yours (a recency-weighted round
    // average) so the numbers are directly comparable.
    const rRounds = [...(r.roundRatings ?? []), roundRating(rTotal - ev.par, ev.holes)].slice(-RATED_WINDOW);
    const rPdga = computePdga(rRounds, pdgaFromInternal(rivalRating(r)));
    return { ...r, beat: r.beat + (youBeat ? 1 : 0), lost: r.lost + (youBeat ? 0 : 1), titles, roundRatings: rRounds, pdgaRating: rPdga };
  });

  const prize = c.stage === "pro" ? prizeFor(ev, placed) : 0;
  const result: EventResult = {
    eventId: ev.id, name: ev.name, season: c.season, age: c.age, stage: c.stage,
    score, toPar: score - ev.par, placed, field: fieldN, played, win, beatRivals, rivalCount: c.rivals.length, winnerName, prize,
  };
  const impMult = ev.importance === "championship" ? 3 : ev.importance === "major" ? 2 : 1;
  const points = Math.max(0, fieldN - placed + 1) * impMult;
  const titles = win ? [...c.titles, { name: ev.name, season: c.season, age: c.age, importance: ev.importance }] : c.titles;
  const ach = new Set(c.achievements);
  if (win) ach.add("first_win");
  if (win && ev.id.endsWith("con")) ach.add("college_champ");
  if (win && ev.id.endsWith("wc")) ach.add("world_champ");
  if (win && ev.importance !== "minor") ach.add("big_title");

  // This round's rating → the recency-weighted PDGA rating creeps up over time.
  const roundRatings = [...c.roundRatings, roundRating(result.toPar, ev.holes)].slice(-RATED_WINDOW);
  const pdgaRating = computePdga(roundRatings, pdgaFromInternal(careerRating(c.skills)));
  if (pdgaRating >= 1000) ach.add("rated_1000");

  const career: Career = {
    ...c,
    done: [...c.done, ev.id],
    results: [...c.results, result].slice(-RESULT_CAP),
    titles, rivals,
    cash: c.cash + prize,
    seasonPoints: c.seasonPoints + points,
    careerPoints: c.careerPoints + points,
    majors: c.majors + (win && ev.importance !== "minor" ? 1 : 0),
    achievements: [...ach],
    roundRatings, pdgaRating,
  };
  return { career, result };
}

// Pro prize money: a purse by event tier, paid to roughly the top quarter.
function prizeFor(ev: CareerEvent, placed: number): number {
  const purse = ev.importance === "championship" ? 100000 : ev.importance === "major" ? 50000 : 15000;
  if (placed > Math.max(5, Math.floor(ev.fieldSize * 0.25))) return 0;
  return Math.round((purse * Math.pow(0.6, placed - 1)) / 100) * 100;
}

// Per-skill decline speed once you age past your prime (power fades fastest).
const DECLINE: CareerSkills = { power: 1.35, control: 0.95, putt: 0.7, mental: -0.2 };

function growSkill(skill: number, pot: number, age: number, invested: number, declineRate: number): number {
  if (age <= 30) {
    const youth = age < 15 ? 1.6 : age < 19 ? 1.3 : age < 24 ? 1.05 : 0.7;
    const room = Math.max(0, pot - skill);
    const natural = room * 0.1 * youth;
    const trained = invested * (1.7 + room * 0.015);
    return clamp(skill + natural + trained, 0, pot + 2);
  }
  // Past 30: gentle decline, softened by how much you train the skill.
  const loss = Math.max(0, (age - 30) * 0.55 * declineRate - invested * 0.45);
  return clamp(skill - loss, 8, pot + 2);
}

// Rivals improve on their own each season (a little focused work, no allocation).
function growRival(r: Rival, age: number): Rival {
  const focus = age <= 30 ? 1.2 : 0;
  const g = (k: keyof CareerSkills) => Math.round(growSkill(r.skills[k], r.potential[k], age, focus, DECLINE[k]));
  return { ...r, skills: { power: g("power"), control: g("control"), putt: g("putt"), mental: g("mental") } };
}

// World rank among a synthetic pro pool (pro stage only).
function computeWorldRank(c: Career): number {
  const rng = mulberry32((c.seed ^ 0xa5a5 ^ (c.season * 7919)) >>> 0);
  const POOL = 80;
  const me = careerRating(c.skills) + Math.min(40, c.seasonPoints) * 0.22;
  let better = 0;
  for (let i = 0; i < POOL; i++) {
    const r = clamp(70 + (rng() * 2 - 1) * 16, 30, 99) + rng() * 10;
    if (r > me) better++;
  }
  return better + 1;
}

// End the season: apply training + growth/decline, advance age + stage, refresh
// the schedule, update world rank, and surface notes for the season summary.
export function advanceSeason(c: Career, alloc: Partial<CareerSkills>): { career: Career; notes: string[] } {
  const notes: string[] = [];
  const age = c.age + 1;
  const skills: CareerSkills = {
    power: growSkill(c.skills.power, c.potential.power, age, alloc.power ?? 0, DECLINE.power),
    control: growSkill(c.skills.control, c.potential.control, age, alloc.control ?? 0, DECLINE.control),
    putt: growSkill(c.skills.putt, c.potential.putt, age, alloc.putt ?? 0, DECLINE.putt),
    mental: growSkill(c.skills.mental, c.potential.mental, age, alloc.mental ?? 0, DECLINE.mental),
  };
  SKILL_KEYS.forEach((k) => { skills[k] = Math.round(skills[k]); });

  let stage = c.stage;
  if (stage === "youth" && age >= 14) { stage = "highschool"; notes.push("🏫 You've started high school — the junior days are behind you."); }
  else if (stage === "highschool" && age >= 18) { stage = "college"; notes.push("🎓 Recruited to college! The college circuit — and Nationals at Winthrop Lake — awaits."); }
  else if (stage === "college" && age >= 22) {
    stage = "pro";
    const earned = c.titles.some((t) => t.importance !== "minor");
    notes.push(earned ? "🏆 You've turned PRO with your card earned on the strength of your college results." : "💪 You've turned PRO — time to prove it against the world's best.");
  }

  // Rivals age + improve alongside you; sponsors pay out; coaches add training.
  const rivals = c.rivals.map((r) => growRival(r, age));
  const stipend = c.sponsors.reduce((s, sp) => s + sp.stipend, 0);
  const coachPts = c.sponsors.filter((sp) => sp.coach).length;

  let career: Career = {
    ...c, age, season: c.season + 1, stage, skills, rivals,
    cash: c.cash + stipend,
    trainPts: TRAIN_PER_SEASON + coachPts, done: [], seasonPoints: 0,
  };

  if (stage === "pro") {
    const rank = computeWorldRank(career);
    career = {
      ...career,
      worldRank: rank,
      bestWorldRank: career.bestWorldRank == null ? rank : Math.min(career.bestWorldRank, rank),
      seasonsAtNo1: career.seasonsAtNo1 + (rank === 1 ? 1 : 0),
    };
    if (rank === 1 && c.worldRank !== 1) notes.push("👑 You've reached WORLD #1!");
    if (rank === 1) { const ach = new Set(career.achievements); ach.add("world_no1"); career.achievements = [...ach]; }
  }

  // Auto-retire once age and decline catch up; otherwise the player chooses.
  if (stage === "pro" && age >= 42) {
    career = { ...career, stage: "retired", retired: true };
    notes.push("🎬 A storied career comes to a close. Time to hang up the bag.");
  }
  return { career, notes };
}

export function retire(c: Career): Career {
  return { ...c, stage: "retired", retired: true };
}

// Whether the season can be wrapped up (all events resolved).
export function seasonComplete(c: Career): boolean {
  return seasonSchedule(c).every((e) => c.done.includes(e.id));
}

const STAGE_ORDER: CareerStage[] = ["youth", "highschool", "college", "pro", "retired"];

// ── Sponsorships ──
export { SPONSOR_CAP };
// Sponsor offers you currently qualify for (by rating + stage) and haven't signed.
export function availableSponsors(c: Career): Sponsor[] {
  if (c.sponsors.length >= SPONSOR_CAP || c.retired) return [];
  const rating = careerRating(c.skills);
  const reached = STAGE_ORDER.indexOf(c.stage);
  const signed = new Set(c.sponsors.map((s) => s.id));
  return SPONSOR_POOL.filter((s) => !signed.has(s.id) && rating >= s.reqRating && reached >= STAGE_ORDER.indexOf(s.reqStage));
}
export function signSponsor(c: Career, id: string): Career {
  if (c.sponsors.length >= SPONSOR_CAP) return c;
  const s = SPONSOR_POOL.find((x) => x.id === id);
  if (!s || c.sponsors.some((x) => x.id === id)) return c;
  return { ...c, sponsors: [...c.sponsors, s], cash: c.cash + s.signing };
}

// ── Economy: spend cash on extra training points (escalating cost per season) ──
function boughtThisSeason(c: Career): number {
  const coachPts = c.sponsors.filter((s) => s.coach).length;
  return Math.max(0, c.trainPts - (TRAIN_PER_SEASON + coachPts));
}
export function trainingPointCost(c: Career): number {
  const stageMult = c.stage === "pro" ? 2500 : c.stage === "college" ? 800 : c.stage === "highschool" ? 300 : 120;
  return stageMult * (boughtThisSeason(c) + 1);
}
export function buyTrainingPoint(c: Career): Career {
  const cost = trainingPointCost(c);
  if (c.cash < cost) return c;
  return { ...c, cash: c.cash - cost, trainPts: c.trainPts + 1 };
}

// Rivals sorted strongest-first (for the hub's rivals board).
export function topRivals(c: Career): Rival[] {
  return [...c.rivals].sort((a, b) => rivalRating(b) - rivalRating(a));
}

export function fmtCash(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${n}`;
}

export function placeLabel(placed: number): string {
  if (placed === 1) return "🥇 Win";
  if (placed === 2) return "🥈 2nd";
  if (placed === 3) return "🥉 3rd";
  const s = placed % 10, t = placed % 100;
  const suf = s === 1 && t !== 11 ? "st" : s === 2 && t !== 12 ? "nd" : s === 3 && t !== 13 ? "rd" : "th";
  return `${placed}${suf}`;
}
