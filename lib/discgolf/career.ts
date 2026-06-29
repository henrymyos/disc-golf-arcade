// ── Career mode. Create a kid, grow four skills over decades, and climb from
// junior events through high school, college (the College Nationals at Winthrop
// Lake), and the pro tour. Events can be SIMULATED from your skills or PLAYED
// as real rounds (your skills change how the disc flies — see skillMods). All
// logic here is pure + deterministic so it's testable and resumes cleanly. ──
import { mulberry32, CATCH_R, TOTAL_PAR, WINTHROP_PAR, tourPars, tourCharacter, tourVenue, discByKey, type Mode, type Hole, type TournLiveRow, type GhostRacer } from "./engine";

export type CareerSkills = { power: number; control: number; putt: number; stamina: number };
export const SKILL_KEYS: (keyof CareerSkills)[] = ["power", "control", "putt", "stamina"];
export const SKILL_LABEL: Record<keyof CareerSkills, string> = {
  power: "Power", control: "Control", putt: "Putting", stamina: "Stamina",
};
// What each skill does — shown in the hub so the benefit of training is obvious.
// Power/Control/Putt change how you PLAY a round; Stamina is an economy stat that
// sets how much season ENERGY you have to enter events (see seasonEnergy).
export const SKILL_DESC: Record<keyof CareerSkills, string> = {
  power: "Throw distance — 99 = full range",
  control: "Aim accuracy — low spreads your shots into a cone",
  putt: "Basket catch size — 99 = normal",
  stamina: "Season energy — more events you can enter each year (99 = the full slate)",
};

// How skills bend the real game when you PLAY an event. At 99 every skill plays
// exactly like normal (outside-career) golf; below 99 it gets harder:
//   power      → throw distance        (99 = full, lower = every shot is shorter)
//   putt       → basket catch radius   (99 = normal circle, lower = smaller)
//   control    → aim spread, a release cone (99 = dead-on your line, lower = wider)
//   stamina    → NOT an in-round effect — it sets your season energy pool (the
//                number of events you can afford to enter; see seasonEnergy).
export type SkillMods = { speedMul: number; catchR: number; windMul: number; aimSpread: number; birdieBoost: number; bogeyPenalty: number };
export const IDENTITY_MODS: SkillMods = { speedMul: 1, catchR: CATCH_R, windMul: 1, aimSpread: 0, birdieBoost: 0, bogeyPenalty: 0 };
export function skillMods(s: CareerSkills): SkillMods {
  const power = Math.min(1, clamp(s.power) / 99);
  const putt = Math.min(1, clamp(s.putt) / 99);
  const control = Math.min(1, clamp(s.control) / 99);
  return {
    speedMul: 0.74 + 0.26 * power,             // 0.74 (beginner, ~80% carry) … 1.0 (full range at 99)
    catchR: CATCH_R * (0.80 + 0.30 * putt),    // 0.80× (forgiving) … 1.1× normal at 99
    windMul: 1,                                 // wind hits you normally now (control no longer fights it)
    aimSpread: 0.20 * (1 - control),           // 0 rad (dead-on) … ~±11° cone — gentler on a rookie so trying hard pays off
    birdieBoost: 0,                             // momentum retired with the Mental skill — every hole is neutral
    bogeyPenalty: 0,
  };
}
// Momentum is retired (Stamina replaced Mental, which used to drive it). Every
// hole now plays neutral — kept as a stable 1 so existing callers don't change.
export function momentumAfter(_mods: SkillMods, _strokes: number, _par: number): number {
  return 1;
}

// Early-career courses play SHORT so a developing player can reach greens with a
// putter/midrange/fairway instead of needing a distance driver — easing back to
// full length by college. Scales every hole's length (see materializeHole's
// lenMul in the engine); 1 = normal. Junior + the first high-school seasons are
// the most forgiving, lengthening as you grow into the bag.
export function careerHoleLenScale(c: Career): number {
  if (c.stage === "youth") return 0.74;
  if (c.stage === "highschool") return Math.min(1, 0.84 + 0.04 * c.season); // ~0.84 (freshman) → ~0.96 (senior)
  return 1; // college + pro: full length
}

// One overall number (0..100) used for simulated results + world ranking. Stamina
// is an ENERGY/economy stat and does NOT make you shoot lower, so it's excluded —
// Overall is the weighted average of the three playing skills (sums to 1.0).
export function careerRating(s: CareerSkills): number {
  return 0.37 * s.power + 0.30 * s.control + 0.33 * s.putt;
}

