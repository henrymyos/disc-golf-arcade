// ── Career mode. Create a kid, grow four skills over decades, and climb from
// junior events through high school, college (the College Nationals at Winthrop
// Lake), and the pro tour. Events can be SIMULATED from your skills or PLAYED
// as real rounds (your skills change how the disc flies — see skillMods). All
// logic here is pure + deterministic so it's testable and resumes cleanly. ──
import { mulberry32, CATCH_R, TOTAL_PAR, WINTHROP_PAR, type Mode } from "./engine";

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
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const TRAIN_PER_SEASON = 6;
const RESULT_CAP = 120;

export function newCareer(name: string, seed: number): Career {
  const rng = mulberry32((seed ^ 0x5bd1e995) >>> 0);
  const talent = rng(); // 0..1 overall ceiling shift
  const pot = (base: number) => Math.round(clamp(base + talent * 26 + rng() * 16, 40, 99));
  const start = (lo: number, hi: number) => Math.round(lo + rng() * (hi - lo));
  const skills: CareerSkills = { power: start(14, 24), control: start(16, 26), putt: start(16, 26), mental: start(20, 30) };
  const potential: CareerSkills = {
    power: Math.max(skills.power + 15, pot(58)),
    control: Math.max(skills.control + 15, pot(58)),
    putt: Math.max(skills.putt + 15, pot(58)),
    mental: Math.max(skills.mental + 12, pot(55)),
  };
  return {
    v: 1, name: name.trim().slice(0, 16) || "Rookie", seed: seed >>> 0,
    age: 10, season: 0, stage: "youth", skills, potential, trainPts: TRAIN_PER_SEASON,
    done: [], results: [], titles: [], seasonPoints: 0, careerPoints: 0, majors: 0,
    worldRank: null, bestWorldRank: null, seasonsAtNo1: 0, achievements: [], retired: false,
  };
}

function parForMode(mode: Mode): { par: number; holes: number } {
  if (mode === "winthrop") return { par: WINTHROP_PAR, holes: 18 };
  if (mode === "course") return { par: TOTAL_PAR, holes: 18 };
  return { par: 27, holes: 9 }; // daily-style 9-hole event (par ~27)
}

// The events on offer this season, by stage. Deterministic from seed + season.
export function seasonSchedule(c: Career): CareerEvent[] {
  const rng = mulberry32((c.seed * 2654435761 + c.season * 40503) >>> 0);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)];
  const ev = (id: string, name: string, mode: Mode, importance: CareerEvent["importance"], fieldSize: number, fieldMean: number): CareerEvent => {
    const { par, holes } = parForMode(mode);
    return { id: `${c.season}-${id}`, name, mode, holes, par, importance, fieldSize, fieldMean };
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
        ev("co1", pick(["Conference Opener", "Autumn Collegiate", "Sunbelt Showdown"]), "course", "minor", 28, 50 + ramp),
        ev("co2", "Conference Championship", "winthrop", "major", 32, 55 + ramp),
        ev("con", "College Nationals", "winthrop", "championship", 36, 60 + ramp),
      ];
    case "pro": {
      const out: CareerEvent[] = [
        ev("pt1", pick(["Spring Open", "Maple Hill Tour Stop", "Emerald Cup", "Music City Open"]), pick(["course", "daily"]) as Mode, "minor", 72, 66 + ramp * 0.4),
        ev("pt2", pick(["Ledgestone Open", "Discraft Classic", "Portland Open"]), "course", "minor", 72, 68 + ramp * 0.4),
        ev("maj", pick(["The Memorial Major", "European Open", "Pro Worlds Qualifier"]), "winthrop", "major", 90, 72 + ramp * 0.4),
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

// Record a finished event (played or simmed). Returns a new career + the result.
export function recordResult(c: Career, ev: CareerEvent, score: number, played: boolean): { career: Career; result: EventResult } {
  const field = genField(c, ev);
  const { placed, field: fieldN } = placeInField(field, score);
  const win = placed === 1;
  const result: EventResult = {
    eventId: ev.id, name: ev.name, season: c.season, age: c.age, stage: c.stage,
    score, toPar: score - ev.par, placed, field: fieldN, played, win,
  };
  const impMult = ev.importance === "championship" ? 3 : ev.importance === "major" ? 2 : 1;
  const points = Math.max(0, fieldN - placed + 1) * impMult;
  const titles = win ? [...c.titles, { name: ev.name, season: c.season, age: c.age, importance: ev.importance }] : c.titles;
  const ach = new Set(c.achievements);
  if (win) ach.add("first_win");
  if (win && ev.id.endsWith("con")) ach.add("college_champ");
  if (win && ev.id.endsWith("wc")) ach.add("world_champ");
  if (win && ev.importance !== "minor") ach.add("big_title");
  const career: Career = {
    ...c,
    done: [...c.done, ev.id],
    results: [...c.results, result].slice(-RESULT_CAP),
    titles,
    seasonPoints: c.seasonPoints + points,
    careerPoints: c.careerPoints + points,
    majors: c.majors + (win && ev.importance !== "minor" ? 1 : 0),
    achievements: [...ach],
  };
  return { career, result };
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

  let career: Career = {
    ...c, age, season: c.season + 1, stage, skills,
    trainPts: TRAIN_PER_SEASON, done: [], seasonPoints: 0,
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

export function placeLabel(placed: number): string {
  if (placed === 1) return "🥇 Win";
  if (placed === 2) return "🥈 2nd";
  if (placed === 3) return "🥉 3rd";
  const s = placed % 10, t = placed % 100;
  const suf = s === 1 && t !== 11 ? "st" : s === 2 && t !== 12 ? "nd" : s === 3 && t !== 13 ? "rd" : "th";
  return `${placed}${suf}`;
}
