"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { submitArcadeScore, getArcadeLeaderboard } from "@/actions/arcade";
import type { ArcadeScore } from "@/lib/arcade-types";
import { getSupabase } from "@/lib/supabase/browser";
import {
  BEST_KEY, WBEST_KEY, HOLEBEST_KEY, SETTINGS_KEY, ACH_KEY, HIST_KEY, CAREER_KEY, COINS_KEY, DAILY_KEY, OWNED_KEY, PROFILE_KEY, RANKED_KEY, BAG_KEY, BAGSEEN_KEY, LEVELREWARD_KEY,
  readLocalProgress, applyProgress, mergeProgress, clearLocalProgress, type Progress,
} from "@/lib/progress";
import {
  dayNumber, claimDailyReward, dailyAvailable, coinsForRound, fmtCoins, type DailyReward,
} from "@/lib/discgolf/wallet";
import {
  AVATARS, DEFAULT_AVATAR, avatarOwnKey, avatarUnlocked, playerXp, levelFromXp, type PlayerProfile,
} from "@/lib/discgolf/profile";
import {
  TRAILS, DEFAULT_TRAIL, trailByKey, type Trail,
} from "@/lib/discgolf/trails";
import {
  DISC_SKINS, BASKET_SKINS, AIM_STYLES, GROUND_THEMES, CELEBRATIONS,
  DEFAULT_DISC_SKIN, DEFAULT_BASKET_SKIN, DEFAULT_AIM_STYLE, DEFAULT_GROUND_THEME, DEFAULT_CELEBRATION,
  COSMETIC_PREFIX, cosmeticOwnKey, cosmeticUnlocked, cosmeticByKey,
  type DiscSkin, type BasketSkin, type AimStyle, type GroundTheme, type Celebration,
} from "@/lib/discgolf/cosmetics";
import {
  weekSeed, rankedCourseKey, roundRP, applyRankedRound, tierFromRP, type RankedState,
} from "@/lib/discgolf/ranked";
import {
  dailyChallenges, weeklyChallenges, roundsThisDay, roundsThisWeek, challengeDone,
  dailyClaimKey, eventClaimKey, type Challenge, type EventRound,
} from "@/lib/discgolf/events";
import {
  W, H, DISC_R, CATCH_R, MAX_DRAG, CANCEL_R, CANCEL_POWER, HOLES, TOTAL_PAR, WINTHROP_PAR, leaderboardCourse, TOURN_KEY, TOURN_FIELD, TOURNAMENTS, tournDef, tournRoundHoles, tournPlace, tournFieldRound, tournLiveStandings, tournStandings, ACHIEVEMENTS, earnedAchievements, achievementReward, scoreLabel, courseStars, courseHoles, courseDifficultyOf, courseStarDifficulty, tournDifficulty, tournStarDifficulty, STRAIGHT_SPEED_MUL, releaseSpeedMul, ADV_DISCS, DISC_PRICE, isDiscUnlocked, levelUpChoices, validDiscIndex, DEFAULT_DISC_INDEX, BAG_MAX, discByKey, discIndexByKey, unlockedDiscKeys, reconcileBag, TOUR_COURSES, tourVenue, aimAt, camXFor, buildTournGhosts, buildRacerGhosts, ghostPosAt, AudioEngine, inRect, inHazard, offRibbons, dailySeed, buildRound, elevAt, vibrate, pxToFeet, distBetween, autoDiscIndex, lastInBoundsLie, stepFlight,
} from "@/lib/discgolf/engine";
import type {
  Vec, Tree, Hole, Mode, Tournament, TournDef, TournLiveRow, Achievement, FlightPath, Release, Flight, GhostState,
} from "@/lib/discgolf/engine";
import {
  newCareer, normalizeCareer, skillMods, seasonSchedule, simEvent, recordResult, advanceSeason, retire, seasonComplete,
  placeLabel, STAGE_LABEL, SKILL_KEYS, SKILL_LABEL, SKILL_DESC, IDENTITY_MODS,
  availableSponsors, signSponsor, trainingPointCost, buyTrainingPoint, topRivals, fmtCash, SPONSOR_CAP,
  careerRating, careerDiscShop, buyCareerDisc, toggleCareerBag, nextCareerDisc, CAREER_BAG_MAX,
  careerFieldForRound, careerCardRacers, careerLiveStandings,
  type Career, type CareerEvent, type EventResult, type CareerSkills, type SkillMods, type FieldPlayer,
} from "@/lib/discgolf/career";

// ─────────────────────────────────────────────────────────────────────────────
// Retro pixel disc-golf game. You throw from the bottom of the screen toward
// the top across the 18-hole Glendoveer East course (or a seeded Daily
// Challenge). Drag back to aim/power; pick a disc + flight shape; mind wind,
// elevation and OB. Scores persist: a personal best + per-hole bests +
// achievements in localStorage, and a saved-by-name leaderboard in Supabase.
// Everything renders to a small portrait canvas upscaled with image-rendering:
// pixelated for the crunchy old-school look.
// ─────────────────────────────────────────────────────────────────────────────

// ── Resume an interrupted round. A plain solo round (not practice / party /
// online / tournament / challenge) is deterministic from its seed, so the only
// state worth keeping is the seed, the completed-hole scores, and the bag. On
// the title screen this offers "Resume" and reconstructs the round exactly. ──
const RESUME_KEY = "discgolf.resume.v1";
const TOURBEST_KEY = "discgolf.tourbests.v1"; // best score per pro-tour venue (by seed)
const TOURNBEST_KEY = "discgolf.tournplaces.v1"; // best finishing place per tournament (by id)
const ENTRY_KEY = "discgolf.entry.v1"; // "offline" | "auth" — which front-door choice was made
type ResumeSnap = { v: 1; mode: Mode; seed: number; scores: number[] };
function holesForMode(mode: Mode): number {
  return mode === "daily" ? 9 : 18;
}
function readResume(): ResumeSnap | null {
  try {
    const r = JSON.parse(localStorage.getItem(RESUME_KEY) || "null");
    if (!r || r.v !== 1 || !Array.isArray(r.scores)) return null;
    if (r.mode !== "course" && r.mode !== "winthrop" && r.mode !== "daily") return null;
    // Nothing played yet, or already finished — not resumable.
    if (r.scores.length === 0 || r.scores.length >= holesForMode(r.mode)) return null;
    return r as ResumeSnap;
  } catch {
    return null;
  }
}

// Tournament rivals (visible "ghost" discs) are built in the engine; see
// buildTournGhosts / ghostPosAt.

// ── Online Friendly Challenge: ephemeral lobbies over Supabase Realtime
// (broadcast + presence, no database). A short shareable code names the
// channel; everyone with the code plays the same seed and scores sync live. ──
type LobbyPlayer = { id: string; name: string; host: boolean; mode?: Mode };
type OnlineScore = { name: string; scores: number[]; total: number; thru: number };
// 4-char codes, omitting easily-confused characters (0/O, 1/I, etc.).
function makeLobbyCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i++) out += alphabet[(Math.random() * alphabet.length) | 0];
  return out;
}
function makeClientId(): string {
  return `${(Math.random() * 1e9) | 0}-${(Math.random() * 1e9) | 0}`;
}

// "intro" plays a short basket → tee fly-over before you take the tee shot.
type Phase = "intro" | "aim" | "fly" | "holed";
type Screen = "landing" | "title" | "playing" | "holeComplete" | "gameComplete";

type GameState = {
  holeIndex: number;
  phase: Phase;
  mode: Mode; // daily challenge vs the full course
  practice?: boolean; // single-hole practice (no bests/history/leaderboard)
  practiceHole?: number; // 1-based hole number being practiced
  party?: { names: string[]; current: number; scores: (number | null)[][] }; // hot-seat pass-and-play
  online?: boolean; // online Friendly Challenge round (scores synced over Realtime)
  career?: { eventId: string; eventName: string; venue?: string; character?: string; emoji?: string }; // round is a played Career event
  mini?: { kind: "putt" | "target"; station: number; makes: number; best: number; points: number; attempts: number; total: number; lastPts?: number }; // practice mini-game
  skill: SkillMods; // Career skill effects on flight (identity for normal play)
  seed: number; // round seed (drives wind + pins)
  roundHoles: Hole[]; // this round's holes (wind/pins baked in)
  disc: { x: number; y: number; vx: number; vy: number };
  rest: Vec;
  angle: number;
  powerT: number;
  power: number;
  throws: number;
  discIndex: number;
  scores: number[];
  shotPaths: Vec[][]; // the actual flight path of each completed shot this hole
  roundPaths: Vec[][][]; // shotPaths of every finished hole (for the best-round ghost)
  trailBuf: Vec[]; // path of the shot currently in the air
  holedAt: number | null;
  fadeTurn: number; // radians the current flight has curved so far
  fadeSign: number; // -1 backhand (left), +1 forehand (right)
  path: FlightPath; // shape of the current flight (overstable / straight)
  release: Release; // release angle of the current flight (hyzer / flat / anny)
  h: number; // current height above the ground
  vh: number; // vertical velocity (height units per frame)
  camY: number; // top of the viewport in world coords (vertical scroll)
  camX: number; // left of the viewport in world coords (horizontal pan on wide holes)
  introT: number; // frames elapsed in the intro fly-over
  flash: { text: string; at: number } | null; // big centered penalty banner (OB / hazard)
};

function freshHole(hole: Hole) {
  const tee = hole.tee;
  return {
    phase: "intro" as Phase, // basket → tee fly-over before the tee shot
    disc: { x: tee.x, y: tee.y, vx: 0, vy: 0 },
    rest: { x: tee.x, y: tee.y },
    angle: aimAt(tee, hole.basket), // auto-aimed at the basket
    powerT: 0,
    power: 0,
    throws: 0,
    shotPaths: [] as Vec[][],
    trailBuf: [] as Vec[],
    holedAt: null as number | null,
    fadeTurn: 0,
    fadeSign: -1,
    path: "overstable" as FlightPath,
    release: "flat" as Release,
    h: 0,
    vh: 0,
    camY: 0, // start showing the basket (top), then pan down
    camX: camXFor(hole, hole.basket.x), // intro looks at the basket first
    introT: 0,
    flash: null as { text: string; at: number } | null,
  };
}

// ── Practice mini-games: flat, wide-open single-target "holes" that reuse the
// throw engine. Putting = sink a putt to advance to a longer one (miss ends the
// run). Target = land near the bullseye for points over a fixed set of throws. ──
function puttFeet(station: number): number { return 15 + station * 5; }
function puttHole(station: number): Hole {
  const distPx = 40 + station * 13;
  const tee: Vec = { x: 160, y: 420 };
  const basket: Vec = { x: 160, y: Math.max(36, 420 - distPx) };
  return { par: 1, worldH: H, tee, basket, fairway: [tee, basket], fwWidth: 640, trees: [], water: [], hazard: [], elev: 0 };
}
function targetRadiusPx(station: number): number { return Math.max(13, 34 - station * 2.4); }
function targetHole(station: number): Hole {
  const distPx = 80 + station * 16;
  const side = (Math.random() * 2 - 1) * Math.min(90, 30 + station * 8);
  const tee: Vec = { x: 160, y: 420 };
  const basket: Vec = { x: Math.max(44, Math.min(276, 160 + side)), y: Math.max(58, 420 - distPx) };
  return { par: 1, worldH: H, tee, basket, fairway: [tee, basket], fwWidth: 640, trees: [], water: [], hazard: [], elev: 0 };
}

// Every fixed course in the app (shown on the "Play Courses" page). Add new
// hand-authored courses here. `seed` is set for procedural pro-tour venues
// (mode "tour"); the two hand-authored layouts need none.
type CourseInfo = { mode: Mode; name: string; holes: number; par: number; blurb: string; seed?: number };
const FIXED_COURSES: CourseInfo[] = [
  { mode: "course", name: "Glendoveer East", holes: 18, par: TOTAL_PAR, blurb: "The Northwest's championship test. A central pond squeezes the front nine, hard doglegs bend around mature firs, and tree-gate greens punish anything but a clean approach — precision off the tee is everything here." },
  { mode: "winthrop", name: "Winthrop Lake", holes: 18, par: WINTHROP_PAR, blurb: "Host of College Nationals. The lake hugs the entire front side and forces nervy water carries, while the middle stretch is rope-hazard golf where one stray throw costs a stroke. A run of long par-4s on the back decides it." },
];
// A character-driven opening line per venue style. The concrete hole stats
// (par mix, water/sand, length) get woven in below to finish the description.
const TOUR_STYLE_INTRO: Record<string, string> = {
  "Wooded": "A tree-choked layout where every fairway threads tight gaps in the pines",
  "Water-laden": "Water is the constant here — forced carries and nervy layups around ponds at nearly every turn",
  "Links (open & windy)": "A wide-open links with almost no trees, where the gusting wind does all the defending",
  "Sandy": "A desert-style course raked with sand traps that swallow anything short or wide of the line",
  "Tight & technical": "A shot-maker's puzzle of narrow, tree-lined corridors that demand a precise line off every tee",
  "Parkland": "A classic parkland layout of rolling, generous fairways and well-guarded tree-gate greens",
};
// The standalone pro-tour venues — the same procedural courses the Career tour
// visits, now playable on their own. Each blurb is built from the venue's actual
// generated 18 holes, so it describes the real layout you're about to play.
const TOUR_COURSE_INFOS: CourseInfo[] = TOUR_COURSES.map((c) => {
  const holes = courseHoles("tour", c.seed);
  const n3 = holes.filter((h) => h.par === 3).length;
  const n4 = holes.filter((h) => h.par === 4).length;
  const n5 = holes.filter((h) => h.par === 5).length;
  const water = holes.filter((h) => (h.water?.length ?? 0) > 0).length;
  const sand = holes.filter((h) => (h.hazard?.length ?? 0) > 0).length;
  const totalFt = holes.reduce((s, h) => s + pxToFeet(h.worldH), 0);
  const intro = TOUR_STYLE_INTRO[c.character] ?? "A varied championship layout that rewards all-round play";
  const feats: string[] = [];
  if (water) feats.push(`water guards ${water} hole${water > 1 ? "s" : ""}`);
  if (sand) feats.push(`${sand} play through sand`);
  feats.push(`it plays ${totalFt.toLocaleString()} ft from the tees`);
  const blurb = `${c.emoji} ${intro}. ${n3} par-3s, ${n4} par-4s and ${n5} par-5s for a par of ${c.par}; ${feats.join(", ")}.`;
  return { mode: "tour" as Mode, name: c.name, holes: c.holes, par: c.par, seed: c.seed, blurb };
});