// ── Energy: the season budget you spend to ENTER events. Bigger events cost more
// (and pay more), so you pick which/how many to play; a full slate always costs
// more than even a maxed pool, so there's always a choice. Stamina sets the pool. ──
export const EVENT_ENERGY: Record<CareerEvent["importance"], number> = { minor: 2, major: 3, championship: 4 };
export function eventEnergyCost(ev: CareerEvent): number {
  return EVENT_ENERGY[ev.importance];
}
// Season energy pool from Stamina: ~8 (untrained) … ~24 (maxed). Train Stamina to
// afford more events per season → more total coins/cash/training/rank.
export function seasonEnergy(stamina: number): number {
  return Math.round(8 + (clamp(stamina) / 99) * 16);
}
// Can you still afford to enter this event?
export function canEnterEvent(c: Career, ev: CareerEvent): boolean {
  return c.energy >= eventEnergyCost(ev);
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
  trainBonus: number; // extra training points earned for a strong finish
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
  tier: number; // 1 local … 4 global … 5 manufacturer (marquee, exclusive)
  signing: number; // one-time cash on signing
  stipend: number; // cash per season
  coach: boolean; // grants +1 training point each season
  reqRating: number; // skill rating needed to be offered
  reqStage: CareerStage; // earliest stage offered
  brand?: string; // a MANUFACTURER deal: locks your career bag to this disc brand only
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
  energy: number;         // season energy pool — spent to ENTER events (refilled each season from Stamina)
  sponsors: Sponsor[];
  sponsorBonusClaimed?: string[]; // sponsor ids whose one-time signing bonus has been paid (so dropping + re-signing can't farm it)
  rivals: Rival[];
  pdgaRating: number;     // official rating (≈700–1050), tracks recent rounds
  roundRatings: number[]; // recent rated rounds (oldest → newest)
  skillFrac?: CareerSkills; // sub-integer skill progress carried between seasons
  discs: string[];        // disc keys unlocked in THIS career (separate from your account)
  bag: string[];          // the ≤5 discs carried into career rounds
  rankPoints: number;     // rolling world-ranking points (decays each season)
  trainBought: number;    // training points bought with cash this season (escalating cost)
  cosmetics: string[];    // cosmetic own-keys bought with career cash (post-max sink)
  look: CareerLook;       // the cosmetics worn during Career rounds
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const RESULT_CAP = 120;
const N_RIVALS = 6;
const RIVAL_NAMES = [
  "Mateo Cruz", "Jaylen Park", "Owen Fitch", "Diego Salas", "Kai Brennan", "Theo Vance",
  "Niko Adeyemi", "Cole Rasmussen", "Eli Tanaka", "Marcus Hale", "Felix Romero", "Asher Quinn",
];
const RIVAL_PALETTE = ["#e23b7b", "#5fb0e8", "#b85cd6", "#e2a13b", "#36D7B7", "#f5d24a"];

// Sponsors unlock by reputation (rating + stage). Sign up to 3 — one of which can
// be a MANUFACTURER deal (Innova / Discraft): the marquee late-game contract that
// pays a fortune but locks your bag to that brand's discs only (see signSponsor).
const SPONSOR_CAP = 3;
const SPONSOR_POOL: Sponsor[] = [
  { id: "localdisc", name: "Hometown Disc Shop", tier: 1, signing: 200, stipend: 150, coach: false, reqRating: 0, reqStage: "highschool" },
  { id: "campusgear", name: "Campus Gear Co.", tier: 1, signing: 500, stipend: 400, coach: true, reqRating: 38, reqStage: "highschool" },
  { id: "fairwayfoods", name: "Fairway Foods", tier: 2, signing: 1500, stipend: 1200, coach: false, reqRating: 50, reqStage: "college" },
  { id: "apexdiscs", name: "Apex Discs", tier: 2, signing: 4000, stipend: 3000, coach: true, reqRating: 58, reqStage: "college" },
  { id: "voltathletic", name: "Volt Athletic", tier: 3, signing: 15000, stipend: 12000, coach: false, reqRating: 66, reqStage: "pro" },
  { id: "summitdiscs", name: "Summit Discs", tier: 3, signing: 30000, stipend: 22000, coach: true, reqRating: 72, reqStage: "pro" },
  { id: "global", name: "Global Sportswear", tier: 4, signing: 90000, stipend: 60000, coach: true, reqRating: 80, reqStage: "pro" },
  // Manufacturer deals — only a genuine top-tour pro lands one. Huge money + their
  // full disc lineup, but you carry ONLY their plastic from then on.
  { id: "innova", name: "Innova", tier: 5, signing: 220000, stipend: 140000, coach: true, reqRating: 82, reqStage: "pro", brand: "Innova" },
  { id: "discraft", name: "Discraft", tier: 5, signing: 220000, stipend: 140000, coach: true, reqRating: 82, reqStage: "pro", brand: "Discraft" },
];

// ── Career disc collection. Career mode runs its OWN disc progression, totally
// separate from your account: you start bare-bones (a putter + a midrange) and
// buy the rest from the Pro Shop with career cash as you climb the stages. None
// of it touches the discs you've unlocked on your main account. ──
export const CAREER_CORE_DISCS = ["aviar", "buzzz", "teebird"]; // every career begins here (putter, mid, fairway)
export const CAREER_BAG_MAX = 5;

// ── Career cosmetics: a post-max cash sink. Career runs its OWN cosmetic
// loadout (disc skin / basket / aim line / course theme / celebration / trail),
// bought with career cash and worn during Career rounds — entirely separate from
// the coins-bought cosmetics on your main account. Keys match the shared
// cosmetics catalog so the UI can render them; storage + spend live here. ──
export type CareerLook = { discSkin: string; basketSkin: string; aimStyle: string; groundTheme: string; celebration: string; trail: string };
export const DEFAULT_CAREER_LOOK: CareerLook = { discSkin: "white", basketSkin: "steel", aimStyle: "white", groundTheme: "classic", celebration: "classic", trail: "classic" };
type CareerDiscEntry = { key: string; cost: number };
// The whole shop is open from day one (like the normal game) — price is the only
// gate, so you save your amateur/scholarship cash and buy what you want. Tuned so
// the iconic Destroyer distance driver is affordable in your SECOND year with
// ordinary play (see amateurCash). (Teebird is a core starter, so it's never listed.)
const CAREER_DISC_SHOP: CareerDiscEntry[] = [
  // Putters + mids + control — cheap, bag-rounding molds.
  { key: "zone", cost: 300 },
  { key: "swarm", cost: 450 },
  { key: "harp", cost: 550 },
  { key: "roc", cost: 700 },
  // Fairways.
  { key: "river", cost: 1200 },
  { key: "firebird", cost: 1600 },
  { key: "pd", cost: 2200 },
  // Distance drivers. The Sidewinder is a cheap, understable FIRST driver any
  // player can afford before college (when the holes reach full length) — so a
  // played career is never hard-gated by the disc economy on the long courses.
  // The rest stay save-up goals that reward placing well.
  { key: "sidewinder", cost: 1200 },
  { key: "wraith", cost: 2400 },
  { key: "destroyer", cost: 2800 }, // the iconic distance driver — affordable in your 2nd year with average play
  { key: "nukeos", cost: 4000 },
  { key: "zeus", cost: 4800 },
];

// A per-season training-point FLOOR — guaranteed development every season just
// for competing, so a player who struggles and never places well still steadily
// improves and is never permanently stuck (they reach a respectable mid-tier on
// the floor alone). Placing well (trainBonus in recordResult) is still what lifts
// you from mid-tier to elite. Youth-weighted so a rookie develops fastest.
export function seasonBaseTrain(age: number): number {
  return age <= 19 ? 6 : age <= 27 ? 4 : 3;
}

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
    const skills: CareerSkills = { power: start(15, 26), control: start(15, 26), putt: start(15, 26), stamina: start(18, 30) };
    const potential: CareerSkills = {
      power: Math.max(skills.power + 14, pot(2)), control: Math.max(skills.control + 14, pot(0)),
      putt: Math.max(skills.putt + 14, pot(0)), stamina: Math.max(skills.stamina + 12, pot(-4)),
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
  // A raw high-school freshman: every skill starts at 20, all upside ahead.
  const skills: CareerSkills = { power: 20, control: 20, putt: 20, stamina: 20 };
  const potential: CareerSkills = {
    power: Math.max(skills.power + 15, pot(58)),
    control: Math.max(skills.control + 15, pot(58)),
    putt: Math.max(skills.putt + 15, pot(58)),
    stamina: Math.max(skills.stamina + 12, pot(55)),
  };
  return {
    v: 1, name: name.trim().slice(0, 16) || "Rookie", seed: seed >>> 0,
    age: 14, season: 0, stage: "highschool", skills, potential, trainPts: 0, // start with nothing — earn your first points by playing
    done: [], results: [], titles: [], seasonPoints: 0, careerPoints: 0, majors: 0,
    worldRank: null, bestWorldRank: null, seasonsAtNo1: 0, achievements: [], retired: false,
    cash: 1000, energy: seasonEnergy(skills.stamina), sponsors: [], sponsorBonusClaimed: [], rivals: generateRivals(seed),
    pdgaRating: pdgaFromInternal(careerRating(skills)), roundRatings: [],
    discs: [...CAREER_CORE_DISCS], bag: [...CAREER_CORE_DISCS], rankPoints: 0, trainBought: 0,
    cosmetics: [], look: { ...DEFAULT_CAREER_LOOK },
  };
}

// Backfill new fields on a save from before economy/rivals/PDGA existed. Also
// migrates the old 4th skill (`mental`) onto `stamina` so existing careers keep a
// trained value (it now governs energy rather than momentum).
export function normalizeCareer(c: Career): Career {
  // Old saves carry `mental`; map it onto `stamina` for skills + potential.
  const withStamina = (sk: CareerSkills): CareerSkills => {
    const os = sk as unknown as Record<string, number>;
    return { power: os.power, control: os.control, putt: os.putt, stamina: os.stamina ?? os.mental ?? 20 };
  };
  const skills = withStamina(c.skills);
  const potential = withStamina(c.potential);
  const skillFrac = c.skillFrac ? withStamina(c.skillFrac) : c.skillFrac;
  let rivals = c.rivals;
  if (!rivals || rivals.length === 0) {
    rivals = generateRivals(c.seed);
    // age the rivals up to the career's current season so they're peers, not kids
    for (let s = 0; s < c.season; s++) rivals = rivals.map((r) => growRival(r, 11 + s));
  }
  rivals = rivals.map((r) => ({ ...r, skills: withStamina(r.skills), potential: withStamina(r.potential), pdgaRating: r.pdgaRating ?? pdgaFromInternal(rivalRating({ ...r, skills: withStamina(r.skills) })), roundRatings: r.roundRatings ?? [] }));
  // The pro tour is the real touring field. Migrate any pre-existing pro save (its
  // fictional rivals become real pros) and refresh the lineup for the season on
  // every load — carrying the head-to-head record once it's already the pro tour.
  if (c.stage === "pro") rivals = proRivals(careerYear(c), isProRivals(rivals) ? rivals : undefined);
  const discs = c.discs?.length ? c.discs : [...CAREER_CORE_DISCS];
  return {
    ...c, skills, potential, skillFrac, cash: c.cash ?? 0,
    energy: c.energy ?? seasonEnergy(skills.stamina), sponsors: c.sponsors ?? [],
    // Existing saves: treat their currently-signed sponsors as already-paid, so a
    // first drop + re-sign after this update can't re-collect those bonuses.
    sponsorBonusClaimed: c.sponsorBonusClaimed ?? (c.sponsors ?? []).map((s) => s.id),
    rivals,
    pdgaRating: c.pdgaRating ?? pdgaFromInternal(careerRating(skills)),
    roundRatings: c.roundRatings ?? [],
    discs,
    bag: c.bag?.length ? c.bag.slice(0, CAREER_BAG_MAX) : discs.slice(0, CAREER_BAG_MAX),
    rankPoints: c.rankPoints ?? 0,
    trainBought: c.trainBought ?? 0,
    cosmetics: c.cosmetics ?? [],
    look: { ...DEFAULT_CAREER_LOOK, ...(c.look ?? {}) },
  };
}

// PDGA rating expected for an internal skill level (used as the early-career seed).
export const pdgaEstimate = (s: CareerSkills): number => pdgaFromInternal(careerRating(s));

export const rivalRating = (r: Rival): number => careerRating(r.skills);

function parForMode(mode: Mode): { par: number; holes: number } {
  if (mode === "winthrop") return { par: WINTHROP_PAR, holes: 18 };
  if (mode === "course") return { par: TOTAL_PAR, holes: 18 };
  if (mode === "tour") return { par: 70, holes: 18 }; // placeholder; tour events set real par from the seed
  return { par: 27, holes: 9 }; // "academy": generated 9-hole event (par ~27)
}

// Venue naming + the procedural layouts live in the engine (tourVenue /
// tourPars / tourCharacter / generateTourCourse), so the same courses are
// playable standalone from "Play Courses".
function tourCourseSeed(careerSeed: number, fullId: string): number {
  return (careerSeed ^ hashId(fullId) ^ 0x51ed270b) >>> 0;
}

// Event-name pools, drawn WITHOUT replacement each season so a full slate reads
// as distinct named events. Larger than any single season needs so picks vary.
const YOUTH_NAMES = ["Junior Open", "Pee-Wee Classic", "Sapling Showdown", "Rookie Invitational", "Backyard Open", "Sunday Juniors"];
const HS_NAMES = ["Eagle Invitational", "Hometown Classic", "Riverside Open", "Lakeside Tournament", "Pine Ridge Open", "Cedar Valley Classic", "Northgate Open"];
const COLLEGE_NAMES = ["Conference Opener", "Autumn Collegiate", "Sunbelt Showdown", "Campus Classic", "University Open", "Inter-Collegiate Cup", "Quad Cities Collegiate"];
const PRO_MINORS = ["Spring Open", "Maple Hill Tour Stop", "Emerald Cup", "Music City Open", "Ledgestone Open", "Discraft Classic", "Portland Open", "Las Vegas Challenge", "Jonesboro Open", "Texas States", "Kansas City Wide Open", "Beaver State Fling", "Idlewild Open", "Great Lakes Open", "Delaware Disc Classic", "Santa Cruz Masters"];
const PRO_MAJORS = ["The Memorial Major", "European Open", "Champions Cup", "United States Disc Golf Championship", "Open de France"];
const PRO_CHAMPS = ["Tour Championship", "Players Cup Final", "Grand Slam Finale"];

// The events on offer this season, by stage. Deterministic from seed + season.
// Each stage offers a CHOOSABLE slate (you spend season energy to enter the ones
// you want): youth ~4, high school ~6, college ~8, pro ~14–15.
export function seasonSchedule(c: Career): CareerEvent[] {
  const rng = mulberry32((c.seed * 2654435761 + c.season * 40503) >>> 0);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)];
  // Shuffle a pool and take n distinct names (suffixing if a stage ever needs more
  // names than the pool holds).
  const take = (arr: string[], n: number): string[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return Array.from({ length: n }, (_, i) => (i < a.length ? a[i] : `${a[i % a.length]} ${Math.floor(i / a.length) + 1}`));
  };
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
    case "youth": {
      // ~4 junior events — a few opens plus the Junior Championship. A gentle
      // field so a raw beginner can place well from their very first event.
      const out = take(YOUTH_NAMES, 3).map((n, i) => ev(`jr${i + 1}`, n, "academy", "minor", 12 + i * 2, 15 + ramp + i));
      out.push(ev("jrc", "Junior Championship", "academy", "championship", 16, 21 + ramp));
      return out;
    }
    case "highschool": {
      // ~6 events. Calibrated for a raw freshman (all skills start at 20). The
      // regular-season events are 9-hole opens — driver-optional but long enough
      // that a good round wins by a stroke or two, not a runaway (see
      // careerHoleLenScale). The two capstones (Regional Qualifier + State
      // Championship) are the full 18-hole Glendoveer test, the big tournaments
      // you grow into. Fields toughen each season via `ramp`.
      const out = take(HS_NAMES, 4).map((n, i) => ev(`hs${i + 1}`, n, "academy", "minor", 20 + i * 2, 26 + ramp + i));
      out.push(ev("hsq", "Regional Qualifier", "course", "major", 24, 30 + ramp));
      out.push(ev("hss", "State Championship", "course", "championship", 28, 36 + ramp));
      return out;
    }
    case "college": {
      // ~8 events, building to Nationals at Winthrop Lake.
      const out = take(COLLEGE_NAMES, 5).map((n, i) => ev(`co${i + 1}`, n, "tour", "minor", 28 + i * 2, 40 + ramp + i));
      out.push(ev("cc1", "Conference Championship", "winthrop", "major", 32, 46 + ramp));
      out.push(ev("cc2", pick(["Regional Championship", "Division Finals"]), "tour", "major", 32, 47 + ramp));
      out.push(ev("con", "College Nationals", "winthrop", "championship", 36, 52 + ramp));
      return out;
    }
    case "pro": {
      // The full pro tour: ~10 rotating tour stops, three majors, a season-ending
      // Tour Championship, and the World Championship at classic Glendoveer every
      // other season — far more than your season energy can enter, so you choose.
      // Pro fields are genuine world-class talent (mean ~78–88 + a tail of stars),
      // so even an elite player can't just show up and sweep — winning the tour
      // takes a truly dominant season, and the marquee events are the hardest.
      const out: CareerEvent[] = [];
      take(PRO_MINORS, 10).forEach((n, i) => out.push(ev(`pt${i + 1}`, n, "tour", "minor", 72 + (i % 3) * 4, 78 + ramp * 0.4 + (i % 4))));
      take(PRO_MAJORS, 3).forEach((n, i) => out.push(ev(`maj${i + 1}`, n, "tour", "major", 90, 84 + ramp * 0.4)));
      out.push(ev("champ", pick(PRO_CHAMPS), "tour", "championship", 96, 87 + ramp * 0.4));
      // A World Championship lands every other season once you're established.
      if (c.season % 2 === 1) out.push(ev("wc", "World Championship", "course", "championship", 96, 89 + ramp * 0.4));
      return out;
    }
    default:
      return [];
  }
}

// Expected strokes for a rating on a course (better rating ⇒ lower), with a
// little round-to-round noise (kept modest so difficulty is consistent).
function scoreFromRating(rating: number, ev: CareerEvent, rng: () => number): number {
  const toPar = (50 - rating) * 0.28 * (ev.holes / 18) + (rng() * 2 - 1) * 1.8;
  return Math.max(Math.round(ev.par * 0.5), Math.round(ev.par + toPar));
}

// One anonymous opponent's rating for an event. Bigger events draw a stronger
// field AND a deeper top end: majors/championships lift the whole field and add
// more "stars" (near-elite players), so the marquee events are genuinely hard to
// win — you can't just shoot a hot round and run away with it.
function fieldOpponentRating(ev: CareerEvent, rng: () => number): number {
  const lift = ev.importance === "championship" ? 5 : ev.importance === "major" ? 3 : 0;
  const starChance = ev.importance === "championship" ? 0.12 : ev.importance === "major" ? 0.08 : 0.05;
  const star = rng() < starChance ? 6 + rng() * 9 : 0; // a tail of standout players
  return clamp(ev.fieldMean + lift + star + (rng() * 2 - 1) * 8, 5, 99);
}

// The field's scores for an event (deterministic per career/season/event).
export function genField(c: Career, ev: CareerEvent): number[] {
  const rng = mulberry32((c.seed ^ hashId(ev.id) ^ 0x9e3779b9) >>> 0);
  return Array.from({ length: ev.fieldSize }, () => scoreFromRating(fieldOpponentRating(ev, rng), ev, rng));
}