export function DiscGolfGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  // Drag-to-throw (Wii-golf style): pull back to set power + aim, release to throw.
  // ax/ay: where the press started (the anchor); cx/cy: the current pointer.
  // Pull is measured anchor→pointer so you can grab anywhere on screen.
  const dragRef = useRef<{ active: boolean; ax: number; ay: number; cx: number; cy: number }>({ active: false, ax: 0, ay: 0, cx: 0, cy: 0 });
  const camRef = useRef({ x: 0, y: 0 }); // current camera scroll, mirrored for the pointer handlers
  const ghostRef = useRef<Vec[][][] | null>(null); // best-round flight paths for the active course
  // Juice: short-lived particles (world coords), camera shake, basket rattle.
  type Particle = { x: number; y: number; vx: number; vy: number; g: number; life: number; max: number; color: string; size: number };
  const particlesRef = useRef<Particle[]>([]);
  // Ambient wind streaks (screen-fixed): faint lines drifting in the wind
  // direction so you can SEE the wind blowing, not just read the arrow.
  const windStreaksRef = useRef<{ x: number; y: number; len: number; a: number; sp: number }[]>([]);
  const shakeRef = useRef({ until: 0, mag: 0 });
  const rattleRef = useRef(0); // timestamp the basket chains were last hit
  const ghostsRef = useRef<GhostState | null>(null); // tournament rivals playing the current hole
  const audioRef = useRef<AudioEngine | null>(null);
  const rafRef = useRef<number>(0);

  // First load shows a "landing" front door (Play offline / Log in). An effect
  // skips it for returning visitors (and when auth isn't even configured). The
  // static initial value keeps SSR/CSR markup identical — the flag is read in an
  // effect, never during render.
  const [screen, setScreen] = useState<Screen>("landing");
  const [muted, setMuted] = useState(false);
  const [discIndex, setDiscIndex] = useState(DEFAULT_DISC_INDEX); // Buzzz (core mid) by default
  const [throwStyle, setThrowStyle] = useState<"BH" | "FH">("BH");
  const [hud, setHud] = useState<{ hole: number; par: number; throws: number; holes: number; player?: string }>({ hole: 1, par: 3, throws: 0, holes: 18 });

  // An interrupted solo round to offer "Resume" on the title screen.
  const [resumeRound, setResumeRound] = useState<ResumeSnap | null>(null);

  // End-of-round state
  const [scorecard, setScorecard] = useState<number[]>([]);
  const [finalTotal, setFinalTotal] = useState(0);
  const [finalSeed, setFinalSeed] = useState(0);
  const [finalPracticeHole, setFinalPracticeHole] = useState<number | null>(null);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [boardsOpen, setBoardsOpen] = useState(false);
  const [coursesOpen, setCoursesOpen] = useState(false);
  const [pauseMenu, setPauseMenu] = useState<{ canRestart: boolean; isCareer: boolean } | null>(null); // in-round menu (restart / sim / home / continue)
  const [tournamentOpen, setTournamentOpen] = useState(false);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const tournamentRef = useRef<Tournament | null>(null);
  useEffect(() => { tournamentRef.current = tournament; }, [tournament]);
  const tournamentPlayRef = useRef(false); // current round is a tournament round
  const [finalTournament, setFinalTournament] = useState(false);
  const [tournLiveView, setTournLiveView] = useState<{ rows: TournLiveRow[]; thru: number } | null>(null);
  const [partyOpen, setPartyOpen] = useState(false);
  const [partyView, setPartyView] = useState<{ names: string[]; holeScores: (number | null)[]; totals: number[] } | null>(null);
  const [finalParty, setFinalParty] = useState<{ names: string[]; totals: number[] } | null>(null);

  // ── Career mode (persisted locally + synced to the cloud when signed in) ──
  const [careerOpen, setCareerOpen] = useState(false);
  const [career, setCareer] = useState<Career | null>(null);
  const careerRef = useRef<Career | null>(null);
  useEffect(() => { careerRef.current = career; }, [career]);
  const careerPlayRef = useRef(false); // current round is a played Career event
  const careerEventRef = useRef<CareerEvent | null>(null); // the event being played
  const careerFieldRef = useRef<FieldPlayer[] | null>(null); // the field's per-hole scores (card + live board)
  const [careerLastResult, setCareerLastResult] = useState<EventResult | null>(null);
  const [careerCoins, setCareerCoins] = useState(0); // account coins paid by the last PLAYED career round (0 when simmed)
  const saveCareer = useCallback((c: Career | null) => {
    setCareer(c);
    careerRef.current = c;
    try {
      if (c) localStorage.setItem(CAREER_KEY, JSON.stringify(c));
      else localStorage.removeItem(CAREER_KEY);
    } catch { /* ignore */ }
  }, []);

  // ── Online Friendly Challenge lobby (Supabase Realtime) ──
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [lobby, setLobby] = useState<{ code: string; isHost: boolean; mode: Mode } | null>(null);
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [onlineScores, setOnlineScores] = useState<Record<string, OnlineScore>>({});
  const [onlineView, setOnlineView] = useState<{ hole: number; par: number; myId: string } | null>(null);
  const [finalOnline, setFinalOnline] = useState(false);
  const onlineRef = useRef<{ channel: RealtimeChannel; code: string; myId: string; myName: string; isHost: boolean; mode: Mode } | null>(null);
  const onlineScoresRef = useRef<Record<string, OnlineScore>>({});
  // The round the host has launched, kept so the host can answer a late joiner's
  // "hello" by re-sending the start signal. Also the idempotency key: a peer
  // ignores a "start" for a seed it has already begun (so a resend aimed at the
  // late joiner doesn't yank everyone else back to hole 1).
  const onlineStartedRef = useRef<{ seed: number; mode: Mode } | null>(null);
  const saveTournament = useCallback((t: Tournament | null) => {
    setTournament(t);
    try {
      if (t) localStorage.setItem(TOURN_KEY, JSON.stringify(t));
      else localStorage.removeItem(TOURN_KEY);
    } catch { /* ignore */ }
  }, []);

  // ── Challenge links: ?ch=<mode>.<seed>.<score>.<name> replays the exact
  // same round (same pins + wind) so two players can compare fairly. ──
  type Challenge = { mode: Mode; seed: number; score: number; name: string };
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const challengePlayRef = useRef(false); // current round IS the challenge round
  const [finalChallenge, setFinalChallenge] = useState<Challenge | null>(null);
  useEffect(() => {
    try {
      const raw = new URLSearchParams(location.search).get("ch");
      if (!raw) return;
      const [m, seedS, scoreS, nameS] = raw.split(".");
      const seed = Number(seedS);
      const score = Number(scoreS);
      if ((m === "course" || m === "winthrop" || m === "daily") && Number.isInteger(seed) && Number.isInteger(score) && score > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setChallenge({ mode: m, seed, score, name: decodeURIComponent(nameS ?? "").slice(0, 16) || "A friend" });
      }
    } catch { /* ignore malformed links */ }
  }, []);
  const challengeRef = useRef<Challenge | null>(null);
  useEffect(() => { challengeRef.current = challenge; }, [challenge]);
  const [finalPars, setFinalPars] = useState<number[]>(HOLES.map((h) => h.par));
  const [finalMode, setFinalMode] = useState<Mode>("course");
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [winthropBest, setWinthropBest] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [leaderboard, setLeaderboard] = useState<ArcadeScore[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const screenRef = useRef<Screen>("title");
  const pausedRef = useRef(false); // freezes the sim while the pause menu is open
  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);
  useEffect(() => { pausedRef.current = pauseMenu != null; }, [pauseMenu]);

  const discIndexRef = useRef(1);
  useEffect(() => {
    discIndexRef.current = discIndex;
  }, [discIndex]);

  const throwStyleRef = useRef<"BH" | "FH">("BH");
  useEffect(() => {
    throwStyleRef.current = throwStyle;
  }, [throwStyle]);

  const [release, setRelease] = useState<Release>("flat");
  const releaseRef = useRef<Release>("flat");
  useEffect(() => {
    releaseRef.current = release;
  }, [release]);

  // ── Settings (persisted) ──
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.7);
  const [leftHanded, setLeftHanded] = useState(false);
  const [showGhost, setShowGhost] = useState(true);
  const showGhostRef = useRef(true);
  useEffect(() => { showGhostRef.current = showGhost; }, [showGhost]);
  const leftHandedRef = useRef(false);
  useEffect(() => { leftHandedRef.current = leftHanded; }, [leftHanded]);
  const modeRef = useRef<Mode>("course");

  // Best-per-hole, achievements, round history (all persisted).
  const holeBestRef = useRef<(number | null)[]>(Array(18).fill(null));
  const [holeBestNote, setHoleBestNote] = useState<{ best: number; isNew: boolean } | null>(null);
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const unlockedRef = useRef<string[]>([]);
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const [roundsPlayed, setRoundsPlayed] = useState(0);
  const roundsPlayedRef = useRef(0);
  const [history, setHistory] = useState<EventRound[]>([]); // recorded rounds (for weekly events)

  // ── Coins economy + daily reward (persisted + cloud-synced) ──
  const [coins, setCoins] = useState(0);
  const coinsRef = useRef(0);
  useEffect(() => { coinsRef.current = coins; }, [coins]);
  const [daily, setDaily] = useState<DailyReward | null>(null);
  const [today, setToday] = useState(0); // current day number (set on mount; avoids Date.now() in render)
  const [dailyClaim, setDailyClaim] = useState<{ coins: number; streak: number } | null>(null);
  const [coinReward, setCoinReward] = useState(0); // coins earned by the round just finished
  const [miniResult, setMiniResult] = useState<{ kind: "putt" | "target"; makes: number; best: number; points: number; coins: number } | null>(null);
  // Add coins (or spend, with a negative amount): updates state, storage, cloud.
  const addCoins = useCallback((delta: number) => {
    const next = Math.max(0, Math.round(coinsRef.current + delta));
    coinsRef.current = next;
    setCoins(next);
    try { localStorage.setItem(COINS_KEY, String(next)); } catch { /* ignore */ }
  }, []);
  const claimDaily = useCallback(() => {
    const res = claimDailyReward(daily, dayNumber(Date.now()));
    if (!res) return;
    addCoins(res.coins);
    setDaily(res.reward);
    try { localStorage.setItem(DAILY_KEY, JSON.stringify(res.reward)); } catch { /* ignore */ }
    setDailyClaim({ coins: res.coins, streak: res.reward.streak });
  }, [daily, addCoins]);

  // Owned discs + cosmetics (purchased with coins) — discs are keyed by their
  // disc key, avatars by "avatar:<key>". Usable on top of achievement unlocks.
  const [owned, setOwned] = useState<string[]>([]);
  const ownedRef = useRef<string[]>([]);
  const [shopOpen, setShopOpen] = useState(false);

  // ── The bag: the ≤5 discs carried into a round (only these are selectable).
  // Discs unlock into the collection; the bag auto-fills, then the player
  // curates it. `bagSeen` records which unlocks were already auto-processed. ──
  const [bag, setBag] = useState<string[]>([]);
  const bagRef = useRef<string[]>([]);
  useEffect(() => { bagRef.current = bag; }, [bag]);
  // The bag actually carried into the round in progress: normally your account
  // bag, but during a Career round it's the career's OWN (separate) bag. The
  // disc rack + in-round disc logic read this; account bag editing is untouched.
  const [activeBag, setActiveBag] = useState<string[]>([]);
  const activeBagRef = useRef<string[]>([]);
  useEffect(() => { activeBagRef.current = activeBag; }, [activeBag]);
  useEffect(() => { if (!careerPlayRef.current) setActiveBag(bag); }, [bag]); // mirror account bag when not mid-career-round
  const [bagSeen, setBagSeen] = useState<string[]>([]);
  const [bagOpen, setBagOpen] = useState(false);
  const [bagLoaded, setBagLoaded] = useState(false); // gates auto-fill until storage is read
  // Level-up disc draft: pick 1 of 2 discs each level. `levelRewarded` is the
  // highest level already resolved (null until the first load migrates).
  const [levelRewarded, setLevelRewarded] = useState<number | null>(null);
  const [levelUp, setLevelUp] = useState<{ level: number; choices: string[] } | null>(null);
  // Move a disc between bag and collection (keeps at least 1 disc in the bag).
  const setBagDiscs = useCallback((next: string[]) => {
    bagRef.current = next; setBag(next);
    try { localStorage.setItem(BAG_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);
  const addToBag = useCallback((key: string) => {
    if (bagRef.current.includes(key) || bagRef.current.length >= BAG_MAX) return;
    setBagDiscs([...bagRef.current, key]);
  }, [setBagDiscs]);
  const removeFromBag = useCallback((key: string) => {
    if (bagRef.current.length <= 1) return; // never empty the bag
    setBagDiscs(bagRef.current.filter((k) => k !== key));
  }, [setBagDiscs]);
  // Reorder a disc within the bag (dir -1 = up/earlier, +1 = down/later). The
  // order sets the rack layout and the 1–5 number-key slots.
  const moveInBag = useCallback((key: string, dir: -1 | 1) => {
    const cur = bagRef.current;
    const i = cur.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= cur.length) return;
    const next = cur.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setBagDiscs(next);
  }, [setBagDiscs]);
  const buyItem = useCallback((ownKey: string, price: number) => {
    if (coinsRef.current < price || ownedRef.current.includes(ownKey)) return;
    addCoins(-price);
    const next = [...ownedRef.current, ownKey];
    ownedRef.current = next;
    setOwned(next);
    try { localStorage.setItem(OWNED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, [addCoins]);
  // Claim a disc from the level-up draft: own it, drop it in the bag if there's
  // room (else it waits in the collection), and mark this level resolved.
  const claimLevelUp = useCallback((key: string) => {
    if (!ownedRef.current.includes(key)) {
      const no = [...ownedRef.current, key];
      ownedRef.current = no; setOwned(no);
      try { localStorage.setItem(OWNED_KEY, JSON.stringify(no)); } catch { /* ignore */ }
    }
    if (!bagRef.current.includes(key) && bagRef.current.length < BAG_MAX) {
      const nb = [...bagRef.current, key];
      bagRef.current = nb; setBag(nb);
      try { localStorage.setItem(BAG_KEY, JSON.stringify(nb)); } catch { /* ignore */ }
    }
    setLevelUp((lu) => {
      const lvl = lu?.level ?? 0;
      if (lvl) { setLevelRewarded(lvl); try { localStorage.setItem(LEVELREWARD_KEY, String(lvl)); } catch { /* ignore */ } }
      return null;
    });
  }, []);

  // Player profile (name + avatar + cosmetics). Persisted + cloud-synced.
  const [profile, setProfile] = useState<PlayerProfile>({ name: "", avatar: DEFAULT_AVATAR, trail: DEFAULT_TRAIL });
  const [profileOpen, setProfileOpen] = useState(false);
  // Chosen cosmetics, mirrored to refs so the render loop can read them cheaply.
  const trailKeyRef = useRef<string>(DEFAULT_TRAIL);
  const discSkinRef = useRef<string>(DEFAULT_DISC_SKIN);
  const basketSkinRef = useRef<string>(DEFAULT_BASKET_SKIN);
  const aimStyleRef = useRef<string>(DEFAULT_AIM_STYLE);
  const groundThemeRef = useRef<string>(DEFAULT_GROUND_THEME);
  const celebrationRef = useRef<string>(DEFAULT_CELEBRATION);
  useEffect(() => { trailKeyRef.current = profile.trail || DEFAULT_TRAIL; }, [profile.trail]);
  useEffect(() => { discSkinRef.current = profile.discSkin || DEFAULT_DISC_SKIN; }, [profile.discSkin]);
  useEffect(() => { basketSkinRef.current = profile.basketSkin || DEFAULT_BASKET_SKIN; }, [profile.basketSkin]);
  useEffect(() => { aimStyleRef.current = profile.aimStyle || DEFAULT_AIM_STYLE; }, [profile.aimStyle]);
  useEffect(() => { groundThemeRef.current = profile.groundTheme || DEFAULT_GROUND_THEME; }, [profile.groundTheme]);
  useEffect(() => { celebrationRef.current = profile.celebration || DEFAULT_CELEBRATION; }, [profile.celebration]);
  const saveProfile = useCallback((next: PlayerProfile) => {
    setProfile(next);
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);
  const buyAvatar = useCallback((key: string, price: number) => buyItem(avatarOwnKey(key), price), [buyItem]);

  // ── Ranked ladder (lifetime RP + tier, persisted + cloud-synced) ──
  const [ranked, setRanked] = useState<RankedState | null>(null);
  const rankedRef = useRef<RankedState | null>(null);
  const [rankedOpen, setRankedOpen] = useState(false);
  const [rankedGain, setRankedGain] = useState<number | null>(null); // RP gained by the round just finished

  // ── Recurring daily + weekly challenges (rotating objectives that pay coins) ──
  const [challengesOpen, setChallengesOpen] = useState(false);
  // Claiming marks the reward in `owned` (cloud-synced, union-merged) under its
  // claim key so it can't be double-claimed, and pays the coins.
  const claimChallenge = useCallback((claimKey: string, reward: number) => {
    if (ownedRef.current.includes(claimKey)) return;
    addCoins(reward);
    const next = [...ownedRef.current, claimKey];
    ownedRef.current = next; setOwned(next);
    try { localStorage.setItem(OWNED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, [addCoins]);

  // Player level — drives the level-up draft. XP counts DISCS owned, not cosmetics
  // (avatar:/trail:/event: … keys), so every level readout matches the profile.
  const discsOwned = owned.filter((k) => !k.includes(":")).length;
  const playerLevel = levelFromXp(playerXp(roundsPlayed, unlocked.length, discsOwned)).level;

  // Level-up disc draft. On the first load under this system, grandfather every
  // disc the player already had (so nothing's lost) and mark all past levels
  // resolved. Thereafter, each new level offers a 1-of-2 disc choice (one popup
  // per level, oldest first). Skips levels with nothing new to offer.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!bagLoaded || levelUp) return; // wait for storage; resolve one popup at a time
    if (levelRewarded == null) {
      // Migration: own everything previously accessible (bagSeen captured it) so
      // nothing's lost. Mark resolved at the POST-grandfather level (owning those
      // discs adds XP) so existing players don't get a flood of retro drafts.
      const grand = Array.from(new Set([...ownedRef.current, ...bagSeen]));
      if (grand.length !== ownedRef.current.length) {
        ownedRef.current = grand; setOwned(grand);
        try { localStorage.setItem(OWNED_KEY, JSON.stringify(grand)); } catch { /* ignore */ }
      }
      const lvl = levelFromXp(playerXp(roundsPlayed, unlocked.length, grand.filter((k) => !k.includes(":")).length)).level;
      setLevelRewarded(lvl);
      try { localStorage.setItem(LEVELREWARD_KEY, String(lvl)); } catch { /* ignore */ }
      return;
    }
    if (playerLevel > levelRewarded) {
      const next = levelRewarded + 1;
      const choices = levelUpChoices(next, unlocked, owned);
      if (choices.length === 0) {
        setLevelRewarded(next); // nothing to draft at this level — advance
        try { localStorage.setItem(LEVELREWARD_KEY, String(next)); } catch { /* ignore */ }
      } else {
        setLevelUp({ level: next, choices });
      }
    }
  }, [bagLoaded, levelUp, levelRewarded, playerLevel, roundsPlayed, unlocked, owned, bagSeen]);

  // Keep the bag reconciled with what's unlocked: auto-add freshly-unlocked
  // discs until the bag is full, leaving the rest in the collection. Gated until
  // the level-up migration has run so a saved bag is never stripped.
  useEffect(() => {
    if (!bagLoaded || levelRewarded == null) return;
    const unlockedKeys = unlockedDiscKeys(unlocked, owned, playerLevel);
    const res = reconcileBag(bagRef.current, bagSeen, unlockedKeys);
    const bagChanged = JSON.stringify(res.bag) !== JSON.stringify(bagRef.current);
    const seenChanged = res.seen.length !== bagSeen.length;
    if (bagChanged) { bagRef.current = res.bag; setBag(res.bag); try { localStorage.setItem(BAG_KEY, JSON.stringify(res.bag)); } catch { /* ignore */ } }
    if (seenChanged) { setBagSeen(res.seen); try { localStorage.setItem(BAGSEEN_KEY, JSON.stringify(res.seen)); } catch { /* ignore */ } }
  }, [bagLoaded, levelRewarded, unlocked, owned, playerLevel, bagSeen]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Title-screen navigation: a small hub so the menu isn't a wall of buttons.
  const [hub, setHub] = useState<"home" | "solo" | "online">("home");
  // How many challenge rewards (daily + weekly) are ready to claim (badged).
  const claimableEvents = (() => {
    const hist = history as EventRound[];
    const wk = weekSeed(today * 86_400_000); // `today` is a day number → land in this week
    const dayRows = roundsThisDay(hist, today);
    const weekRows = roundsThisWeek(hist, wk);
    const dailyN = dailyChallenges(today).filter((c) => challengeDone(c, dayRows) && !owned.includes(dailyClaimKey(today, c.id))).length;
    const weeklyN = weeklyChallenges(wk).filter((c) => challengeDone(c, weekRows) && !owned.includes(eventClaimKey(wk, c.id))).length;
    return dailyN + weeklyN;
  })();

  // A resumable Daily round takes over the Daily Challenge button (Single Player
  // page); any other interrupted solo round shows as a banner above the menu.
  const dailyResume = resumeRound && resumeRound.mode === "daily" ? resumeRound : null;
  const resumeBanner = resumeRound && resumeRound.mode !== "daily" ? resumeRound : null;
  const menuTopMargin = challenge || resumeBanner ? "mt-3" : "mt-7";

  // Per-venue best scores for the standalone pro-tour courses (keyed by seed).
  const [tourBests, setTourBests] = useState<Record<number, number>>({});
  const [tournBests, setTournBests] = useState<Record<string, number>>({}); // best finishing place per tournament id

  // Read all persisted progress from localStorage into state/refs. Runs once on
  // mount and again after a cloud sync overwrites localStorage.
  const loadLocal = useCallback(() => {
    try {
      const best = localStorage.getItem(BEST_KEY);
      setBestScore(best && Number.isFinite(Number(best)) ? Number(best) : null);
      const wBest = localStorage.getItem(WBEST_KEY);
      setWinthropBest(wBest && Number.isFinite(Number(wBest)) ? Number(wBest) : null);

      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      if (s.throwStyle === "BH" || s.throwStyle === "FH") setThrowStyle(s.throwStyle);
      if (s.release === "hyzer" || s.release === "flat" || s.release === "anny") setRelease(s.release);
      if (typeof s.musicVolume === "number") setMusicVolume(s.musicVolume);
      if (typeof s.leftHanded === "boolean") setLeftHanded(s.leftHanded);
      if (typeof s.showGhost === "boolean") setShowGhost(s.showGhost);
      if (typeof s.muted === "boolean") setMuted(s.muted);

      const hb = JSON.parse(localStorage.getItem(HOLEBEST_KEY) || "null");
      holeBestRef.current = Array(18).fill(null).map((_, i) => (Array.isArray(hb) && typeof hb[i] === "number" ? hb[i] : null));
      const ach = JSON.parse(localStorage.getItem(ACH_KEY) || "[]");
      if (Array.isArray(ach)) { unlockedRef.current = ach; setUnlocked(ach); }
      const hist = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
      if (Array.isArray(hist)) { roundsPlayedRef.current = hist.length; setRoundsPlayed(hist.length); setHistory(hist); }
      const tourn = JSON.parse(localStorage.getItem(TOURN_KEY) || "null");
      if (tourn && typeof tourn.id === "string" && tournDef(tourn.id) && Array.isArray(tourn.myTotals)) setTournament(tourn);
      setResumeRound(readResume());
      const car = JSON.parse(localStorage.getItem(CAREER_KEY) || "null");
      if (car && car.v === 1 && car.skills) { const nc = normalizeCareer(car); setCareer(nc); careerRef.current = nc; }
      const coinRaw = localStorage.getItem(COINS_KEY);
      const co = coinRaw != null && Number.isFinite(Number(coinRaw)) ? Number(coinRaw) : 0;
      coinsRef.current = co; setCoins(co);
      setDaily(JSON.parse(localStorage.getItem(DAILY_KEY) || "null"));
      setToday(dayNumber(Date.now()));
      const ow = JSON.parse(localStorage.getItem(OWNED_KEY) || "[]");
      ownedRef.current = Array.isArray(ow) ? ow : []; setOwned(ownedRef.current);
      const prof = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
      if (prof && typeof prof === "object") {
        setProfile({
          name: typeof prof.name === "string" ? prof.name : "",
          avatar: typeof prof.avatar === "string" ? prof.avatar : DEFAULT_AVATAR,
          trail: typeof prof.trail === "string" ? prof.trail : DEFAULT_TRAIL,
          discSkin: typeof prof.discSkin === "string" ? prof.discSkin : DEFAULT_DISC_SKIN,
          basketSkin: typeof prof.basketSkin === "string" ? prof.basketSkin : DEFAULT_BASKET_SKIN,
          aimStyle: typeof prof.aimStyle === "string" ? prof.aimStyle : DEFAULT_AIM_STYLE,
          groundTheme: typeof prof.groundTheme === "string" ? prof.groundTheme : DEFAULT_GROUND_THEME,
          celebration: typeof prof.celebration === "string" ? prof.celebration : DEFAULT_CELEBRATION,
        });
      }
      const rk = JSON.parse(localStorage.getItem(RANKED_KEY) || "null");
      if (rk && typeof rk === "object" && typeof rk.rp === "number") {
        const st: RankedState = { rp: rk.rp, bestToPar: typeof rk.bestToPar === "number" ? rk.bestToPar : null, rounds: typeof rk.rounds === "number" ? rk.rounds : 0 };
        rankedRef.current = st; setRanked(st);
      }
      const tb = JSON.parse(localStorage.getItem(TOURBEST_KEY) || "{}");
      if (tb && typeof tb === "object") setTourBests(tb);
      const tnb = JSON.parse(localStorage.getItem(TOURNBEST_KEY) || "{}");
      if (tnb && typeof tnb === "object") setTournBests(tnb);
      const sb = JSON.parse(localStorage.getItem(BAG_KEY) || "[]");
      if (Array.isArray(sb)) { bagRef.current = sb; setBag(sb); }
      const ss = JSON.parse(localStorage.getItem(BAGSEEN_KEY) || "[]");
      if (Array.isArray(ss)) setBagSeen(ss);
      const lr = localStorage.getItem(LEVELREWARD_KEY);
      setLevelRewarded(lr != null && Number.isFinite(Number(lr)) ? Number(lr) : null);
    } catch {
      /* ignore */
    }
    setBagLoaded(true); // let the bag-reconcile effect run now that storage is read
  }, []);

  // Snapshot / clear the resumable solo round.
  const persistResume = useCallback((g: GameState) => {
    if (g.practice || g.party || g.online || g.career || tournamentPlayRef.current || challengePlayRef.current || careerPlayRef.current) return;
    const scores = g.scores.slice(0, g.holeIndex + 1).map((n) => n ?? 0);
    try {
      localStorage.setItem(RESUME_KEY, JSON.stringify({ v: 1, mode: g.mode, seed: g.seed, scores }));
    } catch { /* ignore */ }
  }, []);
  const clearResume = useCallback(() => {
    setResumeRound(null);
    try { localStorage.removeItem(RESUME_KEY); } catch { /* ignore */ }
  }, []);

  // Load once after mount (keeps SSR/CSR markup identical).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { loadLocal(); }, [loadLocal]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ── Optional login + cloud progress (Supabase, the arcade_progress table) ──
  const supa = getSupabase();
  // Skip the landing front door for returning visitors, or when auth isn't
  // configured (then there's no "log in" choice to offer).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let skip = !supa;
    try { if (localStorage.getItem(ENTRY_KEY)) skip = true; } catch { /* ignore */ }
    if (skip) setScreen((s) => (s === "landing" ? "title" : s));
  }, [supa]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false); // arrived via a password-reset link → set a new password
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Push the current local progress to the signed-in user's row in the
  // arcade_progress table. (Previously stored in auth user_metadata, but that
  // bloated the session JWT — which the cookie-based sister apps store in a
  // cookie — past Vercel's request-header limit. Keep it out of metadata.)
  const pushCloud = useCallback(async (p?: Progress) => {
    if (!supa) return;
    try {
      const { data } = await supa.auth.getUser();
      if (!data.user) return;
      await supa.from("arcade_progress").upsert(
        { user_id: data.user.id, data: p ?? readLocalProgress(), updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    } catch { /* ignore */ }
  }, [supa]);

  // Debounced cloud save (called after rounds, hole bests, settings changes).
  const saveProgress = useCallback(() => {
    if (!supa || !user) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void pushCloud(); }, 1200);
  }, [supa, user, pushCloud]);

  // Flush any pending save the moment the app is backgrounded or closed, so the
  // last change (a finished career round, a new best, a purchase) is never lost
  // to the 1.2s debounce when you swipe the PWA away or switch tabs.
  useEffect(() => {
    if (!supa || !user) return;
    const flush = () => {
      if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
      void pushCloud();
    };
    const onVis = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flush);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("pagehide", flush); };
  }, [supa, user, pushCloud]);

  // On sign-in (and at startup if already signed in), merge cloud progress with
  // local so nothing is lost, then write the union back.
  useEffect(() => {
    if (!supa) return;
    let active = true;
    const onSession = async (sessUser: { id: string; email?: string } | null) => {
      if (!active) return;
      if (!sessUser) { setUser(null); return; }
      setUser({ email: sessUser.email ?? "player" });
      // Cloud progress now lives in the arcade_progress table (see pushCloud).
      let cloud: Progress | undefined;
      try {
        const { data } = await supa
          .from("arcade_progress")
          .select("data")
          .eq("user_id", sessUser.id)
          .maybeSingle();
        cloud = (data?.data as Progress | undefined) ?? undefined;
      } catch { /* ignore */ }
      const merged = cloud ? mergeProgress(readLocalProgress(), cloud) : readLocalProgress();
      if (cloud) { applyProgress(merged); loadLocal(); }
      await pushCloud(merged);
    };
    const { data: sub } = supa.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        // Arrived from a reset-password email link: sign them in, then prompt for
        // a new password.
        void onSession(session?.user ?? null);
        setRecovering(true); setAuthErr(null); setAuthMsg(null); setScreen("title"); setAuthOpen(true);
      } else if (event === "INITIAL_SESSION" || event === "SIGNED_IN") void onSession(session?.user ?? null);
      else if (event === "SIGNED_OUT") setUser(null);
      // ignore TOKEN_REFRESHED / USER_UPDATED to avoid update loops
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [supa, loadLocal, pushCloud]);

  const signIn = useCallback(async () => {
    if (!supa) return;
    setAuthBusy(true); setAuthErr(null); setAuthMsg(null);
    const { error } = await supa.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword });
    if (error) setAuthErr(error.message);
    else { setAuthOpen(false); setAuthPassword(""); }
    setAuthBusy(false);
  }, [supa, authEmail, authPassword]);

  const signUp = useCallback(async () => {
    if (!supa) return;
    setAuthBusy(true); setAuthErr(null); setAuthMsg(null);
    const { data, error } = await supa.auth.signUp({
      email: authEmail.trim(),
      password: authPassword,
      options: { emailRedirectTo: typeof location !== "undefined" ? location.origin : undefined },
    });
    if (error) setAuthErr(error.message);
    else if (!data.session) setAuthMsg("Account created! Check your email for a confirmation link to finish signing in.");
    else { setAuthOpen(false); setAuthPassword(""); }
    setAuthBusy(false);
  }, [supa, authEmail, authPassword]);

  // Send a password-reset link to the entered email.
  const resetPassword = useCallback(async () => {
    if (!supa) return;
    const email = authEmail.trim();
    if (!email) { setAuthErr("Enter your email above first, then tap Forgot password."); return; }
    setAuthBusy(true); setAuthErr(null); setAuthMsg(null);
    const { error } = await supa.auth.resetPasswordForEmail(email, { redirectTo: typeof location !== "undefined" ? location.origin : undefined });
    if (error) setAuthErr(error.message);
    else setAuthMsg("Password reset link sent — check your email.");
    setAuthBusy(false);
  }, [supa, authEmail]);

  // Set a new password (after following the reset link → PASSWORD_RECOVERY).
  const updatePassword = useCallback(async () => {
    if (!supa) return;
    if (authPassword.length < 6) { setAuthErr("Password must be at least 6 characters."); return; }
    setAuthBusy(true); setAuthErr(null); setAuthMsg(null);
    const { error } = await supa.auth.updateUser({ password: authPassword });
    if (error) setAuthErr(error.message);
    else { setRecovering(false); setAuthPassword(""); setAuthOpen(false); }
    setAuthBusy(false);
  }, [supa, authPassword]);

  const signOut = useCallback(async () => {
    if (!supa) return;
    await supa.auth.signOut();
    setUser(null);
    // Leaving the account wipes THIS DEVICE'S copy so the next "Play offline" or
    // sign-up starts a fresh account (the cloud keeps the signed-out account's
    // data — logging back in restores it). Device settings are kept. Reload so
    // every in-memory value resets cleanly and we land on the front door.
    try {
      localStorage.removeItem(ENTRY_KEY);
      [RESUME_KEY, TOURN_KEY, TOURBEST_KEY, TOURNBEST_KEY].forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
    clearLocalProgress();
    if (typeof location !== "undefined") location.reload();
  }, [supa]);

  // Front-door choice: remember it and enter the game (opening the login panel
  // when they picked "Log in / Sign up").
  const chooseEntry = useCallback((choice: "offline" | "auth") => {
    try { localStorage.setItem(ENTRY_KEY, choice); } catch { /* ignore */ }
    setScreen("title");
    if (choice === "auth") { setAuthErr(null); setAuthMsg(null); setAuthOpen(true); }
  }, []);

  // Persist settings + push the music volume to the live engine.
  useEffect(() => {
    audioRef.current?.setMusicVolume(musicVolume);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ throwStyle, release, musicVolume, leftHanded, showGhost, muted }));
    } catch { /* ignore */ }
    saveProgress();
  }, [throwStyle, release, musicVolume, leftHanded, showGhost, muted, saveProgress]);

  // Sync the career save to the cloud whenever it changes (debounced; no-op
  // when signed out). localStorage is already written by saveCareer.
  useEffect(() => { if (career) saveProgress(); }, [career, saveProgress]);
  // Sync coins + daily-reward + owned items + profile + ranked to the cloud on change.
  useEffect(() => { saveProgress(); }, [coins, daily, owned, profile, ranked, bag, bagSeen, levelRewarded, saveProgress]);

  const syncHud = useCallback(() => {
    const g = stateRef.current;
    if (!g) return;
    setHud({ hole: g.holeIndex + 1, par: g.roundHoles[g.holeIndex].par, throws: g.throws, holes: g.roundHoles.length, player: g.party ? g.party.names[g.party.current] : undefined });
  }, []);

  // Auto-caddie: equip the disc the current lie calls for — a straight driver
  // off the tee, a midrange/putter as the basket gets close. The player can
  // still switch by hand for any shot. Skipped during the putt/target minis.
  const equipForLie = useCallback(() => {
    const g = stateRef.current;
    if (!g || g.mini) return;
    const hole = g.roundHoles[g.holeIndex];
    const i = autoDiscIndex(distBetween(g.rest, hole.basket), activeBagRef.current, hole.elev ?? 0);
    g.discIndex = i;
    discIndexRef.current = i;
    setDiscIndex(i);
  }, []);

  const startGame = useCallback((mode?: Mode, seedOverride?: number) => {
    // "tour" only exists inside Career events — never fall back to it for a
    // plain title-screen round (default to Glendoveer instead).
    const m = mode ?? (modeRef.current === "tour" ? "course" : modeRef.current);
    modeRef.current = m;
    if (!audioRef.current) {
      audioRef.current = new AudioEngine();
      audioRef.current.setMusicVolume(musicVolume);
    }
    audioRef.current.resume();
    audioRef.current.setMuted(muted);
    audioRef.current.startMusic();
    challengePlayRef.current = false; // the challenge button re-arms this after calling
    tournamentPlayRef.current = false; // ditto for the tournament launcher
    careerPlayRef.current = false;
    const seed = seedOverride ?? (m === "daily" ? dailySeed() : m === "ranked" ? weekSeed(Date.now()) : (Math.random() * 1e9) | 0);
    const roundHoles = buildRound(seed, m);
    const discIndex = validDiscIndex(discIndexRef.current, bagRef.current);
    discIndexRef.current = discIndex;
    setDiscIndex(discIndex);
    stateRef.current = {
      holeIndex: 0, scores: [], discIndex, roundPaths: [],
      mode: m, skill: IDENTITY_MODS, seed, roundHoles, ...freshHole(roundHoles[0]),
    };
    // Load this course's best-round ghost (drawn as faint gold lines).
    try {
      ghostRef.current = m === "course" || m === "winthrop" ? JSON.parse(localStorage.getItem(`discgolf.ghost.${m}`) || "null") : null;
    } catch { ghostRef.current = null; }
    setSaved(false);
    setSaveErr(null);
    setIsNewBest(false);
    setNewAchievements([]);
    setHoleBestNote(null);
    setPartyView(null);
    setOnlineView(null);
    setSettingsOpen(false);
    clearResume(); // a brand-new round supersedes any saved one
    setScreen("playing");
    syncHud();
  }, [muted, musicVolume, syncHud, clearResume]);

  // ── Career handlers ──
  const [careerNotes, setCareerNotes] = useState<string[]>([]);

  // Play a Career event as a real round, with your skills bending the flight.
  const startCareerEvent = useCallback((c: Career, ev: CareerEvent) => {
    modeRef.current = ev.mode;
    if (!audioRef.current) {
      audioRef.current = new AudioEngine();
      audioRef.current.setMusicVolume(musicVolume);
    }
    audioRef.current.resume();
    audioRef.current.setMuted(muted);
    audioRef.current.startMusic();
    challengePlayRef.current = false;
    tournamentPlayRef.current = false;
    careerPlayRef.current = true;
    careerEventRef.current = ev;
    // Deterministic seed per (career, event) so a replay plays the same course.
    // Tour events carry their own course seed (it also drives the venue + par).
    let seed = ev.seed;
    if (seed == null) {
      let h = c.seed >>> 0;
      for (let i = 0; i < ev.id.length; i++) h = (Math.imul(h, 31) + ev.id.charCodeAt(i)) >>> 0;
      seed = h | 0;
    }
    const roundHoles = buildRound(seed, ev.mode);
    // The field reacts to this course's wind/slope/hazards (card + live board).
    careerFieldRef.current = careerFieldForRound(c, ev, roundHoles);
    // Career carries its OWN bag (its separate disc collection), not your account bag.
    const careerBag = c.bag.length ? c.bag : ["aviar", "buzzz"];
    activeBagRef.current = careerBag;
    setActiveBag(careerBag);
    const discIndex = validDiscIndex(discIndexRef.current, careerBag);
    discIndexRef.current = discIndex;
    setDiscIndex(discIndex);
    stateRef.current = {
      holeIndex: 0, scores: [], discIndex, roundPaths: [],
      mode: ev.mode, skill: skillMods(c.skills),
      career: { eventId: ev.id, eventName: ev.name, venue: ev.venue, character: ev.character, emoji: ev.emoji },
      seed, roundHoles, ...freshHole(roundHoles[0]),
    };
    ghostRef.current = null;
    setSaved(false);
    setSaveErr(null);
    setIsNewBest(false);
    setNewAchievements([]);
    setHoleBestNote(null);
    setPartyView(null);
    setOnlineView(null);
    setCareerOpen(false);
    setScreen("playing");
    syncHud();
  }, [muted, musicVolume, syncHud]);

  // Simulate an event instantly from your skills, record it, and stay in the hub.
  const simCareerEvent = useCallback((ev: CareerEvent) => {
    const c = careerRef.current;
    if (!c) return;
    const { score } = simEvent(c, ev);
    const { career: nc, result } = recordResult(c, ev, score, false);
    saveCareer(nc);
    setCareerLastResult(result);
    setCareerCoins(0); // simmed rounds pay no account coins
  }, [saveCareer]);

  const advanceCareerSeason = useCallback((alloc: Partial<CareerSkills>) => {
    const c = careerRef.current;
    if (!c) return;
    const { career: nc, notes } = advanceSeason(c, alloc);
    saveCareer(nc);
    setCareerLastResult(null);
    setCareerNotes(notes);
  }, [saveCareer]);

  const startNewCareer = useCallback((name: string) => {
    saveCareer(newCareer(name, (Math.random() * 1e9) | 0));
    setCareerLastResult(null);
    setCareerNotes([]);
  }, [saveCareer]);

  // Resume an interrupted solo round: rebuild the exact holes from the seed and
  // jump to the next unplayed hole with the completed scores restored.
  const startResume = useCallback((snap: ResumeSnap) => {
    modeRef.current = snap.mode;
    if (!audioRef.current) {
      audioRef.current = new AudioEngine();
      audioRef.current.setMusicVolume(musicVolume);
    }
    audioRef.current.resume();
    audioRef.current.setMuted(muted);
    audioRef.current.startMusic();
    challengePlayRef.current = false;
    tournamentPlayRef.current = false;
    const roundHoles = buildRound(snap.seed, snap.mode);
    const holeIndex = Math.min(snap.scores.length, roundHoles.length - 1);
    const discIndex = validDiscIndex(discIndexRef.current, bagRef.current);
    discIndexRef.current = discIndex;
    setDiscIndex(discIndex);
    stateRef.current = {
      holeIndex, scores: snap.scores.slice(), discIndex, roundPaths: [],
      mode: snap.mode, skill: IDENTITY_MODS, seed: snap.seed, roundHoles, ...freshHole(roundHoles[holeIndex]),
    };
    try {
      ghostRef.current = snap.mode === "course" || snap.mode === "winthrop" ? JSON.parse(localStorage.getItem(`discgolf.ghost.${snap.mode}`) || "null") : null;
    } catch { ghostRef.current = null; }
    setSaved(false);
    setSaveErr(null);
    setIsNewBest(false);
    setNewAchievements([]);
    setHoleBestNote(null);
    setPartyView(null);
    setOnlineView(null);
    setSettingsOpen(false);
    setScreen("playing");
    syncHud();
  }, [muted, musicVolume, syncHud]);

  // Practice a single hole: same engine, but nothing counts (no bests,
  // history, achievements, or leaderboard) — pure reps.
  const startPractice = useCallback((m: Mode, holeIdx: number, seedOverride?: number) => {
    modeRef.current = m;
    if (!audioRef.current) {
      audioRef.current = new AudioEngine();
      audioRef.current.setMusicVolume(musicVolume);
    }
    audioRef.current.resume();
    audioRef.current.setMuted(muted);
    audioRef.current.startMusic();
    challengePlayRef.current = false;
    // Tour venues are identified by their seed (the layout); Glendoveer/Winthrop
    // get a random seed for jittered pins.
    const seed = seedOverride ?? ((Math.random() * 1e9) | 0);
    const roundHoles = [buildRound(seed, m)[holeIdx]];
    const discIndex = validDiscIndex(discIndexRef.current, bagRef.current);
    discIndexRef.current = discIndex;
    setDiscIndex(discIndex);
    stateRef.current = {
      holeIndex: 0, scores: [], discIndex, roundPaths: [],
      mode: m, skill: IDENTITY_MODS, seed, roundHoles, practice: true, practiceHole: holeIdx + 1, ...freshHole(roundHoles[0]),
    };
    ghostRef.current = null;
    setSaved(false);
    setSaveErr(null);
    setIsNewBest(false);
    setNewAchievements([]);
    setHoleBestNote(null);
    setPartyView(null);
    setOnlineView(null);
    setSettingsOpen(false);
    setScreen("playing");
    syncHud();
  }, [muted, musicVolume, syncHud]);

  // Putting / Target practice mini-game.
  const startMini = useCallback((kind: "putt" | "target") => {
    if (!audioRef.current) {
      audioRef.current = new AudioEngine();
      audioRef.current.setMusicVolume(musicVolume);
    }
    audioRef.current.resume();
    audioRef.current.setMuted(muted);
    audioRef.current.startMusic();
    challengePlayRef.current = false; tournamentPlayRef.current = false; careerPlayRef.current = false;
    const hole = kind === "putt" ? puttHole(0) : targetHole(0);
    stateRef.current = {
      holeIndex: 0, scores: [], discIndex: 0, roundPaths: [],
      mode: "course", skill: IDENTITY_MODS, seed: 0, roundHoles: [hole], practice: true,
      mini: { kind, station: 0, makes: 0, best: 0, points: 0, attempts: 0, total: 10 },
      ...freshHole(hole),
    };
    if (stateRef.current) stateRef.current.phase = "aim"; // skip the fly-over intro
    setDiscIndex(0);
    ghostRef.current = null;
    careerFieldRef.current = null;
    setMiniResult(null);
    setPartyView(null); setOnlineView(null); setSettingsOpen(false); setPracticeOpen(false);
    setScreen("playing");
    syncHud();
  }, [muted, musicVolume, syncHud]);

  // Hot-seat pass-and-play: 2-4 players take turns playing each hole on one
  // device. Nothing counts toward records — it's bragging rights only.
  const startParty = useCallback((m: Mode, names: string[]) => {
    modeRef.current = m;
    if (!audioRef.current) {
      audioRef.current = new AudioEngine();
      audioRef.current.setMusicVolume(musicVolume);
    }
    audioRef.current.resume();
    audioRef.current.setMuted(muted);
    audioRef.current.startMusic();
    challengePlayRef.current = false;
    tournamentPlayRef.current = false;
    const seed = m === "daily" ? dailySeed() : (Math.random() * 1e9) | 0;
    const roundHoles = buildRound(seed, m);
    const discIndex = validDiscIndex(discIndexRef.current, bagRef.current);
    discIndexRef.current = discIndex;
    setDiscIndex(discIndex);
    stateRef.current = {
      holeIndex: 0, scores: [], discIndex, roundPaths: [],
      mode: m, skill: IDENTITY_MODS, seed, roundHoles, practice: true,
      party: { names, current: 0, scores: names.map(() => Array(roundHoles.length).fill(null)) },
      ...freshHole(roundHoles[0]),
    };
    ghostRef.current = null;
    setSaved(false);
    setSaveErr(null);
    setIsNewBest(false);
    setNewAchievements([]);
    setHoleBestNote(null);
    setPartyView(null);
    setOnlineView(null);
    setSettingsOpen(false);
    setScreen("playing");
    syncHud();
  }, [muted, musicVolume, syncHud]);

  // ── Online Friendly Challenge controller ──
  // Begin an online round (host on Start, everyone else on the "start"
  // broadcast). Same seed ⇒ identical holes; scores sync hole-by-hole.
  const beginOnlineRound = useCallback((seed: number, m: Mode) => {
    const o = onlineRef.current;
    if (!o) return;
    // Ignore a duplicate start for a round we've already begun — the host
    // re-broadcasts "start" to catch up late joiners, and that resend reaches
    // everyone, including peers already playing/finished this seed.
    if (onlineStartedRef.current?.seed === seed) return;
    onlineStartedRef.current = { seed, mode: m };
    modeRef.current = m;
    if (!audioRef.current) {
      audioRef.current = new AudioEngine();
      audioRef.current.setMusicVolume(musicVolume);
    }
    audioRef.current.resume();
    audioRef.current.setMuted(muted);
    audioRef.current.startMusic();
    challengePlayRef.current = false;
    tournamentPlayRef.current = false;
    const roundHoles = buildRound(seed, m);
    const discIndex = validDiscIndex(discIndexRef.current, bagRef.current);
    discIndexRef.current = discIndex;
    setDiscIndex(discIndex);
    onlineScoresRef.current = { [o.myId]: { name: o.myName, scores: [], total: 0, thru: 0 } };
    setOnlineScores(onlineScoresRef.current);
    stateRef.current = {
      holeIndex: 0, scores: [], discIndex, roundPaths: [],
      mode: m, skill: IDENTITY_MODS, seed, roundHoles, online: true,
      ...freshHole(roundHoles[0]),
    };
    ghostRef.current = null;
    setSaved(false);
    setSaveErr(null);
    setIsNewBest(false);
    setNewAchievements([]);
    setHoleBestNote(null);
    setPartyView(null);
    setOnlineView(null);
    setChallengeOpen(false);
    setScreen("playing");
    syncHud();
  }, [muted, musicVolume, syncHud]);

  // Join a Realtime channel for a lobby code: presence drives the roster,
  // broadcast carries the start signal and live scores.
  const connectLobby = useCallback((code: string, myName: string, isHost: boolean, m: Mode) => {
    if (!supa) return false;
    const myId = makeClientId();
    const channel = supa.channel(`dga-lobby-${code}`, {
      config: { presence: { key: myId }, broadcast: { self: false } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const st = channel.presenceState() as unknown as Record<string, LobbyPlayer[]>;
        setLobbyPlayers(Object.values(st).map((arr) => arr[0]).filter(Boolean));
      })
      .on("broadcast", { event: "start" }, ({ payload }) => {
        beginOnlineRound(payload.seed as number, payload.mode as Mode);
      })
      .on("broadcast", { event: "hello" }, () => {
        // A peer just joined. If we're the host and a round is already underway,
        // re-send the start signal so the late joiner catches up (everyone else
        // ignores it — they've already begun this seed).
        const started = onlineStartedRef.current;
        if (isHost && started) {
          void channel.send({ type: "broadcast", event: "start", payload: { seed: started.seed, mode: started.mode } });
        }
      })
      .on("broadcast", { event: "score" }, ({ payload }) => {
        const p = payload as OnlineScore & { id: string };
        onlineScoresRef.current = { ...onlineScoresRef.current, [p.id]: { name: p.name, scores: p.scores, total: p.total, thru: p.thru } };
        setOnlineScores(onlineScoresRef.current);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ id: myId, name: myName, host: isHost, mode: m });
          // Ask whoever's already here whether a round is in progress.
          void channel.send({ type: "broadcast", event: "hello", payload: { id: myId } });
        }
      });
    onlineRef.current = { channel, code, myId, myName, isHost, mode: m };
    return true;
  }, [supa, beginOnlineRound]);

  const createLobby = useCallback((m: Mode, name: string) => {
    const code = makeLobbyCode();
    if (!connectLobby(code, name.trim() || "Host", true, m)) return;
    setLobbyPlayers([{ id: "self", name: name.trim() || "Host", host: true, mode: m }]);
    setLobby({ code, isHost: true, mode: m });
  }, [connectLobby]);

  const joinLobby = useCallback((code: string, name: string) => {
    const c = code.trim().toUpperCase();
    if (!connectLobby(c, name.trim() || "Player", false, "winthrop")) return;
    setLobby({ code: c, isHost: false, mode: "winthrop" });
  }, [connectLobby]);

  const startOnlineHost = useCallback(() => {
    const o = onlineRef.current;
    if (!o) return;
    const seed = (Math.random() * 1e9) | 0;
    void o.channel.send({ type: "broadcast", event: "start", payload: { seed, mode: o.mode } });
    beginOnlineRound(seed, o.mode);
  }, [beginOnlineRound]);

  const leaveLobby = useCallback(() => {
    const o = onlineRef.current;
    if (o) void supa?.removeChannel(o.channel);
    onlineRef.current = null;
    onlineScoresRef.current = {};
    onlineStartedRef.current = null;
    setLobby(null);
    setLobbyPlayers([]);
    setOnlineScores({});
  }, [supa]);

  const selectDisc = useCallback((i: number) => {
    // Only discs carried in the bag are selectable during a round.
    if (!ADV_DISCS[i] || !activeBagRef.current.includes(ADV_DISCS[i].key)) return;
    setDiscIndex(i);
    if (stateRef.current) stateRef.current.discIndex = i;
  }, []);

  const throwDisc = useCallback(() => {
    const g = stateRef.current;
    if (!g || g.phase !== "aim") return;
    const disc = ADV_DISCS[g.discIndex];
    // Each disc flies its baked-in shape (e.g. Nuke OS overstable, Destroyer
    // straight).
    g.path = disc.flight ?? "straight";
    g.release = releaseRef.current;
    // Slower launch + extra glide (disc friction) so it floats across the
    // fairway. Straight throws carry farther; the hole's slope acts on the
    // disc in-flight (see SLOPE_PULL in stepFlight), not on the launch.
    const pathMul = (g.path === "straight" ? STRAIGHT_SPEED_MUL : 1) * releaseSpeedMul(g.release);
    const speed = disc.power * (1.2 + g.power * 3.35) * pathMul * g.skill.speedMul;
    g.disc.vx = Math.cos(g.angle) * speed;
    g.disc.vy = Math.sin(g.angle) * speed;
    g.rest = { x: g.disc.x, y: g.disc.y };
    g.trailBuf = [{ x: g.disc.x, y: g.disc.y }]; // start recording the flight path
    // Backhand fades left, forehand fades right — mirrored for a lefty.
    const lh = leftHandedRef.current ? -1 : 1;
    g.fadeSign = (throwStyleRef.current === "BH" ? -1 : 1) * lh;
    g.fadeTurn = 0;
    // Launch upward — height scales with power and the disc's arc, so a putter
    // stays low (lands near the basket to catch) while a driver climbs to clear
    // hazards.
    g.h = 0;
    g.vh = g.power * disc.arc;
    g.throws += 1;
    g.phase = "fly";
    audioRef.current?.sfx("throw");
    vibrate(12);
    syncHud();
  }, [syncHud]);

  const finishGame = useCallback((scores: number[]) => {
    const g = stateRef.current;
    setCoinReward(0);
    setRankedGain(null);
    // A played Career event: record the result against the career and pop back
    // to the hub instead of the normal results / leaderboard flow.
    if (g?.career && careerPlayRef.current) {
      careerPlayRef.current = false;
      setActiveBag(bagRef.current); // career round over — the rack goes back to your account bag
      const total = scores.reduce((s, n) => s + n, 0);
      const c = careerRef.current;
      const ev = careerEventRef.current;
      if (c && ev && !c.done.includes(ev.id)) {
        // Use the same conditions-aware field the live leaderboard was built from.
        const { career: nc, result } = recordResult(c, ev, total, true, careerFieldRef.current ?? undefined);
        saveCareer(nc);
        setCareerLastResult(result);
        // Career progress stays sandboxed inside the Career object — no bests,
        // history, achievements, disc unlocks, or XP leak to your real account.
        // The one thing that does cross over: playing a career round still pays
        // account coins (scaled by how far under par you went), so the mode
        // still feeds your wallet just like a normal round.
        const reward = coinsForRound(total - g.roundHoles.reduce((s, h) => s + h.par, 0), g.roundHoles.length);
        setCareerCoins(reward);
        addCoins(reward);
      } else {
        setCareerCoins(0);
      }
      careerEventRef.current = null;
      careerFieldRef.current = null;
      audioRef.current?.sfx("win");
      vibrate([20, 40, 20]);
      clearResume();
      setCareerOpen(true);
      setScreen("title");
      return;
    }
    const mode = g?.mode ?? modeRef.current;
    const online = g?.online ?? false;
    // Online and practice rounds don't touch personal records / history.
    const practice = (g?.practice ?? false) || online;
    const pars = g ? g.roundHoles.map((h) => h.par) : HOLES.map((h) => h.par);
    const total = scores.reduce((s, n) => s + n, 0);
    setScorecard(scores);
    setFinalTotal(total);
    setFinalPars(pars);
    setFinalMode(mode);
    setFinalPracticeHole(g?.practice ? g?.practiceHole ?? null : null);
    setFinalParty(g?.party ? { names: g.party.names, totals: g.party.scores.map((sc) => sc.reduce<number>((a, b) => a + (b ?? 0), 0)) } : null);
    setFinalOnline(online);

    // Personal bests are tracked per fixed course — Glendoveer and Winthrop
    // each have their own key (the daily course changes every day).
    if (!practice && (mode === "course" || mode === "winthrop")) {
      const key = mode === "course" ? BEST_KEY : WBEST_KEY;
      let prior: number | null = null;
      try {
        const raw = localStorage.getItem(key);
        prior = raw ? Number(raw) : null;
        if (prior != null && !Number.isFinite(prior)) prior = null;
      } catch {
        /* ignore */
      }
      const newBest = prior == null || total < prior;
      const best = newBest ? total : prior!;
      try { localStorage.setItem(key, String(best)); } catch { /* ignore */ }
      if (mode === "course") setBestScore(best);
      else setWinthropBest(best);
      setIsNewBest(newBest);
      // A new best round becomes the course ghost: every shot's flight path,
      // downsampled to keep storage small.
      if (newBest && g) {
        try {
          const paths = [...g.roundPaths, g.shotPaths].map((hp) =>
            hp.map((path) => path.filter((_, i) => i % 3 === 0 || i === path.length - 1).map((pt) => ({ x: Math.round(pt.x), y: Math.round(pt.y) }))),
          );
          localStorage.setItem(`discgolf.ghost.${mode}`, JSON.stringify(paths));
        } catch { /* ignore */ }
      }
    } else if (!practice && mode === "tour" && g) {
      // Standalone pro-tour venues track a personal best per seed.
      const seed = g.seed;
      let map: Record<number, number> = {};
      try { map = JSON.parse(localStorage.getItem(TOURBEST_KEY) || "{}"); } catch { /* ignore */ }
      const prior = map[seed];
      const newBest = prior == null || total < prior;
      if (newBest) {
        map[seed] = total;
        try { localStorage.setItem(TOURBEST_KEY, JSON.stringify(map)); } catch { /* ignore */ }
        setTourBests(map);
      }
      setIsNewBest(newBest);
    } else {
      setIsNewBest(false);
    }

    // Round history + achievements only count for full rounds, not practice.
    if (!practice) {
      let hist: { mode: Mode; total: number; date: number; scores?: number[]; pars?: number[] }[] = [];
      try { hist = JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); } catch { /* ignore */ }
      hist.push({ mode, total, date: Date.now(), scores, pars });
      const trimmed = hist.slice(-100);
      try { localStorage.setItem(HIST_KEY, JSON.stringify(trimmed)); } catch { /* ignore */ }
      roundsPlayedRef.current = hist.length;
      setRoundsPlayed(hist.length);
      setHistory(trimmed);

      const earned = earnedAchievements(scores, pars, mode, hist.length);
      const fresh = earned.filter((id) => !unlockedRef.current.includes(id));
      if (fresh.length) {
        const all = [...unlockedRef.current, ...fresh];
        unlockedRef.current = all;
        setUnlocked(all);
        try { localStorage.setItem(ACH_KEY, JSON.stringify(all)); } catch { /* ignore */ }
        addCoins(achievementReward(fresh)); // one-time coin bounty per new achievement
      }
      setNewAchievements(fresh.map((id) => ACHIEVEMENTS.find((a) => a.id === id)!).filter(Boolean));
    } else {
      setNewAchievements([]);
    }

    // Tournament round: record it, simulate the AI field, run the cut (3-round
    // events), and on the final round bank the best finishing place + champion.
    if (tournamentPlayRef.current) {
      tournamentPlayRef.current = false;
      const t = tournamentRef.current;
      const def = t ? tournDef(t.id) : undefined;
      if (t && def && !t.finished) {
        const nRounds = def.rounds.length;
        const hasCut = def.cut && nRounds >= 3;
        const roundIdx = t.myTotals.length;
        const myTotals = [...t.myTotals, total];
        const fieldTotals = [...t.fieldTotals, tournFieldRound(t.seed, roundIdx, tournRoundHoles(def.rounds[roundIdx]))];
        let madeCut = t.madeCut;
        let finished = false;
        if (hasCut && roundIdx === 1) {
          const sums = [myTotals[0] + myTotals[1], ...fieldTotals[0].map((_, i) => fieldTotals[0][i] + fieldTotals[1][i])];
          const sorted = [...sums].sort((a, b) => a - b);
          const line = sorted[Math.floor(sorted.length / 2) - 1];
          madeCut = myTotals[0] + myTotals[1] <= line;
          if (!madeCut) { finished = true; fieldTotals.push(tournFieldRound(t.seed, 2, tournRoundHoles(def.rounds[2]))); } // field plays on
        }
        if (myTotals.length >= nRounds) finished = true;
        const next: Tournament = { ...t, myTotals, fieldTotals, madeCut, finished, round: roundIdx + 1 };
        saveTournament(next);
        if (finished) {
          // Bank the best (lowest) finishing place for this tournament.
          const place = tournPlace(next, def);
          let map: Record<string, number> = {};
          try { map = JSON.parse(localStorage.getItem(TOURNBEST_KEY) || "{}"); } catch { /* ignore */ }
          if (map[def.id] == null || place < map[def.id]) {
            map[def.id] = place;
            try { localStorage.setItem(TOURNBEST_KEY, JSON.stringify(map)); } catch { /* ignore */ }
            setTournBests(map);
          }
          // "natty" — win the Winthrop Lake Classic specifically.
          if (place === 1 && def.id === "Winthrop Lake Classic" && !unlockedRef.current.includes("natty")) {
            const all = [...unlockedRef.current, "natty"];
            unlockedRef.current = all;
            setUnlocked(all);
            try { localStorage.setItem(ACH_KEY, JSON.stringify(all)); } catch { /* ignore */ }
            addCoins(achievementReward(["natty"]));
            setNewAchievements((prev) => [...prev, ACHIEVEMENTS.find((a) => a.id === "natty")!]);
          }
        }
      }
      setFinalTournament(true);
    } else {
      setFinalTournament(false);
    }

    clearResume(); // the round is over — nothing left to resume
    audioRef.current?.sfx("win");
    vibrate([20, 40, 20]);
    setScreen("gameComplete");
    setFinalSeed(g?.seed ?? 0);
    setFinalChallenge(challengePlayRef.current ? challengeRef.current : null);
    setLeaderboard([]);
    if (!practice) void getArcadeLeaderboard(leaderboardCourse(mode, g?.seed ?? 0)).then(setLeaderboard).catch(() => {});
    // Ranked round: award lifetime RP and track the best to-par. The score also
    // lands on this week's shared ranked board via the normal save flow.
    if (!practice && mode === "ranked") {
      const toPar = total - pars.reduce((s, n) => s + n, 0);
      const next = applyRankedRound(rankedRef.current, toPar);
      rankedRef.current = next; setRanked(next);
      try { localStorage.setItem(RANKED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      setRankedGain(roundRP(toPar));
    } else {
      setRankedGain(null);
    }
    if (!practice) saveProgress(); // sync best/achievements/history to the cloud if signed in
    // Coins for a counting round (more for going low). Career events pay cash,
    // not coins, and are handled in their own branch above.
    if (!practice) { setCoinReward(coinsForRound(total - pars.reduce((s, n) => s + n, 0), pars.length)); addCoins(coinsForRound(total - pars.reduce((s, n) => s + n, 0), pars.length)); }
  }, [saveProgress, saveTournament, clearResume, saveCareer, addCoins]);

  // Bail out of a played Career round already in progress and let it sim from
  // your skills instead — the same instant result as the hub "⚡ Sim", but
  // reachable mid-round from the pause menu. A simmed round pays no coins.
  const simCurrentCareerRound = useCallback(() => {
    const c = careerRef.current;
    const ev = careerEventRef.current;
    careerPlayRef.current = false;
    careerEventRef.current = null;
    careerFieldRef.current = null;
    setActiveBag(bagRef.current); // back to your account bag in the rack
    if (c && ev && !c.done.includes(ev.id)) {
      const { score } = simEvent(c, ev);
      const { career: nc, result } = recordResult(c, ev, score, false);
      saveCareer(nc);
      setCareerLastResult(result);
      setCareerCoins(0);
    }
    audioRef.current?.stopMusic();
    clearResume();
    setPauseMenu(null);
    setCareerOpen(true);
    setScreen("title");
  }, [saveCareer, clearResume]);

  const nextHole = useCallback(() => {
    const g = stateRef.current;
    if (!g) return;
    if (g.holeIndex + 1 >= g.roundHoles.length) {
      finishGame(g.scores.slice());
      return;
    }
    g.roundPaths.push(g.shotPaths);
    g.holeIndex += 1;
    if (g.party) g.party.current = 0;
    Object.assign(g, freshHole(g.roundHoles[g.holeIndex]));
    g.discIndex = discIndexRef.current;
    setScreen("playing");
    syncHud();
  }, [syncHud, finishGame]);

  // In-round pause menu: restart the current round from the first hole using
  // the SAME holes (same seed), or bail out to the title screen.
  const restartRound = useCallback(() => {
    const g = stateRef.current;
    if (!g) return;
    audioRef.current?.resume();
    stateRef.current = {
      ...g,
      holeIndex: 0,
      scores: [],
      roundPaths: [],
      discIndex: validDiscIndex(discIndexRef.current, activeBagRef.current),
      party: g.party ? { names: g.party.names, current: 0, scores: g.party.names.map(() => Array(g.roundHoles.length).fill(null)) } : undefined,
      ...freshHole(g.roundHoles[0]),
    };
    ghostRef.current = g.online || g.practice ? null : ghostRef.current;
    setPartyView(null);
    setOnlineView(null);
    setPauseMenu(null);
    setScreen("playing");
    syncHud();
  }, [syncHud]);

  const exitToHome = useCallback(() => {
    audioRef.current?.stopMusic();
    if (stateRef.current?.online) leaveLobby();
    tournamentPlayRef.current = false;
    const wasCareer = careerPlayRef.current;
    careerPlayRef.current = false;
    if (wasCareer) setActiveBag(bagRef.current); // restore the account bag in the rack
    setPauseMenu(null);
    setResumeRound(readResume()); // surface "Resume" if we left a solo round mid-way
    if (wasCareer) setCareerOpen(true); // bail back to the career hub
    setScreen("title");
  }, [leaveLobby]);

  // Submit the finished round to the per-course leaderboard under the player's
  // profile name (auto-triggered when the results screen shows).
  const saveScore = useCallback(async () => {
    if (saving || saved) return;
    setSaving(true);
    setSaveErr(null);
    try {
      const course = leaderboardCourse(finalMode, finalSeed);
      const res = await submitArcadeScore(profile.name.trim() || "Player", finalTotal, course);
      if (!res.ok) {
        setSaveErr(res.error ?? "Save failed");
        return;
      }
      setSaved(true);
      const lb = await getArcadeLeaderboard(course);
      setLeaderboard(lb);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [saving, saved, profile.name, finalTotal, finalMode, finalSeed]);

  // Auto-save the round to the leaderboard when the results screen appears
  // (skips practice / pass-&-play / online matches).
  useEffect(() => {
    if (screen !== "gameComplete") return;
    if (finalPracticeHole != null || finalParty || finalOnline) return;
    if (saved || saving) return;
    void saveScore();
  }, [screen, finalPracticeHole, finalParty, finalOnline, saved, saving, saveScore]);

  // Share a challenge link that replays this exact round (mode + seed).
  // Render the finished round to an image and share it (or download as fallback).
  const shareCard = useCallback(async () => {
    const total = finalTotal;
    const parTotal = finalPars.reduce((s, n) => s + n, 0);
    const over = total - parTotal;
    const nHoles = finalPars.length;
    const isDaily = finalMode === "daily";
    const courseLabel = isDaily ? "Daily Challenge" : finalMode === "winthrop" ? "Winthrop Lake" : finalMode === "ranked" ? "Ranked · Weekly" : finalMode === "tour" ? tourVenue(finalSeed) : "Glendoveer East";
    const courseName = `${courseLabel} · ${nHoles} holes · par ${parTotal}`;
    const os = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
    const cv = document.createElement("canvas");
    cv.width = 600;
    cv.height = 320;
    const c = cv.getContext("2d");
    if (!c) return;
    c.fillStyle = "#0f1117";
    c.fillRect(0, 0, 600, 320);
    c.textAlign = "left";
    c.fillStyle = "#36D7B7";
    c.font = "bold 32px ui-monospace, monospace";
    c.fillText("DISC GOLF", 28, 52);
    c.fillStyle = "#9aa";
    c.font = "15px ui-monospace, monospace";
    c.fillText(courseName, 28, 78);
    c.fillStyle = "#fff";
    c.font = "bold 56px ui-monospace, monospace";
    c.fillText(`${total}`, 28, 150);
    c.fillStyle = over <= 0 ? "#36D7B7" : "#e08a3b";
    c.font = "bold 26px ui-monospace, monospace";
    c.fillText(over === 0 ? "Even par" : os(over), 120, 150);
    // hole strip (up to 9 per row)
    const perRow = Math.min(9, nHoles);
    const cellW = Math.min(48, Math.floor(540 / perRow));
    const x0 = 28;
    const y0 = 196;
    for (let i = 0; i < nHoles; i++) {
      const x = x0 + (i % perRow) * cellW;
      const y = y0 + Math.floor(i / perRow) * 54;
      const s = scorecard[i];
      const diff = (s ?? finalPars[i]) - finalPars[i];
      c.fillStyle = "#9aa";
      c.font = "11px ui-monospace, monospace";
      c.textAlign = "center";
      c.fillText(`${i + 1}`, x + cellW / 2, y);
      c.fillStyle = s == null ? "#555" : diff < 0 ? "#36D7B7" : diff > 1 ? "#e23b3b" : diff === 1 ? "#f5d24a" : "#fff";
      c.font = "bold 18px ui-monospace, monospace";
      c.fillText(s != null ? `${s}` : "–", x + cellW / 2, y + 22);
    }
    c.textAlign = "left";
    c.fillStyle = "#667";
    c.font = "12px ui-monospace, monospace";
    c.fillText("play it yourself · disc-golf-arcade.vercel.app", 28, 308);

    await new Promise<void>((resolve) => {
      cv.toBlob(async (blob) => {
        if (!blob) return resolve();
        const file = new File([blob], "discgolf-scorecard.png", { type: "image/png" });
        const where = isDaily ? "today's Daily Challenge" : courseLabel;
        try {
          const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
          if (nav.canShare?.({ files: [file] })) {
            await nav.share({ files: [file], title: "Disc Golf", text: `I shot ${total} (${os(over)}) on ${where}!` });
            return resolve();
          }
        } catch {
          /* fall through to download */
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "discgolf-scorecard.png";
        a.click();
        URL.revokeObjectURL(url);
        resolve();
      }, "image/png");
    });
  }, [finalTotal, finalPars, finalMode, finalSeed, scorecard]);

  // When a hole finishes, record/show the best-ever strokes for that hole.
  // Only for Glendoveer — the daily course's holes change every day.
  useEffect(() => {
    if (screen !== "holeComplete") return;
    const g = stateRef.current;
    if (!g || g.mode !== "course" || g.practice || g.career) { setHoleBestNote(null); return; }
    const idx = g.holeIndex;
    const s = g.scores[idx];
    if (typeof s !== "number") return;
    const prev = holeBestRef.current[idx];
    const isNew = prev == null || s < prev;
    const best = isNew ? s : prev;
    if (isNew) {
      const arr = holeBestRef.current.slice();
      arr[idx] = s;
      holeBestRef.current = arr;
      try { localStorage.setItem(HOLEBEST_KEY, JSON.stringify(arr)); } catch { /* ignore */ }
      saveProgress();
    }
    setHoleBestNote({ best: best as number, isNew });
  }, [screen, saveProgress]);

  // Keyboard
  useEffect(() => {
    function onDown(e: KeyboardEvent) {
      if (pausedRef.current) return;
      // Don't hijack keys while the user is typing in a field — otherwise
      // preventDefault on Space/Enter would block spaces in names (e.g. lobby
      // names, the leaderboard save box) and the disc/stance shortcuts would
      // fire on every keystroke.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Enter"].includes(e.key)) e.preventDefault();
      keysRef.current.add(e.key);
      if (e.key >= "1" && e.key <= "9") {
        const n = Number(e.key) - 1; // number keys pick bag slots
        if (n < activeBagRef.current.length) selectDisc(discIndexByKey(activeBagRef.current[n]));
      }
      if (e.key === "b" || e.key === "B") setThrowStyle("BH");
      if (e.key === "f" || e.key === "F") setThrowStyle("FH");
      if (e.key === " " || e.key === "Enter") {
        if (screenRef.current === "title") startGame();
        else if (screenRef.current === "holeComplete") nextHole();
      }
    }
    function onUp(e: KeyboardEvent) {
      keysRef.current.delete(e.key);
    }
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [startGame, nextHole, selectDisc]);

  // Main loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx0 = canvas.getContext("2d");
    if (!ctx0) return;
    const ctx = ctx0;

    function spawnBurst(x: number, y: number, colors: string[], n: number, speed: number, grav = 0.04, life = 26) {
      const ps = particlesRef.current;
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = speed * (0.35 + Math.random() * 0.65);
        ps.push({
          x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - speed * 0.4, g: grav,
          life: life * (0.6 + Math.random() * 0.4), max: life,
          color: colors[(Math.random() * colors.length) | 0], size: 1 + Math.random() * 1.6,
        });
      }
      if (ps.length > 400) ps.splice(0, ps.length - 400);
    }
    function shake(mag: number) {
      shakeRef.current = { until: performance.now() + 160, mag };
    }

    function update() {
      const g = stateRef.current;
      if (!g || screenRef.current !== "playing" || pausedRef.current) return;
      const hole = g.roundHoles[g.holeIndex];
      const maxCam = Math.max(0, hole.worldH - H);
      const basketCamX = camXFor(hole, hole.basket.x);
      const teeCamX = camXFor(hole, hole.tee.x);

      // Rival ghosts: (re)build the field when the hole changes — the tournament
      // field, or your recurring Career rivals on a played event.
      if (tournamentPlayRef.current && tournamentRef.current && !tournamentRef.current.finished && tournDef(tournamentRef.current.id)) {
        if (ghostsRef.current?.holeIndex !== g.holeIndex) {
          ghostsRef.current = buildTournGhosts(tournamentRef.current, tournDef(tournamentRef.current.id)!, g.holeIndex, hole, performance.now());
        }
      } else if (careerPlayRef.current && careerRef.current && careerFieldRef.current) {
        if (ghostsRef.current?.holeIndex !== g.holeIndex) {
          const racers = careerCardRacers(careerFieldRef.current, g.holeIndex);
          ghostsRef.current = buildRacerGhosts(careerRef.current.seed >>> 0, g.holeIndex, hole, racers, performance.now());
        }
      } else if (ghostsRef.current) {
        ghostsRef.current = null;
      }

      // Intro fly-over: hold on the basket, then pan down to the tee, then play.
      if (g.phase === "intro") {
        const HOLD = 26;
        const PAN = 60;
        g.introT += 1;
        if (g.introT <= HOLD) {
          g.camY = 0;
          g.camX = basketCamX;
        } else {
          const p = Math.min(1, (g.introT - HOLD) / PAN);
          const sp = p * p * (3 - 2 * p); // smoothstep
          g.camY = sp * maxCam;
          g.camX = basketCamX + sp * (teeCamX - basketCamX);
        }
        if (g.introT >= HOLD + PAN) {
          g.camY = maxCam;
          g.camX = teeCamX;
          g.phase = "aim";
          equipForLie(); // tee shot: clubs up to a straight driver
        }
        camRef.current = { x: g.camX, y: g.camY };
        return;
      }

      // Camera follows the disc, keeping it ~66% down so the fairway ahead shows
      // — and centered horizontally on wide holes, panning as the hole curves.
      const camTarget = Math.min(maxCam, Math.max(0, g.disc.y - H * 0.66));
      g.camY += (camTarget - g.camY) * 0.16;
      g.camX += (camXFor(hole, g.disc.x) - g.camX) * 0.16;
      camRef.current = { x: g.camX, y: g.camY };

      if (g.phase === "aim") {
        // Aim + power are driven by the pointer drag handlers; nothing to do here.
      } else if (g.phase === "fly") {
        const d = g.disc;
        const disc = ADV_DISCS[g.discIndex];
        const f: Flight = { x: d.x, y: d.y, vx: d.vx, vy: d.vy, h: g.h, vh: g.vh, fadeTurn: g.fadeTurn };
        const res = stepFlight(f, disc, g.fadeSign, g.path, hole, g.release, { catchR: g.skill.catchR, windMul: g.skill.windMul });
        d.x = f.x;
        d.y = f.y;
        d.vx = f.vx;
        d.vy = f.vy;
        g.h = f.h;
        g.vh = f.vh;
        g.fadeTurn = f.fadeTurn;
        g.trailBuf.push({ x: d.x, y: d.y }); // record the real flight curve
        if (res.treeHit) {
          audioRef.current?.sfx("tree");
          spawnBurst(d.x, d.y, ["#2f6b22", "#3f8a2e", "#56a541"], 10, 1.6);
          shake(2);
        }

        if (g.mini && res.status !== "fly") {
          const m = g.mini;
          const endMini = (coins: number) => {
            addCoins(coins);
            audioRef.current?.sfx("win");
            setMiniResult({ kind: m.kind, makes: m.makes, best: m.best, points: m.points, coins });
            stateRef.current = null;
            setScreen("title");
          };
          if (m.kind === "putt") {
            if (res.status === "hole") {
              d.vx = 0; d.vy = 0; d.x = hole.basket.x; d.y = hole.basket.y;
              audioRef.current?.sfx("basket"); vibrate([15, 30, 15]); rattleRef.current = performance.now();
              spawnBurst(hole.basket.x, hole.basket.y, ["#36D7B7", "#f5d24a", "#ffffff"], 50, 2.4, 0.05, 40);
              m.makes += 1; m.best = puttFeet(m.station); m.station += 1;
              const nh = puttHole(m.station); g.roundHoles[0] = nh;
              Object.assign(g, freshHole(nh)); g.mini = m; g.phase = "aim"; g.discIndex = 0;
              syncHud();
            } else {
              audioRef.current?.sfx("tree"); shake(2);
              endMini(m.makes * 12 + Math.round(m.best * 0.5));
            }
          } else {
            const tr = targetRadiusPx(m.station);
            const distPx = Math.hypot(d.x - hole.basket.x, d.y - hole.basket.y);
            const pts = res.status === "hole" ? 100 : distPx < tr ? Math.round((1 - distPx / tr) * 90) + 10 : 0;
            m.points += pts; m.attempts += 1;
            if (pts >= 80) { spawnBurst(d.x, d.y, ["#36D7B7", "#f5d24a", "#fff"], 40, 2, 0.05, 36); audioRef.current?.sfx("basket"); vibrate([15, 30, 15]); }
            else if (pts > 0) { spawnBurst(d.x, d.y, ["#36D7B7", "#9cc4e8"], 16, 1.4); audioRef.current?.sfx("chains"); }
            else { audioRef.current?.sfx("tree"); shake(2); }
            m.lastPts = pts;
            if (m.attempts >= m.total) endMini(Math.round(m.points / 2));
            else { const nh = targetHole(m.station + 1); m.station += 1; g.roundHoles[0] = nh; Object.assign(g, freshHole(nh)); g.mini = m; g.phase = "aim"; g.discIndex = 0; syncHud(); }
          }
        } else if (res.status === "hole") {
          g.phase = "holed";
          g.holedAt = performance.now();
          d.vx = 0;
          d.vy = 0;
          d.x = hole.basket.x;
          d.y = hole.basket.y;
          g.trailBuf.push({ x: hole.basket.x, y: hole.basket.y });
          g.shotPaths.push(g.trailBuf);
          g.trailBuf = [];
          audioRef.current?.sfx("basket");
          vibrate([15, 30, 15]);
          rattleRef.current = performance.now();
          const under = g.throws < hole.par;
          // Equipped hole-out celebration: a bigger pop when you're under par.
          const cel = cosmeticByKey(CELEBRATIONS, celebrationRef.current) ?? CELEBRATIONS[0];
          const nBursts = cel.bursts ?? 1;
          for (let b = 0; b < nBursts; b++) {
            const ox = nBursts > 1 ? (Math.random() - 0.5) * 24 : 0;
            const oy = nBursts > 1 ? (Math.random() - 0.5) * 24 : 0;
            spawnBurst(hole.basket.x + ox, hole.basket.y + oy, cel.colors, Math.round(cel.count * (under ? 1.5 : 1)), cel.speed * (under ? 1.1 : 1), cel.grav, cel.life);
          }
        } else if (res.status === "ob" || res.status === "oob") {
          // OUT OF BOUNDS: +1 and play from where it crossed the line.
          const inWater = hole.water.some((w) => inRect(w, f.x, f.y));
          audioRef.current?.sfx(inWater ? "water" : "tree");
          vibrate(60);
          spawnBurst(
            f.x, f.y,
            inWater ? ["#5b8fc4", "#9cc4e8", "#3a6ea5"] : ["#cfd8dc", "#9aa4b2"],
            inWater ? 16 : 8, inWater ? 1.8 : 1.2,
          );
          shake(inWater ? 3 : 2);
          // Replay from the hole's drop zone if it has one; otherwise from the
          // last point the disc was actually in bounds (walk the recorded
          // flight path back), falling back to this throw's start.
          const lie = hole.dropZone ?? lastInBoundsLie(g.trailBuf, hole, g.rest);
          g.throws += 1;
          g.flash = { text: hole.dropZone ? "OB — DROP ZONE" : "OUT OF BOUNDS", at: performance.now() };
          d.x = lie.x;
          d.y = lie.y;
          d.vx = 0;
          d.vy = 0;
          g.h = 0;
          g.vh = 0;
          g.rest = { x: lie.x, y: lie.y };
          g.shotPaths.push(g.trailBuf); // the curve out to where it crossed OB
          g.trailBuf = [];
          g.angle = aimAt(g.rest, hole.basket);
          g.phase = "aim";
          equipForLie(); // re-club for the new lie
          syncHud();
        } else if (res.status === "stop") {
          // Came to rest. If it's in a hazard (sand), +1 but play where it lies.
          d.vx = 0;
          d.vy = 0;
          g.rest = { x: d.x, y: d.y };
          // Chains rattle when it stops just short of the basket (a near miss).
          const distPin = Math.hypot(d.x - hole.basket.x, d.y - hole.basket.y);
          if (distPin < CATCH_R * 2.4) {
            audioRef.current?.sfx("chains");
            rattleRef.current = performance.now();
          }
          if ((hole.hazard ?? []).some((hz) => inHazard(hz, d.x, d.y)) || (hole.roughIsHazard && offRibbons(hole, d.x, d.y))) {
            g.throws += 1;
            g.flash = { text: "HAZARD", at: performance.now() };
            spawnBurst(d.x, d.y, ["#d9c089", "#c4a96b"], 12, 1.4);
            audioRef.current?.sfx("tree");
            vibrate(60);
            syncHud();
          }
          g.shotPaths.push(g.trailBuf);
          g.trailBuf = [];
          g.angle = aimAt(g.rest, hole.basket); // auto-aim at the basket
          g.phase = "aim";
          equipForLie(); // re-club for the new lie
        }
      } else if (g.phase === "holed") {
        if (g.holedAt && performance.now() - g.holedAt > 850) {
          g.scores[g.holeIndex] = g.throws;
          persistResume(g); // snapshot a resumable solo round after each hole
          // Online: record my hole, broadcast my full card (self-healing against
          // dropped messages), and show the live leaderboard.
          if (g.online && onlineRef.current) {
            const o = onlineRef.current;
            const scores = g.scores.slice(0, g.holeIndex + 1).map((x) => x ?? 0);
            const total = scores.reduce((a, b) => a + b, 0);
            const thru = g.holeIndex + 1;
            onlineScoresRef.current = { ...onlineScoresRef.current, [o.myId]: { name: o.myName, scores, total, thru } };
            setOnlineScores(onlineScoresRef.current);
            void o.channel.send({ type: "broadcast", event: "score", payload: { id: o.myId, name: o.myName, scores, total, thru } });
            setOnlineView({ hole: g.holeIndex, par: g.roundHoles[g.holeIndex].par, myId: o.myId });
            setScreen("holeComplete");
            syncHud();
            return;
          }
          if (tournamentPlayRef.current && tournamentRef.current && !tournamentRef.current.finished && tournDef(tournamentRef.current.id)) {
            const myRoundSoFar = g.scores.reduce((a, b) => a + (b ?? 0), 0);
            setTournLiveView({ rows: tournLiveStandings(tournamentRef.current, tournDef(tournamentRef.current.id)!, myRoundSoFar, g.holeIndex + 1), thru: g.holeIndex + 1 });
          } else if (careerPlayRef.current && careerRef.current && careerFieldRef.current) {
            // Live top-10 after each hole, same as a tournament — you vs the field.
            const myScores = g.scores.slice(0, g.holeIndex + 1).map((x) => x ?? 0);
            const parThru = g.roundHoles.slice(0, g.holeIndex + 1).reduce((s, h) => s + h.par, 0);
            const rows = careerLiveStandings(careerFieldRef.current, `${careerRef.current.name} (you)`, myScores, g.holeIndex + 1, parThru);
            setTournLiveView({ rows, thru: g.holeIndex + 1 });
          } else {
            setTournLiveView(null);
          }
          if (g.party) {
            g.party.scores[g.party.current][g.holeIndex] = g.throws;
            if (g.party.current < g.party.names.length - 1) {
              // Pass the device: same hole resets (fly-over intro re-runs) for
              // the next player.
              g.party.current += 1;
              Object.assign(g, freshHole(g.roundHoles[g.holeIndex]));
              g.discIndex = discIndexRef.current;
              syncHud();
              return;
            }
            setPartyView({
              names: g.party.names,
              holeScores: g.party.scores.map((sc) => sc[g.holeIndex]),
              totals: g.party.scores.map((sc) => sc.reduce<number>((a, b) => a + (b ?? 0), 0)),
            });
          }
          setScreen("holeComplete");
          syncHud();
        }
      }

      // Step the particles (cheap Euler + drag).
      const ps = particlesRef.current;
      for (let i = ps.length - 1; i >= 0; i--) {
        const pt = ps[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vy += pt.g;
        pt.vx *= 0.95;
        pt.vy *= 0.95;
        pt.life -= 1;
        if (pt.life <= 0) ps.splice(i, 1);
      }
    }

    function draw() {
      const g = stateRef.current;
      if (!g) return;
      const hole = g.roundHoles[g.holeIndex];
      const cam = g.camY; // world→screen: screenY = worldY - cam
      const camX = g.camX; // world→screen: screenX = worldX - camX

      // Active ground/course theme (re-tints normal grass; hazard rough keeps
      // its warning colors).
      const ground = cosmeticByKey(GROUND_THEMES, groundThemeRef.current) ?? GROUND_THEMES[0];

      // Everything outside the fairway is rough — out of bounds normally, or
      // olive-tinted hazard ground on rope-lined holes (+1, play where it lies).
      ctx.fillStyle = hole.roughIsHazard ? "#535426" : ground.rough;
      ctx.fillRect(0, 0, W, H);
      // Darker rough mowing bands for a little texture.
      const startY = Math.floor(cam / 16) * 16;
      ctx.fillStyle = hole.roughIsHazard ? "#4b4c22" : ground.roughBand;
      for (let y = startY; y < cam + H; y += 32) ctx.fillRect(0, y - cam, W, 16);

      // All world-space drawing below is shifted by the horizontal camera (and
      // jolted briefly by impacts); screen-fixed UI restores afterwards.
      const shk = shakeRef.current;
      const shakeLeft = Math.max(0, shk.until - performance.now()) / 160;
      const jx = shakeLeft > 0 ? (Math.random() - 0.5) * shk.mag * 2 * shakeLeft : 0;
      const jy = shakeLeft > 0 ? (Math.random() - 0.5) * shk.mag * 2 * shakeLeft : 0;
      ctx.save();
      ctx.translate(-camX + jx, jy);

      // The curved fairway, drawn as a thick ribbon along the centerline. The
      // outer (white) stroke is the OB line; the green stroke inside is the
      // fairway — so doglegs and bends give curved OB edges that follow the
      // hole. Extra ribbons (e.g. hole 13's island tee pad) draw the same way.
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      for (const fw of [hole.fairway, ...(hole.fairways ?? [])]) {
        ctx.beginPath();
        ctx.moveTo(fw[0].x, fw[0].y - cam);
        for (let i = 1; i < fw.length; i++) ctx.lineTo(fw[i].x, fw[i].y - cam);
        // Ribbon edge: white OB line, or hazard-yellow rope on hazard-rough holes.
        ctx.strokeStyle = hole.roughIsHazard ? "#e0c25a" : "#eef1e6";
        ctx.lineWidth = hole.fwWidth;
        ctx.stroke();
        ctx.strokeStyle = ground.fairway; // fairway
        ctx.lineWidth = hole.fwWidth - 3;
        ctx.stroke();
        // Mowing stripes inside the fairway.
        ctx.strokeStyle = ground.stripe;
        ctx.lineWidth = hole.fwWidth - 3;
        ctx.setLineDash([10, 10]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.lineJoin = "miter";
      ctx.lineCap = "butt";
      ctx.lineWidth = 1;

      for (const wt of hole.water) {
        const wy = wt.y - cam;
        ctx.fillStyle = "#3a6ea5";
        ctx.fillRect(wt.x, wy, wt.w, wt.h);
        ctx.fillStyle = "#5b8fc4";
        for (let i = 0; i < wt.h; i += 6) ctx.fillRect(wt.x + 2, wy + 3 + i, wt.w - 6, 1);
      }

      // Grass OB islands — turf patches inside the fairway, roped off with a
      // dashed white OB line. Land in one and it plays exactly like water OB.
      for (const ob of hole.obZones ?? []) {
        const ocx = ob.x + ob.w / 2;
        const ocy = ob.y - cam + ob.h / 2;
        ctx.fillStyle = "#3c6b2e";
        ctx.beginPath();
        ctx.ellipse(ocx, ocy, ob.w / 2, ob.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#eef1e6";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.ellipse(ocx, ocy, ob.w / 2, ob.h / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
        ctx.fillStyle = "rgba(238,241,230,0.9)";
        ctx.font = "bold 6px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("OB", ocx, ocy + 0.5);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }

      // Hazards (sand) — sandy ovals ringed in caddie-book orange with an HZ
      // tag, so they read as "+1 stroke" at a glance (unlike plain fairway).
      for (const hz of hole.hazard ?? []) {
        const hx = hz.x + hz.w / 2;
        const hy = hz.y - cam + hz.h / 2;
        ctx.fillStyle = "#d9c089";
        ctx.beginPath();
        ctx.ellipse(hx, hy, hz.w / 2, hz.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#c4a96b";
        ctx.beginPath();
        ctx.ellipse(hx, hy, hz.w / 2 - 2, hz.h / 2 - 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#e0923b";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.ellipse(hx, hy, hz.w / 2, hz.h / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
        ctx.fillStyle = "#a8651f";
        ctx.font = "bold 6px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("HZ", hx, hy + 0.5);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }

      // Wooden walls (mando fences): plank rails with posts; consecutive
      // segments at the same height get an orange arch framing the gap.
      const walls = hole.walls ?? [];
      for (const wl of walls) {
        const wy = wl.y - cam;
        ctx.fillStyle = "#8a6a3a";
        ctx.fillRect(wl.x, wy - 3, wl.w, 6);
        ctx.fillStyle = "#5f451f";
        for (let px = wl.x; px <= wl.x + wl.w - 2; px += 12) ctx.fillRect(px, wy - 4, 2, 8);
        ctx.fillRect(wl.x + wl.w - 2, wy - 4, 2, 8);
      }
      for (let i = 0; i + 1 < walls.length; i++) {
        if (walls[i].y !== walls[i + 1].y) continue;
        const wy = walls[i].y - cam;
        const gx1 = walls[i].x + walls[i].w;
        const gx2 = walls[i + 1].x;
        ctx.strokeStyle = "#e0923b";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gx1, wy + 4);
        ctx.lineTo(gx1, wy - 10);
        ctx.lineTo(gx2, wy - 10);
        ctx.lineTo(gx2, wy + 4);
        ctx.stroke();
        ctx.lineWidth = 1;
      }

      // Drop zone — where OB throws play from on holes that have one.
      if (hole.dropZone) {
        const dzy = hole.dropZone.y - cam;
        ctx.fillStyle = "#e0923b";
        ctx.beginPath();
        ctx.arc(hole.dropZone.x, dzy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#0f1117";
        ctx.font = "bold 5px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("DZ", hole.dropZone.x, dzy + 0.5);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }

      // Tee pad
      ctx.fillStyle = "#caa46a";
      ctx.fillRect(hole.tee.x - 7, hole.tee.y - cam - 5, 14, 10);
      ctx.fillStyle = "#8a6a3a";
      ctx.fillRect(hole.tee.x - 7, hole.tee.y - cam - 5, 14, 2);

      // Best-round ghost: your record round's flight lines on this hole.
      if (ghostRef.current && showGhostRef.current && !g.practice) {
        const hp = ghostRef.current[g.holeIndex];
        if (Array.isArray(hp)) {
          ctx.strokeStyle = "rgba(245,210,74,0.35)";
          ctx.setLineDash([2, 4]);
          ctx.lineWidth = 1;
          for (const path of hp) {
            if (!Array.isArray(path) || path.length < 2) continue;
            ctx.beginPath();
            ctx.moveTo(path[0].x, path[0].y - cam);
            for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y - cam);
            ctx.stroke();
            const end = path[path.length - 1];
            ctx.fillStyle = "rgba(245,210,74,0.55)";
            ctx.fillRect(end.x - 1.5, end.y - cam - 1.5, 3, 3);
          }
          ctx.setLineDash([]);
        }
      }

      // Ghost trail: the actual curved flight path of each earlier shot on this
      // hole, with a dot where each came to rest.
      for (const path of g.shotPaths) {
        if (path.length < 2) continue;
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.25;
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y - cam);
        for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y - cam);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineJoin = "miter";
        const end = path[path.length - 1];
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath();
        ctx.arc(end.x, end.y - cam, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      const rattleAge = performance.now() - rattleRef.current;
      const rattle = rattleAge < 420 ? Math.sin(rattleAge * 0.09) * (1 - rattleAge / 420) * 1.6 : 0;
      // Target-practice rings (drawn on the ground around the bullseye basket).
      if (g.mini?.kind === "target") {
        const tx = hole.basket.x, ty = hole.basket.y - cam, tr = targetRadiusPx(g.mini.station);
        const rings: [number, string][] = [[tr, "rgba(226,59,59,0.18)"], [tr * 0.66, "rgba(245,210,74,0.20)"], [tr * 0.33, "rgba(54,215,183,0.28)"]];
        for (const [r, fill] of rings) {
          ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(tx, ty, r, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(tx, ty, r, 0, Math.PI * 2); ctx.stroke();
        }
      }
      drawBasket(ctx, hole.basket.x + rattle, hole.basket.y - cam, g.skill.catchR, cosmeticByKey(BASKET_SKINS, basketSkinRef.current));
      for (const tr of hole.trees) drawTree(ctx, { x: tr.x, y: tr.y - cam, r: tr.r });

      // Tournament rivals playing the hole alongside you (simulated field).
      if ((tournamentPlayRef.current || careerPlayRef.current) && ghostsRef.current?.holeIndex === g.holeIndex) {
        const gst = ghostsRef.current;
        const elapsed = performance.now() - gst.startAt;
        ctx.textAlign = "center";
        for (const gh of gst.ghosts) {
          const pos = ghostPosAt(gh, elapsed - gh.delay);
          if (pos.holed) {
            if (!gh.holedFired) {
              gh.holedFired = true; // a small pop when a rival holes out, then they leave
              spawnBurst(hole.basket.x, hole.basket.y, [gh.color, "#ffffff"], 14, 1.6, 0.05, 28);
            }
            continue;
          }
          const sx = pos.x;
          const sy = pos.y - cam;
          const dy = sy - pos.lift;
          ctx.globalAlpha = 0.45; // shadow
          ctx.fillStyle = "rgba(0,0,0,0.35)";
          ctx.beginPath();
          ctx.ellipse(sx, sy, 2.2, 1.3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.9; // disc
          ctx.fillStyle = gh.color;
          ctx.beginPath();
          ctx.arc(sx, dy, 2.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.fillRect(Math.round(sx) - 0.5, Math.round(dy) - 0.5, 1, 1);
          ctx.globalAlpha = 0.8; // name tag
          ctx.font = "5px ui-monospace, monospace";
          ctx.fillStyle = "rgba(0,0,0,0.65)";
          ctx.fillText(gh.name, sx + 0.4, dy - 5.6);
          ctx.fillStyle = gh.color;
          ctx.fillText(gh.name, sx, dy - 6);
        }
        ctx.globalAlpha = 1;
        ctx.textAlign = "left";
      }

      // Aim: the exact predicted flight path (simulated with the real physics)
      // plus a visible pull-back slider/knob on the disc.
      if (g.phase === "aim") {
        const dr = dragRef.current;
        const aimDisc = ADV_DISCS[g.discIndex];
        const lh2 = leftHandedRef.current ? -1 : 1;
        const sign = (throwStyleRef.current === "BH" ? -1 : 1) * lh2;
        const path: FlightPath = aimDisc.flight ?? "straight";
        const dsx = g.disc.x;
        const dsy = g.disc.y - cam; // disc screen position

        let kx: number;
        let ky: number;
        let power: number;
        if (dr.active) {
          // Pull is the anchor→pointer vector; the knob renders off the disc so
          // the slider stays attached even though the gesture started elsewhere.
          let pullX = dr.cx - dr.ax;
          let pullY = dr.cy - dr.ay;
          const dist = Math.hypot(pullX, pullY) || 0.0001;
          const cl = Math.min(dist, MAX_DRAG);
          pullX = (pullX / dist) * cl;
          pullY = (pullY / dist) * cl;
          kx = dsx + pullX;
          ky = dsy + pullY;
          power = cl / MAX_DRAG;
        } else {
          kx = dsx;
          ky = dsy + 26;
          power = 0;
        }

        // Once pulling back, show a "cancel" area around the disc: release the
        // knob inside it to abort the throw.
        const inCancel = power < CANCEL_POWER;
        if (dr.active) {
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(dsx, dsy, CANCEL_R, 0, Math.PI * 2);
          if (inCancel) {
            ctx.fillStyle = "rgba(226,59,59,0.22)";
            ctx.fill();
            ctx.strokeStyle = "rgba(226,59,59,0.95)";
          } else {
            ctx.strokeStyle = "rgba(255,255,255,0.45)";
          }
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.lineWidth = 1;
          if (inCancel) {
            ctx.fillStyle = "rgba(226,59,59,0.95)";
            ctx.font = "bold 7px ui-monospace, monospace";
            ctx.textAlign = "center";
            ctx.fillText("CANCEL", dsx, dsy - CANCEL_R - 3);
            ctx.textAlign = "left";
          }
        }

        if (dr.active && power > 0.04 && !inCancel) {
          const pathMul = (path === "straight" ? STRAIGHT_SPEED_MUL : 1) * releaseSpeedMul(releaseRef.current);
          const speed = aimDisc.power * (1.2 + power * 3.35) * pathMul * g.skill.speedMul;
          const f: Flight = {
            x: g.disc.x, y: g.disc.y,
            vx: Math.cos(g.angle) * speed, vy: Math.sin(g.angle) * speed,
            h: 0, vh: power * aimDisc.arc, fadeTurn: 0,
          };
          const pts: { x: number; y: number }[] = [{ x: f.x, y: f.y }];
          for (let i = 0; i < 360; i++) {
            const r = stepFlight(f, aimDisc, sign, path, hole, releaseRef.current, { catchR: g.skill.catchR, windMul: g.skill.windMul });
            pts.push({ x: f.x, y: f.y });
            if (r.status !== "fly") break;
          }
          // Only reveal the first half of the flight, fading from solid to gone.
          const shown = Math.max(2, Math.floor(pts.length * 0.5));
          const aimStyle = cosmeticByKey(AIM_STYLES, aimStyleRef.current) ?? AIM_STYLES[0];
          ctx.lineWidth = 2;
          ctx.strokeStyle = aimStyle.color;
          if (aimStyle.dash) ctx.setLineDash(aimStyle.dash);
          if (aimStyle.glow) { ctx.shadowBlur = 6; ctx.shadowColor = aimStyle.color; }
          for (let i = 0; i < shown - 1; i++) {
            const t = i / (shown - 1);
            ctx.globalAlpha = Math.max(0.04, 0.95 * (1 - Math.pow(t, 1.4)));
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y - cam);
            ctx.lineTo(pts[i + 1].x, pts[i + 1].y - cam);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          ctx.setLineDash([]);
          ctx.shadowBlur = 0;
        }

        // Slider track + knob (the pull-back handle), colored by power.
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(dsx, dsy);
        ctx.lineTo(kx, ky);
        ctx.stroke();
        const pc = inCancel ? "#e23b3b" : power < 0.5 ? "#36D7B7" : power < 0.85 ? "#f5d24a" : "#e23b3b";
        ctx.fillStyle = dr.active ? pc : "rgba(255,255,255,0.7)";
        ctx.beginPath();
        ctx.arc(kx, ky, dr.active ? 5 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.stroke();
        ctx.lineWidth = 1;
      }

      // Cosmetic flight trail, drawn under the disc so the disc rides its head.
      if (g.trailBuf.length >= 2) {
        drawTrail(ctx, g.trailBuf, cam, trailByKey(trailKeyRef.current), performance.now());
      }

      // Shadow on the ground + disc lifted by its height.
      const disc = ADV_DISCS[g.discIndex];
      const dscreenY = g.disc.y - cam;
      const shadowR = Math.max(1.5, DISC_R - g.h * 0.03);
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath();
      ctx.ellipse(g.disc.x, dscreenY, shadowR, shadowR * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      const discY = dscreenY - g.h;
      const skin = cosmeticByKey(DISC_SKINS, discSkinRef.current) ?? DISC_SKINS[0];
      ctx.save();
      if (skin.kind === "glow") { ctx.shadowBlur = 7; ctx.shadowColor = skin.body; }
      if (skin.kind === "chrome") {
        const grad = ctx.createRadialGradient(g.disc.x - 1.5, discY - 1.5, 0.4, g.disc.x, discY, DISC_R);
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.55, skin.body);
        grad.addColorStop(1, "#878d97");
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = skin.body;
      }
      ctx.beginPath();
      ctx.arc(g.disc.x, discY, DISC_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (skin.kind === "galaxy") {
        ctx.fillStyle = "rgba(255,255,255,0.92)"; // star specks
        ctx.fillRect(Math.round(g.disc.x) + 1, Math.round(discY) - 1, 1, 1);
        ctx.fillRect(Math.round(g.disc.x) - 2, Math.round(discY) + 1, 1, 1);
      }
      ctx.fillStyle = disc.color; // tier pip so you can tell which disc is in hand
      ctx.fillRect(Math.round(g.disc.x) - 1, Math.round(discY) - 1, 2, 2);

      // Particles (leaves, splashes, sand, confetti) fade out as they die.
      for (const pt of particlesRef.current) {
        ctx.globalAlpha = Math.max(0, pt.life / pt.max);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - pt.size / 2, pt.y - cam - pt.size / 2, pt.size, pt.size);
      }
      ctx.globalAlpha = 1;

      ctx.restore(); // end of world-space (horizontally panned) drawing

      // ── Ambient wind (screen-fixed) — faint streaks blowing across the whole
      // viewport in the wind's direction. Density and speed scale with strength,
      // so a stiff breeze visibly rips across the screen and a calm one barely
      // drifts. Purely cosmetic; the arrow/mph panel still gives the exact read.
      {
        const wmag = hole.windMag ?? 0;
        if (wmag > 0.0006) {
          const wmph = Math.round((wmag / 0.018) * 15);
          const wang = Math.atan2(hole.wind?.y ?? 0, hole.wind?.x ?? 0);
          const dx = Math.cos(wang);
          const dy = Math.sin(wang);
          const streaks = windStreaksRef.current;
          const margin = 36;
          const target = Math.min(48, 5 + Math.round(wmph * 2.2)); // more wind → more streaks
          const baseSpeed = 0.7 + wmph * 0.24; // px/frame at the slowest layer
          while (streaks.length < target) {
            streaks.push({
              x: Math.random() * (W + margin * 2) - margin,
              y: Math.random() * (H + margin * 2) - margin,
              len: 5 + Math.random() * 11,
              a: 0.05 + Math.random() * 0.13,
              sp: 0.65 + Math.random() * 0.8, // per-streak speed → parallax depth
            });
          }
          if (streaks.length > target) streaks.length = target;
          // Tint matches the arrow: blue (calm) → yellow → orange (strong).
          const tint = wmph >= 10 ? "224,138,59" : wmph >= 5 ? "245,210,74" : "196,222,238";
          ctx.lineCap = "round";
          ctx.lineWidth = 1;
          for (const st of streaks) {
            const v = baseSpeed * st.sp;
            st.x += dx * v;
            st.y += dy * v;
            if (st.x < -margin) st.x = W + margin;
            else if (st.x > W + margin) st.x = -margin;
            if (st.y < -margin) st.y = H + margin;
            else if (st.y > H + margin) st.y = -margin;
            const l = st.len * st.sp;
            ctx.strokeStyle = `rgba(${tint},${st.a})`;
            ctx.beginPath();
            ctx.moveTo(st.x, st.y);
            ctx.lineTo(st.x - dx * l, st.y - dy * l); // tail points upwind
            ctx.stroke();
          }
        } else {
          windStreaksRef.current.length = 0;
        }
      }

      // ── Mini-map (screen-fixed) — sits on the side AWAY from the hole's
      // upper half, so a dogleg toward one corner is never hidden under it. ──
      {
        const ww = hole.worldW ?? W;
        const s = Math.min(60 / ww, (H - 90) / hole.worldH);
        const mw = ww * s;
        const mh = hole.worldH * s;
        const upper = hole.fairway.filter((p) => p.y < hole.worldH * 0.5);
        const leanX = [...upper, hole.basket].reduce((sum, p) => sum + p.x, 0) / (upper.length + 1);
        const ox = leanX > ww / 2 ? 7 : W - 7 - mw;
        const oy = 25; // below the HUD pill
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(ox - 3, oy - 3, mw + 6, mh + 6);
        ctx.fillStyle = "#2f5a26"; // rough
        ctx.fillRect(ox, oy, mw, mh);
        // curved fairway ribbon(s)
        ctx.strokeStyle = "#4d9a39";
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.lineWidth = Math.max(3, hole.fwWidth * s);
        for (const fw of [hole.fairway, ...(hole.fairways ?? [])]) {
          ctx.beginPath();
          ctx.moveTo(ox + fw[0].x * s, oy + fw[0].y * s);
          for (let i = 1; i < fw.length; i++) ctx.lineTo(ox + fw[i].x * s, oy + fw[i].y * s);
          ctx.stroke();
        }
        ctx.lineJoin = "miter";
        ctx.lineCap = "butt";
        ctx.lineWidth = 1;
        ctx.fillStyle = "#3a6ea5";
        for (const wt of hole.water) ctx.fillRect(ox + wt.x * s, oy + wt.y * s, wt.w * s, wt.h * s);
        for (const hz of hole.hazard ?? []) {
          ctx.fillStyle = "#d9c089";
          ctx.fillRect(ox + hz.x * s, oy + hz.y * s, hz.w * s, hz.h * s);
          ctx.strokeStyle = "#e0923b";
          ctx.strokeRect(ox + hz.x * s + 0.5, oy + hz.y * s + 0.5, Math.max(2, hz.w * s) - 1, Math.max(2, hz.h * s) - 1);
        }
        if (hole.dropZone) {
          ctx.fillStyle = "#e0923b";
          ctx.beginPath();
          ctx.arc(ox + hole.dropZone.x * s, oy + hole.dropZone.y * s, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = "#8a6a3a";
        for (const wl of hole.walls ?? []) {
          ctx.beginPath();
          ctx.moveTo(ox + wl.x * s, oy + wl.y * s);
          ctx.lineTo(ox + (wl.x + wl.w) * s, oy + wl.y * s);
          ctx.stroke();
        }
        ctx.strokeStyle = "rgba(238,241,230,0.9)";
        for (const ob of hole.obZones ?? []) {
          ctx.strokeRect(ox + ob.x * s + 0.5, oy + ob.y * s + 0.5, Math.max(2, ob.w * s) - 1, Math.max(2, ob.h * s) - 1);
        }
        ctx.fillStyle = "#234d1f";
        for (const tr of hole.trees) {
          ctx.beginPath();
          ctx.arc(ox + tr.x * s, oy + tr.y * s, Math.max(1.4, tr.r * s), 0, Math.PI * 2);
          ctx.fill();
        }
        // viewport window (tracks both camera axes)
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = 1;
        ctx.strokeRect(ox + camX * s + 0.5, oy + cam * s + 0.5, Math.min(mw, W * s) - 1, Math.min(mh, H * s) - 1);
        // tournament rivals
        if ((tournamentPlayRef.current || careerPlayRef.current) && ghostsRef.current?.holeIndex === g.holeIndex) {
          const gst = ghostsRef.current;
          const elapsed = performance.now() - gst.startAt;
          for (const gh of gst.ghosts) {
            const pos = ghostPosAt(gh, elapsed - gh.delay);
            if (pos.holed) continue;
            ctx.fillStyle = gh.color;
            ctx.beginPath();
            ctx.arc(ox + pos.x * s, oy + pos.y * s, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        // basket + disc
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(ox + hole.basket.x * s, oy + hole.basket.y * s, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = disc.color;
        ctx.beginPath();
        ctx.arc(ox + g.disc.x * s, oy + g.disc.y * s, 2.4, 0, Math.PI * 2);
        ctx.fill();

        // ── Wind + elevation panel, under the minimap ──
        const mag = hole.windMag ?? 0;
        const mph = Math.round((mag / 0.018) * 15);
        const wa = Math.atan2(hole.wind?.y ?? 0, hole.wind?.x ?? 0);
        const elev = elevAt(hole, g.disc.y); // slope where the disc lies (zoned holes change mid-hole)
        const panY = oy + mh + 5;
        const panH = 48;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(ox - 3, panY, mw + 6, panH);

        // — Wind (top) —
        const cxw = ox + 12;
        const cyw = panY + 13;
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cxw, cyw, 9, 0, Math.PI * 2);
        ctx.stroke();
        const windCol = mph >= 10 ? "#e08a3b" : mph >= 5 ? "#f5d24a" : "#9fd4e8";
        const al = 9;
        const hx = cxw + Math.cos(wa) * al;
        const hy = cyw + Math.sin(wa) * al;
        ctx.strokeStyle = windCol;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cxw - Math.cos(wa) * al, cyw - Math.sin(wa) * al);
        ctx.lineTo(hx, hy);
        ctx.stroke();
        ctx.fillStyle = windCol; // triangular arrowhead
        ctx.beginPath();
        ctx.moveTo(hx + Math.cos(wa) * 4, hy + Math.sin(wa) * 4);
        ctx.lineTo(hx + Math.cos(wa + 2.4) * 4, hy + Math.sin(wa + 2.4) * 4);
        ctx.lineTo(hx + Math.cos(wa - 2.4) * 4, hy + Math.sin(wa - 2.4) * 4);
        ctx.closePath();
        ctx.fill();
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = "bold 9px monospace";
        ctx.fillStyle = windCol;
        ctx.fillText(`${mph}mph`, ox + 25, cyw);

        // divider
        ctx.strokeStyle = "rgba(255,255,255,0.14)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ox, panY + 25);
        ctx.lineTo(ox + mw, panY + 25);
        ctx.stroke();

        // — Elevation (bottom): word + a carry % so its effect is explicit —
        const eCol = elev > 0 ? "#e89a4a" : elev < 0 ? "#5fc8e8" : "#9ab";
        const eWord = elev > 0 ? "UPHILL" : elev < 0 ? "DOWNHILL" : "FLAT";
        const chev = (elev > 0 ? "▲" : elev < 0 ? "▼" : "—").repeat(Math.max(1, Math.min(3, Math.abs(elev))));
        ctx.fillStyle = eCol;
        ctx.font = "bold 9px monospace";
        ctx.fillText(`${chev} ${eWord}`, ox, panY + 35);
        const pct = Math.round(-elev * 10); // carry change vs. flat
        ctx.font = "8px monospace";
        ctx.fillStyle = elev === 0 ? "#9ab" : pct > 0 ? "#36D7B7" : "#e08a3b";
        ctx.fillText(elev === 0 ? "even carry" : `${pct > 0 ? "+" : ""}${pct}% carry`, ox, panY + 45);
      }

      // HUD (screen-fixed) — a clean labeled status pill across the top.
      const hudH = 17;
      ctx.fillStyle = "rgba(13,15,20,0.82)";
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(4, 4, W - 8, hudH, 5);
      ctx.fill();
      ctx.stroke();
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      const hcy = 4 + hudH / 2 + 0.5;
      // Live "to par": completed holes plus the current hole once you've thrown.
      const holesIn = g.holeIndex + (g.throws > 0 ? 1 : 0);
      const strokesIn = g.scores.reduce((s, n) => s + (n ?? 0), 0) + (g.throws > 0 ? g.throws : 0);
      const over = strokesIn - g.roundHoles.slice(0, holesIn).reduce((s, h) => s + h.par, 0);
      const overStr = over === 0 ? "E" : over > 0 ? `+${over}` : `${over}`;
      let hx = 11;
      const hudItem = (label: string, value: string, valColor: string) => {
        ctx.font = "bold 6px ui-monospace, monospace";
        ctx.fillStyle = "#6b7280";
        ctx.fillText(label, hx, hcy);
        hx += ctx.measureText(label).width + 3;
        ctx.font = "bold 9px ui-monospace, monospace";
        ctx.fillStyle = valColor;
        ctx.fillText(value, hx, hcy);
        hx += ctx.measureText(value).width + 9;
      };
      if (g.mini) {
        if (g.mini.kind === "putt") {
          hudItem("PUTT", `${puttFeet(g.mini.station)} ft`, "#36D7B7");
          hudItem("MADE", `${g.mini.makes}`, "#ffffff");
        } else {
          hudItem("THROW", `${g.mini.attempts + 1}/${g.mini.total}`, "#ffffff");
          hudItem("POINTS", `${g.mini.points}`, "#f5d24a");
          if (g.mini.lastPts != null) hudItem("LAST", `+${g.mini.lastPts}`, g.mini.lastPts >= 80 ? "#36D7B7" : g.mini.lastPts > 0 ? "#cbd5e1" : "#e08a3b");
        }
      } else {
        if (g.party) hudItem("UP", g.party.names[g.party.current].slice(0, 8), "#f5d24a");
        hudItem("HOLE", g.party ? `${g.holeIndex + 1}/${g.roundHoles.length}` : g.practice ? `P${g.practiceHole}` : `${g.holeIndex + 1}/${g.roundHoles.length}`, "#ffffff");
        hudItem("PAR", `${hole.par}`, "#ffffff");
        hudItem("PIN", `${pxToFeet(distBetween(g.rest, hole.basket))}ft`, "#9cc4e8");
        hudItem("THR", `${g.throws}`, "#ffffff");
        hudItem("TO PAR", overStr, over < 0 ? "#36D7B7" : over > 0 ? "#e08a3b" : "#cbd5e1");
      }
      if (g.mode === "daily") {
        ctx.font = "bold 7px ui-monospace, monospace";
        const dw = ctx.measureText("DAILY").width + 8;
        const dx = W - 10 - dw;
        ctx.fillStyle = "rgba(245,210,74,0.18)";
        ctx.beginPath();
        ctx.roundRect(dx, hcy - 6, dw, 12, 3);
        ctx.fill();
        ctx.fillStyle = "#f5d24a";
        ctx.textAlign = "center";
        ctx.fillText("DAILY", dx + dw / 2, hcy);
        ctx.textAlign = "left";
      }

      // Intro caption — hole, par, and the slope (so elevation is read up front).
      if (g.phase === "intro") {
        const elev = hole.elev ?? 0;
        const venue = g.career?.venue;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, H / 2 - (venue ? 32 : 20), W, venue ? 52 : 40);
        ctx.textAlign = "center";
        if (venue) {
          // Career venue + its character (wooded, water-laden, links, …).
          ctx.fillStyle = "#f5d24a";
          ctx.font = "bold 9px monospace";
          ctx.fillText(`${g.career?.emoji ?? ""} ${venue}`.trim().toUpperCase(), W / 2, H / 2 - 21);
          if (g.career?.character) {
            ctx.fillStyle = "#9ab";
            ctx.font = "8px monospace";
            ctx.fillText(g.career.character, W / 2, H / 2 - 12);
          }
        }
        ctx.fillStyle = "#fff";
        ctx.font = "10px monospace";
        ctx.fillText(
          g.party
            ? `${g.party.names[g.party.current].toUpperCase().slice(0, 12)}  ·  HOLE ${g.holeIndex + 1}  ·  PAR ${hole.par}`
            : `HOLE ${g.practiceHole ?? g.holeIndex + 1}  ·  PAR ${hole.par}${g.practice ? "  ·  PRACTICE" : ""}`,
          W / 2, H / 2 - (venue ? 2 : 6),
        );
        if (hole.elevZones?.length) {
          // Changing slope, e.g. "▼ DOWNHILL EARLY — UPHILL LATE ▲"
          const first = hole.elevZones[0].elev;
          const last = hole.elevZones[hole.elevZones.length - 1].elev;
          ctx.fillStyle = "#e89a4a";
          ctx.font = "bold 11px monospace";
          const word = (e: number) => (e > 0 ? "UPHILL" : e < 0 ? "DOWNHILL" : "FLAT");
          ctx.fillText(`${first < 0 ? "▼" : "▲"} ${word(first)} EARLY — ${word(last)} LATE ${last < 0 ? "▼" : "▲"}`, W / 2, H / 2 + 8);
        } else if (elev !== 0) {
          ctx.fillStyle = elev > 0 ? "#e89a4a" : "#5fc8e8";
          ctx.font = "bold 11px monospace";
          const word = elev > 0 ? "UPHILL" : "DOWNHILL";
          const arr = (elev > 0 ? "▲" : "▼").repeat(Math.min(3, Math.abs(elev)));
          ctx.fillText(`${arr} ${word} — throws play ${elev > 0 ? "shorter" : "longer"}`, W / 2, H / 2 + 8);
        } else {
          ctx.fillStyle = "#9ab";
          ctx.font = "9px monospace";
          ctx.fillText("flat", W / 2, H / 2 + 8);
        }
        ctx.textAlign = "left";
      }

      // Penalty banner — big red "OUT OF BOUNDS / HAZARD" + "+1", centered.
      if (g.flash) {
        const FLASH_MS = 1500;
        const t = (performance.now() - g.flash.at) / FLASH_MS;
        if (t >= 1) {
          g.flash = null;
        } else {
          const alpha = t > 0.7 ? Math.max(0, 1 - (t - 0.7) / 0.3) : 1; // hold, then fade
          const cy = H / 2;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.fillRect(0, cy - 24, W, 48);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(0,0,0,0.85)";
          ctx.fillStyle = "#ff2e2e";
          ctx.font = "bold 22px ui-monospace, monospace";
          ctx.strokeText(g.flash.text, W / 2, cy - 7);
          ctx.fillText(g.flash.text, W / 2, cy - 7);
          ctx.font = "bold 18px ui-monospace, monospace";
          ctx.strokeText("+1", W / 2, cy + 14);
          ctx.fillText("+1", W / 2, cy + 14);
          ctx.restore();
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
        }
      }
    }

    // Fixed-timestep sim so motion stays at the right wall-clock speed even when
    // the frame rate dips — the disc/camera advance by elapsed real time rather
    // than once-per-frame (which slowed to a crawl on slower devices). Render
    // once per frame after catching the sim up.
    const STEP_MS = 1000 / 60; // simulate at 60 Hz
    let prev = performance.now();
    let acc = 0;
    function frame(now: number) {
      acc += Math.min(STEP_MS * 4, now - prev); // never try to catch up more than 4 steps
      prev = now;
      let steps = 0;
      while (acc >= STEP_MS && steps < 4) { update(); acc -= STEP_MS; steps++; }
      draw();
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [syncHud, persistResume, addCoins, equipForLie]);

  useEffect(() => {
    return () => {
      audioRef.current?.close();
      audioRef.current = null;
    };
  }, []);

  function toggleMute() {
    setMuted((m) => {
      const next = !m;
      audioRef.current?.setMuted(next);
      return next;
    });
  }

  // ── Canvas display size ───────────────────────────────────────────────────
  // Contain-fit the canvas to the play area: without this it sits at its native
  // 320×448 CSS size (max-w/max-h only shrink), which looks tiny on desktop.
  const playAreaRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const area = playAreaRef.current;
    const canvas = canvasRef.current;
    if (!area || !canvas) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const scale = Math.min(width / W, height / H);
      canvas.style.width = `${W * scale}px`;
      canvas.style.height = `${H * scale}px`;
    });
    ro.observe(area);
    return () => ro.disconnect();
  }, []);

  // ── Drag-to-throw (pointer) ────────────────────────────────────────────────
  const clientToCanvas = useCallback((clientX: number, clientY: number) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { x: (clientX - r.left) * (W / r.width), y: (clientY - r.top) * (H / r.height) };
  }, []);
  // Pull is measured from where the press started (the anchor), so you can grab
  // anywhere on screen — handy when the disc is near an edge and there's no room
  // to pull back from the disc itself. The slider/knob still renders attached to
  // the disc; only the gesture origin moves.
  const applyDrag = useCallback((g: GameState, px: number, py: number) => {
    const dr = dragRef.current;
    const pullX = px - dr.ax; // pull relative to the press point
    const pullY = py - dr.ay;
    const dist = Math.hypot(pullX, pullY);
    g.power = Math.min(1, dist / MAX_DRAG);
    if (dist > 4) g.angle = Math.atan2(-pullY, -pullX); // throw opposite the pull
  }, []);
  function onCanvasDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (screenRef.current !== "playing" || pausedRef.current) return;
    const g = stateRef.current;
    if (!g || g.phase !== "aim") return;
    const p = clientToCanvas(e.clientX, e.clientY);
    dragRef.current = { active: true, ax: p.x, ay: p.y, cx: p.x, cy: p.y };
    applyDrag(g, p.x, p.y);
  }

  // Move/release are handled on the window so the throw still fires even when
  // you drag far past the canvas edge (the old bug where a big pull-back
  // sometimes did nothing on release).
  useEffect(() => {
    function move(e: PointerEvent) {
      const dr = dragRef.current;
      if (!dr.active) return;
      const g = stateRef.current;
      if (!g || g.phase !== "aim") return;
      const p = clientToCanvas(e.clientX, e.clientY);
      dr.cx = p.x;
      dr.cy = p.y;
      applyDrag(g, p.x, p.y);
    }
    function up() {
      const dr = dragRef.current;
      if (!dr.active) return;
      dr.active = false;
      const g = stateRef.current;
      if (!g) return;
      // Released inside the cancel ring (or barely pulled) → abort the throw.
      if (g.phase === "aim" && g.power > CANCEL_POWER) throwDisc();
      else g.power = 0;
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [clientToCanvas, applyDrag, throwDisc]);

  const finalParTotal = finalPars.reduce((s, n) => s + n, 0);
  const finalOver = finalTotal - finalParTotal;
  const finalIsDaily = finalMode === "daily";
  // The personal best for the course just played (null for the daily).
  const finalBest = finalMode === "course" ? bestScore : finalMode === "winthrop" ? winthropBest : finalMode === "tour" ? (tourBests[finalSeed] ?? null) : null;
  const overStr = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);

  return (
    <div className="h-[100dvh] w-full bg-[#0f1117] flex flex-col select-none overflow-hidden">
      {/* Play area — canvas fills the available space, keeping its aspect ratio */}
      <div ref={playAreaRef} className="relative flex-1 min-h-0 flex items-center justify-center px-2 pt-2 pb-1">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={onCanvasDown}
          className="max-h-full max-w-full rounded-lg border border-white/10 bg-[#4a8a3a]"
          style={{ imageRendering: "pixelated", touchAction: "none" }}
        />

        {screen === "landing" && (
          <div className="absolute inset-0 overflow-y-auto rounded-lg bg-gradient-to-b from-[#1c2233] via-[#141926] to-[#0f1117]">
            <div
              className="min-h-full flex items-center justify-center px-5"
              style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)", paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
            >
              <div className="w-full max-w-[290px] flex flex-col items-center text-center py-6">
                <svg width="56" height="56" viewBox="0 0 32 32" aria-hidden className="drop-shadow">
                  <g stroke="#2a7d70" strokeWidth="2" strokeLinecap="round">
                    <line x1="2" y1="12.5" x2="8" y2="12.5" /><line x1="1" y1="18" x2="7" y2="18" />
                  </g>
                  <ellipse cx="18.5" cy="16.5" rx="11" ry="5" fill="#1f9e8c" />
                  <ellipse cx="18.5" cy="14.8" rx="11" ry="5" fill="#36D7B7" />
                  <ellipse cx="18.5" cy="14" rx="6.5" ry="2.4" fill="#5fe6d2" />
                </svg>
                <h1 className="text-white font-black text-[28px] leading-tight tracking-tight mt-3">
                  Disc Golf <span className="text-[#36D7B7]">Arcade</span>
                </h1>
                <p className="text-gray-300 text-sm mt-2 font-medium">How do you want to play?</p>

                <div className="w-full flex flex-col gap-2.5 mt-6">
                  <button type="button" onClick={() => chooseEntry("offline")} className={titleCard}>
                    Play offline
                  </button>
                  {supa && (
                    <button type="button" onClick={() => chooseEntry("auth")} className={titleCard}>
                      👤 Log in / Sign up
                    </button>
                  )}
                </div>
                <p className="text-gray-500 text-[11px] mt-4 leading-snug">
                  {supa
                    ? "Offline saves to this device. Log in to sync your bag, coins and bests across devices — you can switch anytime from the menu."
                    : "Your scores save right here on this device."}
                </p>
              </div>
            </div>
          </div>
        )}

        {screen === "title" && (
          <>
          {hub === "home" && (
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
              className="absolute z-10 right-3 w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 active:bg-white/15 text-gray-300 hover:text-white text-lg transition"
              style={{ top: "max(env(safe-area-inset-top), 0.5rem)" }}
            >
              ⚙
            </button>
          )}
          <div className="absolute inset-0 overflow-y-auto rounded-lg bg-gradient-to-b from-[#1c2233] via-[#141926] to-[#0f1117]">
            <div
              className="min-h-full flex items-start justify-center px-5"
              style={{ paddingTop: "max(env(safe-area-inset-top), 1.5rem)", paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
            >
            <div className="w-full max-w-[300px] flex flex-col items-center text-center pt-1 pb-4">
              {/* Logo */}
              <div className="flex flex-col items-center gap-2.5">
                <svg width="56" height="56" viewBox="0 0 32 32" aria-hidden className="drop-shadow">
                  <g stroke="#2a7d70" strokeWidth="2" strokeLinecap="round">
                    <line x1="2" y1="12.5" x2="8" y2="12.5" /><line x1="1" y1="18" x2="7" y2="18" />
                  </g>
                  <ellipse cx="18.5" cy="16.5" rx="11" ry="5" fill="#1f9e8c" />
                  <ellipse cx="18.5" cy="14.8" rx="11" ry="5" fill="#36D7B7" />
                  <ellipse cx="18.5" cy="14" rx="6.5" ry="2.4" fill="#5fe6d2" />
                </svg>
                <h1 className="text-white font-black text-[30px] leading-none tracking-tight">
                  Disc Golf <span className="text-[#36D7B7]">Arcade</span>
                </h1>
              </div>

              {/* Player profile chip — avatar, name, level + xp-to-next bar */}
              {(() => {
                const lvl = levelFromXp(playerXp(roundsPlayed, unlocked.length, discsOwned));
                return (
                  <button
                    type="button"
                    onClick={() => setProfileOpen(true)}
                    className="w-full mt-7 flex items-center gap-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 transition text-left"
                  >
                    <span className="text-2xl leading-none shrink-0">{profile.avatar || DEFAULT_AVATAR}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-white font-bold text-sm truncate">{profile.name?.trim() || "Set up profile"}</span>
                        <span className="text-[#36D7B7] font-bold text-[11px] shrink-0">Lv {lvl.level}</span>
                      </div>
                      <div className="mt-1 h-1.5 bg-white/10 rounded overflow-hidden">
                        <div className="h-full bg-[#36D7B7] rounded" style={{ width: `${lvl.need ? Math.round((lvl.into / lvl.need) * 100) : 100}%` }} />
                      </div>
                    </div>
                  </button>
                );
              })()}

              {/* Coins + daily reward */}
              <div className="w-full flex items-center gap-2 mt-3">
                <div className="flex items-center gap-1.5 rounded-lg bg-[#f5d24a]/10 border border-[#f5d24a]/30 px-2.5 py-1.5">
                  <Coin />
                  <span className="text-[#f5d24a] font-bold text-sm font-mono">{fmtCoins(coins)}</span>
                </div>
                {dailyAvailable(daily, today) ? (
                  <button type="button" onClick={claimDaily}
                    className="flex-1 rounded-lg bg-[#36D7B7] hover:bg-[#2bc4a6] active:scale-[0.99] text-[#0f1117] font-bold text-sm py-2 transition animate-pulse">
                    🎁 Daily reward
                  </button>
                ) : (
                  <div className="flex-1 rounded-lg border border-white/10 text-gray-400 text-xs font-semibold py-2 text-center">
                    🎁 Claimed · 🔥 {daily?.streak ?? 0}d
                  </div>
                )}
              </div>

              {/* A pending challenge from a shared link */}
              {challenge && (
                <button
                  type="button"
                  onClick={() => { startGame(challenge.mode, challenge.seed); challengePlayRef.current = true; }}
                  className="w-full rounded-xl border border-[#e0923b]/60 bg-[#e0923b]/15 hover:bg-[#e0923b]/25 text-white font-bold py-3 px-3 mt-4 transition text-sm"
                >
                  ⚔ {challenge.name} challenged you: {challenge.score} on{" "}
                  {challenge.mode === "course" ? "Glendoveer" : challenge.mode === "winthrop" ? "Winthrop Lake" : "a Daily course"} — play it!
                </button>
              )}

              {/* Resume an interrupted solo round (Daily resumes live on the
                  Daily Challenge button instead — see the Single Player page). */}
              {resumeBanner && (
                <button
                  type="button"
                  onClick={() => startResume(resumeBanner)}
                  className="w-full rounded-xl border border-[#36D7B7]/60 bg-[#36D7B7]/15 hover:bg-[#36D7B7]/25 text-white font-bold py-3 px-3 mt-4 transition text-sm"
                >
                  ↻ Resume {resumeBanner.mode === "course" ? "Glendoveer" : resumeBanner.mode === "winthrop" ? "Winthrop Lake" : resumeBanner.mode === "tour" ? tourVenue(resumeBanner.seed) : resumeBanner.mode === "ranked" ? "Ranked" : "round"} · hole {resumeBanner.scores.length + 1}
                </button>
              )}

              {/* Hub: three category cards keep the menu uncluttered */}
              {hub === "home" && (
                <>
                  <div className={`w-full flex flex-col gap-3 ${menuTopMargin}`}>
                    <button type="button" onClick={() => setHub("solo")} className={hubCard}>
                      <span className="font-black text-lg">Single Player</span>
                    </button>
                    <button type="button" onClick={() => setHub("online")} className={hubCard}>
                      <span className="font-black text-lg">Online</span>
                    </button>
                    <button type="button" onClick={() => setPracticeOpen(true)} className={hubCard}>
                      <span className="font-black text-lg">Practice</span>
                    </button>
                  </div>

                  {/* Utilities — Bag, Shop, Challenges, Leaderboards (Settings = top-right gear) */}
                  <div className="w-full flex gap-2 mt-4">
                    <button type="button" onClick={() => setBagOpen(true)} className={titleCardSm}>Bag</button>
                    <button type="button" onClick={() => setShopOpen(true)} className={titleCardSm}>Shop</button>
                  </div>
                  <div className="w-full flex gap-2 mt-2">
                    <button type="button" onClick={() => setChallengesOpen(true)} className={titleCardSm}>
                      Challenges{claimableEvents > 0 ? ` (${claimableEvents})` : ""}
                    </button>
                    <button type="button" onClick={() => setBoardsOpen(true)} className={titleCardSm}>Leaderboards</button>
                  </div>
                </>
              )}

              {/* Single Player page */}
              {hub === "solo" && (
                <div className={`w-full flex flex-col gap-2 ${menuTopMargin}`}>
                  <button type="button" onClick={() => setHub("home")} className={`${titleCardSm} !flex-none self-start px-3`}>‹ Back</button>
                  {dailyResume ? (
                    <button type="button" onClick={() => startResume(dailyResume)} className={titleCard}>
                      ↻ Resume Daily · hole {dailyResume.scores.length + 1}
                    </button>
                  ) : (
                    <button type="button" onClick={() => startGame("daily")} className={titleCard}>
                      Daily Challenge
                    </button>
                  )}
                  <button type="button" onClick={() => setCoursesOpen(true)} className={titleCard}>
                    Challenge the Arcade
                  </button>
                  <button type="button" onClick={() => { setCareerLastResult(null); setCareerNotes([]); setCareerOpen(true); }} className={titleCard}>
                    Career{career && !career.retired ? " · Continue" : ""}
                  </button>
                  <button type="button" onClick={() => setTournamentOpen(true)} className={titleCard}>
                    Tournaments{tournament && !tournament.finished ? ` · ${tournDef(tournament.id)?.name ?? ""} R${tournament.myTotals.length + 1}` : ""}
                  </button>
                </div>
              )}

              {/* Online & Compete page */}
              {hub === "online" && (
                <div className={`w-full flex flex-col gap-2 ${menuTopMargin}`}>
                  <button type="button" onClick={() => setHub("home")} className={`${titleCardSm} !flex-none self-start px-3`}>‹ Back</button>
                  <button type="button" onClick={() => setChallengeOpen(true)} className={titleCard}>
                    Challenge Friends
                  </button>
                  <button type="button" onClick={() => setRankedOpen(true)} className={titleCard}>
                    Ranked · {tierFromRP(ranked?.rp ?? 0).tier.emoji} {tierFromRP(ranked?.rp ?? 0).tier.name}
                  </button>
                </div>
              )}
            </div>
            </div>
          </div>
          </>
        )}

        {screen === "holeComplete" && onlineView && (() => {
          const sl = scoreLabel(hud.throws, onlineView.par);
          const rows = Object.entries(onlineScores)
            .map(([id, s]) => ({ id, ...s }))
            .sort((a, b) => a.total - b.total);
          const lead = rows.length ? rows[0].total : 0;
          return (
            <Overlay onTap={nextHole}>
              <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-[0.15em]">Hole {onlineView.hole + 1}</p>
              <p className="text-[#36D7B7] font-black text-2xl leading-none">{sl.emoji && `${sl.emoji} `}{sl.name}</p>
              <div className="w-full max-w-[260px] space-y-1 pt-1">
                {rows.map((r) => (
                  <div key={r.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1.5 text-sm">
                    <span className="text-white font-semibold truncate">{r.total === lead ? "👑 " : ""}{r.id === onlineView.myId ? `${r.name} (you)` : r.name}</span>
                    <span className="text-gray-300 font-mono text-xs">thru {r.thru} · {r.total}</span>
                  </div>
                ))}
              </div>
              <p className="text-white/35 text-xs pt-1">tap anywhere to continue</p>
            </Overlay>
          );
        })()}
        {screen === "holeComplete" && partyView && (
          <Overlay onTap={nextHole}>
            <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-[0.15em]">Hole {hud.hole} complete</p>
            <div className="w-full max-w-[240px] space-y-1 pt-1">
              {partyView.names.map((n, i) => {
                const sc = partyView.holeScores[i];
                const lead = Math.min(...partyView.totals);
                return (
                  <div key={n} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1.5 text-sm">
                    <span className="text-white font-semibold truncate">{partyView.totals[i] === lead ? "👑 " : ""}{n}</span>
                    <span className="text-gray-300 font-mono">{sc != null ? scoreLabel(sc, hud.par).name : "–"} · {partyView.totals[i]}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-white/35 text-xs pt-1">tap anywhere to continue</p>
          </Overlay>
        )}
        {screen === "holeComplete" && !partyView && !onlineView && (() => {
          const sl = scoreLabel(hud.throws, hud.par);
          const tone =
            sl.tone === "great" ? "text-[#f5d24a]" :
            sl.tone === "good" ? "text-[#36D7B7]" :
            sl.tone === "even" ? "text-white" : "text-[#e08a3b]";
          return (
            <Overlay onTap={nextHole}>
              <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-[0.15em]">Hole {hud.hole}</p>
              <p className={`${tone} font-black text-4xl leading-none`}>
                {sl.emoji && `${sl.emoji} `}{sl.name}
              </p>
              <p className="text-gray-300 text-sm">{hud.throws} throws · par {hud.par}</p>
              {holeBestNote && (
                <p className="text-xs font-semibold">
                  {holeBestNote.isNew
                    ? <span className="text-[#f5d24a]">★ New best for this hole!</span>
                    : <span className="text-gray-500">Your best here: {holeBestNote.best}</span>}
                </p>
              )}
              {tournLiveView && (() => {
                const top = tournLiveView.rows.slice(0, 10);
                const me = tournLiveView.rows.find((r) => r.you)!;
                const par = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
                const row = (r: TournLiveRow, key: string) => (
                  <div key={key} className={`flex items-center gap-2 px-2.5 py-1 text-xs ${r.you ? "bg-[#36D7B7]/15 text-[#36D7B7] font-bold rounded" : "text-gray-300"}`}>
                    <span className="font-mono w-5 text-right">{r.rank}</span>
                    <span className="flex-1 truncate text-left">{r.name}</span>
                    <span className="font-mono">{par(r.toPar)}</span>
                    <span className="font-mono font-bold w-7 text-right text-white">{r.total}</span>
                  </div>
                );
                return (
                  <div className="w-full max-w-[260px]">
                    <p className="text-[#f5d24a] text-[10px] font-bold uppercase tracking-wide mb-1 text-center">🏟 Leaderboard · thru {hud.hole}</p>
                    <div className="bg-black/30 rounded-lg p-1 space-y-0.5">
                      {top.map((r) => row(r, `t${r.rank}`))}
                      {me.rank > 10 && (
                        <>
                          <div className="text-center text-gray-600 text-xs leading-none">···</div>
                          {row(me, "me")}
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
              <p className="text-white/35 text-xs pt-1">tap anywhere to continue</p>
            </Overlay>
          );
        })()}

        {tutorialOpen && <TutorialPanel onClose={() => setTutorialOpen(false)} />}

        {statsOpen && <StatsPanel onClose={() => setStatsOpen(false)} />}

        {boardsOpen && <LeaderboardPanel onClose={() => setBoardsOpen(false)} />}

        {partyOpen && (
          <PartyPanel
            onClose={() => setPartyOpen(false)}
            onStart={(m, names) => { setPartyOpen(false); startParty(m, names); }}
          />
        )}

        {/* Challenge Friends menu (online lobbies disabled if Supabase isn't set up) */}
        {challengeOpen && !lobby && (
          <ChallengePanel
            online={!!supa}
            onClose={() => setChallengeOpen(false)}
            onPassPlay={() => { setChallengeOpen(false); setPartyOpen(true); }}
            onCreate={(m, name) => createLobby(m, name)}
            onJoin={(code, name) => joinLobby(code, name)}
          />
        )}

        {/* Lobby (shown on the title screen until the host starts) */}
        {screen === "title" && lobby && (
          <LobbyPanel
            lobby={lobby}
            players={lobbyPlayers}
            onStart={startOnlineHost}
            onLeave={leaveLobby}
          />
        )}

        {tournamentOpen && (
          <TournamentPanel
            tournaments={TOURNAMENTS}
            active={tournament}
            bests={tournBests}
            onStart={(def) => saveTournament({ id: def.id, seed: def.seed, round: 0, myTotals: [], fieldTotals: [], madeCut: true, finished: false })}
            onAbandon={() => saveTournament(null)}
            onPlayRound={(t) => {
              const def = tournDef(t.id);
              if (!def) return;
              const rd = def.rounds[t.myTotals.length];
              if (!rd) return;
              setTournamentOpen(false);
              // Tour rounds play their fixed venue seed; Glendoveer/Winthrop get a
              // per-round seed so each round's pins/wind differ.
              const seed = rd.seed ?? ((t.seed + t.myTotals.length * 1013904223) | 0);
              startGame(rd.mode, seed);
              tournamentPlayRef.current = true;
            }}
            onClose={() => setTournamentOpen(false)}
          />
        )}

        {dailyClaim && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0f1117]/85 backdrop-blur-sm rounded-lg px-6" onClick={() => setDailyClaim(null)}>
            <div className="text-center">
              <p className="text-6xl mb-2">🎁</p>
              <p className="text-[#f5d24a] font-black text-4xl">+{dailyClaim.coins} <Coin className="!w-7 !h-7 align-[-2px]" /></p>
              <p className="text-gray-300 text-sm mt-2">Daily reward · 🔥 {dailyClaim.streak}-day streak</p>
              <button type="button" onClick={() => setDailyClaim(null)} className={`${btn} mt-4`}>Nice!</button>
            </div>
          </div>
        )}

        {careerOpen && (
          <CareerPanel
            career={career}
            lastResult={careerLastResult}
            lastCoins={careerCoins}
            notes={careerNotes}
            onClose={() => { setCareerOpen(false); setCareerNotes([]); }}
            onStart={startNewCareer}
            onPlay={(ev) => { const c = careerRef.current; if (c) startCareerEvent(c, ev); }}
            onSim={simCareerEvent}
            onAdvance={advanceCareerSeason}
            onRetire={() => { const c = careerRef.current; if (c) saveCareer(retire(c)); }}
            onAbandon={() => { saveCareer(null); setCareerLastResult(null); setCareerNotes([]); }}
            onSign={(id) => { const c = careerRef.current; if (c) saveCareer(signSponsor(c, id)); }}
            onBuyTrain={() => { const c = careerRef.current; if (c) saveCareer(buyTrainingPoint(c)); }}
            onBuyDisc={(key) => { const c = careerRef.current; if (c) saveCareer(buyCareerDisc(c, key)); }}
            onToggleBag={(key) => { const c = careerRef.current; if (c) saveCareer(toggleCareerBag(c, key)); }}
            dismissNotes={() => setCareerNotes([])}
          />
        )}

        {coursesOpen && (
          <CoursesPanel
            courses={FIXED_COURSES}
            tourCourses={TOUR_COURSE_INFOS}
            bests={{ course: bestScore, winthrop: winthropBest }}
            tourBests={tourBests}
            onClose={() => setCoursesOpen(false)}
            onPlay={(m, seed) => { setCoursesOpen(false); startGame(m, seed); }}
          />
        )}

        {shopOpen && (
          <ShopPanel coins={coins} unlocked={unlocked} owned={owned} level={playerLevel} profile={profile} onBuy={buyItem} onEquip={(field, key) => saveProfile({ ...profile, [field]: key })} onClose={() => setShopOpen(false)} />
        )}

        {bagOpen && (
          <BagPanel
            bag={bag} unlocked={unlocked} owned={owned} level={playerLevel}
            onAdd={addToBag} onRemove={removeFromBag} onMove={moveInBag}
            onShop={() => { setBagOpen(false); setShopOpen(true); }}
            onClose={() => setBagOpen(false)}
          />
        )}

        {profileOpen && (
          <ProfilePanel
            profile={profile}
            coins={coins}
            owned={owned}
            unlocked={unlocked}
            roundsPlayed={roundsPlayed}
            bestScore={bestScore}
            winthropBest={winthropBest}
            bagCount={bag.length}
            onSave={saveProfile}
            onBuyAvatar={buyAvatar}
            onBag={() => { setProfileOpen(false); setBagOpen(true); }}
            onShop={() => { setProfileOpen(false); setShopOpen(true); }}
            onStats={() => { setProfileOpen(false); setStatsOpen(true); }}
            hasAuth={!!supa}
            user={user}
            onAccount={() => { setProfileOpen(false); setAuthErr(null); setAuthMsg(null); setAuthOpen(true); }}
            onSignOut={signOut}
            onClose={() => setProfileOpen(false)}
          />
        )}

        {rankedOpen && (
          <RankedPanel
            ranked={ranked}
            playerName={profile.name}
            onPlay={() => { setRankedOpen(false); startGame("ranked"); }}
            onClose={() => setRankedOpen(false)}
          />
        )}

        {challengesOpen && (
          <ChallengesPanel
            history={history}
            owned={owned}
            coins={coins}
            today={today}
            onClaim={claimChallenge}
            onClose={() => setChallengesOpen(false)}
          />
        )}

        {practiceOpen && (
          <PracticePanel
            onClose={() => setPracticeOpen(false)}
            onPick={(m, i, seed) => { setPracticeOpen(false); startPractice(m, i, seed); }}
            onMini={(k) => { setPracticeOpen(false); startMini(k); }}
            onHowTo={() => { setPracticeOpen(false); setTutorialOpen(true); }}
          />
        )}

        {settingsOpen && (
          <SettingsPanel
            onClose={() => setSettingsOpen(false)}
            throwStyle={throwStyle} setThrowStyle={setThrowStyle}
            musicVolume={musicVolume} setMusicVolume={setMusicVolume}
            leftHanded={leftHanded} setLeftHanded={setLeftHanded}
            showGhost={showGhost} setShowGhost={setShowGhost}
            muted={muted} onToggleSound={toggleMute}
            unlocked={unlocked}
          />
        )}

        {authOpen && (
          <AuthPanel
            onClose={() => { setRecovering(false); setAuthOpen(false); }}
            user={user}
            recovering={recovering}
            email={authEmail} setEmail={setAuthEmail}
            password={authPassword} setPassword={setAuthPassword}
            busy={authBusy} error={authErr} message={authMsg}
            clearFeedback={() => { setAuthErr(null); setAuthMsg(null); }}
            onSignIn={signIn} onSignUp={signUp} onSignOut={signOut}
            onResetPassword={resetPassword} onUpdatePassword={updatePassword}
          />
        )}

        {/* In-round pause menu */}
        {pauseMenu && (screen === "playing" || screen === "holeComplete") && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0f1117]/80 backdrop-blur-sm rounded-lg px-6">
            <div className="w-full max-w-[240px] flex flex-col gap-2.5">
              <h2 className="text-white font-black text-2xl text-center mb-1">Paused</h2>
              <button type="button" onClick={() => setPauseMenu(null)} className={`${btn} w-full !mt-0`}>Continue</button>
              {pauseMenu.isCareer && (
                <button type="button" onClick={simCurrentCareerRound}
                  className="w-full bg-[#1a1d23] border border-white/15 hover:border-white/35 text-white font-bold py-3 rounded-lg transition">
                  ⚡ Sim rest of round
                </button>
              )}
              {pauseMenu.canRestart && (
                <button type="button" onClick={restartRound}
                  className="w-full bg-[#1a1d23] border border-white/15 hover:border-white/35 text-white font-bold py-3 rounded-lg transition">
                  Restart round
                </button>
              )}
              <button type="button" onClick={exitToHome}
                className="w-full bg-[#1a1d23] border border-white/15 hover:border-white/35 text-white font-bold py-3 rounded-lg transition">
                Exit to home
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Control panel: disc rack + flight/stance/mute — only while in a round */}
      {(screen === "playing" || screen === "holeComplete") && (
        <div className="shrink-0 w-full border-t border-white/10 bg-[#13161b]">
          <div className="mx-auto w-full max-w-[480px] px-3 pt-2 pb-[max(calc(env(safe-area-inset-bottom)+0.4rem),1.25rem)] flex flex-col gap-2">
            {/* Disc selector — only the discs in your bag (no bag-editing or
                shopping mid-round; both live on the home screen between rounds). */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">Bag · {activeBag.length}/{BAG_MAX}</span>
              <span className="text-[10px] text-gray-400 font-medium truncate ml-2 min-w-0">
                {`${ADV_DISCS[discIndex]?.brand ?? ""} ${ADV_DISCS[discIndex]?.name ?? ""}`}
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1" style={{ scrollbarWidth: "thin" }}>
              {activeBag.map((key) => {
                const d = discByKey(key);
                if (!d) return null;
                const i = discIndexByKey(key);
                return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectDisc(i)}
                  className={`shrink-0 w-[90px] rounded-lg border px-2 py-1.5 text-left transition ${
                    i === discIndex ? "border-[#36D7B7]/70 bg-[#36D7B7]/10" : "border-white/10 hover:border-white/25 bg-white/[0.02]"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className={`text-xs font-bold truncate ${i === discIndex ? "text-white" : "text-gray-300"}`}>{d.name}</span>
                  </span>
                  <span className="block text-[9px] text-gray-500 mt-0.5">{d.brand}</span>
                </button>
                );
              })}
            </div>

            {/* Release angle */}
            <div className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500">Angle</span>
              <div className="flex-1 flex gap-1 bg-[#0f1117] border border-white/10 rounded-lg p-1">
                {([
                  { key: "hyzer", label: "Hyzer ⤸" },
                  { key: "flat", label: "Flat" },
                  { key: "anny", label: "⤹ Anny" },
                ] as const).map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setRelease(r.key)}
                    aria-pressed={release === r.key}
                    className={`flex-1 rounded-md px-2 py-1.5 text-xs font-bold transition ${
                      release === r.key ? "bg-[#e0923b] text-[#0f1117] shadow" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stance + mute */}
            <div className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500">Stance</span>
              <div className="flex-1 flex gap-1 bg-[#0f1117] border border-white/10 rounded-lg p-1">
                {([
                  { key: "BH", label: "Backhand ◄" },
                  { key: "FH", label: "► Forehand" },
                ] as const).map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setThrowStyle(s.key)}
                    aria-pressed={throwStyle === s.key}
                    className={`flex-1 rounded-md px-2 py-1.5 text-xs font-bold transition ${
                      throwStyle === s.key ? "bg-[#4B3DFF] text-white shadow" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => { const g = stateRef.current; setPauseMenu({ canRestart: !!g && !g.online && !g.mini && !tournamentPlayRef.current && !careerPlayRef.current, isCareer: careerPlayRef.current }); }}
                aria-label="Menu"
                className="shrink-0 w-10 h-[34px] flex items-center justify-center bg-[#0f1117] border border-white/10 hover:border-white/25 text-white rounded-lg active:bg-white/10 transition"
              >
                ☰
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results: scorecard + save + leaderboard */}
      {/* Practice mini-game results */}
      {levelUp && (
        <LevelUpPanel level={levelUp.level} choices={levelUp.choices} bagHasRoom={bag.length < BAG_MAX} onPick={claimLevelUp} />
      )}

      {miniResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1117]/95 backdrop-blur-sm p-6">
          <div className="w-full max-w-xs text-center space-y-3">
            <p className="text-5xl">{miniResult.kind === "putt" ? "⛳" : "🎯"}</p>
            <h2 className="text-white font-black text-2xl">{miniResult.kind === "putt" ? "Putting Practice" : "Target Practice"}</h2>
            {miniResult.kind === "putt" ? (
              <p className="text-gray-300">You sank <span className="text-[#36D7B7] font-bold">{miniResult.makes}</span> putt{miniResult.makes === 1 ? "" : "s"} — longest <span className="text-white font-bold">{miniResult.best} ft</span>.</p>
            ) : (
              <p className="text-gray-300">You scored <span className="text-[#f5d24a] font-bold">{miniResult.points}</span> points over 10 throws.</p>
            )}
            <p className="text-[#f5d24a] font-bold text-lg">+{miniResult.coins} <Coin className="!w-4 !h-4" /></p>
            <div className="flex flex-col gap-2 pt-1">
              <button type="button" onClick={() => startMini(miniResult.kind)} className={`${btn} w-full`}>↻ Play again</button>
              <button type="button" onClick={() => { audioRef.current?.stopMusic(); setMiniResult(null); }} className="w-full bg-[#1a1d23] border border-white/15 hover:border-white/35 text-white font-bold py-3 rounded-lg transition">🏠 Done</button>
            </div>
          </div>
        </div>
      )}

      {screen === "gameComplete" && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-start sm:items-center justify-center">
          <div className="w-full max-w-lg space-y-3 my-auto">
            <div className="text-center">
              <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wide">
                {finalPracticeHole != null
                  ? `${finalMode === "winthrop" ? "Winthrop Lake" : finalMode === "tour" ? tourVenue(finalSeed) : "Glendoveer East"} · hole ${finalPracticeHole} · par ${finalParTotal}`
                  : finalIsDaily
                    ? `Today's course · ${finalPars.length} holes · par ${finalParTotal}`
                    : finalMode === "ranked"
                      ? `Ranked · this week · ${finalPars.length} holes · par ${finalParTotal}`
                      : finalMode === "tour"
                        ? `${tourVenue(finalSeed)} · ${finalPars.length} holes · par ${finalParTotal}`
                        : `${finalMode === "winthrop" ? "Winthrop Lake" : "Glendoveer East"} · 18 holes · par ${finalParTotal}`}
              </p>
              <h2 className="text-white font-black text-2xl mt-0.5">
                {finalParty || finalOnline ? "Match complete!" : finalPracticeHole != null ? "Practice complete!" : finalIsDaily ? "Daily Challenge complete!" : "Round complete!"}
              </h2>
              {/* Personal headline only for solo rounds — in Pass & Play / online
                  the standings tables below are the real result (finalTotal is
                  just one player's card). */}
              {!finalParty && !finalOnline && (<>
                <p className="text-[#36D7B7] font-bold text-lg mt-1">
                  {finalTotal} throws · {finalOver === 0 ? "Even par" : overStr(finalOver)}
                  {isNewBest && <span className="ml-2 text-[#f5d24a]">★ New best!</span>}
                </p>
                {finalBest != null && !isNewBest && (
                  <p className="text-gray-400 text-xs mt-0.5">Your best: {finalBest} ({overStr(finalBest - finalParTotal)})</p>
                )}
                {coinReward > 0 && (
                  <p className="text-[#f5d24a] text-sm font-bold mt-1">+{coinReward} <Coin />{rankedGain != null ? <span className="text-[#36D7B7] ml-2">+{rankedGain} RP 🏅</span> : null}</p>
                )}
              </>)}
              {finalChallenge && (
                <p className={`text-sm font-bold mt-1.5 ${finalTotal < finalChallenge.score ? "text-[#36D7B7]" : finalTotal === finalChallenge.score ? "text-gray-300" : "text-[#e08a3b]"}`}>
                  ⚔ vs {finalChallenge.name} ({finalChallenge.score}):{" "}
                  {finalTotal < finalChallenge.score ? "You win!" : finalTotal === finalChallenge.score ? "Tied!" : "They got you."}
                </p>
              )}
            </div>

            {/* Pass-and-play standings */}
            {finalParty && (
              <div className="bg-[#1a1d23] border border-white/5 rounded-2xl overflow-hidden">
                {finalParty.names
                  .map((n, i) => ({ n, t: finalParty.totals[i] }))
                  .sort((a, b) => a.t - b.t)
                  .map((row, i) => (
                    <div key={row.n} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${i ? "border-t border-white/5" : ""}`}>
                      <span className="text-gray-400 font-mono w-5">{i + 1}</span>
                      <span className="text-white font-semibold flex-1 truncate">{i === 0 ? "🏆 " : ""}{row.n}</span>
                      <span className="text-gray-400 font-mono">{overStr(row.t - finalParTotal)}</span>
                      <span className="text-white font-mono font-bold w-8 text-right">{row.t}</span>
                    </div>
                  ))}
              </div>
            )}

            {/* Online Friendly Challenge standings (live — updates as friends finish) */}
            {finalOnline && (
              <div className="bg-[#1a1d23] border border-white/5 rounded-2xl overflow-hidden">
                {Object.entries(onlineScores)
                  .map(([id, s]) => ({ id, ...s }))
                  .sort((a, b) => a.total - b.total)
                  .map((row, i) => (
                    <div key={row.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${i ? "border-t border-white/5" : ""}`}>
                      <span className="text-gray-400 font-mono w-5">{i + 1}</span>
                      <span className="text-white font-semibold flex-1 truncate">{i === 0 ? "🏆 " : ""}{row.name}</span>
                      <span className="text-gray-500 font-mono text-xs">thru {row.thru}</span>
                      <span className="text-gray-400 font-mono">{overStr(row.total - finalParTotal)}</span>
                      <span className="text-white font-mono font-bold w-8 text-right">{row.total}</span>
                    </div>
                  ))}
              </div>
            )}

            {/* Newly-unlocked achievements */}
            {newAchievements.length > 0 && (
              <div className="bg-[#f5d24a]/10 border border-[#f5d24a]/30 rounded-2xl p-3">
                <p className="text-[#f5d24a] font-bold text-sm mb-2">
                  🏅 Achievement{newAchievements.length > 1 ? "s" : ""} unlocked!
                  <span className="text-[#f5d24a]/80 font-mono"> +{newAchievements.reduce((s, a) => s + a.coins, 0)} <Coin /></span>
                </p>
                <div className="flex flex-col gap-1.5">
                  {newAchievements.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-sm">
                      <span className="text-lg">{a.emoji}</span>
                      <span className="text-white font-semibold">{a.name}</span>
                      <span className="text-gray-400 text-xs flex-1 truncate">— {a.desc}</span>
                      <span className="text-[#f5d24a] font-mono text-xs shrink-0 inline-flex items-center gap-1">+{a.coins} <Coin /></span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scorecard — one row per nine. Skipped for Pass & Play, where
                `scorecard` is only the last player's card (the standings table
                above is the real result). */}
            {!finalParty && (
            <div className="bg-[#1a1d23] border border-white/5 rounded-2xl p-3 space-y-3 text-[11px]">
              {(finalPars.length > 9
                ? [{ label: "Out", from: 0, to: 9 }, { label: "In", from: 9, to: 18 }]
                : [{ label: "Tot", from: 0, to: finalPars.length }]
              ).map(({ label, from, to }) => {
                const pars = finalPars.slice(from, to);
                const parSum = pars.reduce((s, n) => s + n, 0);
                const youSum = scorecard.slice(from, to).reduce((s, n) => s + (n ?? 0), 0);
                return (
                  <table key={label} className="w-full text-center tabular-nums">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="text-left font-semibold pr-1 w-7"></th>
                        {pars.map((_, i) => (
                          <th key={i} className="font-semibold px-0.5">{from + i + 1}</th>
                        ))}
                        <th className="font-bold pl-1 text-gray-300">{label}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="text-gray-400">
                        <td className="text-left pr-1">Par</td>
                        {pars.map((p, i) => (
                          <td key={i} className="px-0.5">{p}</td>
                        ))}
                        <td className="pl-1 font-mono">{parSum}</td>
                      </tr>
                      <tr className="text-white font-semibold">
                        <td className="text-left pr-1">You</td>
                        {pars.map((p, i) => {
                          const s = scorecard[from + i];
                          const diff = (s ?? p) - p;
                          const color = s == null ? "#6b7280" : diff < 0 ? "#36D7B7" : diff > 1 ? "#e23b3b" : diff === 1 ? "#f5d24a" : "#ffffff";
                          return (
                            <td key={i} className="px-0.5 font-mono" style={{ color }}>{s ?? "–"}</td>
                          );
                        })}
                        <td className="pl-1 font-mono">{youSum}</td>
                      </tr>
                    </tbody>
                  </table>
                );
              })}
              <div className="flex justify-between border-t border-white/5 pt-2 text-white font-bold text-sm">
                <span>Total</span>
                <span className="font-mono">{finalTotal} · par {finalParTotal}</span>
              </div>
            </div>
            )}

            {/* Save + per-course leaderboard (the daily board resets each day);
                practice rounds skip all of it. */}
            {finalPracticeHole == null && !finalParty && !finalOnline && (<>
            {saved ? (
              <p className="text-center text-[#36D7B7] text-sm font-semibold">Saved to the leaderboard as {profile.name.trim() || "Player"} ✓</p>
            ) : saveErr ? (
              <button type="button" onClick={saveScore} disabled={saving}
                className="w-full bg-[#1a1d23] border border-white/15 hover:border-white/35 text-white text-sm font-semibold py-2 rounded-lg transition disabled:opacity-50">
                {saving ? "Saving…" : "Retry save"}
              </button>
            ) : (
              <p className="text-center text-gray-400 text-sm">{saving ? "Saving to the leaderboard…" : "Saving…"}</p>
            )}
            {saveErr && !saved && <p className="text-red-400 text-xs text-center">{saveErr}</p>}

            <div className="bg-[#1a1d23] border border-white/5 rounded-2xl overflow-hidden">
              <p className="text-white font-bold text-sm px-4 py-2.5 border-b border-white/5">
                🏆 {finalIsDaily ? "Today's leaderboard" : finalMode === "ranked" ? "This week's ranked board" : finalMode === "tour" ? `${tourVenue(finalSeed)} leaderboard` : `${finalMode === "winthrop" ? "Winthrop Lake" : "Glendoveer East"} leaderboard`}
              </p>
              {leaderboard.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">No scores yet — be the first!</p>
              ) : (
                <ol>
                  {leaderboard.slice(0, 10).map((row, i) => {
                    const mine = row.name === (profile.name.trim() || "Player");
                    return (
                      <li
                        key={`${row.name}-${row.created_at}`}
                        className={`flex items-center gap-3 px-4 py-2 text-sm ${i !== 0 ? "border-t border-white/5" : ""} ${mine ? "bg-[#36D7B7]/10" : ""}`}
                      >
                        <span className="text-gray-400 font-mono w-6 text-right">{i + 1}</span>
                        <span className={`flex-1 truncate ${mine ? "text-[#36D7B7] font-bold" : "text-white"}`}>{row.name}</span>
                        <span className="text-gray-400 font-mono">{overStr(row.strokes - finalParTotal)}</span>
                        <span className="text-white font-mono font-bold w-8 text-right">{row.strokes}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
            </>)}

            <div className="flex flex-wrap justify-center gap-2">
              {finalPracticeHole != null ? (
                <button type="button" onClick={() => startPractice(finalMode, finalPracticeHole - 1, finalSeed)} className={btn}>↻ Retry hole</button>
              ) : finalTournament ? (
                <button type="button" onClick={() => { audioRef.current?.stopMusic(); setScreen("title"); setTournamentOpen(true); }} className={btn}>
                  🏟 Standings
                </button>
              ) : finalOnline ? (
                <button type="button" onClick={() => { audioRef.current?.stopMusic(); setScreen("title"); }} className={btn}>
                  🎉 Back to lobby
                </button>
              ) : (
                <button type="button" onClick={() => (finalMode === "tour" ? startGame("tour", finalSeed) : startGame())} className={btn}>↻ Play again</button>
              )}
              <button type="button" onClick={shareCard} aria-label="Share card" title="Share card" className="mt-1 flex items-center justify-center bg-[#1a1d23] border border-white/15 hover:border-white/35 text-white text-lg px-3.5 py-3 rounded-lg transition">
                📤
              </button>
              <button
                type="button"
                onClick={() => { audioRef.current?.stopMusic(); if (finalOnline) leaveLobby(); setScreen("title"); }}
                className="mt-1 bg-[#1a1d23] border border-white/15 hover:border-white/35 text-white font-bold px-6 py-3 rounded-lg transition"
              >
                🏠 Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btn =
  "mt-1 bg-[#4B3DFF] hover:bg-[#3a2ee0] text-white font-bold px-6 py-3 rounded-lg transition";

// Uniform title-screen action cards: one dark fill, a green outline.
const titleCard =
  "w-full rounded-xl border border-[#36D7B7]/55 bg-[#1a1d23] hover:border-[#36D7B7] hover:bg-[#20262f] active:scale-[0.99] text-white font-bold py-3 transition";
const titleCardSm =
  "flex-1 rounded-lg border border-[#36D7B7]/45 bg-[#1a1d23] hover:border-[#36D7B7] text-gray-200 hover:text-white text-xs font-semibold py-2 transition";
// Big primary hub card — the three main actions, made large so they're clearly
// the buttons to press.
const hubCard =
  "w-full flex items-center justify-center rounded-xl border border-[#36D7B7]/55 bg-[#1a1d23] hover:border-[#36D7B7] hover:bg-[#20262f] active:scale-[0.99] text-white py-6 transition";

// A small gold coin chip — used wherever a coin balance/amount is shown so the
// currency reads as clearly gold (rather than the dull 🪙 emoji).
function Coin({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block w-3 h-3 rounded-full align-[-1px] shrink-0 ${className}`}
      style={{ background: "radial-gradient(circle at 35% 30%, #fff3ad, #f6c63a 58%, #c08812)", boxShadow: "inset 0 0 0 0.5px rgba(110,72,0,0.55)" }}
    />
  );
}

function Overlay({ children, onTap }: { children: React.ReactNode; onTap?: () => void }) {
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 rounded-lg text-center px-4${onTap ? " cursor-pointer" : ""}`}
      onClick={onTap}
    >
      {children}
    </div>
  );
}

// How to Play: an auto-playing demo where an imaginary player takes on a hole
// start to finish — pulling back to aim, throwing, switching discs and sinking
// the putt. A small looping canvas animation; the caption tracks each step.
function TutorialPanel({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [caption, setCaption] = useState("An imaginary player takes on a hole…");
  const capRef = useRef("");
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const DW = 240, DH = 320;
    type Pt = { x: number; y: number };
    const basket: Pt = { x: 120, y: 44 };
    const tee: Pt = { x: 120, y: 274 };
    const tree = { x: 158, y: 165, r: 12 };
    const pond = { x: 72, y: 120, rx: 24, ry: 15 };
    const DISCS = [
      { name: "Driver", color: "#e23b3b" },
      { name: "Mid", color: "#f5d24a" },
      { name: "Putter", color: "#36D7B7" },
    ];
    const SHOTS: { from: Pt; ctrl: Pt; to: Pt; di: number }[] = [
      { from: tee, ctrl: { x: 92, y: 206 }, to: { x: 132, y: 150 }, di: 0 },
      { from: { x: 132, y: 150 }, ctrl: { x: 150, y: 114 }, to: { x: 122, y: 82 }, di: 1 },
      { from: { x: 122, y: 82 }, ctrl: { x: 118, y: 62 }, to: basket, di: 2 },
    ];
    const throwIdx = [2, 5, 8]; // BEATS index of each shot's throw
    type Beat = { dur: number; cap: string; kind: "intro" | "aim" | "throw" | "switch" | "celebrate"; shot: number };
    const BEATS: Beat[] = [
      { dur: 1100, cap: "An imaginary player lines up the tee shot", kind: "intro", shot: 0 },
      { dur: 1500, cap: "Press and drag BACK from the disc to aim and build power", kind: "aim", shot: 0 },
      { dur: 1100, cap: "Release to throw the other way — pull farther for more power", kind: "throw", shot: 0 },
      { dur: 1100, cap: "Closer now — switch to a midrange for control", kind: "switch", shot: 1 },
      { dur: 1300, cap: "Line up the approach and throw again", kind: "aim", shot: 1 },
      { dur: 1000, cap: "Lay it up near the basket", kind: "throw", shot: 1 },
      { dur: 1100, cap: "On the green — switch to the putter", kind: "switch", shot: 2 },
      { dur: 1200, cap: "A gentle pull for the putt…", kind: "aim", shot: 2 },
      { dur: 900, cap: "Sink it!", kind: "throw", shot: 2 },
      { dur: 1700, cap: "Hole complete! 🎉", kind: "celebrate", shot: 2 },
    ];
    const total = BEATS.reduce((s, b) => s + b.dur, 0);
    const qbez = (a: Pt, c: Pt, b: Pt, t: number): Pt => ({
      x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
      y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
    });
    const easeInOut = (p: number) => p * p * (3 - 2 * p);
    const easeOut = (p: number) => 1 - (1 - p) * (1 - p);
    const norm = (v: Pt): Pt => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; };
    const drawBag = (activeDi: number) => {
      const h = 18, w = 64, gap = 6, x0 = (DW - (w * 3 + gap * 2)) / 2, y0 = DH - 25;
      ctx.font = "8px ui-monospace, monospace"; ctx.textBaseline = "middle";
      for (let i = 0; i < 3; i++) {
        const x = x0 + i * (w + gap);
        ctx.fillStyle = "#1a1d23"; ctx.fillRect(x, y0, w, h);
        ctx.strokeStyle = i === activeDi ? DISCS[i].color : "rgba(255,255,255,0.15)";
        ctx.lineWidth = i === activeDi ? 2 : 1; ctx.strokeRect(x, y0, w, h);
        ctx.fillStyle = DISCS[i].color; ctx.beginPath(); ctx.arc(x + 12, y0 + h / 2, 4, 0, Math.PI * 2); ctx.fill();
        ctx.textAlign = "center"; ctx.fillStyle = i === activeDi ? "#fff" : "#9aa4b2";
        ctx.fillText(DISCS[i].name, x + w / 2 + 6, y0 + h / 2 + 0.5);
      }
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    };

    let raf = 0;
    const startT = performance.now();
    const render = (now: number) => {
      const tt = (now - startT) % total;
      let acc = 0, bi = 0, p = 0;
      for (let i = 0; i < BEATS.length; i++) {
        if (tt < acc + BEATS[i].dur) { bi = i; p = (tt - acc) / BEATS[i].dur; break; }
        acc += BEATS[i].dur;
      }
      const beat = BEATS[bi];
      if (capRef.current !== beat.cap) { capRef.current = beat.cap; setCaption(beat.cap); }

      // Grass + a curved fairway ribbon.
      ctx.fillStyle = "#2f5a26"; ctx.fillRect(0, 0, DW, DH);
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.strokeStyle = "#4d9a39"; ctx.lineWidth = 52;
      ctx.beginPath(); ctx.moveTo(tee.x, tee.y); ctx.quadraticCurveTo(96, 198, 124, 138); ctx.quadraticCurveTo(140, 92, basket.x, basket.y); ctx.stroke();
      ctx.strokeStyle = "#56a541"; ctx.lineWidth = 4; ctx.setLineDash([10, 10]); ctx.stroke(); ctx.setLineDash([]);
      // Pond + tree hazards.
      ctx.fillStyle = "#3a6ea5"; ctx.beginPath(); ctx.ellipse(pond.x, pond.y, pond.rx, pond.ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#5b8fc4"; ctx.beginPath(); ctx.ellipse(pond.x, pond.y - 1.5, pond.rx - 3, pond.ry - 3, 0, 0, Math.PI * 2); ctx.fill();
      drawTree(ctx, { x: tree.x, y: tree.y, r: tree.r });
      // Faint paths of shots already thrown.
      for (let s = 0; s < SHOTS.length; s++) {
        if (bi <= throwIdx[s]) continue;
        ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 1.25; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(SHOTS[s].from.x, SHOTS[s].from.y);
        ctx.quadraticCurveTo(SHOTS[s].ctrl.x, SHOTS[s].ctrl.y, SHOTS[s].to.x, SHOTS[s].to.y); ctx.stroke(); ctx.setLineDash([]);
      }
      drawBasket(ctx, basket.x, basket.y);

      // Disc position + which disc is in hand for this beat.
      let pos: Pt = tee, activeDi = 0;
      if (beat.kind === "aim") { pos = SHOTS[beat.shot].from; activeDi = SHOTS[beat.shot].di; }
      else if (beat.kind === "throw") { pos = qbez(SHOTS[beat.shot].from, SHOTS[beat.shot].ctrl, SHOTS[beat.shot].to, easeInOut(p)); activeDi = SHOTS[beat.shot].di; }
      else if (beat.kind === "switch") { pos = SHOTS[beat.shot].from; activeDi = p < 0.5 ? SHOTS[beat.shot - 1].di : SHOTS[beat.shot].di; }
      else if (beat.kind === "celebrate") { pos = basket; activeDi = 2; }
      else { pos = tee; activeDi = 0; }

      // Live trail while the disc is in the air.
      if (beat.kind === "throw") {
        const tp = easeInOut(p);
        ctx.strokeStyle = DISCS[activeDi].color; ctx.lineWidth = 2; ctx.globalAlpha = 0.5; ctx.beginPath();
        for (let k = 0; k <= 16; k++) { const pp = qbez(SHOTS[beat.shot].from, SHOTS[beat.shot].ctrl, SHOTS[beat.shot].to, tp * k / 16); if (k === 0) ctx.moveTo(pp.x, pp.y); else ctx.lineTo(pp.x, pp.y); }
        ctx.stroke(); ctx.globalAlpha = 1;
      }

      // Aim: predicted dots, pull-back slider, power knob + a fingertip ring.
      if (beat.kind === "aim") {
        const dir = norm({ x: SHOTS[beat.shot].to.x - pos.x, y: SHOTS[beat.shot].to.y - pos.y });
        const pw = easeOut(Math.min(1, p * 1.25));
        const kx = pos.x - dir.x * 30 * pw, ky = pos.y - dir.y * 30 * pw;
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        for (let k = 1; k <= 5; k++) { const pp = qbez(SHOTS[beat.shot].from, SHOTS[beat.shot].ctrl, SHOTS[beat.shot].to, k / 14); ctx.beginPath(); ctx.arc(pp.x, pp.y, 1.3, 0, Math.PI * 2); ctx.fill(); }
        ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pos.x, pos.y); ctx.lineTo(kx, ky); ctx.stroke();
        ctx.fillStyle = pw < 0.5 ? "#36D7B7" : pw < 0.85 ? "#f5d24a" : "#e23b3b"; ctx.beginPath(); ctx.arc(kx, ky, 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(kx, ky, 8, 0, Math.PI * 2); ctx.stroke();
      }

      // The disc itself (shadow, white body, tier-color pip).
      ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(pos.x, pos.y + 1, 4, 2.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = DISCS[activeDi].color; ctx.fillRect(Math.round(pos.x) - 1, Math.round(pos.y) - 1, 2, 2);

      // Celebration confetti on the made putt.
      if (beat.kind === "celebrate") {
        const cols = ["#36D7B7", "#f5d24a", "#ffffff", "#4B3DFF", "#e23b3b"];
        for (let k = 0; k < 18; k++) { const ang = (k / 18) * Math.PI * 2; const sp = 20 + (k % 4) * 8; const cx = basket.x + Math.cos(ang) * sp * p; const cy = basket.y + Math.sin(ang) * sp * p + p * p * 16; ctx.globalAlpha = Math.max(0, 1 - p); ctx.fillStyle = cols[k % 5]; ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3); }
        ctx.globalAlpha = 1;
      }

      drawBag(activeDi);
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="absolute inset-0 z-40 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-3 my-auto text-center">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">How to Play</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <canvas ref={canvasRef} width={240} height={320} className="w-full rounded-xl border border-white/10 bg-[#2f5a26]" style={{ imageRendering: "pixelated" }} />
        <p className="text-gray-200 text-sm font-medium min-h-[40px] leading-snug flex items-center justify-center">{caption}</p>
        <button type="button" onClick={onClose} className={`${btn} w-full`}>Got it ✓</button>
      </div>
    </div>
  );
}

// Challenge Friends entry point: choose hot-seat Pass & Play or an online
// Friendly Challenge, then Create a lobby or Join one with a code.
function ChallengePanel({ online, onClose, onPassPlay, onCreate, onJoin }: {
  online: boolean;
  onClose: () => void;
  onPassPlay: () => void;
  onCreate: (m: Mode, name: string) => void;
  onJoin: (code: string, name: string) => void;
}) {
  const [step, setStep] = useState<"menu" | "create" | "join">("menu");
  const [course, setCourse] = useState<Mode>("winthrop");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const seg = (active: boolean) =>
    `flex-1 rounded-md px-2 py-2 text-xs font-bold transition ${active ? "bg-[#4B3DFF] text-white" : "text-gray-400 hover:text-white"}`;
  const input = "w-full bg-[#1a1d23] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#4B3DFF]";
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-3 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">👥 Challenge Friends</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        {step === "menu" && (
          <>
            <button type="button" onClick={onPassPlay}
              className="w-full text-left rounded-xl border border-[#36D7B7]/55 bg-[#1a1d23] hover:border-[#36D7B7] hover:bg-[#20262f] active:scale-[0.99] px-4 py-3 transition">
              <span className="block text-white font-bold text-sm">Pass &amp; Play</span>
              <span className="block text-gray-500 text-[11px] mt-0.5">2–4 players take turns on one device.</span>
            </button>
            <button type="button" onClick={() => online && setStep("create")} disabled={!online}
              className={`w-full text-left rounded-xl border px-4 py-3 transition ${online ? "border-[#36D7B7]/55 bg-[#1a1d23] hover:border-[#36D7B7] hover:bg-[#20262f] active:scale-[0.99]" : "border-white/5 bg-white/[0.02] opacity-50"}`}>
              <span className="block text-white font-bold text-sm">Friendly Challenge</span>
              <span className="block text-gray-500 text-[11px] mt-0.5">
                {online ? "Play the same round online — everyone on their own phone." : "Online play needs Supabase configured."}
              </span>
            </button>
          </>
        )}

        {step === "create" && (
          <>
            <p className="text-gray-400 text-xs">Pick a course and create a lobby — share the code so friends can join.</p>
            <div className="flex gap-1 bg-[#1a1d23] border border-white/10 rounded-lg p-1">
              <button type="button" onClick={() => setCourse("course")} className={seg(course === "course")}>Glendoveer</button>
              <button type="button" onClick={() => setCourse("winthrop")} className={seg(course === "winthrop")}>Winthrop</button>
              <button type="button" onClick={() => setCourse("daily")} className={seg(course === "daily")}>Daily</button>
            </div>
            <input type="text" value={name} maxLength={12} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={input} />
            <button type="button" onClick={() => onCreate(course, name)} className={`${btn} w-full`}>Create lobby</button>
            <button type="button" onClick={() => setStep("menu")} className="w-full text-gray-500 hover:text-gray-300 text-xs py-1 transition">← Back</button>
          </>
        )}

        {step === "join" && (
          <>
            <p className="text-gray-400 text-xs">Enter the 4-character code your friend shared.</p>
            <input type="text" value={code} maxLength={4} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CODE" className={`${input} tracking-[0.3em] text-center font-mono uppercase`} />
            <input type="text" value={name} maxLength={12} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={input} />
            <button type="button" onClick={() => code.trim().length === 4 && onJoin(code, name)} disabled={code.trim().length !== 4} className={`${btn} w-full disabled:opacity-50`}>Join lobby</button>
            <button type="button" onClick={() => setStep("menu")} className="w-full text-gray-500 hover:text-gray-300 text-xs py-1 transition">← Back</button>
          </>
        )}

        {online && step === "menu" && (
          <button type="button" onClick={() => setStep("join")}
            className="w-full text-center text-[#36D7B7] hover:text-[#2bc4a6] text-sm font-semibold py-1 transition">
            Have a code? Join a lobby →
          </button>
        )}
      </div>
    </div>
  );
}

// Lobby waiting room: shows the code, live roster (Realtime presence), and a
// Start button for the host. Friends join with the code from another device.
function LobbyPanel({ lobby, players, onStart, onLeave }: {
  lobby: { code: string; isHost: boolean; mode: Mode };
  players: LobbyPlayer[];
  onStart: () => void;
  onLeave: () => void;
}) {
  const host = players.find((p) => p.host);
  const courseMode = host?.mode ?? lobby.mode;
  const courseLabel = courseMode === "course" ? "Glendoveer East" : courseMode === "winthrop" ? "Winthrop Lake" : "Daily course";
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-4 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">Lobby</h2>
          <button type="button" onClick={onLeave} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="rounded-xl bg-[#1a1d23] border border-white/10 p-4 text-center">
          <p className="text-gray-500 text-[10px] uppercase tracking-[0.2em]">Join code</p>
          <p className="text-[#36D7B7] font-black text-4xl tracking-[0.25em] mt-1">{lobby.code}</p>
          <p className="text-gray-500 text-[11px] mt-2">{courseLabel}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs font-semibold mb-1.5">Players ({players.length})</p>
          <div className="space-y-1">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 text-sm">
                <span className="text-white font-semibold truncate flex-1">{p.name}</span>
                {p.host && <span className="text-[#f5d24a] text-[10px] font-bold uppercase tracking-wide">Host</span>}
              </div>
            ))}
            {players.length === 0 && <p className="text-gray-500 text-xs">Connecting…</p>}
          </div>
        </div>
        {lobby.isHost ? (
          <>
            <button type="button" onClick={onStart} className={`${btn} w-full`}>Start round</button>
            {players.length < 2 && <p className="text-gray-500 text-[11px] text-center">Waiting for friends to join — you can start anytime.</p>}
          </>
        ) : (
          <p className="text-gray-400 text-sm text-center py-2">Waiting for the host to start…</p>
        )}
      </div>
    </div>
  );
}

// Pass-and-play setup: pick a course, 2-4 players, optional names.
function PartyPanel({ onClose, onStart }: { onClose: () => void; onStart: (m: Mode, names: string[]) => void }) {
  const [course, setCourse] = useState<Mode>("course");
  const [count, setCount] = useState(2);
  const [names, setNames] = useState<string[]>(["", "", "", ""]);
  const seg = (active: boolean) =>
    `flex-1 rounded-md px-2 py-2 text-xs font-bold transition ${active ? "bg-[#4B3DFF] text-white" : "text-gray-400 hover:text-white"}`;
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-3 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">👥 Pass &amp; Play</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <p className="text-gray-500 text-[11px]">Take turns on each hole, one phone. Doesn&apos;t count toward records.</p>
        <div className="flex gap-1 bg-[#1a1d23] border border-white/10 rounded-lg p-1">
          <button type="button" onClick={() => setCourse("course")} className={seg(course === "course")}>Glendoveer</button>
          <button type="button" onClick={() => setCourse("winthrop")} className={seg(course === "winthrop")}>Winthrop</button>
          <button type="button" onClick={() => setCourse("daily")} className={seg(course === "daily")}>Daily</button>
        </div>
        <div className="flex gap-1 bg-[#1a1d23] border border-white/10 rounded-lg p-1">
          {[2, 3, 4].map((n) => (
            <button key={n} type="button" onClick={() => setCount(n)} className={seg(count === n)}>{n} players</button>
          ))}
        </div>
        <div className="space-y-1.5">
          {Array.from({ length: count }, (_, i) => (
            <input
              key={i}
              type="text"
              value={names[i]}
              maxLength={12}
              onChange={(e) => setNames((ns) => ns.map((n, j) => (j === i ? e.target.value : n)))}
              placeholder={`Player ${i + 1}`}
              className="w-full bg-[#1a1d23] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#4B3DFF]"
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => onStart(course, Array.from({ length: count }, (_, i) => names[i].trim() || `Player ${i + 1}`))}
          className={`${btn} w-full`}
        >
          Tee off
        </button>
      </div>
    </div>
  );
}

// Tournaments: a roster of named events on the play-courses, each 2–3 rounds vs
// a seeded 35-strong AI field (3-round events cut to the top half after R2).
function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}
function TournamentPanel({ tournaments, active, bests, onStart, onAbandon, onPlayRound, onClose }: {
  tournaments: TournDef[];
  active: Tournament | null;
  bests: Record<string, number>;
  onStart: (def: TournDef) => void;
  onAbandon: () => void;
  onPlayRound: (t: Tournament) => void;
  onClose: () => void;
}) {
  const def = active ? tournDef(active.id) : null;
  // Roster sorted easiest → hardest (hook must run before the early return).
  const roster = useMemo(() => tournaments.map((d) => ({ d, diff: tournDifficulty(d) })).sort((a, b) => a.diff - b.diff), [tournaments]);

  // ── Active tournament: standings + play/continue ──
  if (active && def) {
    const standings = active.myTotals.length > 0 ? tournStandings(active, def) : null;
    const place = standings ? standings.findIndex((r) => r.you) + 1 : 0;
    const champion = active.finished && place === 1;
    const cols = def.rounds.map((_, r) => r);
    const hasCut = def.cut && def.rounds.length >= 3;
    return (
      <div className="absolute inset-0 z-20 bg-[#0f1117]/95 backdrop-blur-sm rounded-lg flex flex-col">
        <div className="w-full max-w-sm mx-auto flex flex-col h-full px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] text-left">
          <div className="flex items-center justify-between gap-2 shrink-0">
            <h2 className="text-white font-black text-lg truncate">🏟 {def.name}</h2>
            <div className="flex items-center gap-2 shrink-0">
              <DiffStars n={tournStarDifficulty(def)} />
              <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
            </div>
          </div>
          <p className="text-gray-500 text-[11px] shrink-0">{def.venues} · {def.rounds.length} rounds{hasCut ? " · cut after R2" : ""}</p>

          {champion && (
            <div className="bg-[#f5d24a]/10 border border-[#f5d24a]/40 rounded-xl p-2.5 text-center mt-2 shrink-0">
              <p className="text-[#f5d24a] font-black text-lg">🏆 CHAMPION!</p>
            </div>
          )}
          {active.finished && hasCut && !active.madeCut && (
            <p className="text-[#e08a3b] text-sm font-semibold text-center mt-2 shrink-0">Missed the cut — finished {ordinal(place)}.</p>
          )}
          {active.finished && place > 1 && !(hasCut && !active.madeCut) && (
            <p className="text-gray-300 text-sm text-center mt-2 shrink-0">Finished <span className="text-white font-bold">{ordinal(place)}</span> of {TOURN_FIELD}.</p>
          )}

          <div className="flex-1 overflow-y-auto mt-2 bg-[#1a1d23] border border-white/5 rounded-xl">
            {standings ? (
              <table className="w-full text-[11px] tabular-nums">
                <thead className="sticky top-0 bg-[#1a1d23]">
                  <tr className="text-gray-500 border-b border-white/5">
                    <th className="text-left pl-3 py-1.5 w-8">#</th>
                    <th className="text-left">Player</th>
                    {cols.map((r) => <th key={r} className="text-right pr-1">R{r + 1}</th>)}
                    <th className="text-right pr-3">Tot</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row, i) => (
                    <tr key={row.name} className={`${row.you ? "bg-[#36D7B7]/10 text-[#36D7B7] font-bold" : "text-gray-300"} ${i ? "border-t border-white/5" : ""} ${row.cut ? "opacity-50" : ""}`}>
                      <td className="pl-3 py-1">{row.cut ? "—" : i + 1}</td>
                      <td className="truncate max-w-[110px]">{row.name}{row.cut ? " (cut)" : ""}</td>
                      {cols.map((r) => <td key={r} className="text-right pr-1 font-mono">{row.rounds[r] ?? ""}</td>)}
                      <td className="text-right pr-3 font-mono font-bold">{row.total || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-300 text-sm p-4 text-center">Round 1 awaits — the field is warming up.</p>
            )}
          </div>

          {!active.finished ? (
            <>
              <button type="button" onClick={() => onPlayRound(active)} className={`${btn} w-full shrink-0 mt-3`}>
                Play round {active.myTotals.length + 1} of {def.rounds.length}
              </button>
              <button type="button" onClick={onAbandon} className="w-full text-gray-500 hover:text-gray-300 text-xs py-1.5 transition shrink-0">Abandon tournament</button>
            </>
          ) : (
            <button type="button" onClick={onAbandon} className={`${btn} w-full shrink-0 mt-3`}>↩ Back to tournaments</button>
          )}
        </div>
      </div>
    );
  }

  // ── Tournament roster ──
  return (
    <div className="absolute inset-0 z-20 bg-[#0f1117]/95 backdrop-blur-sm rounded-lg flex flex-col">
      <div className="w-full max-w-xs mx-auto flex flex-col h-full px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] text-left">
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-white font-black text-xl">🏟 Tournaments</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <p className="text-gray-500 text-[11px] mt-1 shrink-0">Easiest first. <span className="text-[#e0923b]">★</span> = difficulty (5 = very hard). A {TOURN_FIELD}-strong field over 2–3 rounds; 3-round events cut after R2.</p>
        <div className="flex-1 overflow-y-auto mt-2.5 space-y-2.5 pr-0.5 -mr-0.5">
          {roster.map(({ d }) => {
            const best = bests[d.id];
            return (
              <div key={d.id} className="rounded-xl bg-[#1a1d23] border border-white/10 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-white font-bold text-sm truncate pt-0.5">{d.name}</span>
                  <div className="shrink-0 text-right">
                    <DiffStars n={tournStarDifficulty(d)} />
                    <span className="block text-gray-500 text-[10px] mt-0.5">{d.rounds.length} rounds</span>
                  </div>
                </div>
                <p className="text-gray-500 text-[11px] mt-0.5 truncate">{d.venues}</p>
                <div className="flex items-center justify-between mt-2.5">
                  <span className="text-[11px] text-gray-400">
                    {best ? <>🏅 Best <span className="text-[#f5d24a] font-bold">{ordinal(best)}</span> <span className="text-gray-500">of {TOURN_FIELD}</span></> : "Not played yet"}
                  </span>
                  <button type="button" onClick={() => onStart(d)} className="shrink-0 rounded-lg bg-[#4B3DFF] hover:bg-[#3a2ee0] text-white text-sm font-bold px-5 py-1.5 transition">Play</button>
                </div>
              </div>
            );
          })}
        </div>
        <button type="button" onClick={onClose} className={`${btn} w-full shrink-0 mt-3`}>Done</button>
      </div>
    </div>
  );
}

// ── Career mode panel: the multi-decade journey from junior events to the pro
// tour. Skills grow each season (you allocate training); events can be PLAYED as
// real rounds — your skills bend the flight — or SIMULATED from your skills. ──
function CareerStat({ label, v }: { label: string; v: number | string }) {
  return (
    <div className="bg-[#1a1d23] border border-white/5 rounded-lg py-2">
      <p className="text-white font-black text-lg leading-none">{v}</p>
      <p className="text-gray-500 text-[10px] mt-0.5 uppercase tracking-wide">{label}</p>
    </div>
  );
}
function CareerPanel({ career, lastResult, lastCoins, notes, onClose, onStart, onPlay, onSim, onAdvance, onRetire, onAbandon, onSign, onBuyTrain, onBuyDisc, onToggleBag, dismissNotes }: {
  career: Career | null;
  lastResult: EventResult | null;
  lastCoins: number;
  notes: string[];
  onClose: () => void;
  onStart: (name: string) => void;
  onPlay: (ev: CareerEvent) => void;
  onSim: (ev: CareerEvent) => void;
  onAdvance: (alloc: Partial<CareerSkills>) => void;
  onRetire: () => void;
  onAbandon: () => void;
  onSign: (id: string) => void;
  onBuyTrain: () => void;
  onBuyDisc: (key: string) => void;
  onToggleBag: (key: string) => void;
  dismissNotes: () => void;
}) {
  const [name, setName] = useState("");
  const [alloc, setAlloc] = useState<CareerSkills>({ power: 0, control: 0, putt: 0, mental: 0 });
  const [confirm, setConfirm] = useState<"retire" | "abandon" | null>(null);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { setAlloc({ power: 0, control: 0, putt: 0, mental: 0 }); setConfirm(null); }, [career?.season, career?.retired]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const wrap = "absolute inset-0 z-30 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-start justify-center rounded-lg";
  const card = "w-full max-w-sm space-y-3 my-auto text-left";
  const toPar = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);

  // Season wrap-up (promotions, world #1, retirement) shown after advancing.
  if (notes.length > 0) {
    return (
      <div className={wrap}><div className={card}>
        <h2 className="text-white font-black text-xl">Season wrap-up</h2>
        <div className="space-y-2">
          {notes.map((n, i) => (
            <p key={i} className="text-gray-200 text-sm bg-white/5 border border-white/10 rounded-lg px-3 py-2">{n}</p>
          ))}
        </div>
        <button type="button" onClick={dismissNotes} className={`${btn} w-full`}>Continue ▶</button>
      </div></div>
    );
  }

  // New career.
  if (!career) {
    return (
      <div className={wrap}><div className={card}>
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">🌟 Career</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <p className="text-gray-300 text-sm">Start as a 14-year-old freshman with two discs and a dream — a clean slate, kept <span className="text-white">completely separate from your main account</span>. Train four skills (<span className="text-white">no cap</span>), unlock discs in the <span className="text-[#e0923b]">Pro Shop</span>, and finish events well to develop faster. Climb from high school to college (Nationals at Winthrop Lake) to the pro tour and chase <span className="text-[#f5d24a]">World #1</span>. Play the big rounds yourself; sim the rest — any coins you earn still go to your account.</p>
        <input type="text" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full bg-[#1a1d23] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#e0923b]" />
        <button type="button" onClick={() => onStart(name)} className={`${btn} w-full`}>Begin career</button>
      </div></div>
    );
  }
  const sched = seasonSchedule(career);
  const resultFor = (id: string) => career.results.find((r) => r.eventId === id);
  const spent = SKILL_KEYS.reduce((s, k) => s + alloc[k], 0);
  const remaining = career.trainPts - spent;
  const canAdvance = seasonComplete(career);
  const undone = sched.filter((e) => !career.done.includes(e.id));
  const sponsorOffers = availableSponsors(career);
  const trainCost = trainingPointCost(career);
  const rivals = topRivals(career);
  const overall = Math.round(careerRating(career.skills)); // the single headline number — rises as you train
  const shop = careerDiscShop(career); // discs buyable now (career cash, stage-gated)
  const nextDisc = nextCareerDisc(career); // a teaser disc unlocking at a later stage
  // Current in-play effect of each skill, so the benefit of training is concrete.
  const mods = skillMods(career.skills);
  const effectFor = (k: keyof CareerSkills): string => {
    if (k === "power") { const p = Math.round((mods.speedMul - 1) * 100); return `${p >= 0 ? "+" : ""}${p}% dist`; }
    if (k === "control") return `wind ×${mods.windMul.toFixed(2)}`;
    if (k === "putt") return `catch ${mods.catchR.toFixed(1)}`;
    return "overall";
  };

  // Retired legacy screen.
  if (career.retired) {
    const big = career.titles.filter((t) => t.importance !== "minor");
    return (
      <div className={wrap}><div className={card}>
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">🏁 {career.name}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <p className="text-gray-400 text-xs -mt-2">Retired at age {career.age} · {career.season} seasons · PDGA {career.pdgaRating} · earned {fmtCash(career.cash)}</p>
        <div className="grid grid-cols-2 gap-2 text-center">
          <CareerStat label="Titles" v={career.titles.length} />
          <CareerStat label="Majors" v={career.majors} />
          <CareerStat label="Best world rank" v={career.bestWorldRank ? `#${career.bestWorldRank}` : "—"} />
          <CareerStat label="Seasons at #1" v={career.seasonsAtNo1} />
        </div>
        {big.length > 0 && (
          <div className="bg-[#1a1d23] border border-white/5 rounded-xl p-3 max-h-44 overflow-y-auto">
            <p className="text-[#f5d24a] text-xs font-bold mb-1.5">Career titles</p>
            {big.map((t, i) => <p key={i} className="text-gray-300 text-xs">🏆 {t.name} <span className="text-gray-500">· age {t.age}</span></p>)}
          </div>
        )}
        <button type="button" onClick={onAbandon} className={`${btn} w-full`}>Start a new career</button>
        <button type="button" onClick={onClose} className="w-full text-gray-500 hover:text-gray-300 text-xs py-1 transition">Close</button>
      </div></div>
    );
  }

  // Season hub.
  return (
    <div className={wrap}><div className={card}>
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h2 className="text-white font-black text-lg leading-tight truncate">{career.name}</h2>
          <p className="text-gray-400 text-[11px]">{STAGE_LABEL[career.stage]} · Age {career.age} · Season {career.season + 1}</p>
          <p className="text-[11px] mt-0.5">
            {career.stage === "pro" && career.worldRank
              ? <span className="text-[#f5d24a] font-bold">World #{career.worldRank}</span>
              : <span className="text-gray-500">PDGA {career.pdgaRating}</span>}
            <span className="text-[#36D7B7] font-bold font-mono ml-2">{fmtCash(career.cash)}</span>
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="text-right leading-tight">
            <span className="block text-[#36D7B7] font-black text-2xl font-mono leading-none">{overall}</span>
            <span className="block text-gray-500 text-[8px] uppercase tracking-wide">Overall</span>
          </span>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
      </div>

      {lastResult && (
        <div className={`rounded-lg px-3 py-2 text-sm border ${lastResult.win ? "border-[#f5d24a]/50 bg-[#f5d24a]/10 text-[#f5d24a]" : "border-white/10 bg-white/5 text-gray-200"}`}>
          <div>{lastResult.name}: <span className="font-bold">{placeLabel(lastResult.placed)}</span> of {lastResult.field} · {toPar(lastResult.toPar)} ({lastResult.score}){lastResult.prize > 0 && <span className="text-[#36D7B7]"> · +{fmtCash(lastResult.prize)}</span>}{lastCoins > 0 && <span className="text-[#f5d24a]"> · +{lastCoins} <Coin className="!w-3 !h-3 align-[-1px]" /></span>}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">
            Beat {lastResult.beatRivals}/{lastResult.rivalCount} rivals{lastResult.winnerName ? ` · ${lastResult.winnerName} took the title` : ""}
            {lastResult.trainBonus > 0 && <span className="text-[#36D7B7]"> · +{lastResult.trainBonus} training pt{lastResult.trainBonus > 1 ? "s" : ""}</span>}
          </div>
        </div>
      )}

      {/* Skills + training */}
      <div className="bg-[#1a1d23] border border-white/5 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wide">Skills · Overall {overall}</p>
          <p className="text-[11px] text-gray-400">Training <span className={remaining > 0 ? "text-[#36D7B7] font-bold" : "text-gray-500"}>{remaining}</span>/{career.trainPts}</p>
        </div>
        {SKILL_KEYS.map((k) => {
          const val = career.skills[k];
          const pot = career.potential[k];
          const add = alloc[k];
          return (
            <div key={k} className="flex items-center gap-2">
              <span className="w-12 text-[11px] text-gray-300">{SKILL_LABEL[k]}</span>
              <div className="flex-1 h-2.5 bg-white/5 rounded relative overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-[#36D7B7] rounded" style={{ width: `${Math.min(100, val)}%` }} />
                {pot < 100 && <div className="absolute inset-y-0 w-0.5 bg-white/40" style={{ left: `${Math.min(100, pot)}%` }} />}
              </div>
              <span className="w-9 text-right text-[11px] font-mono text-white">{val}{add ? <span className="text-[#36D7B7]">+{add}</span> : null}</span>
              <div className="flex gap-0.5 shrink-0">
                <button type="button" onClick={() => setAlloc((a) => ({ ...a, [k]: Math.max(0, a[k] - 1) }))} disabled={add === 0} className="w-5 h-5 rounded bg-white/10 text-white text-xs leading-none disabled:opacity-30">−</button>
                <button type="button" onClick={() => setAlloc((a) => (remaining > 0 ? { ...a, [k]: a[k] + 1 } : a))} disabled={remaining <= 0} className="w-5 h-5 rounded bg-white/10 text-white text-xs leading-none disabled:opacity-30">+</button>
              </div>
            </div>
          );
        })}
        {/* What each skill does + its current in-play effect */}
        <div className="space-y-0.5 pt-1.5 border-t border-white/5">
          {SKILL_KEYS.map((k) => (
            <div key={k} className="flex items-baseline justify-between gap-2 text-[9px] leading-tight">
              <span className="text-gray-500 truncate"><span className="text-gray-300 font-semibold">{SKILL_LABEL[k]}</span> — {SKILL_DESC[k]}</span>
              <span className="text-[#36D7B7] font-mono shrink-0">{effectFor(k)}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-gray-500 text-[10px] flex-1 leading-snug">Skills <span className="text-gray-300">only rise when you train them</span>, with <span className="text-gray-300">no cap</span> — most training points come from <span className="text-gray-300">finishing events well</span>. The tick is your natural talent; train right past it.</p>
          <button type="button" onClick={onBuyTrain} disabled={career.cash < trainCost}
            className="shrink-0 rounded bg-[#36D7B7]/15 border border-[#36D7B7]/40 text-[#36D7B7] text-[11px] font-bold px-2 py-1 disabled:opacity-30 disabled:border-white/10 disabled:text-gray-500">
            +1 pt · {fmtCash(trainCost)}
          </button>
        </div>
      </div>

      {/* Career bag + Pro Shop — a disc collection entirely separate from your account */}
      <div className="bg-[#1a1d23] border border-white/5 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wide">Bag · {career.bag.length}/{CAREER_BAG_MAX}</p>
          <p className="text-[10px] text-gray-500">tap a disc to bag/unbag</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {career.discs.map((key) => {
            const d = discByKey(key);
            if (!d) return null;
            const inBag = career.bag.includes(key);
            return (
              <button key={key} type="button" onClick={() => onToggleBag(key)}
                className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${inBag ? "border-[#36D7B7]/70 bg-[#36D7B7]/10 text-white" : "border-white/10 bg-white/[0.02] text-gray-500"}`}>
                <span className="w-2 h-2 rounded-full inline-block mr-1 align-[-1px]" style={{ background: d.color }} />{d.name}
              </button>
            );
          })}
        </div>
        {shop.length > 0 ? (
          <div className="space-y-1 pt-1.5 border-t border-white/5">
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wide">Pro Shop · buy with career cash</p>
            {shop.map(({ key, cost }) => {
              const d = discByKey(key);
              if (!d) return null;
              return (
                <div key={key} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="text-white font-semibold truncate">{d.name}</span>
                    <span className="text-gray-500 truncate hidden xs:inline">{d.brand}</span>
                  </span>
                  <button type="button" onClick={() => onBuyDisc(key)} disabled={career.cash < cost}
                    className="shrink-0 rounded bg-[#e0923b] hover:brightness-110 text-[#0f1117] font-bold px-2 py-0.5 disabled:bg-white/10 disabled:text-gray-500">
                    {fmtCash(cost)}
                  </button>
                </div>
              );
            })}
          </div>
        ) : nextDisc ? (
          <p className="text-gray-500 text-[10px] pt-1.5 border-t border-white/5">Reach <span className="text-gray-300">{STAGE_LABEL[nextDisc.stage]}</span> to unlock more discs in the Pro Shop.</p>
        ) : (
          <p className="text-gray-500 text-[10px] pt-1.5 border-t border-white/5">You own every disc in the bag. 🎒</p>
        )}
      </div>

      {/* Sponsors */}
      <div className="bg-[#1a1d23] border border-white/5 rounded-xl p-3 space-y-1.5">
        <p className="text-gray-400 text-xs font-bold uppercase tracking-wide">Sponsors ({career.sponsors.length}/{SPONSOR_CAP})</p>
        {career.sponsors.length === 0 && sponsorOffers.length === 0 && (
          <p className="text-gray-600 text-[11px]">Win events and raise your rating to attract sponsors.</p>
        )}
        {career.sponsors.map((s) => (
          <div key={s.id} className="flex items-center justify-between text-[11px]">
            <span className="text-white">{s.name}{s.coach ? " 🎓" : ""}</span>
            <span className="text-gray-400 font-mono">{fmtCash(s.stipend)}/yr</span>
          </div>
        ))}
        {sponsorOffers.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-2 bg-white/[0.03] rounded px-2 py-1.5">
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold truncate">{s.name}{s.coach ? " 🎓" : ""}</p>
              <p className="text-gray-500 text-[10px]">{fmtCash(s.signing)} signing · {fmtCash(s.stipend)}/yr{s.coach ? " · +1 training" : ""}</p>
            </div>
            <button type="button" onClick={() => onSign(s.id)} className="shrink-0 rounded bg-[#e0923b] hover:brightness-110 text-[#0f1117] text-[11px] font-bold px-2.5 py-1">Sign</button>
          </div>
        ))}
      </div>

      {/* Schedule */}
      <div className="space-y-1.5">
        <p className="text-gray-400 text-xs font-bold uppercase tracking-wide">Schedule</p>
        {sched.map((ev) => {
          const r = resultFor(ev.id);
          const impColor = ev.importance === "championship" ? "text-[#f5d24a]" : ev.importance === "major" ? "text-[#5fb0e8]" : "text-gray-500";
          const impWord = ev.importance === "championship" ? "Championship" : ev.importance === "major" ? "Major" : "Tour";
          const courseLabel = ev.venue ?? (ev.mode === "winthrop" ? "Winthrop Lake" : ev.mode === "course" ? "Glendoveer" : "9-hole");
          return (
            <div key={ev.id} className="bg-[#1a1d23] border border-white/5 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{ev.name}</p>
                  <p className="text-[10px] text-gray-500"><span className={impColor}>{impWord}</span> · {courseLabel} · {ev.fieldSize} players</p>
                  {ev.character && <p className="text-[10px] text-gray-500 truncate">{ev.emoji} {ev.character}</p>}
                </div>
                {r ? (
                  <span className={`shrink-0 text-xs font-bold ${r.win ? "text-[#f5d24a]" : "text-gray-300"}`} title={r.played ? "played" : "simmed"}>{placeLabel(r.placed)} <span className="text-gray-500 font-normal">{r.played ? "▶" : "⚡"}</span></span>
                ) : (
                  <div className="shrink-0 flex gap-1">
                    <button type="button" onClick={() => onPlay(ev)} className="rounded bg-[#4B3DFF] hover:bg-[#3a2ee0] text-white text-xs font-bold px-2.5 py-1">Play</button>
                    <button type="button" onClick={() => onSim(ev)} className="rounded bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-2.5 py-1">⚡ Sim</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Rivals board — PDGA tracked the same way as yours, so it's comparable */}
      <div className="space-y-1">
        <div className="flex items-baseline justify-between">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wide">Rivals · PDGA · record</p>
          <p className="text-[10px] text-gray-500">you: <span className="text-[#f5d24a] font-mono">{career.pdgaRating}</span></p>
        </div>
        {[...rivals].sort((a, b) => b.pdgaRating - a.pdgaRating).map((r) => (
          <div key={r.id} className="flex items-center gap-2 bg-[#1a1d23] border border-white/5 rounded-lg px-3 py-1.5 text-xs">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
            <span className="text-white font-semibold flex-1 truncate">{r.name}</span>
            {r.titles > 0 && <span className="text-[#f5d24a] text-[10px]">🏆{r.titles}</span>}
            <span className={`font-mono text-[11px] w-9 text-right ${r.pdgaRating > career.pdgaRating ? "text-[#e0923b]" : "text-[#36D7B7]"}`}>{r.pdgaRating}</span>
            <span className="font-mono text-[11px] w-9 text-right"><span className="text-[#36D7B7]">{r.beat}</span><span className="text-gray-600">-</span><span className="text-[#e2453b]">{r.lost}</span></span>
          </div>
        ))}
      </div>

      {/* Advance / sim-remaining */}
      {canAdvance ? (
        <button type="button" onClick={() => onAdvance(alloc)} className={`${btn} w-full`}>Advance to next season ▶</button>
      ) : (
        <button type="button" onClick={() => undone.forEach((ev) => onSim(ev))} className="w-full rounded-lg bg-white/5 border border-white/10 hover:border-white/25 text-gray-200 text-sm font-bold py-2.5 transition">
          ⚡ Sim remaining {undone.length} event{undone.length === 1 ? "" : "s"}
        </button>
      )}
      <div className="flex items-center justify-between pt-0.5">
        {career.stage === "pro" ? (
          confirm === "retire" ? (
            <span className="text-xs text-gray-400">Retire? <button type="button" onClick={onRetire} className="text-[#e2453b] font-bold">Yes</button> · <button type="button" onClick={() => setConfirm(null)} className="text-gray-300">No</button></span>
          ) : (
            <button type="button" onClick={() => setConfirm("retire")} className="text-gray-500 hover:text-gray-300 text-xs">Retire</button>
          )
        ) : <span />}
        {confirm === "abandon" ? (
          <span className="text-xs text-gray-400">Delete? <button type="button" onClick={onAbandon} className="text-[#e2453b] font-bold">Yes</button> · <button type="button" onClick={() => setConfirm(null)} className="text-gray-300">No</button></span>
        ) : (
          <button type="button" onClick={() => setConfirm("abandon")} className="text-gray-600 hover:text-gray-400 text-xs">Abandon</button>
        )}
      </div>
    </div></div>
  );
}

// Player profile — pick an avatar, set a name, see your level and badges.
function ProfilePanel({ profile, coins, owned, unlocked, roundsPlayed, bestScore, winthropBest, bagCount, onSave, onBuyAvatar, onBag, onShop, onStats, hasAuth, user, onAccount, onSignOut, onClose }: {
  profile: PlayerProfile;
  coins: number;
  owned: string[];
  unlocked: string[];
  roundsPlayed: number;
  bestScore: number | null;
  winthropBest: number | null;
  bagCount: number;
  onSave: (p: PlayerProfile) => void;
  onBuyAvatar: (key: string, price: number) => void;
  onBag: () => void;
  onShop: () => void;
  onStats: () => void;
  hasAuth: boolean;
  user: { email: string } | null;
  onAccount: () => void;
  onSignOut: () => void;
  onClose: () => void;
}) {
  const discsOwned = owned.filter((k) => !k.includes(":")).length; // exclude avatar:/event: cosmetics
  const lvl = levelFromXp(playerXp(roundsPlayed, unlocked.length, discsOwned));
  const pct = lvl.need ? Math.round((lvl.into / lvl.need) * 100) : 100;
  const over = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-3.5 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">👤 Profile</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* Identity card */}
        <div className="flex items-center gap-3 bg-[#1a1d23] border border-white/10 rounded-xl px-3 py-3">
          <span className="text-4xl leading-none shrink-0">{profile.avatar || DEFAULT_AVATAR}</span>
          <div className="min-w-0 flex-1">
            <input
              value={profile.name}
              onChange={(e) => onSave({ ...profile, name: e.target.value.slice(0, 16) })}
              placeholder="Your name"
              maxLength={16}
              className="w-full bg-transparent text-white font-bold text-base outline-none border-b border-white/10 focus:border-[#36D7B7] pb-0.5"
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[#36D7B7] font-bold text-xs">Level {lvl.level}</span>
              <span className="text-gray-500 font-mono text-[10px]">{lvl.into}/{lvl.need} XP</span>
            </div>
            <div className="mt-1 h-1.5 bg-white/10 rounded overflow-hidden">
              <div className="h-full bg-[#36D7B7] rounded" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        {/* Lifetime stats */}
        <div className="grid grid-cols-4 gap-1.5 text-center">
          {[
            { v: roundsPlayed, l: "Rounds" },
            { v: bestScore != null ? over(bestScore - TOTAL_PAR) : "–", l: "GE Best" },
            { v: winthropBest != null ? over(winthropBest - WINTHROP_PAR) : "–", l: "WL Best" },
            { v: discsOwned, l: "Discs" },
          ].map((s) => (
            <div key={s.l} className="rounded-lg bg-white/5 border border-white/10 px-1 py-1.5">
              <p className="text-white font-bold text-sm leading-none">{s.v}</p>
              <p className="text-gray-500 text-[8px] mt-1 uppercase tracking-wide">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Discs: edit the bag or buy more; detailed stats */}
        <div className="flex gap-2">
          <button type="button" onClick={onBag} className="flex-1 rounded-lg border border-[#36D7B7]/45 bg-[#1a1d23] hover:border-[#36D7B7] text-white text-xs font-bold py-2">🎒 Bag · {bagCount}/{BAG_MAX}</button>
          <button type="button" onClick={onShop} className="flex-1 rounded-lg border border-[#f5d24a]/45 bg-[#1a1d23] hover:border-[#f5d24a] text-white text-xs font-bold py-2">🛒 Shop</button>
          <button type="button" onClick={onStats} className="flex-1 rounded-lg border border-white/15 bg-[#1a1d23] hover:border-white/35 text-white text-xs font-bold py-2">📊 Stats</button>
        </div>

        {/* Avatar picker */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-gray-400 text-xs font-semibold">Avatar</p>
            <span className="text-[#f5d24a] font-bold font-mono text-[11px]">{fmtCoins(coins)} <Coin /></span>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {AVATARS.map((a) => {
              const have = avatarUnlocked(a, owned);
              const selected = (profile.avatar || DEFAULT_AVATAR) === a.emoji;
              const afford = coins >= a.price;
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => (have ? onSave({ ...profile, avatar: a.emoji }) : afford ? onBuyAvatar(a.key, a.price) : undefined)}
                  disabled={!have && !afford}
                  title={have ? a.key : `${a.price} coins`}
                  className={`relative aspect-square rounded-lg flex items-center justify-center text-xl transition ${
                    selected ? "bg-[#36D7B7]/25 ring-2 ring-[#36D7B7]" : "bg-white/5 hover:bg-white/10"
                  } ${!have && !afford ? "opacity-40" : ""}`}
                >
                  <span className={have ? "" : "grayscale opacity-70"}>{a.emoji}</span>
                  {!have && (
                    <span className="absolute -bottom-0.5 inset-x-0 flex items-center justify-center gap-0.5 text-[7px] font-mono text-[#f5d24a] leading-none">{a.price}<Coin className="!w-1.5 !h-1.5" /></span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-gray-600 text-[10px] mt-1.5">Tap a locked avatar to buy it with coins, then tap again to wear it.</p>
        </div>

        {/* Badges */}
        <div>
          <p className="text-gray-400 text-xs font-semibold mb-1.5">Badges ({unlocked.length}/{ACHIEVEMENTS.length})</p>
          <div className="grid grid-cols-3 gap-1.5">
            {ACHIEVEMENTS.map((a) => {
              const earned = unlocked.includes(a.id);
              return (
                <div
                  key={a.id}
                  title={a.desc}
                  className={`rounded-lg px-1.5 py-2 text-center border ${
                    earned ? "bg-[#f5d24a]/10 border-[#f5d24a]/30" : "bg-white/5 border-white/5"
                  }`}
                >
                  <div className={`text-lg leading-none ${earned ? "" : "grayscale opacity-40"}`}>{a.emoji}</div>
                  <div className={`text-[8px] mt-1 leading-tight ${earned ? "text-gray-300" : "text-gray-600"}`}>{a.name}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Account — log in to sync, or sign out */}
        {hasAuth && (
          <div>
            <p className="text-gray-400 text-xs font-semibold mb-1.5">Account</p>
            {user ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate text-gray-300 text-xs">👤 {user.email}</span>
                <button type="button" onClick={onSignOut} className="shrink-0 rounded-lg border border-white/15 hover:border-white/35 text-gray-200 hover:text-white text-xs font-semibold px-3 py-1.5 transition">Log out</button>
              </div>
            ) : (
              <button type="button" onClick={onAccount} className="w-full rounded-lg border border-[#36D7B7]/45 bg-[#1a1d23] hover:border-[#36D7B7] text-white text-xs font-bold py-2 transition">👤 Log in / Sign up</button>
            )}
            <p className="text-gray-600 text-[10px] mt-1.5">Log in to sync your bag, coins and best scores across devices.</p>
          </div>
        )}

        <button type="button" onClick={onClose} className={`${btn} w-full`}>Done</button>
      </div>
    </div>
  );
}

// Level-up reward: choose 1 of 2 discs. Shown over everything; you must pick.
function LevelUpPanel({ level, choices, bagHasRoom, onPick }: {
  level: number;
  choices: string[];
  bagHasRoom: boolean;
  onPick: (key: string) => void;
}) {
  const discs = choices.map((k) => discByKey(k)).filter((d): d is NonNullable<typeof d> => !!d);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0f1117]/85 backdrop-blur-sm p-5">
      <div className="w-full max-w-xs rounded-2xl bg-gradient-to-b from-[#1c2233] to-[#0f1117] border border-[#36D7B7]/30 p-5 text-center shadow-2xl">
        <p className="text-[#f5d24a] font-black text-xs tracking-[0.2em]">⬆ LEVEL UP</p>
        <h2 className="text-white font-black text-3xl mt-0.5 leading-none">Level {level}</h2>
        <p className="text-gray-300 text-sm font-semibold mt-2">Pick a new disc for your bag</p>
        <p className="text-gray-500 text-[11px] mt-0.5">{bagHasRoom ? "It goes straight into your bag." : "Bag's full — it'll wait in your collection."}</p>
        <div className="flex flex-col gap-2.5 mt-4">
          {discs.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => onPick(d.key)}
              className="flex items-center gap-3 rounded-xl bg-[#1a1d23] border border-white/10 hover:border-[#36D7B7] hover:bg-[#20262f] active:scale-[0.99] px-3 py-3 text-left transition"
            >
              <span className="w-4 h-4 rounded-full shrink-0" style={{ background: d.color }} />
              <div className="min-w-0 flex-1">
                <p className="text-white font-bold text-sm truncate">{d.name} <span className="text-gray-500 font-normal text-[10px]">{d.brand}</span></p>
                <p className="text-[10px] font-mono text-gray-400 truncate">{d.blurb.split("· ")[1]} · {d.flight === "overstable" ? "overstable" : "straight"}</p>
              </div>
              <span className="text-[#36D7B7] text-xl shrink-0 leading-none">＋</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// The bag editor — carry up to BAG_MAX discs into a round. Unlocked discs sit in
// the collection; add/remove to curate the bag (swap = remove one, add another).
function BagPanel({ bag, unlocked, owned, level, onAdd, onRemove, onMove, onShop, onClose }: {
  bag: string[];
  unlocked: string[];
  owned: string[];
  level: number;
  onAdd: (key: string) => void;
  onRemove: (key: string) => void;
  onMove: (key: string, dir: -1 | 1) => void;
  onShop: () => void;
  onClose: () => void;
}) {
  const inBag = bag.map((k) => discByKey(k)).filter((d): d is NonNullable<typeof d> => !!d);
  const collection = ADV_DISCS.filter((d) => !bag.includes(d.key) && isDiscUnlocked(d, unlocked, owned, level));
  const locked = ADV_DISCS.filter((d) => !isDiscUnlocked(d, unlocked, owned, level));
  const full = bag.length >= BAG_MAX;
  const nums = (d: { blurb: string; flight?: string }) => `${d.blurb.split("· ")[1] ?? ""} · ${d.flight === "overstable" ? "overstable" : "straight"}`;
  const row = (d: NonNullable<ReturnType<typeof discByKey>>, action: React.ReactNode) => (
    <div key={d.key} className="flex items-center gap-2.5 bg-[#1a1d23] border border-white/5 rounded-lg px-3 py-2">
      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
      <div className="min-w-0 flex-1">
        <p className="text-white text-sm font-bold truncate">{d.name} <span className="text-gray-500 font-normal text-[10px]">{d.brand}</span></p>
        <p className="text-[10px] font-mono text-gray-500 truncate">{nums(d)}</p>
      </div>
      {action}
    </div>
  );
  return (
    <div className="absolute inset-0 z-30 bg-[#0f1117]/95 backdrop-blur-sm rounded-lg flex flex-col">
      <div className="w-full max-w-xs mx-auto flex flex-col h-full px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] text-left">
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-white font-black text-xl">🎒 Your Bag · {bag.length}/{BAG_MAX}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <p className="text-gray-500 text-[11px] mt-1 shrink-0">Carry up to {BAG_MAX} discs into a round — only these are usable. {full ? "Bag's full; remove one to swap." : "Add discs from your collection below."}</p>
        <div className="flex-1 overflow-y-auto mt-2.5 space-y-2 pr-0.5 -mr-0.5">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wide">In your bag <span className="text-gray-600 font-normal normal-case tracking-normal">· ▲▼ reorder (slots 1–{BAG_MAX})</span></p>
          {inBag.map((d, i) => (
            <div key={d.key} className="flex items-center gap-2 bg-[#1a1d23] border border-white/5 rounded-lg px-2.5 py-2">
              <span className="shrink-0 w-3.5 text-center text-[10px] font-mono text-gray-500">{i + 1}</span>
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-bold truncate">{d.name} <span className="text-gray-500 font-normal text-[10px]">{d.brand}</span></p>
                <p className="text-[10px] font-mono text-gray-500 truncate">{nums(d)}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => onMove(d.key, -1)} disabled={i === 0} aria-label="Move up" className="w-6 h-7 rounded bg-white/10 hover:bg-white/15 text-gray-200 text-[11px] leading-none disabled:opacity-25">▲</button>
                <button type="button" onClick={() => onMove(d.key, 1)} disabled={i === inBag.length - 1} aria-label="Move down" className="w-6 h-7 rounded bg-white/10 hover:bg-white/15 text-gray-200 text-[11px] leading-none disabled:opacity-25">▼</button>
                <button type="button" onClick={() => onRemove(d.key)} disabled={bag.length <= 1} aria-label="Remove from bag" className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white text-base leading-none disabled:opacity-25">×</button>
              </div>
            </div>
          ))}
          {collection.length > 0 && <p className="text-gray-400 text-xs font-bold uppercase tracking-wide pt-1">Collection</p>}
          {collection.map((d) => row(d,
            <button type="button" onClick={() => onAdd(d.key)} disabled={full}
              className="shrink-0 rounded-lg bg-[#36D7B7] hover:bg-[#2bc4a6] text-[#0f1117] text-xs font-bold px-3 py-1.5 disabled:opacity-30 disabled:bg-white/10 disabled:text-gray-500">Add</button>,
          ))}
          {locked.length > 0 && (
            <>
              <div className="flex items-center justify-between pt-1">
                <p className="text-gray-400 text-xs font-bold uppercase tracking-wide">Locked</p>
                <button type="button" onClick={onShop} className="text-[#f5d24a] text-[11px] font-bold hover:brightness-110">🛒 Shop ›</button>
              </div>
              {locked.map((d) => {
                const price = DISC_PRICE[d.key];
                return (
                  <div key={d.key} className="flex items-center gap-2.5 bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2 opacity-70">
                    <span className="w-3 h-3 rounded-full shrink-0 bg-[#444]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-gray-300 text-sm font-bold truncate">🔒 {d.name} <span className="text-gray-600 font-normal text-[10px]">{d.brand}</span></p>
                      <p className="text-[10px] font-mono text-gray-600">{price != null ? <span className="inline-flex items-center gap-1">In the Shop · {price} <Coin className="!w-2.5 !h-2.5" /></span> : "Draft at level-up"}</p>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
        <button type="button" onClick={onClose} className={`${btn} w-full shrink-0 mt-3`}>Done</button>
      </div>
    </div>
  );
}

// ── Shop swatch previews (CSS backgrounds for each cosmetic category). ──
function trailSwatch(t: Trail): string {
  if (t.kind === "none") return "repeating-linear-gradient(45deg,#2a2f3a,#2a2f3a 3px,#1a1d23 3px,#1a1d23 6px)";
  if (t.kind === "rainbow") return "linear-gradient(90deg,#ff4d4d,#f5a623,#f5d24a,#36D7B7,#5fb0e8,#b85cd6)";
  if (t.colors.length === 1) return t.colors[0];
  return `linear-gradient(90deg,${t.colors.join(",")})`;
}
function discSkinSwatch(s: DiscSkin): string {
  if (s.kind === "chrome") return "linear-gradient(90deg,#ffffff,#d7dde6,#878d97)";
  if (s.kind === "galaxy") return "linear-gradient(90deg,#b07cf0,#6a4bd6,#2a1d5a)";
  return s.body;
}
function basketSwatch(b: BasketSkin): string {
  return `linear-gradient(90deg,${b.band},${b.pole},${b.base})`;
}
function groundSwatch(g: GroundTheme): string {
  return `linear-gradient(90deg,${g.rough},${g.fairway},${g.stripe})`;
}
function celebrationSwatch(c: Celebration): string {
  if (c.colors.length === 1) return c.colors[0];
  return `linear-gradient(90deg,${c.colors.join(",")})`;
}

// Cosmetic profile fields the shop can equip.
type CosmeticField = "trail" | "discSkin" | "basketSkin" | "aimStyle" | "groundTheme" | "celebration";

// Disc shop — buy advanced discs + cosmetics with coins.
function ShopPanel({ coins, unlocked, owned, level, profile, onBuy, onEquip, onClose }: {
  coins: number;
  unlocked: string[];
  owned: string[];
  level: number;
  profile: PlayerProfile;
  onBuy: (key: string, price: number) => void;
  onEquip: (field: CosmeticField, key: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"discs" | "trails" | "discskin" | "basket" | "aim" | "ground" | "celebration">("discs");
  const seg = (active: boolean) =>
    `shrink-0 rounded-md px-2.5 py-1.5 text-xs font-bold whitespace-nowrap transition ${active ? "bg-[#4B3DFF] text-white" : "text-gray-400 hover:text-white"}`;
  // Every priced disc across both bags, cheapest first.
  const items = ADV_DISCS.filter((d) => DISC_PRICE[d.key] != null).sort((a, b) => DISC_PRICE[a.key] - DISC_PRICE[b.key]);
  // One buy/equip row, shared by every cosmetic category.
  const cosmeticRow = <T extends { key: string; name: string; desc: string; price: number }>(
    item: T, prefix: string, selected: string, field: CosmeticField, swatch: string,
  ) => {
    const have = cosmeticUnlocked(prefix, item, owned);
    const equipped = selected === item.key;
    const afford = coins >= item.price;
    return (
      <div key={item.key} className="flex items-center gap-2.5 bg-[#1a1d23] border border-white/5 rounded-lg px-3 py-2">
        <span className="w-8 h-3 rounded-full shrink-0 border border-white/10" style={{ background: swatch }} />
        <div className="min-w-0 flex-1">
          <p className="text-white text-sm font-bold truncate">{item.name}</p>
          <p className="text-[10px] text-gray-500">{item.desc}</p>
        </div>
        {have ? (
          <button type="button" onClick={() => onEquip(field, item.key)} disabled={equipped}
            className={`shrink-0 rounded-lg text-xs font-bold px-2.5 py-1.5 ${equipped ? "text-[#36D7B7]" : "bg-[#36D7B7] hover:bg-[#2bc4a6] text-[#0f1117]"}`}>
            {equipped ? "Equipped ✓" : "Equip"}
          </button>
        ) : (
          <button type="button" onClick={() => onBuy(cosmeticOwnKey(prefix, item.key), item.price)} disabled={!afford}
            className="shrink-0 inline-flex items-center justify-center gap-1 rounded-lg bg-[#f5d24a] hover:brightness-110 text-[#0f1117] text-xs font-bold px-2.5 py-1.5 disabled:opacity-40 disabled:bg-white/10 disabled:text-gray-500">
            {item.price} <Coin />
          </button>
        )}
      </div>
    );
  };
  const TABS: { id: typeof tab; label: string }[] = [
    { id: "discs", label: "🥏 Discs" },
    { id: "trails", label: "✨ Trails" },
    { id: "discskin", label: "🎨 Disc" },
    { id: "basket", label: "🧺 Basket" },
    { id: "aim", label: "🎯 Aim" },
    { id: "ground", label: "🌿 Ground" },
    { id: "celebration", label: "🎉 Win" },
  ];
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-2.5 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">🛒 Shop</h2>
          <div className="flex items-center gap-2">
            <span className="text-[#f5d24a] font-bold font-mono text-sm">{fmtCoins(coins)} <Coin /></span>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
          </div>
        </div>
        <div className="flex gap-1 bg-[#1a1d23] rounded-lg p-1 overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} className={seg(tab === t.id)}>{t.label}</button>
          ))}
        </div>

        {tab === "discs" && <>
          <p className="text-gray-500 text-[11px]">Every disc is buyable at any level — distance drivers are just pricey. Or draft one free each level-up. Discs work in every mode.</p>
          {items.map((d) => {
            const bought = owned.includes(d.key);
            const have = isDiscUnlocked(d, unlocked, owned, level); // owned or earned
            const price = DISC_PRICE[d.key];
            const afford = coins >= price;
            return (
              <div key={d.key} className="flex items-center gap-2.5 bg-[#1a1d23] border border-white/5 rounded-lg px-3 py-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-bold truncate">{d.name} <span className="text-gray-500 font-normal text-[10px]">{d.brand}</span></p>
                  <p className="text-[10px] font-mono text-gray-500">{d.blurb.split("· ")[1] ?? d.blurb}</p>
                </div>
                {have ? (
                  <span className="shrink-0 text-[11px] font-bold text-[#36D7B7]">{bought ? "Owned ✓" : "Earned ✓"}</span>
                ) : (
                  <button type="button" onClick={() => onBuy(d.key, price)} disabled={!afford}
                    className="shrink-0 inline-flex items-center justify-center gap-1 rounded-lg bg-[#f5d24a] hover:brightness-110 text-[#0f1117] text-xs font-bold px-2.5 py-1.5 disabled:opacity-40 disabled:bg-white/10 disabled:text-gray-500">
                    {price} <Coin />
                  </button>
                )}
              </div>
            );
          })}
        </>}

        {tab === "trails" && <>
          <p className="text-gray-500 text-[11px]">A streak your disc leaves on every throw. Buy, then Equip — works in every mode.</p>
          {TRAILS.map((t) => cosmeticRow(t, "trail", profile.trail || DEFAULT_TRAIL, "trail", trailSwatch(t)))}
        </>}

        {tab === "discskin" && <>
          <p className="text-gray-500 text-[11px]">Recolor the flying disc. Its tier color stays as a center pip so you can tell which disc is in hand.</p>
          {DISC_SKINS.map((s) => cosmeticRow(s, COSMETIC_PREFIX.discSkin, profile.discSkin || DEFAULT_DISC_SKIN, "discSkin", discSkinSwatch(s)))}
        </>}

        {tab === "basket" && <>
          <p className="text-gray-500 text-[11px]">Restyle the basket you&apos;re aiming at — shown on every hole.</p>
          {BASKET_SKINS.map((b) => cosmeticRow(b, COSMETIC_PREFIX.basket, profile.basketSkin || DEFAULT_BASKET_SKIN, "basketSkin", basketSwatch(b)))}
        </>}

        {tab === "aim" && <>
          <p className="text-gray-500 text-[11px]">Restyle the predicted-flight aim line you see while pulling back.</p>
          {AIM_STYLES.map((a) => cosmeticRow(a, COSMETIC_PREFIX.aim, profile.aimStyle || DEFAULT_AIM_STYLE, "aimStyle", a.color))}
        </>}

        {tab === "ground" && <>
          <p className="text-gray-500 text-[11px]">Re-tint the grass and fairway. Hazard rough keeps its warning colors.</p>
          {GROUND_THEMES.map((g) => cosmeticRow(g, COSMETIC_PREFIX.ground, profile.groundTheme || DEFAULT_GROUND_THEME, "groundTheme", groundSwatch(g)))}
        </>}

        {tab === "celebration" && <>
          <p className="text-gray-500 text-[11px]">The burst that fires when you sink the disc — bigger when you beat par.</p>
          {CELEBRATIONS.map((c) => cosmeticRow(c, COSMETIC_PREFIX.celebration, profile.celebration || DEFAULT_CELEBRATION, "celebration", celebrationSwatch(c)))}
        </>}

        <button type="button" onClick={onClose} className={`${btn} w-full`}>Done</button>
      </div>
    </div>
  );
}

// Every fixed course in the app on one page — keeps the title screen short and
// scales as new courses are added to FIXED_COURSES.
// A 1–5 star difficulty rating (orange stars), 5 = very difficult.
function DiffStars({ n }: { n: number }) {
  return (
    <span className="leading-none tracking-tight whitespace-nowrap" aria-label={`Difficulty ${n} of 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={`text-[11px] ${i < n ? "text-[#e0923b]" : "text-white/15"}`}>★</span>
      ))}
    </span>
  );
}
function CoursesPanel({ courses, tourCourses, bests, tourBests, onClose, onPlay }: {
  courses: CourseInfo[];
  tourCourses: CourseInfo[];
  bests: Record<string, number | null>;
  tourBests: Record<number, number>;
  onClose: () => void;
  onPlay: (m: Mode, seed?: number) => void;
}) {
  const [tab, setTab] = useState<"championship" | "tour">("championship");
  const over = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
  const seg = (active: boolean) =>
    `flex-1 rounded-md px-2 py-2 text-xs font-bold transition ${active ? "bg-[#4B3DFF] text-white" : "text-gray-400 hover:text-white"}`;
  const bestFor = (c: CourseInfo) => (c.seed != null ? tourBests[c.seed] ?? null : bests[c.mode] ?? null);
  // Sort each tab easiest → hardest by intrinsic difficulty.
  const byDiff = (cs: CourseInfo[]) => cs.map((c) => ({ c, d: courseDifficultyOf(c.mode, c.seed) })).sort((a, b) => a.d - b.d);
  const champ = useMemo(() => byDiff(courses), [courses]);
  const tourL = useMemo(() => byDiff(tourCourses), [tourCourses]);
  const list = tab === "championship" ? champ : tourL;
  const card = ({ c }: { c: CourseInfo }) => {
    const best = bestFor(c);
    const stars = courseStars(best, c.par);
    const diff = courseStarDifficulty(c.mode, c.seed);
    return (
      <div key={c.seed != null ? `tour-${c.seed}` : c.mode} className="rounded-xl bg-[#1a1d23] border border-white/10 p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="text-white font-bold text-sm truncate pt-0.5">{c.name}</span>
          <div className="shrink-0 text-right">
            <DiffStars n={diff} />
            <span className="block text-gray-500 text-[10px] mt-0.5">{c.holes} holes · par {c.par}</span>
          </div>
        </div>
        <p className="text-gray-500 text-[11px] mt-0.5 leading-snug">{c.blurb}</p>
        <div className="flex items-center justify-between mt-2.5">
          <div className="min-w-0">
            <div className="text-sm leading-none tracking-wide" aria-label={`${stars} of 3 stars`}>
              {[0, 1, 2].map((i) => (
                <span key={i} className={i < stars ? "text-[#f5d24a]" : "text-white/15"}>★</span>
              ))}
            </div>
            <span className="block text-[10px] text-gray-500 mt-1">
              {best != null ? <>Best <span className="text-[#36D7B7] font-bold">{best}</span> ({over(best - c.par)})</> : "Not played yet"}
            </span>
          </div>
          <button type="button" onClick={() => onPlay(c.mode, c.seed)} className="shrink-0 rounded-lg bg-[#4B3DFF] hover:bg-[#3a2ee0] text-white text-sm font-bold px-5 py-1.5 transition">Play</button>
        </div>
      </div>
    );
  };
  return (
    <div className="absolute inset-0 z-20 bg-[#0f1117]/95 backdrop-blur-sm rounded-lg flex flex-col">
      <div className="w-full max-w-xs mx-auto flex flex-col h-full px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] text-left">
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-white font-black text-xl">⛳ Play Courses</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="flex gap-1 bg-[#1a1d23] border border-white/10 rounded-lg p-1 mt-3 shrink-0">
          <button type="button" onClick={() => setTab("championship")} className={seg(tab === "championship")}>Championship</button>
          <button type="button" onClick={() => setTab("tour")} className={seg(tab === "tour")}>🏆 Pro Tour</button>
        </div>
        <p className="text-gray-500 text-[11px] mt-2 shrink-0">Easiest first. <span className="text-[#e0923b]">★</span> = difficulty (5 = very hard). Gold <span className="text-[#f5d24a]">★</span> below are your best: even par · −9 · −18.</p>
        <div className="flex-1 overflow-y-auto mt-2 space-y-2.5 pr-0.5 -mr-0.5">
          {list.map(({ c }) => card({ c }))}
        </div>
        <button type="button" onClick={onClose} className={`${btn} w-full shrink-0 mt-3`}>Done</button>
      </div>
    </div>
  );
}

// Recurring challenges that pay coins: easy DAILY objectives (reset each day)
// and harder WEEKLY ones (reset each week). Progress is read from saved round
// history; claims are marked in the owned set so they survive a refresh and
// can't be claimed twice.
function ChallengesPanel({ history, owned, coins, today, onClaim, onClose }: {
  history: EventRound[];
  owned: string[];
  coins: number;
  today: number; // current day number
  onClaim: (claimKey: string, reward: number) => void;
  onClose: () => void;
}) {
  const [week] = useState(() => weekSeed(Date.now()));
  const dayRows = roundsThisDay(history, today);
  const weekRows = roundsThisWeek(history, week);
  const row = (c: Challenge, rows: EventRound[], claimKey: string) => {
    const have = Math.min(c.measure(rows), c.goal);
    const done = have >= c.goal;
    const claimed = owned.includes(claimKey);
    const pct = Math.round((have / c.goal) * 100);
    return (
      <div key={c.id} className="bg-[#1a1d23] border border-white/10 rounded-lg px-2.5 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none shrink-0">{c.emoji}</span>
          <span className="text-white font-semibold text-xs flex-1 truncate">{c.desc}</span>
          <span className="text-[#f5d24a] font-bold text-[10px] shrink-0 inline-flex items-center gap-0.5">+{c.reward} <Coin className="!w-2 !h-2" /></span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 bg-white/10 rounded overflow-hidden">
            <div className="h-full rounded bg-[#36D7B7]" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-gray-400 font-mono text-[9px] w-8 text-right">{have}/{c.goal}</span>
          {claimed ? (
            <span className="shrink-0 text-[10px] font-bold text-[#36D7B7] w-14 text-center">Claimed ✓</span>
          ) : (
            <button
              type="button"
              onClick={() => onClaim(claimKey, c.reward)}
              disabled={!done}
              className="shrink-0 w-14 rounded-md bg-[#36D7B7] hover:bg-[#2bc4a6] text-[#0f1117] text-[10px] font-bold py-1 disabled:opacity-30 disabled:bg-white/10 disabled:text-gray-500"
            >
              {done ? "Claim" : "Locked"}
            </button>
          )}
        </div>
      </div>
    );
  };
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-1.5 my-auto text-left">
        <div className="flex items-center justify-between pb-0.5">
          <h2 className="text-white font-black text-xl">🎯 Challenges</h2>
          <div className="flex items-center gap-2">
            <span className="text-[#f5d24a] font-bold font-mono text-sm inline-flex items-center gap-1">{fmtCoins(coins)} <Coin /></span>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
          </div>
        </div>

        {/* Daily — light objectives, reset every day */}
        <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide">Daily · resets at midnight</p>
        {dailyChallenges(today).map((c) => row(c, dayRows, dailyClaimKey(today, c.id)))}

        {/* Weekly — harder objectives, reset every week */}
        <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide pt-0.5">Weekly · resets Monday</p>
        {weeklyChallenges(week).map((c) => row(c, weekRows, eventClaimKey(week, c.id)))}

        <button type="button" onClick={onClose} className={`${btn} w-full !mt-2.5`}>Done</button>
      </div>
    </div>
  );
}

// Async global ranked ladder. Everyone plays the SAME 18-hole course this week
// and competes on a shared weekly board; lifetime RP maps to a climbing tier.
function RankedPanel({ ranked, playerName, onPlay, onClose }: {
  ranked: RankedState | null;
  playerName: string;
  onPlay: () => void;
  onClose: () => void;
}) {
  // Date.now() is fine in a lazy useState initializer (runs once, not in render).
  const [week] = useState(() => weekSeed(Date.now()));
  const [par] = useState(() => buildRound(week, "ranked").reduce((s, h) => s + h.par, 0));
  const [rows, setRows] = useState<ArcadeScore[] | null>(null);
  const over = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
  const rp = ranked?.rp ?? 0;
  const t = tierFromRP(rp);
  const pct = t.need ? Math.round((t.into / t.need) * 100) : 100;
  const me = (playerName ?? "").trim().slice(0, 16) || "Anon";
  useEffect(() => {
    let active = true;
    getArcadeLeaderboard(rankedCourseKey(week), 25).then((r) => { if (active) setRows(r); }).catch(() => { if (active) setRows([]); });
    return () => { active = false; };
  }, [week]);
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-3 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">🏅 Ranked</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* Tier card */}
        <div className="flex items-center gap-3 bg-[#1a1d23] border border-white/10 rounded-xl px-3 py-3">
          <span className="text-4xl leading-none shrink-0">{t.tier.emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between">
              <span className="font-bold text-base" style={{ color: t.tier.color }}>{t.tier.name}</span>
              <span className="text-gray-400 font-mono text-[11px]">{rp} RP</span>
            </div>
            <div className="mt-1.5 h-1.5 bg-white/10 rounded overflow-hidden">
              <div className="h-full rounded" style={{ width: `${pct}%`, background: t.tier.color }} />
            </div>
            <p className="text-gray-500 text-[10px] mt-1">{t.next ? `${t.need - t.into} RP to ${t.next.name}` : "Top tier reached 👑"}</p>
          </div>
        </div>

        <p className="text-gray-400 text-[11px] leading-snug">
          One 18-hole course per week — the same for everyone. Post your best on the global board; it resets every Monday. Each round earns RP toward your next tier.
        </p>

        <button type="button" onClick={onPlay} className={`${btn} w-full`}>
          Play this week&apos;s ranked round
        </button>

        {/* Live weekly board */}
        <div>
          <p className="text-gray-400 text-xs font-semibold mb-1.5">This week · par {par}{ranked?.bestToPar != null ? ` · your best ${over(ranked.bestToPar)}` : ""}</p>
          <div className="bg-[#1a1d23] border border-white/5 rounded-2xl overflow-hidden">
            {rows === null ? (
              <p className="text-gray-400 text-sm text-center py-6">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No scores yet — be the first this week!</p>
            ) : (
              <ol>
                {rows.map((row, i) => {
                  const mine = row.name === me;
                  return (
                    <li
                      key={`${row.name}-${row.created_at}`}
                      className={`flex items-center gap-3 px-4 py-2 text-sm ${i !== 0 ? "border-t border-white/5" : ""} ${mine ? "bg-[#36D7B7]/15" : ""}`}
                    >
                      <span className={`font-mono w-6 text-right ${i === 0 ? "text-[#f5d24a]" : "text-gray-400"}`}>{i + 1}</span>
                      <span className={`flex-1 truncate ${mine ? "text-[#36D7B7] font-bold" : "text-white"}`}>{i === 0 ? "👑 " : ""}{row.name}{mine ? " (you)" : ""}</span>
                      <span className="text-gray-400 font-mono">{over(row.strokes - par)}</span>
                      <span className="text-white font-mono font-bold w-8 text-right">{row.strokes}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>

        <button type="button" onClick={onClose} className={`${btn} w-full`}>Done</button>
      </div>
    </div>
  );
}

// Browse the global (Supabase) leaderboard for any course from the title
// screen. Daily uses today's seed; Glendoveer & Winthrop are all-time.
function LeaderboardPanel({ onClose }: { onClose: () => void }) {
  type Board = { key: "course" | "winthrop" | "daily"; label: string; courseKey: string; par: number };
  const [boards] = useState<Board[]>(() => {
    const dSeed = dailySeed();
    const dPar = buildRound(dSeed, "daily").reduce((s, h) => s + h.par, 0);
    return [
      { key: "course", label: "Glendoveer", courseKey: "glendoveer", par: TOTAL_PAR },
      { key: "winthrop", label: "Winthrop", courseKey: "winthrop", par: WINTHROP_PAR },
      { key: "daily", label: "Daily", courseKey: `daily-${dSeed}`, par: dPar },
    ];
  });
  const [pick, setPick] = useState<Board>(boards[0]);
  const [rows, setRows] = useState<ArcadeScore[] | null>(null);
  const over = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
  const seg = (active: boolean) =>
    `flex-1 rounded-md px-2 py-2 text-xs font-bold transition ${active ? "bg-[#4B3DFF] text-white" : "text-gray-400 hover:text-white"}`;
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let active = true;
    setRows(null);
    getArcadeLeaderboard(pick.courseKey, 25).then((r) => { if (active) setRows(r); }).catch(() => { if (active) setRows([]); });
    return () => { active = false; };
  }, [pick]);
  /* eslint-enable react-hooks/set-state-in-effect */
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-3 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">🏆 Leaderboards</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="flex gap-1 bg-[#1a1d23] border border-white/10 rounded-lg p-1">
          {boards.map((b) => (
            <button key={b.key} type="button" onClick={() => setPick(b)} className={seg(pick.key === b.key)}>{b.label}</button>
          ))}
        </div>
        <p className="text-gray-500 text-[11px]">
          {pick.key === "daily" ? "Today's course · par " : "All-time · par "}{pick.par}
        </p>
        <div className="bg-[#1a1d23] border border-white/5 rounded-2xl overflow-hidden">
          {rows === null ? (
            <p className="text-gray-400 text-sm text-center py-6">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">No scores yet — be the first!</p>
          ) : (
            <ol>
              {rows.map((row, i) => (
                <li
                  key={`${row.name}-${row.created_at}`}
                  className={`flex items-center gap-3 px-4 py-2 text-sm ${i !== 0 ? "border-t border-white/5" : ""}`}
                >
                  <span className={`font-mono w-6 text-right ${i === 0 ? "text-[#f5d24a]" : "text-gray-400"}`}>{i + 1}</span>
                  <span className="text-white flex-1 truncate">{i === 0 ? "👑 " : ""}{row.name}</span>
                  <span className="text-gray-400 font-mono">{over(row.strokes - pick.par)}</span>
                  <span className="text-white font-mono font-bold w-8 text-right">{row.strokes}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <button type="button" onClick={onClose} className={`${btn} w-full`}>Done</button>
      </div>
    </div>
  );
}

function StatsPanel({ onClose }: { onClose: () => void }) {
  const [hist] = useState<{ mode: string; total: number; date: number; scores?: number[]; pars?: number[] }[]>(() => {
    try {
      const h = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
      return Array.isArray(h) ? h : [];
    } catch { return []; }
  });
  const byMode = (m: string) => hist.filter((r) => r.mode === m);
  const avg = (rows: { total: number }[]) => (rows.length ? (rows.reduce((s, r) => s + r.total, 0) / rows.length).toFixed(1) : "–");
  const best = (rows: { total: number }[]) => (rows.length ? Math.min(...rows.map((r) => r.total)) : null);
  // Score-type distribution over every recorded hole.
  const dist = { ace: 0, eagle: 0, birdie: 0, par: 0, bogey: 0, worse: 0 };
  let holesCounted = 0;
  for (const r of hist) {
    if (!r.scores || !r.pars) continue;
    r.scores.forEach((sc, i) => {
      const pr = r.pars![i];
      if (typeof sc !== "number" || typeof pr !== "number") return;
      holesCounted++;
      if (sc === 1) dist.ace++;
      else if (sc - pr <= -2) dist.eagle++;
      else if (sc - pr === -1) dist.birdie++;
      else if (sc === pr) dist.par++;
      else if (sc - pr === 1) dist.bogey++;
      else dist.worse++;
    });
  }
  const rowsFor: { label: string; rows: { total: number }[] }[] = [
    { label: "Glendoveer East", rows: byMode("course") },
    { label: "Winthrop Lake", rows: byMode("winthrop") },
    { label: "Daily Challenge", rows: byMode("daily") },
  ];
  const distRows = [
    { label: "Aces", n: dist.ace, color: "#f5d24a" },
    { label: "Eagles", n: dist.eagle, color: "#f5d24a" },
    { label: "Birdies", n: dist.birdie, color: "#36D7B7" },
    { label: "Pars", n: dist.par, color: "#cbd5e1" },
    { label: "Bogeys", n: dist.bogey, color: "#e0923b" },
    { label: "Double+", n: dist.worse, color: "#e23b3b" },
  ];
  const maxN = Math.max(1, ...distRows.map((d) => d.n));
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-4 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">Stats</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        {hist.length === 0 ? (
          <p className="text-gray-400 text-sm">No rounds yet — play one and come back!</p>
        ) : (
          <>
            <p className="text-gray-400 text-xs">{hist.length} round{hist.length === 1 ? "" : "s"} played</p>
            <div className="space-y-1.5">
              {rowsFor.map(({ label, rows }) => (
                <div key={label} className="flex items-center justify-between bg-[#1a1d23] border border-white/10 rounded-lg px-3 py-2 text-sm">
                  <span className="text-white font-semibold">{label}</span>
                  <span className="text-gray-400 font-mono text-xs">
                    {rows.length} rds{best(rows) != null ? ` · best ${best(rows)}` : ""} · avg {avg(rows)}
                  </span>
                </div>
              ))}
            </div>
            {holesCounted > 0 && (
              <div>
                <p className="text-gray-400 text-xs font-semibold mb-1.5">Scoring ({holesCounted} holes)</p>
                <div className="space-y-1">
                  {distRows.map((d) => (
                    <div key={d.label} className="flex items-center gap-2 text-xs">
                      <span className="w-14 text-gray-400">{d.label}</span>
                      <div className="flex-1 h-3 bg-white/5 rounded overflow-hidden">
                        <div className="h-full rounded" style={{ width: `${(d.n / maxN) * 100}%`, background: d.color }} />
                      </div>
                      <span className="w-8 text-right text-white font-mono">{d.n}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        <button type="button" onClick={onClose} className={`${btn} w-full`}>Done</button>
      </div>
    </div>
  );
}

// Pick any hole on either course and grind it — practice rounds don't count
// toward bests, history, achievements, or leaderboards.
function PracticePanel({ onClose, onPick, onMini, onHowTo }: {
  onClose: () => void;
  onPick: (m: Mode, holeIdx: number, seed?: number) => void;
  onMini: (kind: "putt" | "target") => void;
  onHowTo: () => void;
}) {
  // Every premade course — the two championship layouts + every pro-tour venue.
  const allCourses = useMemo(() => [...FIXED_COURSES, ...TOUR_COURSE_INFOS], []);
  const [course, setCourse] = useState<CourseInfo>(allCourses[0]);
  // Glendoveer per-hole bests, read once when the panel opens.
  const [holeBest] = useState<(number | null)[]>(() => {
    try {
      const hb = JSON.parse(localStorage.getItem(HOLEBEST_KEY) || "null");
      return Array.isArray(hb) ? hb : [];
    } catch { return []; }
  });
  const key = (c: CourseInfo) => (c.seed != null ? `tour-${c.seed}` : c.mode);
  const holes = courseHoles(course.mode, course.seed);
  return (
    <div className="absolute inset-0 z-20 bg-[#0f1117]/95 backdrop-blur-sm rounded-lg flex flex-col">
      <div className="w-full max-w-xs mx-auto flex flex-col h-full px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] text-left">
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-white font-black text-xl">Practice</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onHowTo} className="rounded-lg border border-white/15 hover:border-white/35 text-gray-200 hover:text-white text-xs font-semibold px-2.5 py-1.5 transition">📖 How to Play</button>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
          </div>
        </div>
        {/* Skill mini-games */}
        <div className="flex gap-2 mt-3 shrink-0">
          <button type="button" onClick={() => onMini("putt")} className="flex-1 rounded-lg bg-[#1a1d23] border border-[#36D7B7]/50 hover:border-[#36D7B7] py-2.5 transition">
            <span className="block text-white font-bold text-sm">⛳ Putting</span>
            <span className="block text-gray-500 text-[10px]">sink it to advance</span>
          </button>
          <button type="button" onClick={() => onMini("target")} className="flex-1 rounded-lg bg-[#1a1d23] border border-[#36D7B7]/50 hover:border-[#36D7B7] py-2.5 transition">
            <span className="block text-white font-bold text-sm">🎯 Target</span>
            <span className="block text-gray-500 text-[10px]">hit the bullseye</span>
          </button>
        </div>
        <p className="text-gray-500 text-[11px] font-semibold uppercase tracking-wide pt-2.5 shrink-0">Or grind any hole</p>
        {/* Course picker — all premade courses */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 mt-1 -mx-1 px-1 shrink-0" style={{ scrollbarWidth: "thin" }}>
          {allCourses.map((c) => {
            const sel = key(c) === key(course);
            return (
              <button key={key(c)} type="button" onClick={() => setCourse(c)}
                className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold whitespace-nowrap transition ${sel ? "bg-[#4B3DFF] text-white" : "bg-[#1a1d23] border border-white/10 text-gray-300 hover:border-white/25"}`}>
                {c.name}
              </button>
            );
          })}
        </div>
        <p className="text-gray-500 text-[11px] mt-1.5 shrink-0">{course.name} · pick a hole — practice doesn&apos;t count toward bests or boards.</p>
        <div className="flex-1 overflow-y-auto mt-2 pr-0.5 -mr-0.5">
          <div className="grid grid-cols-3 gap-1.5">
            {holes.map((h, i) => {
              const best = course.mode === "course" ? holeBest[i] : null;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onPick(course.mode, i, course.seed)}
                  className="rounded-lg bg-[#1a1d23] border border-white/10 hover:border-[#36D7B7]/60 px-2 py-2 text-left transition"
                >
                  <span className="block text-white font-bold text-sm leading-none">{i + 1}</span>
                  <span className="block text-gray-500 text-[10px] mt-1">
                    par {h.par}{best != null ? ` · best ${best}` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel(props: {
  onClose: () => void;
  throwStyle: "BH" | "FH";
  setThrowStyle: (s: "BH" | "FH") => void;
  musicVolume: number;
  setMusicVolume: (v: number) => void;
  leftHanded: boolean;
  setLeftHanded: (b: boolean) => void;
  showGhost: boolean;
  setShowGhost: (b: boolean) => void;
  muted: boolean;
  onToggleSound: () => void;
  unlocked: string[];
}) {
  const { onClose, throwStyle, setThrowStyle, musicVolume, setMusicVolume, leftHanded, setLeftHanded, showGhost, setShowGhost, muted, onToggleSound, unlocked } = props;
  const seg = (active: boolean) =>
    `flex-1 rounded-md px-2 py-2 text-xs font-bold transition ${active ? "bg-[#4B3DFF] text-white" : "text-gray-400 hover:text-white"}`;
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-4 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">Settings</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div>
          <p className="text-gray-400 text-xs font-semibold mb-1">Default stance</p>
          <div className="flex gap-1 bg-[#1a1d23] border border-white/10 rounded-lg p-1">
            <button type="button" onClick={() => setThrowStyle("BH")} className={seg(throwStyle === "BH")}>Backhand</button>
            <button type="button" onClick={() => setThrowStyle("FH")} className={seg(throwStyle === "FH")}>Forehand</button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setLeftHanded(!leftHanded)}
          className="w-full flex items-center justify-between bg-[#1a1d23] border border-white/10 rounded-lg px-3 py-2.5"
        >
          <span className="text-white text-sm font-semibold">Left-handed</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${leftHanded ? "bg-[#36D7B7] text-[#0f1117]" : "bg-white/10 text-gray-400"}`}>
            {leftHanded ? "ON" : "OFF"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setShowGhost(!showGhost)}
          className="w-full flex items-center justify-between bg-[#1a1d23] border border-white/10 rounded-lg px-3 py-2.5"
        >
          <span className="text-left">
            <span className="block text-white text-sm font-semibold">Best-round ghost</span>
            <span className="block text-gray-500 text-[11px]">Show your record round&apos;s flight lines while you play</span>
          </span>
          <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded ${showGhost ? "bg-[#36D7B7] text-[#0f1117]" : "bg-white/10 text-gray-400"}`}>
            {showGhost ? "ON" : "OFF"}
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleSound}
          className="w-full flex items-center justify-between bg-[#1a1d23] border border-white/10 rounded-lg px-3 py-2.5"
        >
          <span className="text-white text-sm font-semibold">Sound</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${!muted ? "bg-[#36D7B7] text-[#0f1117]" : "bg-white/10 text-gray-400"}`}>
            {!muted ? "ON" : "OFF"}
          </span>
        </button>

        <div>
          <p className="text-gray-400 text-xs font-semibold mb-1">Music volume</p>
          <input
            type="range" min={0} max={1} step={0.05} value={musicVolume}
            onChange={(e) => setMusicVolume(Number(e.target.value))}
            className="w-full accent-[#36D7B7]"
          />
        </div>

        <div>
          <p className="text-gray-400 text-xs font-semibold mb-2">Achievements ({unlocked.length}/{ACHIEVEMENTS.length})</p>
          <div className="space-y-1.5">
            {ACHIEVEMENTS.map((a) => {
              const got = unlocked.includes(a.id);
              return (
                <div key={a.id} className={`flex items-center gap-2 text-sm ${got ? "" : "opacity-40"}`}>
                  <span className="text-lg">{got ? a.emoji : "🔒"}</span>
                  <span className="text-white font-semibold shrink-0">{a.name}</span>
                  <span className="text-gray-500 text-xs flex-1 truncate">— {a.desc}</span>
                  <span className={`font-mono text-xs shrink-0 inline-flex items-center gap-1 ${got ? "text-gray-600" : "text-[#f5d24a]"}`}>{got ? "✓" : <>+{a.coins} <Coin className="!w-2.5 !h-2.5" /></>}</span>
                </div>
              );
            })}
          </div>
        </div>

        <button type="button" onClick={onClose} className={`${btn} w-full`}>Done</button>
      </div>
    </div>
  );
}

// The Disc Golf Arcade mark, reused on the auth panel.
function DiscMark({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="drop-shadow">
      <g stroke="#2a7d70" strokeWidth="2" strokeLinecap="round">
        <line x1="2" y1="12.5" x2="8" y2="12.5" /><line x1="1" y1="18" x2="7" y2="18" />
      </g>
      <ellipse cx="18.5" cy="16.5" rx="11" ry="5" fill="#1f9e8c" />
      <ellipse cx="18.5" cy="14.8" rx="11" ry="5" fill="#36D7B7" />
      <ellipse cx="18.5" cy="14" rx="6.5" ry="2.4" fill="#5fe6d2" />
    </svg>
  );
}
function AuthPanel(props: {
  onClose: () => void;
  user: { email: string } | null;
  recovering: boolean;
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  busy: boolean; error: string | null; message: string | null;
  clearFeedback: () => void;
  onSignIn: () => void; onSignUp: () => void; onSignOut: () => void;
  onResetPassword: () => void; onUpdatePassword: () => void;
}) {
  const { onClose, user, recovering, email, setEmail, password, setPassword, busy, error, message, clearFeedback, onSignIn, onSignUp, onSignOut, onResetPassword, onUpdatePassword } = props;
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showPw, setShowPw] = useState(false);
  const switchTo = (m: "login" | "signup") => { if (m !== mode) { setMode(m); clearFeedback(); } };
  const seg = (active: boolean) =>
    `flex-1 rounded-md py-1.5 text-sm font-bold transition ${active ? "bg-[#4B3DFF] text-white shadow" : "text-gray-400 hover:text-white"}`;
  const input = "w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#4B3DFF] transition";
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs my-auto">
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none -mt-1">×</button>
        </div>

        {recovering ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center gap-1.5">
              <DiscMark />
              <h2 className="text-white font-black text-xl">Set a new password</h2>
              <p className="text-gray-500 text-xs px-2">Choose a new password for your account.</p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (!busy && password) onUpdatePassword(); }} className="space-y-3">
              <div className="relative">
                <input type={showPw ? "text" : "password"} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password (min 6 characters)" className={`${input} pr-14`} />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-[11px] font-bold px-1">{showPw ? "HIDE" : "SHOW"}</button>
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              {message && <p className="text-[#36D7B7] text-xs">{message}</p>}
              <button type="submit" disabled={busy || !password} className="w-full bg-[#4B3DFF] hover:bg-[#3a2ee0] active:scale-[0.99] text-white font-bold py-2.5 rounded-lg transition disabled:opacity-50">
                {busy ? "…" : "Update password"}
              </button>
            </form>
          </div>
        ) : user ? (
          <div className="space-y-4 text-center">
            <div className="flex flex-col items-center gap-2">
              <DiscMark />
              <h2 className="text-white font-black text-xl">Account</h2>
            </div>
            <div className="bg-[#1a1d23] border border-white/10 rounded-xl px-3 py-3">
              <p className="text-gray-500 text-[11px] uppercase tracking-wide font-semibold">Signed in as</p>
              <p className="text-white font-semibold break-all text-sm mt-0.5">{user.email}</p>
            </div>
            <p className="text-[#36D7B7] text-xs font-semibold">✓ Best scores, coins &amp; achievements sync across devices.</p>
            <button type="button" onClick={onSignOut} className="w-full bg-[#1a1d23] border border-white/15 hover:border-white/35 text-white font-bold py-2.5 rounded-lg transition">Log out</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center gap-1.5">
              <DiscMark />
              <h2 className="text-white font-black text-xl">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
              <p className="text-gray-500 text-xs px-2">
                {mode === "login" ? "Log in to pick up your progress on any device." : "Sign up to save your progress to the cloud."}
              </p>
            </div>

            {/* Separate Log in / Sign up modes */}
            <div className="flex gap-1 bg-[#1a1d23] border border-white/10 rounded-lg p-1">
              <button type="button" onClick={() => switchTo("login")} className={seg(mode === "login")}>Log in</button>
              <button type="button" onClick={() => switchTo("signup")} className={seg(mode === "signup")}>Sign up</button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); if (!busy && email && password) (mode === "login" ? onSignIn() : onSignUp()); }} className="space-y-3">
              <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={input} />
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "login" ? "Password" : "Password (min 6 characters)"}
                  className={`${input} pr-14`}
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-[11px] font-bold px-1">
                  {showPw ? "HIDE" : "SHOW"}
                </button>
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}
              {message && <p className="text-[#36D7B7] text-xs">{message}</p>}

              <button type="submit" disabled={busy || !email || !password} className="w-full bg-[#4B3DFF] hover:bg-[#3a2ee0] active:scale-[0.99] text-white font-bold py-2.5 rounded-lg transition disabled:opacity-50">
                {busy ? "…" : mode === "login" ? "Log in" : "Create account"}
              </button>
            </form>

            {mode === "login" && (
              <button type="button" onClick={onResetPassword} disabled={busy} className="w-full text-center text-gray-500 hover:text-gray-300 text-[11px] transition disabled:opacity-50">
                Forgot password?
              </button>
            )}

            <p className="text-center text-gray-500 text-xs">
              {mode === "login" ? (
                <>New here? <button type="button" onClick={() => switchTo("signup")} className="text-[#36D7B7] font-semibold hover:brightness-110">Create an account</button></>
              ) : (
                <>Already have an account? <button type="button" onClick={() => switchTo("login")} className="text-[#36D7B7] font-semibold hover:brightness-110">Log in</button></>
              )}
            </p>
            <p className="text-gray-600 text-[11px] text-center">Your scores also save on this device without an account.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Flight trail rendering ────────────────────────────────────────────────
function hexRGB(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
// A color sampled from a palette at t∈[0,1] (tail→head), linearly interpolated.
function paletteAt(cols: string[], t: number): [number, number, number] {
  if (cols.length === 0) return [255, 255, 255];
  if (cols.length === 1) return hexRGB(cols[0]);
  const seg = t * (cols.length - 1);
  const i = Math.min(cols.length - 2, Math.floor(seg));
  const f = seg - i;
  const a = hexRGB(cols[i]);
  const b = hexRGB(cols[i + 1]);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
// Draw the cosmetic flight trail along the disc's path (world coords; `cam` is
// the vertical camera offset). Fades and tapers toward the tail; `kind` styles
// it. Only the most-recent points are drawn (older ones scroll off-screen).
function drawTrail(ctx: CanvasRenderingContext2D, pts: Vec[], cam: number, trail: Trail | undefined, now: number) {
  if (!trail || trail.kind === "none" || pts.length < 2) return;
  // Keep this cheap: a short tail and no per-segment shadowBlur (which tanks the
  // frame rate on mobile, slowing the whole fixed-step sim). Glow kinds get a
  // SINGLE blurred underlay stroke instead of one per segment.
  const start = Math.max(1, pts.length - 56);
  const n = pts.length;
  const span = Math.max(1, n - 1 - (start - 1));
  const widen = trail.kind === "shadow" ? 1.8 : 1;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  // One blurred halo pass for glow trails (cheap: a single stroke, not N).
  if (trail.kind === "neon" || trail.kind === "fire" || trail.kind === "ice") {
    ctx.shadowBlur = 6;
    ctx.shadowColor = trail.colors[trail.colors.length - 1] || "#ffffff";
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 2.4 * widen;
    ctx.beginPath();
    ctx.moveTo(pts[start - 1].x, pts[start - 1].y - cam);
    for (let i = start; i < n; i++) ctx.lineTo(pts[i].x, pts[i].y - cam);
    ctx.stroke();
    ctx.shadowBlur = 0; // colored segments below draw without the costly shadow
  }
  for (let i = start; i < n; i++) {
    const t = (i - start) / span; // 0 tail → 1 head
    const alpha = 0.1 + 0.78 * t;
    ctx.lineWidth = (0.5 + 2.3 * t) * widen;
    if (trail.kind === "rainbow") {
      const hue = (t * 280 + now * 0.05) % 360;
      ctx.strokeStyle = `hsla(${hue}, 90%, 62%, ${alpha})`;
    } else {
      const rgb = paletteAt(trail.colors, t);
      const mul = trail.kind === "fire" ? 0.8 + 0.2 * Math.sin(now * 0.025 + i * 0.6) : 1;
      ctx.strokeStyle = `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${alpha * mul})`;
    }
    ctx.beginPath();
    ctx.moveTo(pts[i - 1].x, pts[i - 1].y - cam);
    ctx.lineTo(pts[i].x, pts[i].y - cam);
    ctx.stroke();
  }
  // Sparkle: a few cheap twinkling motes (no shadow).
  if (trail.kind === "sparkle") {
    for (let i = start + 2; i < n; i += 4) {
      const t = (i - start) / span;
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(now * 0.01 + i * 1.7));
      const rgb = paletteAt(trail.colors, t);
      ctx.fillStyle = `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${tw * (0.25 + 0.75 * t)})`;
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y - cam, 0.6 + 1.0 * tw * t, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawTree(ctx: CanvasRenderingContext2D, tr: Tree) {
  // Trunk (taller, to read as a full-height tree you can't throw over).
  ctx.fillStyle = "#5a3a1a";
  ctx.fillRect(Math.round(tr.x) - 1, Math.round(tr.y), 3, tr.r + 7);
  // Dark base ring + a canopy lifted slightly for a touch of height.
  ctx.fillStyle = "#225e1f";
  ctx.beginPath();
  ctx.arc(tr.x, tr.y + 1, tr.r + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2f6b2a";
  ctx.beginPath();
  ctx.arc(tr.x, tr.y - 2, tr.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3f8a37";
  ctx.beginPath();
  ctx.arc(tr.x - tr.r * 0.3, tr.y - tr.r * 0.45, tr.r * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawBasket(ctx: CanvasRenderingContext2D, x: number, y: number, catchR = CATCH_R, skin?: BasketSkin) {
  const s = skin ?? BASKET_SKINS[0];
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.beginPath();
  ctx.arc(x, y, catchR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = s.pole;
  ctx.fillRect(Math.round(x) - 1, Math.round(y) - 2, 2, 12);
  ctx.fillStyle = s.base;
  ctx.fillRect(Math.round(x) - 4, Math.round(y) + 10, 8, 2);
  ctx.fillStyle = s.band;
  ctx.fillRect(Math.round(x) - 5, Math.round(y) - 8, 10, 3);
  ctx.fillStyle = s.chains;
  for (let i = -3; i <= 3; i += 3) ctx.fillRect(Math.round(x) + i, Math.round(y) - 5, 1, 5);
}