// How much a hole helps or hurts the field's score (signed extra strokes), from
// its wind, slope, water/sand and a tight fairway. The wind and slope terms are
// SIGNED and DIRECTIONAL so the whole field feels conditions exactly like you do:
// a downhill/downwind hole plays easier for the bots (negative difficulty) and an
// uphill/headwind hole harder — no more free human edge on the kind holes. Used
// for the bots' scores and the on-course ghosts' shot counts.
function holeDifficulty(h: Hole): number {
  // Wind projected onto the tee→basket axis: tailwind (toward the basket) eases the
  // hole, headwind hardens it, crosswind is a touch harder either way. (Falls back
  // to raw magnitude if a hole carries no wind vector.)
  let wind: number;
  if (h.wind) {
    const ax = h.basket.x - h.tee.x, ay = h.basket.y - h.tee.y;
    const len = Math.hypot(ax, ay) || 1;
    const along = (h.wind.x * ax + h.wind.y * ay) / len; // >0 = tailwind (helps)
    const cross = Math.abs(h.wind.x * ay - h.wind.y * ax) / len; // sideways magnitude
    wind = (-along + cross * 0.5) / 0.018; // headwind/cross → +, tailwind → −
  } else {
    wind = (h.windMag ?? 0) / 0.018;
  }
  // Signed slope: uphill (+elev) plays longer/harder, downhill (−elev) easier —
  // the same carry the player gets, so the field isn't blind to a downhill hole.
  const elev = h.elevZones?.length ? h.elevZones.reduce((s, z) => s + z.elev, 0) / h.elevZones.length : (h.elev ?? 0);
  const slope = elev / 2; // −1..+1
  const water = (h.water?.length ?? 0) > 0 ? 0.4 : 0;
  const sand = Math.min(3, h.hazard?.length ?? 0) * 0.12;
  const narrow = Math.max(0, (118 - h.fwWidth) / 118); // tighter corridor → harder
  return wind * 0.6 + slope * 0.5 + water + sand + narrow * 0.5;
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

// Simming an event assumes you play it COMPETENTLY — a focused round a notch
// above your raw skill rating (a good player out-throws their stats with smart
// aim). This keeps simming roughly on par with playing it yourself, so a sim-only
// career still progresses and can climb to ~90+ overall instead of stalling.
const SIM_PLAY_BONUS = 8;
export function simEvent(c: Career, ev: CareerEvent): { score: number; field: number[] } {
  const rng = mulberry32((c.seed ^ hashId(ev.id) ^ 0x1234567) >>> 0);
  const score = scoreFromRating(careerRating(c.skills) + SIM_PLAY_BONUS, ev, rng);
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
// Per-hole scores for a rating. `diff[i]` (optional) adds the hole's conditions
// difficulty so windy/uphill/tight holes cost the field more strokes there too;
// better players (lower perHoleToPar) shrug some of it off.
function simHoleScores(rating: number, par: number, holes: number, rng: () => number, diff?: number[]): number[] {
  const parPerHole = par / holes;
  const perHoleToPar = (50 - rating) * 0.28 / 18;
  const grit = 1 - (rating - 50) / 140; // skill cushions conditions a little
  return Array.from({ length: holes }, (_, i) =>
    Math.max(1, Math.round(parPerHole + perHoleToPar + (diff ? diff[i] * Math.max(0.45, grit) : 0) + (rng() * 2 - 1) * 0.65)),
  );
}
// ── The pro tour is real. Your first pro season is 2026, and the field is the
// actual current touring pros at their present-day form. Each season after is a
// light simulation of how they'll progress: young guns climb toward a peak around
// 27, prime players hold, and veterans gently decline — so the order reshuffles
// year over year while the names stay real. ──
export const CAREER_FIRST_PRO_YEAR = 2026;
const PRO_TURN_AGE = 22; // college → pro lands at age 22 (see advanceSeason)

type ProEntry = { name: string; rating: number; age: number }; // rating = 2026 internal skill; age = age in 2026
// Top of the men's tour, ordered roughly by 2026 form. The first N_PRO_MARQUEE
// become your recurring rivals (the discs you race + a head-to-head record); the
// rest fill out the field with real names down the leaderboard.
const PRO_ROSTER: ProEntry[] = [
  { name: "Gannon Buhr", rating: 90, age: 20 },
  { name: "Niklas Anttila", rating: 88, age: 21 },
  { name: "Isaac Robinson", rating: 88, age: 25 },
  { name: "Calvin Heimburg", rating: 88, age: 28 },
  { name: "Eagle McMahon", rating: 87, age: 28 },
  { name: "Paul McBeth", rating: 87, age: 36 },
  { name: "Ezra Aderhold", rating: 87, age: 26 },
  { name: "Anthony Barela", rating: 86, age: 28 },
  { name: "Gavin Babcock", rating: 86, age: 22 },
  { name: "Kyle Klein", rating: 86, age: 27 },
  { name: "Cole Redalen", rating: 85, age: 22 },
  { name: "Ricky Wysocki", rating: 85, age: 33 },
  { name: "Chris Dickerson", rating: 85, age: 34 },
  { name: "Corey Ellis", rating: 84, age: 28 },
  { name: "Aaron Gossage", rating: 84, age: 31 },
  { name: "Adam Hammes", rating: 84, age: 29 },
  { name: "Simon Lizotte", rating: 84, age: 33 },
  { name: "Linus Carlsson", rating: 83, age: 27 },
  { name: "Andrew Presnell", rating: 83, age: 30 },
  { name: "Emerson Keith", rating: 83, age: 28 },
  { name: "Kevin Jones", rating: 82, age: 33 },
  { name: "Alden Harris", rating: 82, age: 24 },
  { name: "Garrett Gurthie", rating: 81, age: 38 },
  { name: "Mason Ford", rating: 81, age: 23 },
];
const N_PRO_MARQUEE = 6; // the first N_PRO_MARQUEE pros become your recurring rivals
const PRO_FIELD_COLOR = "#8a93a6"; // named (non-rival) tour pros in the field

// The calendar year of a career: 2026 the season you turn pro, then +1 each season
// (ages map 1:1 to seasons, and the pro tour begins at PRO_TURN_AGE).
export function careerYear(c: Career): number {
  return CAREER_FIRST_PRO_YEAR + Math.max(0, c.age - PRO_TURN_AGE);
}

// A pro's age-trajectory: a rating offset relative to a peak around 27, used to
// simulate how each name rises and falls over the seasons.
function proAgeCurve(age: number): number {
  if (age <= 27) return -(27 - age) * 0.7;     // still climbing toward a peak
  if (age <= 31) return 0;                       // prime plateau
  if (age <= 36) return -(age - 31) * 0.55;      // gentle decline
  return -(36 - 31) * 0.55 - (age - 36) * 1.1;   // steeper late-career slide
}
// A pro's simulated rating in a given year: their 2026 base shifted by how far
// their age-trajectory has moved, plus a hair of deterministic year-to-year
// variance so the order reshuffles a little each season.
function proRatingInYear(p: ProEntry, year: number): number {
  const ageThen = p.age + (year - CAREER_FIRST_PRO_YEAR);
  const drift = proAgeCurve(ageThen) - proAgeCurve(p.age);
  const noise = (hashId(`${p.name}#${year}`) / 0x100000000) * 3.2 - 1.6;
  return clamp(p.rating + drift + noise, 55, 96);
}
// Your marquee rivals on the pro tour — real pros, rated for `year`, carrying the
// head-to-head record forward from the prior pro season (matched by id).
function proRivals(year: number, prior?: Rival[]): Rival[] {
  return PRO_ROSTER.slice(0, N_PRO_MARQUEE).map((p, i) => {
    const id = `pro${i}`;
    const r = clamp(Math.round(proRatingInYear(p, year)), 40, 99);
    const skills: CareerSkills = { power: r, control: r, putt: r, stamina: 92 };
    const prev = prior?.find((x) => x.id === id);
    return {
      id, name: p.name, color: RIVAL_PALETTE[i % RIVAL_PALETTE.length],
      skills, potential: { power: 99, control: 99, putt: 99, stamina: 99 },
      titles: prev?.titles ?? 0, beat: prev?.beat ?? 0, lost: prev?.lost ?? 0,
      pdgaRating: pdgaFromInternal(r), roundRatings: prev?.roundRatings ?? [],
    };
  });
}
// The rest of the tour (beyond your rivals), named + rated for `year` and sorted
// strongest-first, used to name the field down the leaderboard.
function proFieldFill(year: number): { name: string; rating: number }[] {
  return PRO_ROSTER.slice(N_PRO_MARQUEE)
    .map((p) => ({ name: p.name, rating: proRatingInYear(p, year) }))
    .sort((a, b) => b.rating - a.rating);
}
// Are these rivals the real pro tour (vs. the fictional peers you grew up with)?
function isProRivals(rivals: Rival[]): boolean {
  return rivals.length > 0 && rivals[0].id.startsWith("pro");
}

// `diff` (optional) carries per-hole conditions difficulty for a PLAYED round, so
// the field (and the ghosts you watch) react to wind/slope/hazards like you do.
function buildField(c: Career, ev: CareerEvent, diff?: number[]): FieldPlayer[] {
  // On the pro tour the field plays a touch better at the marquee events — the
  // same bump the anonymous field already gets in fieldOpponentRating.
  const proLift = c.stage === "pro" ? (ev.importance === "championship" ? 5 : ev.importance === "major" ? 3 : 0) : 0;
  const field: FieldPlayer[] = c.rivals.map((r) => {
    const holes = simHoleScores(rivalRating(r) + proLift, ev.par, ev.holes, mulberry32((c.seed ^ hashId(ev.id) ^ hashId(r.id)) >>> 0), diff);
    return { name: r.name, isRival: true, color: r.color, holes, total: holes.reduce((a, b) => a + b, 0) };
  });
  const anonCount = Math.max(0, ev.fieldSize - c.rivals.length);
  const rng = mulberry32((c.seed ^ hashId(ev.id) ^ 0x9e3779b9) >>> 0);
  // Pro events name the top of the field with real tour pros (beyond your
  // rivals); the deep field stays anonymous.
  const named = c.stage === "pro" ? proFieldFill(careerYear(c)) : null;
  for (let i = 0; i < anonCount; i++) {
    const pro = named && i < named.length ? named[i] : null;
    const rating = pro ? pro.rating + proLift : fieldOpponentRating(ev, rng);
    const holes = simHoleScores(rating, ev.par, ev.holes, rng, diff);
    field.push({ name: pro ? pro.name : anonName((c.seed ^ hashId(ev.id)) >>> 0, i), isRival: false, color: pro ? PRO_FIELD_COLOR : "#7a808a", holes, total: holes.reduce((a, b) => a + b, 0) });
  }
  return field;
}
export function careerFieldHoles(c: Career, ev: CareerEvent): FieldPlayer[] {
  return buildField(c, ev);
}
// The field for a PLAYED round, where each hole's wind/slope/hazards bump scores.
export function careerFieldForRound(c: Career, ev: CareerEvent, roundHoles: Hole[]): FieldPlayer[] {
  return buildField(c, ev, roundHoles.map(holeDifficulty));
}

// Your on-course "card": the three best-placed rivals you're grouped with.
export function careerCard(field: FieldPlayer[]): FieldPlayer[] {
  return field.filter((p) => p.isRival).sort((a, b) => a.total - b.total).slice(0, 3);
}
// The card as ghost racers for one hole (shot count = their score on that hole).
export function careerCardRacers(field: FieldPlayer[], holeIndex: number): GhostRacer[] {
  return careerCard(field).map((p) => ({ name: p.name.split(" ").pop() || p.name, color: p.color, shots: Math.max(1, p.holes[holeIndex] ?? 1) }));
}

// ── Ranked: an AI field for one ranked round. Unlike a Career event (recurring
// rivals + an event-tuned field), every opponent is an anonymous pro whose rating
// centers on `fieldMean` (your tier strength) with a spread, reacting to the
// played holes' conditions just like you. Seeded by the round so it's stable on a
// replay/resync but fresh every round. Reuses careerLiveStandings for standings. ──
export function rankedFieldForRound(seed: number, fieldMean: number, size: number, roundHoles: Hole[]): FieldPlayer[] {
  const par = roundHoles.reduce((s, h) => s + h.par, 0);
  const diff = roundHoles.map(holeDifficulty);
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const field: FieldPlayer[] = [];
  for (let i = 0; i < size; i++) {
    const rating = clamp(fieldMean + (rng() * 2 - 1) * 14, 20, 99); // spread around the tier mean
    const holes = simHoleScores(rating, par, roundHoles.length, rng, diff);
    field.push({ name: anonName(seed, i), isRival: false, color: "#7a808a", holes, total: holes.reduce((a, b) => a + b, 0) });
  }
  return field;
}
// On-course ghost racers for a ranked hole: three mid-pack opponents, so the race
// alongside you stays close (the career card uses your rivals; ranked has none).
export function rankedCardRacers(field: FieldPlayer[], holeIndex: number): GhostRacer[] {
  const sorted = [...field].sort((a, b) => a.total - b.total);
  const mid = Math.floor(sorted.length / 2);
  return sorted.slice(Math.max(0, mid - 1), mid + 2).map((p) => ({ name: p.name.split(" ").pop() || p.name, color: p.color, shots: Math.max(1, p.holes[holeIndex] ?? 1) }));
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

// Account coins paid for PLAYING a career event, by where you FINISH (and how big
// the event is): win big, mid-pack earns a little, last place still gets a token
// for showing up; the marquee events pay the most. Simmed events still pay nothing
// — coins are the reward for actually playing the round. Exported for the preview.
export function careerCoins(importance: CareerEvent["importance"], placed: number, fieldN: number): number {
  const peak = importance === "championship" ? 140 : importance === "major" ? 95 : 60;
  const frac = Math.max(0, (fieldN - placed) / Math.max(1, fieldN - 1)); // 1 at a win → 0 at last
  return Math.round(8 + (peak - 8) * Math.pow(frac, 1.5));
}

// Training points earned for a finish — placement + event importance. Exported so
// the hub can preview "what you'll earn here" before you commit to playing.
export function trainBonusFor(importance: CareerEvent["importance"], placed: number, fieldN: number): number {
  return placed === 1 ? (importance === "championship" ? 6 : importance === "major" ? 5 : 4)
    : placed <= 3 ? 3
    : placed <= Math.ceil(fieldN * 0.1) ? 2 // a top-10% finish develops you a little
    : placed <= Math.ceil(fieldN * 0.5) ? 1 // even a top-half finish teaches you something
    : 0;
}

// Record a finished event (played or simmed). Folds in your recurring rivals
// (placement, head-to-head, who actually won), prize money, points + titles.
// `field` may be supplied (a played round's conditions-aware field) so placement
// matches the live leaderboard you saw; otherwise the statistical field is used.
export function recordResult(c: Career, ev: CareerEvent, score: number, played: boolean, field?: FieldPlayer[]): { career: Career; result: EventResult } {
  field = field ?? careerFieldHoles(c, ev);
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
  // Amateur events pay no tour purse, but a strong finish earns a little
  // scholarship/sponsor cash so the career Pro Shop is reachable before turning pro.
  const amateurPay = c.stage === "pro" ? 0 : amateurCash(ev, placed, fieldN);
  // How you finish drives how fast you develop: training points are EARNED here,
  // not handed out for aging — the per-season floor barely moves you, so reaching
  // 90 takes sustained good play and 99 takes dominance. Win the big ones to grow.
  const trainBonus = trainBonusFor(ev.importance, placed, fieldN);
  // World-ranking points — top-heavy and importance-weighted, so a season of
  // winning everything vaults you up the rankings while a quiet season barely moves you.
  const earnedRankPts = rankPointsFor(ev, placed, fieldN);
  const result: EventResult = {
    eventId: ev.id, name: ev.name, season: c.season, age: c.age, stage: c.stage,
    score, toPar: score - ev.par, placed, field: fieldN, played, win, beatRivals, rivalCount: c.rivals.length, winnerName, prize, trainBonus,
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
    energy: Math.max(0, c.energy - eventEnergyCost(ev)), // entering an event (played or simmed) spends its energy
    cash: c.cash + prize + amateurPay,
    rankPoints: c.rankPoints + earnedRankPts,
    trainPts: c.trainPts + trainBonus,
    seasonPoints: c.seasonPoints + points,
    careerPoints: c.careerPoints + points,
    majors: c.majors + (win && ev.importance !== "minor" ? 1 : 0),
    achievements: [...ach],
    roundRatings, pdgaRating,
  };
  return { career, result };
}

// Pro prize money: a purse by event tier, paid to roughly the top quarter.
// Trimmed from the old purses so a pro career doesn't pile up idle cash late.
function prizeFor(ev: CareerEvent, placed: number): number {
  const purse = ev.importance === "championship" ? 55000 : ev.importance === "major" ? 28000 : 9000;
  if (placed > Math.max(5, Math.floor(ev.fieldSize * 0.25))) return 0;
  return Math.round((purse * Math.pow(0.6, placed - 1)) / 100) * 100;
}
// Amateur "scholarship" cash — boosted + broadened so the Pro Shop is reachable
// through school with ordinary play, not just by winning. The whole TOP HALF of
// the field earns something (scaled by how high you finish), so an average player
// who places mid-pack steadily banks cash and can afford a real distance driver
// (the Destroyer) by their second year. Importance-scaled; top-heavy but gentle.
function amateurCash(ev: CareerEvent, placed: number, fieldN: number): number {
  const cutoff = Math.max(5, Math.ceil(fieldN * 0.5)); // top half (at least 5) is paid
  if (placed > cutoff) return 0;
  const top = ev.importance === "championship" ? 4000 : ev.importance === "major" ? 2000 : 1000;
  const frac = (cutoff - placed + 1) / cutoff; // 1 at a win → ~1/cutoff at the cut line
  return Math.round((top * Math.pow(frac, 1.2)) / 50) * 50;
}
// World-ranking points from a finish: a per-event peak (by importance) shared
// out steeply by placement, so wins are worth far more than mid-pack finishes.
function rankPointsFor(ev: CareerEvent, placed: number, fieldN: number): number {
  const peak = ev.importance === "championship" ? 600 : ev.importance === "major" ? 350 : 150;
  const frac = Math.max(0, (fieldN - placed) / Math.max(1, fieldN - 1)); // 1 at a win → 0 at last
  return Math.round(peak * Math.pow(frac, 2.2));
}

// Per-skill decline speed once you age past your prime (power fades fastest).
const DECLINE: CareerSkills = { power: 1.35, control: 0.95, putt: 0.7, stamina: 0.6 };

// Skills only move when you TRAIN them — there's no free yearly growth. Younger
// players develop more per point; gains shrink as you approach your potential.
// Past 30, untrained skills decline (training a skill offsets its decline).
const GROW_RATE = 2.1;
// A skill ONLY moves when you spend training points on it (no free growth).
// `isPlayer` caps every player skill at 99 — your hard ceiling; rivals instead
// cap at their own potential, so their ceilings vary and you can still surpass
// them. `pot` shapes the curve: gains taper as you approach it (and again past
// ~80), so the closer you get to 99 the more each point costs.
function growSkill(skill: number, pot: number, age: number, invested: number, declineRate: number, isPlayer = false): number {
  if (isPlayer) {
    // The PLAYER's skills move EXACTLY 1:1 with the training points spent — no
    // hidden curve and no potential gate, so every career can climb to the 99 cap.
    // Points are EARNED by finishing events well (see trainBonus), so reaching 90
    // is the reward for good play, never something aging hands you. Decline only
    // bites past 35, and training a skill cancels that year's loss point-for-point.
    let next = skill + invested;
    if (age > 35) next -= Math.max(0, (age - 35) * 0.5 * declineRate - invested);
    return clamp(next, 8, 99);
  }
  // Rivals keep the original talent-curved growth (capped at their own potential).
  const youth = age < 16 ? 1.5 : age < 20 ? 1.2 : age < 26 ? 0.9 : age <= 30 ? 0.65 : 0.45;
  const rawRoom = pot - skill;
  // Growth is strong below their potential and nearly nil above it, so potential
  // stays a real talent ceiling: an average rival peaks around its potential,
  // and only a high-talent one (potential near 99) climbs into the high-90s.
  const roomFactor = rawRoom <= 0 ? 0.06 : 0.38 + Math.min(rawRoom, 45) * 0.014;
  const highDamp = 1 / (1 + Math.max(0, skill - 80) * 0.05); // the last points still cost more, but stay reachable
  const gain = invested > 0 ? invested * youth * GROW_RATE * roomFactor * highDamp : 0;
  let next = skill + gain;
  if (age > 30) next -= Math.max(0, (age - 30) * 0.55 * declineRate - invested * 0.55);
  return clamp(next, 8, pot + 2);
}

// Rivals improve on their own each season (a little focused work, no allocation).
function growRival(r: Rival, age: number): Rival {
  const focus = age <= 30 ? 1.2 : 0;
  const g = (k: keyof CareerSkills) => Math.round(growSkill(r.skills[k], r.potential[k], age, focus, DECLINE[k]));
  return { ...r, skills: { power: g("power"), control: g("control"), putt: g("putt"), stamina: g("stamina") } };
}

// World rank among a synthetic pro pool. A player's standing blends raw skill
// (slow to build — it takes seasons of training to reach the top) with recent
// ranking points (fast, if you're winning everything). So you can rocket up by
// dominating the tour, but holding #1 still demands genuine, sustained class.
const worldStanding = (rating: number, rankPoints: number) => rating + Math.min(rankPoints, 3000) * 0.06;
function computeWorldRank(c: Career): number {
  const rng = mulberry32((c.seed ^ 0xa5a5 ^ (c.season * 7919)) >>> 0);
  const POOL = 100;
  const me = worldStanding(careerRating(c.skills), c.rankPoints);
  let better = 0;
  for (let i = 0; i < POOL; i++) {
    // Most of the pool are strong tour pros; a top ~5% are genuine world-beaters
    // who both rate near the ceiling AND bank big points. So reaching #1 demands
    // being among the very best (≈98–99 skill) AND winning the tour — a
    // freshly-minted pro debuts mid-pack and a merely-very-good player tops out a
    // few spots short, rather than arriving at #1 the moment they turn pro.
    const skill = rng() < 0.05
      ? clamp(86 + rng() * 10, 35, 100)           // ~5% elite: 86..96 — a maxed player can edge them
      : clamp(70 + (rng() * 2 - 1) * 16, 35, 100); // the field: 54..86
    const pts = Math.max(0, (skill - 66) * 95 + (rng() * 2 - 1) * 250);
    if (worldStanding(skill, pts) > me) better++;
  }
  return better + 1;
}

// End the season: apply training + growth/decline, advance age + stage, refresh
// the schedule, update world rank, and surface notes for the season summary.
export function advanceSeason(c: Career, alloc: Partial<CareerSkills>): { career: Career; notes: string[] } {
  const notes: string[] = [];
  const age = c.age + 1;
  // Skills are shown as integers but tracked with a signed fractional carry, so
  // small per-season gains accumulate instead of being rounded away every year.
  // (Rounding each season used to wall progress at ~97 whenever points were
  // spread across skills, making "max all skills by ~30" impossible.) The "true"
  // skill = displayed integer + carried fraction; growth runs on the true value,
  // then we split it back into a nearest integer + a [-0.5, 0.5) remainder.
  const skills = {} as CareerSkills;
  const skillFrac = {} as CareerSkills;
  SKILL_KEYS.forEach((k) => {
    const trueSkill = c.skills[k] + (c.skillFrac?.[k] ?? 0);
    const grown = growSkill(trueSkill, c.potential[k], age, alloc[k] ?? 0, DECLINE[k], true);
    skills[k] = Math.round(grown);
    skillFrac[k] = grown - skills[k];
  });

  let stage = c.stage;
  if (stage === "youth" && age >= 14) { stage = "highschool"; notes.push("🏫 You've started high school — the junior days are behind you."); }
  else if (stage === "highschool" && age >= 18) { stage = "college"; notes.push("🎓 Recruited to college! The college circuit — and Nationals at Winthrop Lake — awaits."); }
  else if (stage === "college" && age >= 22) {
    stage = "pro";
    const earned = c.titles.some((t) => t.importance !== "minor");
    notes.push(earned ? "🏆 You've turned PRO with your card earned on the strength of your college results." : "💪 You've turned PRO — time to prove it against the world's best.");
  }

  // Rivals age + improve alongside you; sponsors pay out; coaches add training.
  // On the pro tour your rivals ARE the real tour — simulated for the new season
  // (and carrying your head-to-head record once you're already pro).
  let rivals = c.rivals.map((r) => growRival(r, age));
  if (stage === "pro") rivals = proRivals(CAREER_FIRST_PRO_YEAR + Math.max(0, age - PRO_TURN_AGE), c.stage === "pro" ? c.rivals : undefined);
  const stipend = c.sponsors.reduce((s, sp) => s + sp.stipend, 0);
  const coachPts = c.sponsors.filter((sp) => sp.coach).length;

  let career: Career = {
    ...c, age, season: c.season + 1, stage, skills, skillFrac, rivals,
    cash: c.cash + stipend,
    energy: seasonEnergy(skills.stamina), // refill the season energy pool from your (newly trained) Stamina
    trainPts: seasonBaseTrain(age) + coachPts, done: [], seasonPoints: 0, trainBought: 0,
    rankPoints: Math.round(c.rankPoints * 0.6), // last season's results fade — staying #1 needs sustained dominance
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
// The disc brand a signed MANUFACTURER deal locks your career bag to (or null).
export function sponsorBrandLock(c: Career): string | null {
  return c.sponsors.find((s) => s.brand)?.brand ?? null;
}
// Every career-shop / core disc that belongs to a given brand — the pool a
// manufacturer deal grants you and restricts your bag to.
function brandUniverseKeys(brand: string): string[] {
  const all = Array.from(new Set([...CAREER_CORE_DISCS, ...CAREER_DISC_SHOP.map((d) => d.key)]));
  return all.filter((k) => discByKey(k)?.brand === brand);
}
// Build a sensible ≤BAG_MAX bag out of a brand's discs: one of each class present
// (putter→mid→fairway→driver), then fill the rest preferring drivers + mids.
function brandBag(brandKeys: string[]): string[] {
  const cls = (k: string) => CAREER_DISC_CLASS[k] ?? "mid";
  const byClass: Record<string, string[]> = {};
  brandKeys.forEach((k) => { (byClass[cls(k)] ??= []).push(k); });
  const bag: string[] = [];
  ["putter", "mid", "fairway", "driver"].forEach((cl) => { if (byClass[cl]?.length) bag.push(byClass[cl][0]); });
  for (const cl of ["driver", "mid", "fairway", "putter"]) {
    for (const k of byClass[cl] ?? []) { if (bag.length >= CAREER_BAG_MAX) break; if (!bag.includes(k)) bag.push(k); }
  }
  return bag.slice(0, CAREER_BAG_MAX);
}
// Apply a manufacturer deal: grant the brand's full lineup and rebuild the bag so
// it's brand-only and immediately playable.
function applyBrandDeal(c: Career, brand: string): Career {
  const keys = brandUniverseKeys(brand);
  const discs = Array.from(new Set([...c.discs, ...keys]));
  return { ...c, discs, bag: brandBag(keys) };
}
// Sponsor offers you currently qualify for (by rating + stage) and haven't signed.
// Regular sponsors need one of your 3 slots free. A MANUFACTURER deal also takes a
// slot the first time, but if you already hold one, the rival brand is still
// offered as a SWITCH (no slot needed — it replaces your current deal).
export function availableSponsors(c: Career): Sponsor[] {
  if (c.retired) return [];
  const rating = careerRating(c.skills);
  const reached = STAGE_ORDER.indexOf(c.stage);
  const signed = new Set(c.sponsors.map((s) => s.id));
  const hasBrand = c.sponsors.some((s) => s.brand);
  const slotFree = c.sponsors.length < SPONSOR_CAP;
  return SPONSOR_POOL.filter((s) => {
    if (signed.has(s.id)) return false;
    if (rating < s.reqRating || reached < STAGE_ORDER.indexOf(s.reqStage)) return false;
    if (s.brand) return hasBrand || slotFree; // switch (have one) or a free slot for the first
    return slotFree;
  });
}
export function signSponsor(c: Career, id: string): Career {
  const s = SPONSOR_POOL.find((x) => x.id === id);
  if (!s || c.sponsors.some((x) => x.id === id)) return c;
  // A sponsor's signing bonus is paid at most ONCE per career — re-signing one you
  // dropped earlier pays nothing (you just resume its stipend/coach).
  const claimed = c.sponsorBonusClaimed ?? [];
  const bonus = claimed.includes(id) ? 0 : s.signing;
  const sponsorBonusClaimed = claimed.includes(id) ? claimed : [...claimed, id];
  if (s.brand) {
    const current = c.sponsors.find((x) => x.brand);
    if (current) {
      // SWITCH manufacturers: replace the deal in place (no extra slot), pay the new
      // brand's bonus only if you've never repped them before, then rebuild the bag.
      return applyBrandDeal({ ...c, sponsors: c.sponsors.map((x) => (x.brand ? s : x)), cash: c.cash + bonus, sponsorBonusClaimed }, s.brand);
    }
    if (c.sponsors.length >= SPONSOR_CAP) return c; // first manufacturer deal needs a free slot
    return applyBrandDeal({ ...c, sponsors: [...c.sponsors, s], cash: c.cash + bonus, sponsorBonusClaimed }, s.brand);
  }
  if (c.sponsors.length >= SPONSOR_CAP) return c;
  return { ...c, sponsors: [...c.sponsors, s], cash: c.cash + bonus, sponsorBonusClaimed };
}
// Drop a sponsor — frees its slot so you can switch who reps you. You keep cash
// already paid but forfeit its future stipend/coach. Dropping a manufacturer deal
// lifts the brand lock (your bag/shop reopen to every brand). The signing bonus
// stays "claimed", so re-signing it later pays no second bonus.
export function unsignSponsor(c: Career, id: string): Career {
  if (!c.sponsors.some((x) => x.id === id)) return c;
  return { ...c, sponsors: c.sponsors.filter((x) => x.id !== id) };
}

// ── Economy: spend cash on extra training points (escalating cost per season) ──
export function trainingPointCost(c: Career): number {
  const stageMult = c.stage === "pro" ? 2500 : c.stage === "college" ? 800 : c.stage === "highschool" ? 300 : 120;
  return stageMult * (c.trainBought + 1); // escalates per point bought this season
}
export function buyTrainingPoint(c: Career): Career {
  const cost = trainingPointCost(c);
  if (c.cash < cost) return c;
  return { ...c, cash: c.cash - cost, trainPts: c.trainPts + 1, trainBought: c.trainBought + 1 };
}

// Immediate 1:1 skill training: spend a point to raise a skill on the spot (or
// refund one to lower it). The hub applies this instantly — no waiting for the
// season to roll over. Clamped to the 99 ceiling / an 8 floor; manual edits clear
// the fractional carry so the next season's decline math starts from a clean int.
export function spendSkillPoint(c: Career, skill: keyof CareerSkills, delta: number): Career {
  const frac = (val: number): CareerSkills | undefined =>
    c.skillFrac ? { ...c.skillFrac, [skill]: val } : c.skillFrac;
  if (delta > 0) {
    if (c.trainPts <= 0 || c.skills[skill] >= 99) return c;
    return { ...c, trainPts: c.trainPts - 1, skills: { ...c.skills, [skill]: c.skills[skill] + 1 }, skillFrac: frac(0) };
  }
  if (delta < 0) {
    if (c.skills[skill] <= 8) return c;
    return { ...c, trainPts: c.trainPts + 1, skills: { ...c.skills, [skill]: c.skills[skill] - 1 }, skillFrac: frac(0) };
  }
  return c;
}

// ── Career disc collection: a Pro Shop (cash) + bag curation, all separate from
// your account's discs. ──
// Every disc you don't already own, cheapest first — the whole catalog is open
// from the start, so the only thing between you and a disc is saving the cash. A
// manufacturer deal restricts the shop to that brand (you can't buy what you can't play).
export function careerDiscShop(c: Career): { key: string; cost: number }[] {
  const owned = new Set(c.discs);
  const lock = sponsorBrandLock(c);
  return CAREER_DISC_SHOP
    .filter((d) => !owned.has(d.key))
    .filter((d) => !lock || discByKey(d.key)?.brand === lock)
    .sort((a, b) => a.cost - b.cost);
}
// Disc "class" so a freshly-bought disc can slot into the bag sensibly.
const CAREER_DISC_CLASS: Record<string, string> = {
  aviar: "putter", zone: "putter", harp: "putter",
  buzzz: "mid", swarm: "mid", roc: "mid",
  teebird: "fairway", firebird: "fairway", river: "fairway", pd: "fairway",
  sidewinder: "driver", destroyer: "driver", wraith: "driver", nukeos: "driver", zeus: "driver",
};
// Drop a newly-bought disc straight into the bag so it's usable right away: if
// there's room, add it; if the bag is full, swap out a disc from an
// over-represented class (so buying your first driver actually bags it instead
// of sitting unused behind five starters). A perfectly-spread bag is left alone.
function autoBagDisc(bag: string[], key: string): string[] {
  if (bag.includes(key)) return bag;
  if (bag.length < CAREER_BAG_MAX) return [...bag, key];
  const cls = (k: string) => CAREER_DISC_CLASS[k] ?? "mid";
  const counts: Record<string, number> = {};
  bag.forEach((k) => { counts[cls(k)] = (counts[cls(k)] ?? 0) + 1; });
  const newCls = cls(key);
  const dropClass =
    Object.keys(counts).find((cl) => counts[cl] > 1 && cl !== newCls) ??
    Object.keys(counts).find((cl) => counts[cl] > 1);
  if (!dropClass) return bag; // already a balanced spread — respect the player's bag
  let dropIdx = -1; // drop the last bagged disc of the over-represented class
  bag.forEach((k, i) => { if (cls(k) === dropClass) dropIdx = i; });
  return bag.filter((_, i) => i !== dropIdx).concat(key);
}
export function buyCareerDisc(c: Career, key: string): Career {
  if (c.discs.includes(key)) return c;
  const lock = sponsorBrandLock(c);
  if (lock && discByKey(key)?.brand !== lock) return c; // exclusive deal — off-brand discs aren't for sale
  const entry = CAREER_DISC_SHOP.find((d) => d.key === key);
  if (!entry || c.cash < entry.cost) return c; // no stage gate — just need the cash
  return { ...c, cash: c.cash - entry.cost, discs: [...c.discs, key], bag: autoBagDisc(c.bag, key) };
}
// Add/remove an owned disc from the career bag (keeps 1..CAREER_BAG_MAX in it). A
// manufacturer deal makes the bag brand-exclusive: off-brand discs can't be added.
export function toggleCareerBag(c: Career, key: string): Career {
  if (!c.discs.includes(key)) return c;
  if (c.bag.includes(key)) {
    if (c.bag.length <= 1) return c; // never empty the bag
    return { ...c, bag: c.bag.filter((k) => k !== key) };
  }
  if (c.bag.length >= CAREER_BAG_MAX) return c;
  const lock = sponsorBrandLock(c);
  if (lock && discByKey(key)?.brand !== lock) return c; // only the sponsor's plastic
  return { ...c, bag: [...c.bag, key] };
}

// Buy a career cosmetic (own-key like "skin:gold") with career cash.
export function buyCareerCosmetic(c: Career, ownKey: string, cost: number): Career {
  if (c.cosmetics.includes(ownKey) || c.cash < cost) return c;
  return { ...c, cash: c.cash - cost, cosmetics: [...c.cosmetics, ownKey] };
}
// Wear an owned cosmetic in a look slot (disc skin, basket, aim line, …).
export function equipCareerLook(c: Career, slot: keyof CareerLook, key: string): Career {
  return { ...c, look: { ...c.look, [slot]: key } };
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
