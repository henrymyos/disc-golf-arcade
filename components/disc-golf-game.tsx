"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { submitArcadeScore, getArcadeLeaderboard } from "@/actions/arcade";
import type { ArcadeScore } from "@/lib/arcade-types";
import { getSupabase } from "@/lib/supabase/browser";
import {
  BEST_KEY, WBEST_KEY, HOLEBEST_KEY, SETTINGS_KEY, ACH_KEY, HIST_KEY, CAREER_KEY, COINS_KEY, DAILY_KEY,
  readLocalProgress, applyProgress, mergeProgress, type Progress,
} from "@/lib/progress";
import {
  dayNumber, claimDailyReward, dailyAvailable, coinsForRound, fmtCoins, type DailyReward,
} from "@/lib/discgolf/wallet";
import {
  W, H, DISC_R, CATCH_R, MAX_DRAG, CANCEL_R, CANCEL_POWER, HOLES, TOTAL_PAR, WINTHROP_HOLES, WINTHROP_PAR, leaderboardCourse, TOURN_KEY, TOURN_NAMES, tournFieldRound, tournLiveStandings, tournStandings, ACHIEVEMENTS, earnedAchievements, scoreLabel, STRAIGHT_SPEED_MUL, releaseSpeedMul, DISCS, ADV_DISCS, activeDiscs, DISC_UNLOCKS, validDiscIndex, aimAt, camXFor, buildTournGhosts, buildRacerGhosts, ghostPosAt, AudioEngine, inRect, inHazard, offRibbons, dailySeed, buildRound, elevAt, vibrate, fullPowerRange, lastInBoundsLie, stepFlight,
} from "@/lib/discgolf/engine";
import type {
  Vec, Tree, Hole, Mode, Tournament, TournLiveRow, Achievement, FlightPath, Release, Flight, GhostState,
} from "@/lib/discgolf/engine";
import { challengeParam } from "@/lib/discgolf/challenge";
import {
  newCareer, normalizeCareer, skillMods, seasonSchedule, simEvent, recordResult, advanceSeason, retire, seasonComplete,
  placeLabel, STAGE_LABEL, SKILL_KEYS, SKILL_LABEL, SKILL_DESC, IDENTITY_MODS,
  availableSponsors, signSponsor, trainingPointCost, buyTrainingPoint, topRivals, fmtCash, SPONSOR_CAP,
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
type ResumeSnap = { v: 1; mode: Mode; seed: number; scores: number[]; advanced: boolean };
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
type Screen = "title" | "playing" | "holeComplete" | "gameComplete";

type GameState = {
  holeIndex: number;
  phase: Phase;
  mode: Mode; // daily challenge vs the full course
  practice?: boolean; // single-hole practice (no bests/history/leaderboard)
  practiceHole?: number; // 1-based hole number being practiced
  party?: { names: string[]; current: number; scores: (number | null)[][] }; // hot-seat pass-and-play
  online?: boolean; // online Friendly Challenge round (scores synced over Realtime)
  advanced: boolean; // advanced bag (real discs) vs simple (putter/mid/driver)
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
// hand-authored courses here.
type CourseInfo = { mode: Mode; name: string; holes: number; par: number; blurb: string };
const FIXED_COURSES: CourseInfo[] = [
  { mode: "course", name: "Glendoveer East", holes: 18, par: TOTAL_PAR, blurb: "Northwest Championship — a center pond, hard doglegs and tree-gate greens." },
  { mode: "winthrop", name: "Winthrop Lake", holes: 18, par: WINTHROP_PAR, blurb: "College Nationals — the lake guards the whole front, rope-hazard golf in the middle." },
];

export function DiscGolfGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  // Drag-to-throw (Wii-golf style): pull back to set power + aim, release to throw.
  const dragRef = useRef<{ active: boolean; cx: number; cy: number }>({ active: false, cx: 0, cy: 0 });
  const camRef = useRef({ x: 0, y: 0 }); // current camera scroll, mirrored for the pointer handlers
  const ghostRef = useRef<Vec[][][] | null>(null); // best-round flight paths for the active course
  const rangeFlashRef = useRef(0); // when a disc was last switched (brightens the reach line)
  // Juice: short-lived particles (world coords), camera shake, basket rattle.
  type Particle = { x: number; y: number; vx: number; vy: number; g: number; life: number; max: number; color: string; size: number };
  const particlesRef = useRef<Particle[]>([]);
  const shakeRef = useRef({ until: 0, mag: 0 });
  const rattleRef = useRef(0); // timestamp the basket chains were last hit
  const ghostsRef = useRef<GhostState | null>(null); // tournament rivals playing the current hole
  const audioRef = useRef<AudioEngine | null>(null);
  const rafRef = useRef<number>(0);

  const [screen, setScreen] = useState<Screen>("title");
  const [muted, setMuted] = useState(false);
  const [discIndex, setDiscIndex] = useState(1); // Mid by default
  const [throwStyle, setThrowStyle] = useState<"BH" | "FH">("BH");
  const [flightPath, setFlightPath] = useState<FlightPath>("overstable");
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
  const [pauseMenu, setPauseMenu] = useState<{ canRestart: boolean } | null>(null); // in-round menu (restart / home / continue)
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
  const [nameInput, setNameInput] = useState("");
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

  const flightPathRef = useRef<FlightPath>("overstable");
  useEffect(() => {
    flightPathRef.current = flightPath;
  }, [flightPath]);

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
  const [advanced, setAdvanced] = useState(false);
  const advancedRef = useRef(false);
  useEffect(() => { advancedRef.current = advanced; }, [advanced]);
  const modeRef = useRef<Mode>("course");

  // Best-per-hole, achievements, round history (all persisted).
  const holeBestRef = useRef<(number | null)[]>(Array(18).fill(null));
  const [holeBestNote, setHoleBestNote] = useState<{ best: number; isNew: boolean } | null>(null);
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const unlockedRef = useRef<string[]>([]);
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const [roundsPlayed, setRoundsPlayed] = useState(0);
  const roundsPlayedRef = useRef(0);

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
      if (s.flightPath === "overstable" || s.flightPath === "straight") setFlightPath(s.flightPath);
      if (s.release === "hyzer" || s.release === "flat" || s.release === "anny") setRelease(s.release);
      if (typeof s.musicVolume === "number") setMusicVolume(s.musicVolume);
      if (typeof s.leftHanded === "boolean") setLeftHanded(s.leftHanded);
      if (typeof s.showGhost === "boolean") setShowGhost(s.showGhost);
      if (typeof s.advanced === "boolean") setAdvanced(s.advanced);
      if (typeof s.muted === "boolean") setMuted(s.muted);

      const hb = JSON.parse(localStorage.getItem(HOLEBEST_KEY) || "null");
      holeBestRef.current = Array(18).fill(null).map((_, i) => (Array.isArray(hb) && typeof hb[i] === "number" ? hb[i] : null));
      const ach = JSON.parse(localStorage.getItem(ACH_KEY) || "[]");
      if (Array.isArray(ach)) { unlockedRef.current = ach; setUnlocked(ach); }
      const hist = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
      if (Array.isArray(hist)) { roundsPlayedRef.current = hist.length; setRoundsPlayed(hist.length); }
      const tourn = JSON.parse(localStorage.getItem(TOURN_KEY) || "null");
      if (tourn && typeof tourn.seed === "number" && Array.isArray(tourn.myTotals)) setTournament(tourn);
      setResumeRound(readResume());
      const car = JSON.parse(localStorage.getItem(CAREER_KEY) || "null");
      if (car && car.v === 1 && car.skills) { const nc = normalizeCareer(car); setCareer(nc); careerRef.current = nc; }
      const coinRaw = localStorage.getItem(COINS_KEY);
      const co = coinRaw != null && Number.isFinite(Number(coinRaw)) ? Number(coinRaw) : 0;
      coinsRef.current = co; setCoins(co);
      setDaily(JSON.parse(localStorage.getItem(DAILY_KEY) || "null"));
      setToday(dayNumber(Date.now()));
    } catch {
      /* ignore */
    }
  }, []);

  // Snapshot / clear the resumable solo round.
  const persistResume = useCallback((g: GameState) => {
    if (g.practice || g.party || g.online || g.career || tournamentPlayRef.current || challengePlayRef.current || careerPlayRef.current) return;
    const scores = g.scores.slice(0, g.holeIndex + 1).map((n) => n ?? 0);
    try {
      localStorage.setItem(RESUME_KEY, JSON.stringify({ v: 1, mode: g.mode, seed: g.seed, scores, advanced: g.advanced }));
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

  // ── Optional login + cloud progress (Supabase auth user_metadata) ──
  const supa = getSupabase();
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Push the current local progress up to the signed-in user's metadata.
  const pushCloud = useCallback(async (p?: Progress) => {
    if (!supa) return;
    try {
      const { data } = await supa.auth.getUser();
      if (!data.user) return;
      await supa.auth.updateUser({ data: { arcade_progress: p ?? readLocalProgress() } });
    } catch { /* ignore */ }
  }, [supa]);

  // Debounced cloud save (called after rounds, hole bests, settings changes).
  const saveProgress = useCallback(() => {
    if (!supa || !user) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void pushCloud(); }, 1200);
  }, [supa, user, pushCloud]);

  // On sign-in (and at startup if already signed in), merge cloud progress with
  // local so nothing is lost, then write the union back.
  useEffect(() => {
    if (!supa) return;
    let active = true;
    const onSession = async (sessUser: { email?: string; user_metadata?: { arcade_progress?: Progress } } | null) => {
      if (!active) return;
      if (!sessUser) { setUser(null); return; }
      setUser({ email: sessUser.email ?? "player" });
      const cloud = sessUser.user_metadata?.arcade_progress;
      const merged = cloud ? mergeProgress(readLocalProgress(), cloud) : readLocalProgress();
      if (cloud) { applyProgress(merged); loadLocal(); }
      await pushCloud(merged);
    };
    const { data: sub } = supa.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") void onSession(session?.user ?? null);
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
    else if (!data.session) setAuthMsg("Account created — check your email to confirm, then log in.");
    else { setAuthOpen(false); setAuthPassword(""); }
    setAuthBusy(false);
  }, [supa, authEmail, authPassword]);

  const signOut = useCallback(async () => {
    if (!supa) return;
    await supa.auth.signOut();
    setUser(null);
  }, [supa]);

  // Persist settings + push the music volume to the live engine.
  useEffect(() => {
    audioRef.current?.setMusicVolume(musicVolume);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ throwStyle, flightPath, release, musicVolume, leftHanded, advanced, showGhost, muted }));
    } catch { /* ignore */ }
    saveProgress();
  }, [throwStyle, flightPath, release, musicVolume, leftHanded, advanced, showGhost, muted, saveProgress]);

  // Sync the career save to the cloud whenever it changes (debounced; no-op
  // when signed out). localStorage is already written by saveCareer.
  useEffect(() => { if (career) saveProgress(); }, [career, saveProgress]);
  // Sync coins + daily-reward state to the cloud when they change.
  useEffect(() => { saveProgress(); }, [coins, daily, saveProgress]);

  const syncHud = useCallback(() => {
    const g = stateRef.current;
    if (!g) return;
    setHud({ hole: g.holeIndex + 1, par: g.roundHoles[g.holeIndex].par, throws: g.throws, holes: g.roundHoles.length, player: g.party ? g.party.names[g.party.current] : undefined });
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
    const seed = seedOverride ?? (m === "daily" ? dailySeed() : (Math.random() * 1e9) | 0);
    const roundHoles = buildRound(seed, m);
    const adv = advancedRef.current;
    const discIndex = validDiscIndex(adv, discIndexRef.current, unlockedRef.current);
    discIndexRef.current = discIndex;
    setDiscIndex(discIndex);
    stateRef.current = {
      holeIndex: 0, scores: [], discIndex, roundPaths: [],
      mode: m, advanced: adv, skill: IDENTITY_MODS, seed, roundHoles, ...freshHole(roundHoles[0]),
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
    const adv = advancedRef.current;
    const discIndex = validDiscIndex(adv, discIndexRef.current, unlockedRef.current);
    discIndexRef.current = discIndex;
    setDiscIndex(discIndex);
    stateRef.current = {
      holeIndex: 0, scores: [], discIndex, roundPaths: [],
      mode: ev.mode, advanced: adv, skill: skillMods(c.skills),
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
    const adv = snap.advanced;
    const discIndex = validDiscIndex(adv, discIndexRef.current, unlockedRef.current);
    discIndexRef.current = discIndex;
    setDiscIndex(discIndex);
    stateRef.current = {
      holeIndex, scores: snap.scores.slice(), discIndex, roundPaths: [],
      mode: snap.mode, advanced: adv, skill: IDENTITY_MODS, seed: snap.seed, roundHoles, ...freshHole(roundHoles[holeIndex]),
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
  const startPractice = useCallback((m: Mode, holeIdx: number) => {
    modeRef.current = m;
    if (!audioRef.current) {
      audioRef.current = new AudioEngine();
      audioRef.current.setMusicVolume(musicVolume);
    }
    audioRef.current.resume();
    audioRef.current.setMuted(muted);
    audioRef.current.startMusic();
    challengePlayRef.current = false;
    const seed = (Math.random() * 1e9) | 0;
    const roundHoles = [buildRound(seed, m)[holeIdx]];
    const adv = advancedRef.current;
    const discIndex = validDiscIndex(adv, discIndexRef.current, unlockedRef.current);
    discIndexRef.current = discIndex;
    setDiscIndex(discIndex);
    stateRef.current = {
      holeIndex: 0, scores: [], discIndex, roundPaths: [],
      mode: m, advanced: adv, skill: IDENTITY_MODS, seed, roundHoles, practice: true, practiceHole: holeIdx + 1, ...freshHole(roundHoles[0]),
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
      mode: "course", advanced: false, skill: IDENTITY_MODS, seed: 0, roundHoles: [hole], practice: true,
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
    const adv = advancedRef.current;
    const discIndex = validDiscIndex(adv, discIndexRef.current, unlockedRef.current);
    discIndexRef.current = discIndex;
    setDiscIndex(discIndex);
    stateRef.current = {
      holeIndex: 0, scores: [], discIndex, roundPaths: [],
      mode: m, advanced: adv, skill: IDENTITY_MODS, seed, roundHoles, practice: true,
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
    const adv = advancedRef.current;
    const discIndex = validDiscIndex(adv, discIndexRef.current, unlockedRef.current);
    discIndexRef.current = discIndex;
    setDiscIndex(discIndex);
    onlineScoresRef.current = { [o.myId]: { name: o.myName, scores: [], total: 0, thru: 0 } };
    setOnlineScores(onlineScoresRef.current);
    stateRef.current = {
      holeIndex: 0, scores: [], discIndex, roundPaths: [],
      mode: m, advanced: adv, skill: IDENTITY_MODS, seed, roundHoles, online: true,
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
    // Locked advanced discs can't be selected until their achievement is earned.
    if (advancedRef.current) {
      const lock = DISC_UNLOCKS[ADV_DISCS[i]?.key ?? ""];
      if (lock && !unlockedRef.current.includes(lock.ach)) return;
    }
    setDiscIndex(i);
    if (stateRef.current) stateRef.current.discIndex = i;
    rangeFlashRef.current = performance.now(); // emphasize the reach line briefly
  }, []);

  // Toggling the advanced bag resets to a sensible default disc (the bags don't
  // line up index-for-index).
  const handleSetAdvanced = useCallback((v: boolean) => {
    setAdvanced(v);
    const def = v ? 4 : 1; // Teebird / Mid
    setDiscIndex(def);
    if (stateRef.current) stateRef.current.discIndex = Math.min(def, activeDiscs(v).length - 1);
  }, []);

  const throwDisc = useCallback(() => {
    const g = stateRef.current;
    if (!g || g.phase !== "aim") return;
    const disc = activeDiscs(g.advanced)[g.discIndex];
    // Advanced discs fly their baked-in shape (e.g. Nuke OS overstable,
    // Destroyer straight); simple mode uses the overstable/straight toggle.
    g.path = g.advanced ? disc.flight ?? "straight" : flightPathRef.current;
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
    // A played Career event: record the result against the career and pop back
    // to the hub instead of the normal results / leaderboard flow.
    if (g?.career && careerPlayRef.current) {
      careerPlayRef.current = false;
      const total = scores.reduce((s, n) => s + n, 0);
      const c = careerRef.current;
      const ev = careerEventRef.current;
      if (c && ev && !c.done.includes(ev.id)) {
        // Use the same conditions-aware field the live leaderboard was built from.
        const { career: nc, result } = recordResult(c, ev, total, true, careerFieldRef.current ?? undefined);
        saveCareer(nc);
        setCareerLastResult(result);
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
    } else {
      setIsNewBest(false);
    }

    // Round history + achievements only count for full rounds, not practice.
    if (!practice) {
      let hist: { mode: Mode; total: number; date: number; scores?: number[]; pars?: number[] }[] = [];
      try { hist = JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); } catch { /* ignore */ }
      hist.push({ mode, total, date: Date.now(), scores, pars });
      try { localStorage.setItem(HIST_KEY, JSON.stringify(hist.slice(-100))); } catch { /* ignore */ }
      roundsPlayedRef.current = hist.length;
      setRoundsPlayed(hist.length);

      const earned = earnedAchievements(scores, pars, mode, hist.length);
      const fresh = earned.filter((id) => !unlockedRef.current.includes(id));
      if (fresh.length) {
        const all = [...unlockedRef.current, ...fresh];
        unlockedRef.current = all;
        setUnlocked(all);
        try { localStorage.setItem(ACH_KEY, JSON.stringify(all)); } catch { /* ignore */ }
      }
      setNewAchievements(fresh.map((id) => ACHIEVEMENTS.find((a) => a.id === id)!).filter(Boolean));
    } else {
      setNewAchievements([]);
    }

    // Tournament round: record it, simulate the AI field, run the cut, and
    // crown a champion at the end.
    if (tournamentPlayRef.current) {
      tournamentPlayRef.current = false;
      const t = tournamentRef.current;
      if (t && !t.finished) {
        const roundIdx = t.myTotals.length;
        const myTotals = [...t.myTotals, total];
        const fieldTotals = [...t.fieldTotals, tournFieldRound(t.seed, roundIdx)];
        let madeCut = t.madeCut;
        let finished = false;
        if (roundIdx === 1) {
          const sums = [myTotals[0] + myTotals[1], ...fieldTotals[0].map((_, i) => fieldTotals[0][i] + fieldTotals[1][i])];
          const sorted = [...sums].sort((a, b) => a - b);
          const line = sorted[Math.floor(sorted.length / 2) - 1];
          madeCut = myTotals[0] + myTotals[1] <= line;
          if (!madeCut) {
            finished = true;
            fieldTotals.push(tournFieldRound(t.seed, 2)); // the field plays on
          }
        } else if (roundIdx === 2) {
          finished = true;
        }
        const next: Tournament = { ...t, myTotals, fieldTotals, madeCut, finished, round: roundIdx + 1 };
        saveTournament(next);
        if (finished && madeCut && tournStandings(next)[0]?.you && !unlockedRef.current.includes("natty")) {
          const all = [...unlockedRef.current, "natty"];
          unlockedRef.current = all;
          setUnlocked(all);
          try { localStorage.setItem(ACH_KEY, JSON.stringify(all)); } catch { /* ignore */ }
          setNewAchievements((prev) => [...prev, ACHIEVEMENTS.find((a) => a.id === "natty")!]);
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
    if (!practice) saveProgress(); // sync best/achievements/history to the cloud if signed in
    // Coins for a counting round (more for going low). Career events pay cash,
    // not coins, and are handled in their own branch above.
    if (!practice) { setCoinReward(coinsForRound(total - pars.reduce((s, n) => s + n, 0), pars.length)); addCoins(coinsForRound(total - pars.reduce((s, n) => s + n, 0), pars.length)); }
  }, [saveProgress, saveTournament, clearResume, saveCareer, addCoins]);

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
      discIndex: validDiscIndex(g.advanced, discIndexRef.current, unlockedRef.current),
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
    setPauseMenu(null);
    setResumeRound(readResume()); // surface "Resume" if we left a solo round mid-way
    if (wasCareer) setCareerOpen(true); // bail back to the career hub
    setScreen("title");
  }, [leaveLobby]);

  const saveScore = useCallback(async () => {
    if (saving || saved) return;
    setSaving(true);
    setSaveErr(null);
    try {
      const course = leaderboardCourse(finalMode, finalSeed);
      const res = await submitArcadeScore(nameInput, finalTotal, course);
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
  }, [saving, saved, nameInput, finalTotal, finalMode, finalSeed]);

  // Share a challenge link that replays this exact round (mode + seed).
  // Render the finished round to an image and share it (or download as fallback).
  const shareCard = useCallback(async () => {
    const total = finalTotal;
    const parTotal = finalPars.reduce((s, n) => s + n, 0);
    const over = total - parTotal;
    const nHoles = finalPars.length;
    const isDaily = finalMode === "daily";
    const courseLabel = isDaily ? "Daily Challenge" : finalMode === "winthrop" ? "Winthrop Lake" : "Glendoveer East";
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
  }, [finalTotal, finalPars, finalMode, scorecard]);

  // Share a challenge link that replays this exact round (same seed ⇒ same pins
  // + wind). Friends open it and play to beat your score; the link unfurls with
  // a generated OG preview (see app/page.tsx + app/og).
  const [challengeCopied, setChallengeCopied] = useState(false);
  const shareChallenge = useCallback(async () => {
    const name = nameInput.trim() || "A friend";
    const param = challengeParam(finalMode, finalSeed, finalTotal, name);
    const url = `${location.origin}/?ch=${param}`;
    const label = finalMode === "winthrop" ? "Winthrop Lake" : finalMode === "daily" ? "today's Daily" : "Glendoveer East";
    try {
      const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
      if (nav.share) {
        await nav.share({ title: "Disc Golf Arcade", text: `I shot ${finalTotal} on ${label}. Beat it!`, url });
        return;
      }
    } catch { /* fall through to clipboard */ }
    try {
      await navigator.clipboard.writeText(url);
      setChallengeCopied(true);
      setTimeout(() => setChallengeCopied(false), 2200);
    } catch { /* ignore */ }
  }, [nameInput, finalMode, finalSeed, finalTotal]);

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
        const n = Number(e.key) - 1;
        if (n < activeDiscs(advancedRef.current).length) selectDisc(n);
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
      if (tournamentPlayRef.current && tournamentRef.current && !tournamentRef.current.finished) {
        if (ghostsRef.current?.holeIndex !== g.holeIndex) {
          ghostsRef.current = buildTournGhosts(tournamentRef.current, g.holeIndex, hole, performance.now());
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
        const disc = activeDiscs(g.advanced)[g.discIndex];
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
          spawnBurst(hole.basket.x, hole.basket.y, ["#36D7B7", "#f5d24a", "#ffffff", "#4B3DFF"], under ? 70 : 36, under ? 2.6 : 1.9, 0.05, 40);
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
          if (tournamentPlayRef.current && tournamentRef.current && !tournamentRef.current.finished) {
            const myRoundSoFar = g.scores.reduce((a, b) => a + (b ?? 0), 0);
            setTournLiveView({ rows: tournLiveStandings(tournamentRef.current, myRoundSoFar, g.holeIndex + 1), thru: g.holeIndex + 1 });
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

      // Everything outside the fairway is rough — out of bounds normally, or
      // olive-tinted hazard ground on rope-lined holes (+1, play where it lies).
      ctx.fillStyle = hole.roughIsHazard ? "#535426" : "#2f5a26";
      ctx.fillRect(0, 0, W, H);
      // Darker rough mowing bands for a little texture.
      const startY = Math.floor(cam / 16) * 16;
      ctx.fillStyle = hole.roughIsHazard ? "#4b4c22" : "#2b5323";
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
        ctx.strokeStyle = "#4d9a39"; // fairway
        ctx.lineWidth = hole.fwWidth - 3;
        ctx.stroke();
        // Mowing stripes inside the fairway.
        ctx.strokeStyle = "#56a541";
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
      drawBasket(ctx, hole.basket.x + rattle, hole.basket.y - cam, g.skill.catchR);
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
        const aimDisc = activeDiscs(g.advanced)[g.discIndex];
        const lh2 = leftHandedRef.current ? -1 : 1;
        const sign = (throwStyleRef.current === "BH" ? -1 : 1) * lh2;
        const path: FlightPath = g.advanced ? aimDisc.flight ?? "straight" : flightPathRef.current;
        const dsx = g.disc.x;
        const dsy = g.disc.y - cam; // disc screen position

        // Full-power reach for the selected disc: a short tick showing how far it
        // carries. Only shown briefly when switching discs (fading out), and not
        // while lining up a shot. Points up the line toward the basket — or
        // straight up the screen when the basket is off-screen.
        {
          const since = performance.now() - rangeFlashRef.current;
          const SHOW_MS = 2000;
          if (!dr.active && since < SHOW_MS) {
            const range = fullPowerRange(aimDisc, elevAt(hole, g.disc.y), (path === "straight" ? STRAIGHT_SPEED_MUL : 1) * releaseSpeedMul(releaseRef.current) * g.skill.speedMul);
            const bsy = hole.basket.y - cam;
            const bsx = hole.basket.x - camX;
            const basketVisible = bsy >= 0 && bsy <= H && bsx >= 0 && bsx <= W;
            const ang = basketVisible ? g.angle : -Math.PI / 2; // straight up if off-screen
            const rx = g.disc.x + Math.cos(ang) * range;
            const ry = g.disc.y + Math.sin(ang) * range - cam;
            const half = 2 * CATCH_R; // full length = 2 basket diameters
            const px = -Math.sin(ang); // unit perpendicular to the throw line
            const py = Math.cos(ang);
            if (ry > 14 && ry < H - 2 && rx - camX > 2 && rx - camX < W - 2) {
              const a = Math.max(0, 0.9 * (1 - since / SHOW_MS)); // fade out
              ctx.save();
              ctx.globalAlpha = a;
              ctx.strokeStyle = aimDisc.color;
              ctx.lineWidth = 1.5;
              ctx.lineCap = "round";
              ctx.beginPath();
              ctx.moveTo(rx - px * half, ry - py * half);
              ctx.lineTo(rx + px * half, ry + py * half);
              ctx.stroke();
              ctx.lineCap = "butt";
              ctx.fillStyle = aimDisc.color;
              ctx.font = "7px monospace";
              ctx.textAlign = "center";
              ctx.textBaseline = "bottom";
              ctx.fillText(`${aimDisc.name} max`, rx, ry - half - 2);
              ctx.textBaseline = "middle";
              ctx.restore();
            }
          }
        }

        let kx: number;
        let ky: number;
        let power: number;
        if (dr.active) {
          // dr.cx/cy are screen coords; dsx is world-x (drawn under translate).
          let pullX = dr.cx + camX - dsx;
          let pullY = dr.cy - dsy;
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
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#ffffff";
          for (let i = 0; i < shown - 1; i++) {
            const t = i / (shown - 1);
            ctx.globalAlpha = Math.max(0.04, 0.95 * (1 - Math.pow(t, 1.4)));
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y - cam);
            ctx.lineTo(pts[i + 1].x, pts[i + 1].y - cam);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
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

      // Shadow on the ground + disc lifted by its height.
      const disc = activeDiscs(g.advanced)[g.discIndex];
      const dscreenY = g.disc.y - cam;
      const shadowR = Math.max(1.5, DISC_R - g.h * 0.03);
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath();
      ctx.ellipse(g.disc.x, dscreenY, shadowR, shadowR * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      const discY = dscreenY - g.h;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(g.disc.x, discY, DISC_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = disc.color;
      ctx.fillRect(Math.round(g.disc.x) - 1, Math.round(discY) - 1, 2, 2);

      // Particles (leaves, splashes, sand, confetti) fade out as they die.
      for (const pt of particlesRef.current) {
        ctx.globalAlpha = Math.max(0, pt.life / pt.max);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - pt.size / 2, pt.y - cam - pt.size / 2, pt.size, pt.size);
      }
      ctx.globalAlpha = 1;

      ctx.restore(); // end of world-space (horizontally panned) drawing

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

    function frame() {
      update();
      draw();
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [syncHud, persistResume, addCoins]);

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
  // Pull is measured from the disc itself, so the slider/knob stays attached to
  // it: drag the knob back, aim by its direction, release to throw the opposite way.
  const applyDrag = useCallback((g: GameState, px: number, py: number) => {
    const pullX = px - (g.disc.x - camRef.current.x); // disc's on-screen X
    const pullY = py - (g.disc.y - camRef.current.y); // disc's on-screen Y
    const dist = Math.hypot(pullX, pullY);
    g.power = Math.min(1, dist / MAX_DRAG);
    if (dist > 4) g.angle = Math.atan2(-pullY, -pullX); // throw opposite the pull
  }, []);
  function onCanvasDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (screenRef.current !== "playing" || pausedRef.current) return;
    const g = stateRef.current;
    if (!g || g.phase !== "aim") return;
    const p = clientToCanvas(e.clientX, e.clientY);
    dragRef.current = { active: true, cx: p.x, cy: p.y };
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
  const finalBest = finalMode === "course" ? bestScore : finalMode === "winthrop" ? winthropBest : null;
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

        {screen === "title" && (
          <div className="absolute inset-0 overflow-y-auto rounded-lg bg-gradient-to-b from-[#1c2233] via-[#141926] to-[#0f1117]">
            <div
              className="min-h-full flex items-center justify-center px-5"
              style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)", paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
            >
            <div className="w-full max-w-[290px] flex flex-col items-center text-center py-2">
              {/* Logo */}
              <div className="flex flex-col items-center gap-2">
                <svg width="44" height="44" viewBox="0 0 32 32" aria-hidden className="drop-shadow">
                  <g stroke="#2a7d70" strokeWidth="2" strokeLinecap="round">
                    <line x1="2" y1="12.5" x2="8" y2="12.5" /><line x1="1" y1="18" x2="7" y2="18" />
                  </g>
                  <ellipse cx="18.5" cy="16.5" rx="11" ry="5" fill="#1f9e8c" />
                  <ellipse cx="18.5" cy="14.8" rx="11" ry="5" fill="#36D7B7" />
                  <ellipse cx="18.5" cy="14" rx="6.5" ry="2.4" fill="#5fe6d2" />
                </svg>
                <h1 className="text-white font-black text-[26px] leading-none tracking-tight">
                  Disc Golf <span className="text-[#36D7B7]">Arcade</span>
                </h1>
              </div>
              <p className="text-gray-300 text-xs mt-2.5 font-medium">Pixel disc golf — wind, hills &amp; water.</p>
              <p className="text-gray-500 text-[11px] mt-1">Drag back from the disc to aim &amp; throw.</p>

              {/* Stat pills */}
              {(bestScore != null || winthropBest != null || roundsPlayed > 0) && (
                <div className="flex gap-2 mt-3">
                  {bestScore != null && (
                    <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5">
                      <p className="text-[#36D7B7] font-bold text-sm leading-none">{bestScore}</p>
                      <p className="text-gray-500 text-[9px] mt-0.5 uppercase tracking-wide">GE Best ({overStr(bestScore - TOTAL_PAR)})</p>
                    </div>
                  )}
                  {winthropBest != null && (
                    <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5">
                      <p className="text-[#f5d24a] font-bold text-sm leading-none">{winthropBest}</p>
                      <p className="text-gray-500 text-[9px] mt-0.5 uppercase tracking-wide">WL Best ({overStr(winthropBest - WINTHROP_PAR)})</p>
                    </div>
                  )}
                  {roundsPlayed > 0 && (
                    <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5">
                      <p className="text-white font-bold text-sm leading-none">{roundsPlayed}</p>
                      <p className="text-gray-500 text-[9px] mt-0.5 uppercase tracking-wide">Rounds</p>
                    </div>
                  )}
                </div>
              )}

              {/* Coins + daily reward */}
              <div className="w-full flex items-center gap-2 mt-3">
                <div className="flex items-center gap-1 rounded-lg bg-[#f5d24a]/10 border border-[#f5d24a]/30 px-2.5 py-1.5">
                  <span>🪙</span>
                  <span className="text-[#f5d24a] font-bold text-sm font-mono">{fmtCoins(coins)}</span>
                </div>
                {dailyAvailable(daily, today) ? (
                  <button type="button" onClick={claimDaily}
                    className="flex-1 rounded-lg bg-[#36D7B7] hover:bg-[#2bc4a6] active:scale-[0.99] text-[#0f1117] font-bold text-sm py-2 transition animate-pulse">
                    🎁 Claim daily reward
                  </button>
                ) : (
                  <div className="flex-1 rounded-lg border border-white/10 text-gray-400 text-xs font-semibold py-2 text-center">
                    🎁 Daily claimed · 🔥 {daily?.streak ?? 0}-day streak
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

              {/* Resume an interrupted solo round */}
              {resumeRound && (
                <button
                  type="button"
                  onClick={() => startResume(resumeRound)}
                  className="w-full rounded-xl border border-[#36D7B7]/60 bg-[#36D7B7]/15 hover:bg-[#36D7B7]/25 text-white font-bold py-3 px-3 mt-4 transition text-sm"
                >
                  ↻ Resume {resumeRound.mode === "course" ? "Glendoveer" : resumeRound.mode === "winthrop" ? "Winthrop Lake" : "Daily"} · hole {resumeRound.scores.length + 1}
                </button>
              )}

              {/* Primary actions */}
              <div className={`w-full flex flex-col gap-2 ${challenge || resumeRound ? "mt-2" : "mt-5"}`}>
                <button type="button" onClick={() => startGame("daily")} className={titleCard}>
                  🔥 Daily Challenge
                </button>
                <button type="button" onClick={() => setCoursesOpen(true)} className={titleCard}>
                  ⛳ Play Courses · {FIXED_COURSES.length}
                </button>
                <button type="button" onClick={() => { setCareerLastResult(null); setCareerNotes([]); setCareerOpen(true); }} className={titleCard}>
                  🌟 Career{career && !career.retired ? ` · ${STAGE_LABEL[career.stage]}, age ${career.age}` : ""}
                </button>
                <button type="button" onClick={() => setTournamentOpen(true)} className={titleCard}>
                  🏟 Tournament{tournament && !tournament.finished ? ` · R${tournament.myTotals.length + 1}` : ""}
                </button>
                <button type="button" onClick={() => setChallengeOpen(true)} className={titleCard}>
                  👥 Challenge Friends
                </button>
                <button type="button" onClick={() => setTutorialOpen(true)} className={titleCard}>
                  📖 How to Play
                </button>
              </div>
              <p className="text-gray-500 text-[10px] mt-1.5">Daily = a fresh 9-hole course, same for everyone</p>

              {/* Secondary actions */}
              <div className="w-full flex gap-2 mt-4">
                <button type="button" onClick={() => setBoardsOpen(true)} className={titleCardSm}>
                  🏆 Leaders
                </button>
                <button type="button" onClick={() => setPracticeOpen(true)} className={titleCardSm}>
                  🎯 Practice
                </button>
                <button type="button" onClick={() => setStatsOpen(true)} className={titleCardSm}>
                  📊 Stats
                </button>
              </div>
              <div className="w-full flex gap-2 mt-2">
                <button type="button" onClick={() => setSettingsOpen(true)} className={titleCardSm}>
                  ⚙ Settings
                </button>
                {supa && (
                  <button type="button" onClick={() => { setAuthErr(null); setAuthMsg(null); setAuthOpen(true); }} className={`${titleCardSm} truncate px-2`}>
                    {user ? `👤 ${user.email}` : "👤 Log in"}
                  </button>
                )}
              </div>
            </div>
            </div>
          </div>
        )}

        {screen === "holeComplete" && onlineView && (() => {
          const sl = scoreLabel(hud.throws, onlineView.par);
          const rows = Object.entries(onlineScores)
            .map(([id, s]) => ({ id, ...s }))
            .sort((a, b) => a.total - b.total);
          const lead = rows.length ? rows[0].total : 0;
          return (
            <Overlay>
              <p className="text-[#36D7B7] font-bold text-lg">Hole {onlineView.hole + 1} · {sl.emoji && `${sl.emoji} `}{sl.name}</p>
              <div className="w-full max-w-[260px] space-y-1">
                {rows.map((r) => (
                  <div key={r.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1.5 text-sm">
                    <span className="text-white font-semibold truncate">{r.total === lead ? "👑 " : ""}{r.id === onlineView.myId ? `${r.name} (you)` : r.name}</span>
                    <span className="text-gray-300 font-mono text-xs">thru {r.thru} · {r.total}</span>
                  </div>
                ))}
              </div>
              <button type="button" onClick={nextHole} className={btn}>
                {hud.hole >= hud.holes ? "See results ▶" : "Next hole ▶"}
              </button>
            </Overlay>
          );
        })()}
        {screen === "holeComplete" && partyView && (
          <Overlay>
            <p className="text-[#36D7B7] font-bold text-xl">Hole {hud.hole} complete</p>
            <div className="w-full max-w-[240px] space-y-1">
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
            <button type="button" onClick={nextHole} className={btn}>
              {hud.hole >= hud.holes ? "See results ▶" : "Next hole ▶"}
            </button>
          </Overlay>
        )}
        {screen === "holeComplete" && !partyView && !onlineView && (() => {
          const sl = scoreLabel(hud.throws, hud.par);
          const tone =
            sl.tone === "great" ? "text-[#f5d24a]" :
            sl.tone === "good" ? "text-[#36D7B7]" :
            sl.tone === "even" ? "text-white" : "text-[#e08a3b]";
          return (
            <Overlay>
              <p className="text-[#36D7B7] font-bold text-xl">Hole {hud.hole} complete</p>
              <p className={`${tone} font-black text-3xl leading-tight`}>
                {sl.emoji && `${sl.emoji} `}{sl.name}
              </p>
              <p className="text-gray-300 text-sm">{hud.throws} throws · par {hud.par}</p>
              {holeBestNote && (
                <p className="text-xs font-semibold">
                  {holeBestNote.isNew
                    ? <span className="text-[#f5d24a]">★ New best for this hole!</span>
                    : <span className="text-gray-400">Your best here: {holeBestNote.best}</span>}
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
              <button type="button" onClick={nextHole} className={btn}>
                {hud.hole >= hud.holes ? "See results ▶" : "Next hole ▶"}
              </button>
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
            tournament={tournament}
            onClose={() => setTournamentOpen(false)}
            onNew={() => saveTournament({ seed: (Math.random() * 1e9) | 0, round: 0, myTotals: [], fieldTotals: [], madeCut: true, finished: false })}
            onAbandon={() => saveTournament(null)}
            onPlayRound={(t) => {
              setTournamentOpen(false);
              startGame("winthrop", (t.seed + t.myTotals.length * 1013904223) | 0);
              tournamentPlayRef.current = true;
            }}
          />
        )}

        {dailyClaim && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0f1117]/85 backdrop-blur-sm rounded-lg px-6" onClick={() => setDailyClaim(null)}>
            <div className="text-center">
              <p className="text-6xl mb-2">🎁</p>
              <p className="text-[#f5d24a] font-black text-4xl">+{dailyClaim.coins} 🪙</p>
              <p className="text-gray-300 text-sm mt-2">Daily reward · 🔥 {dailyClaim.streak}-day streak</p>
              <button type="button" onClick={() => setDailyClaim(null)} className={`${btn} mt-4`}>Nice!</button>
            </div>
          </div>
        )}

        {careerOpen && (
          <CareerPanel
            career={career}
            lastResult={careerLastResult}
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
            dismissNotes={() => setCareerNotes([])}
          />
        )}

        {coursesOpen && (
          <CoursesPanel
            courses={FIXED_COURSES}
            bests={{ course: bestScore, winthrop: winthropBest }}
            onClose={() => setCoursesOpen(false)}
            onPlay={(m) => { setCoursesOpen(false); startGame(m); }}
          />
        )}

        {practiceOpen && (
          <PracticePanel
            onClose={() => setPracticeOpen(false)}
            onPick={(m, i) => { setPracticeOpen(false); startPractice(m, i); }}
            onMini={(k) => { setPracticeOpen(false); startMini(k); }}
          />
        )}

        {settingsOpen && (
          <SettingsPanel
            onClose={() => setSettingsOpen(false)}
            throwStyle={throwStyle} setThrowStyle={setThrowStyle}
            flightPath={flightPath} setFlightPath={setFlightPath}
            musicVolume={musicVolume} setMusicVolume={setMusicVolume}
            leftHanded={leftHanded} setLeftHanded={setLeftHanded}
            showGhost={showGhost} setShowGhost={setShowGhost}
            advanced={advanced} setAdvanced={handleSetAdvanced}
            unlocked={unlocked}
          />
        )}

        {authOpen && (
          <AuthPanel
            onClose={() => setAuthOpen(false)}
            user={user}
            email={authEmail} setEmail={setAuthEmail}
            password={authPassword} setPassword={setAuthPassword}
            busy={authBusy} error={authErr} message={authMsg}
            onSignIn={signIn} onSignUp={signUp} onSignOut={signOut}
          />
        )}

        {/* In-round pause menu */}
        {pauseMenu && (screen === "playing" || screen === "holeComplete") && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0f1117]/80 backdrop-blur-sm rounded-lg px-6">
            <div className="w-full max-w-[240px] flex flex-col gap-2.5">
              <h2 className="text-white font-black text-2xl text-center mb-1">Paused</h2>
              <button type="button" onClick={() => setPauseMenu(null)} className={`${btn} w-full !mt-0`}>▶ Continue</button>
              {pauseMenu.canRestart && (
                <button type="button" onClick={restartRound}
                  className="w-full bg-[#1a1d23] border border-white/15 hover:border-white/35 text-white font-bold py-3 rounded-lg transition">
                  ↻ Restart round
                </button>
              )}
              <button type="button" onClick={exitToHome}
                className="w-full bg-[#1a1d23] border border-white/15 hover:border-white/35 text-white font-bold py-3 rounded-lg transition">
                🏠 Exit to home
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Control panel: disc rack + flight/stance/mute — only while in a round */}
      {(screen === "playing" || screen === "holeComplete") && (
        <div className="shrink-0 w-full border-t border-white/10 bg-[#13161b]">
          <div className="mx-auto w-full max-w-[480px] px-3 pt-2 pb-[max(calc(env(safe-area-inset-bottom)+0.4rem),1.25rem)] flex flex-col gap-2">
            {/* Disc selector */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">Disc</span>
              <span className="text-[10px] text-gray-400 font-medium truncate ml-2">
                {advanced ? `${ADV_DISCS[discIndex]?.brand ?? ""} ${ADV_DISCS[discIndex]?.name ?? ""}` : "Drag back from the disc to throw"}
              </span>
            </div>
            {advanced ? (
              <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1" style={{ scrollbarWidth: "thin" }}>
                {ADV_DISCS.map((d, i) => {
                  const lock = DISC_UNLOCKS[d.key];
                  const locked = !!lock && !unlocked.includes(lock.ach);
                  return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => selectDisc(i)}
                    disabled={locked}
                    className={`shrink-0 w-[90px] rounded-lg border px-2 py-1.5 text-left transition ${
                      locked ? "border-white/5 bg-white/[0.02] opacity-50"
                        : i === discIndex ? "border-[#36D7B7]/70 bg-[#36D7B7]/10" : "border-white/10 hover:border-white/25 bg-white/[0.02]"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: locked ? "#444" : d.color }} />
                      <span className={`text-xs font-bold truncate ${i === discIndex && !locked ? "text-white" : "text-gray-300"}`}>
                        {locked ? "🔒 " : ""}{d.name}
                      </span>
                    </span>
                    <span className="block text-[9px] text-gray-500 mt-0.5">{locked ? lock!.label : d.brand}</span>
                    <span className="block text-[9px] font-mono text-gray-400 leading-tight">{locked ? "to unlock" : d.blurb.split("· ")[1]}</span>
                  </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {DISCS.map((d, i) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => selectDisc(i)}
                    title={d.blurb}
                    className={`rounded-lg border px-2 py-2 flex items-center gap-1.5 text-xs font-bold transition ${
                      i === discIndex ? "border-[#36D7B7]/70 bg-[#36D7B7]/10 text-white" : "border-white/10 text-gray-300 hover:border-white/25 bg-white/[0.02]"
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="truncate">{d.name}</span>
                    <span className="ml-auto text-[10px] text-gray-600">{i + 1}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Flight (simple mode only) */}
            {!advanced && (
              <div className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500">Flight</span>
                <div className="flex-1 flex gap-1 bg-[#0f1117] border border-white/10 rounded-lg p-1">
                  {([
                    { key: "overstable", label: "Overstable" },
                    { key: "straight", label: "Straight" },
                  ] as const).map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setFlightPath(p.key)}
                      aria-pressed={flightPath === p.key}
                      className={`flex-1 rounded-md px-2 py-1.5 text-xs font-bold transition ${
                        flightPath === p.key ? "bg-[#36D7B7] text-[#0f1117] shadow" : "text-gray-400 hover:text-white"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                onClick={toggleMute}
                aria-label={muted ? "Unmute" : "Mute"}
                className="shrink-0 w-10 h-[34px] flex items-center justify-center bg-[#0f1117] border border-white/10 hover:border-white/25 text-white rounded-lg active:bg-white/10 transition"
              >
                {muted ? "🔇" : "🔊"}
              </button>
              <button
                type="button"
                onClick={() => { const g = stateRef.current; setPauseMenu({ canRestart: !!g && !g.online && !g.mini && !tournamentPlayRef.current && !careerPlayRef.current }); }}
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
            <p className="text-[#f5d24a] font-bold text-lg">+{miniResult.coins} 🪙</p>
            <div className="flex flex-col gap-2 pt-1">
              <button type="button" onClick={() => startMini(miniResult.kind)} className={`${btn} w-full`}>↻ Play again</button>
              <button type="button" onClick={() => { audioRef.current?.stopMusic(); setMiniResult(null); }} className="w-full bg-[#1a1d23] border border-white/15 hover:border-white/35 text-white font-bold py-3 rounded-lg transition">🏠 Done</button>
            </div>
          </div>
        </div>
      )}

      {screen === "gameComplete" && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm p-4 flex items-start sm:items-center justify-center">
          <div className="w-full max-w-lg space-y-4 my-auto">
            <div className="text-center">
              <h2 className="text-white font-black text-2xl">
                {finalParty || finalOnline ? "Match complete!" : finalPracticeHole != null ? "Practice complete!" : finalIsDaily ? "Daily Challenge complete!" : "Round complete!"}
              </h2>
              <p className="text-gray-400 text-xs">
                {finalPracticeHole != null
                  ? `${finalMode === "winthrop" ? "Winthrop Lake" : "Glendoveer East"} · hole ${finalPracticeHole} · par ${finalParTotal}`
                  : finalIsDaily
                    ? `Today's course · ${finalPars.length} holes · par ${finalParTotal}`
                    : `${finalMode === "winthrop" ? "Winthrop Lake" : "Glendoveer East"} · 18 holes · par ${finalParTotal}`}
              </p>
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
                {coinReward > 0 && <p className="text-[#f5d24a] text-sm font-bold mt-1">+{coinReward} 🪙</p>}
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
                <p className="text-[#f5d24a] font-bold text-sm mb-2">🏅 Achievement{newAchievements.length > 1 ? "s" : ""} unlocked!</p>
                <div className="flex flex-col gap-1.5">
                  {newAchievements.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-sm">
                      <span className="text-lg">{a.emoji}</span>
                      <span className="text-white font-semibold">{a.name}</span>
                      <span className="text-gray-400 text-xs">— {a.desc}</span>
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
              <p className="text-center text-[#36D7B7] text-sm font-semibold">Saved to the leaderboard ✓</p>
            ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="Your name"
                      maxLength={16}
                      className="flex-1 bg-[#1a1d23] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#4B3DFF]"
                    />
                    <button
                      type="button"
                      onClick={saveScore}
                      disabled={saving}
                      className="bg-[#36D7B7] hover:bg-[#2bc4a6] text-black font-bold text-sm px-4 py-2 rounded-lg transition disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save score"}
                    </button>
                  </div>
                )}
            {saveErr && <p className="text-red-400 text-xs text-center">{saveErr}</p>}

            <div className="bg-[#1a1d23] border border-white/5 rounded-2xl overflow-hidden">
              <p className="text-white font-bold text-sm px-4 py-2.5 border-b border-white/5">
                🏆 {finalIsDaily ? "Today's leaderboard" : `${finalMode === "winthrop" ? "Winthrop Lake" : "Glendoveer East"} leaderboard`}
              </p>
              {leaderboard.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">No scores yet — be the first!</p>
              ) : (
                <ol>
                  {leaderboard.map((row, i) => (
                    <li
                      key={`${row.name}-${row.created_at}`}
                      className={`flex items-center gap-3 px-4 py-2 text-sm ${i !== 0 ? "border-t border-white/5" : ""}`}
                    >
                      <span className="text-gray-400 font-mono w-6 text-right">{i + 1}</span>
                      <span className="text-white flex-1 truncate">{row.name}</span>
                      <span className="text-gray-400 font-mono">{overStr(row.strokes - finalParTotal)}</span>
                      <span className="text-white font-mono font-bold w-8 text-right">{row.strokes}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            </>)}

            <div className="flex flex-wrap justify-center gap-2">
              {finalPracticeHole != null ? (
                <button type="button" onClick={() => startPractice(finalMode, finalPracticeHole - 1)} className={btn}>↻ Retry hole</button>
              ) : finalTournament ? (
                <button type="button" onClick={() => { audioRef.current?.stopMusic(); setScreen("title"); setTournamentOpen(true); }} className={btn}>
                  🏟 Standings
                </button>
              ) : finalOnline ? (
                <button type="button" onClick={() => { audioRef.current?.stopMusic(); setScreen("title"); }} className={btn}>
                  🎉 Back to lobby
                </button>
              ) : (
                <button type="button" onClick={() => startGame()} className={btn}>↻ Play again</button>
              )}
              <button type="button" onClick={shareCard} className="mt-1 bg-[#1a1d23] border border-white/15 hover:border-white/35 text-white font-bold px-6 py-3 rounded-lg transition">
                📤 Share card
              </button>
              {/* Challenge a friend to the exact same round (fixed seed). Not for
                  practice/party/online, where there's no single comparable score. */}
              {finalPracticeHole == null && !finalParty && !finalOnline && (
                <button type="button" onClick={shareChallenge} className="mt-1 bg-[#1a1d23] border border-[#e0923b]/40 hover:border-[#e0923b]/70 text-white font-bold px-6 py-3 rounded-lg transition">
                  {challengeCopied ? "✓ Link copied" : "⚔ Challenge a friend"}
                </button>
              )}
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

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 rounded-lg text-center px-4">
      {children}
    </div>
  );
}

// Paginated how-to-play walkthrough: throw, disc choice, flight shape, stance.
// Each step pairs a small looping SVG animation with a short caption.
function TutorialPanel({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const illo = "w-full rounded-lg border border-white/10 bg-[#10141a]";
  // Knob pull-back loop shared by the line + knob in step 1.
  const pull = { dur: "2.6s", keyTimes: "0;0.45;0.6;1", repeatCount: "indefinite" } as const;
  const steps: { title: string; caption: string; art: React.ReactNode }[] = [
    {
      title: "Pull back & throw",
      caption: "Press on your disc and drag back — the farther you pull, the more power. Release to throw the opposite way. Pulled back but changed your mind? Bring the knob back inside the red ring to cancel.",
      art: (
        <svg viewBox="0 0 220 130" className={illo}>
          <rect x="60" y="0" width="100" height="130" fill="#16331f" />
          <line x1="110" y1="14" x2="110" y2="30" stroke="#cfd8dc" strokeWidth="2" />
          <rect x="102" y="16" width="16" height="9" fill="none" stroke="#cfd8dc" strokeWidth="2" />
          <path d="M110 92 C 104 70, 116 48, 110 30" fill="none" stroke="#36D7B7" strokeWidth="2" strokeDasharray="4 4">
            <animate attributeName="stroke-dashoffset" from="32" to="0" dur="1.2s" repeatCount="indefinite" />
          </path>
          <text x="122" y="62" fill="#36D7B7" fontSize="9">throw</text>
          <circle cx="110" cy="92" r="6" fill="#36D7B7" />
          <line x1="110" y1="92" stroke="rgba(255,255,255,0.7)" strokeWidth="2">
            <animate attributeName="x2" values="110;134;134;110" {...pull} />
            <animate attributeName="y2" values="92;118;118;92" {...pull} />
          </line>
          <circle r="5" fill="#fff">
            <animate attributeName="cx" values="110;134;134;110" {...pull} />
            <animate attributeName="cy" values="92;118;118;92" {...pull} />
          </circle>
          <text x="144" y="122" fill="#9aa4b2" fontSize="9">pull back</text>
        </svg>
      ),
    },
    {
      title: "Pick your disc",
      caption: "Tap a disc in the rack below the screen — any time, even mid-hole. Putters are short but controlled, mids are balanced, drivers fly farthest. When you switch, a tick flashes on the fairway showing that disc's max reach.",
      art: (
        <svg viewBox="0 0 220 130" className={illo}>
          {([
            { name: "Putter", color: "#36D7B7", len: 55, y: 30 },
            { name: "Mid", color: "#f5d24a", len: 82, y: 65 },
            { name: "Driver", color: "#e23b3b", len: 120, y: 100 },
          ] as const).map((d) => (
            <g key={d.name}>
              <circle cx="24" cy={d.y} r="8" fill={d.color} />
              <text x="38" y={d.y + 3} fill="#e7ebf0" fontSize="10" fontWeight="bold">{d.name}</text>
              <rect x="86" y={d.y - 3.5} height="7" rx="3.5" fill={d.color} opacity="0.85">
                <animate attributeName="width" values={`0;${d.len};${d.len}`} keyTimes="0;0.55;1" dur="2.8s" repeatCount="indefinite" />
              </rect>
              <line x1={86 + d.len} y1={d.y - 7} x2={86 + d.len} y2={d.y + 7} stroke={d.color} strokeWidth="2" />
            </g>
          ))}
        </svg>
      ),
    },
    {
      title: "Flight shape",
      caption: "Overstable bends steadily one way — reliable in wind. Straight holds its line and carries farther. Toggle it next to the disc rack. (Advanced bag: each real disc has its own baked-in shape instead.)",
      art: (
        <svg viewBox="0 0 220 130" className={illo}>
          <path d="M70 112 C 70 85, 56 55, 42 32" fill="none" stroke="#e08a3b" strokeWidth="2.5" strokeDasharray="5 4">
            <animate attributeName="stroke-dashoffset" from="36" to="0" dur="1.3s" repeatCount="indefinite" />
          </path>
          <circle cx="70" cy="112" r="5" fill="#e08a3b" />
          <text x="50" y="124" fill="#e08a3b" fontSize="9">Overstable</text>
          <path d="M150 112 C 158 85, 146 50, 145 20" fill="none" stroke="#36D7B7" strokeWidth="2.5" strokeDasharray="5 4">
            <animate attributeName="stroke-dashoffset" from="36" to="0" dur="1.3s" repeatCount="indefinite" />
          </path>
          <circle cx="150" cy="112" r="5" fill="#36D7B7" />
          <text x="132" y="124" fill="#36D7B7" fontSize="9">Straight</text>
          <text x="158" y="30" fill="#9aa4b2" fontSize="8">farther</text>
        </svg>
      ),
    },
    {
      title: "Stance",
      caption: "Backhand (BH) fades left at the end of the flight; forehand (FH) fades right. Pick per throw next to the disc rack to shape shots around trees and doglegs. Left-handed? Flip it in Settings and everything mirrors.",
      art: (
        <svg viewBox="0 0 220 130" className={illo}>
          <path d="M110 110 C 104 75, 86 45, 68 28" fill="none" stroke="#36D7B7" strokeWidth="2.5" strokeDasharray="5 4">
            <animate attributeName="stroke-dashoffset" from="36" to="0" dur="1.3s" repeatCount="indefinite" />
          </path>
          <path d="M110 110 C 116 75, 134 45, 152 28" fill="none" stroke="#f5d24a" strokeWidth="2.5" strokeDasharray="5 4">
            <animate attributeName="stroke-dashoffset" from="36" to="0" dur="1.3s" repeatCount="indefinite" />
          </path>
          <circle cx="110" cy="110" r="6" fill="#fff" />
          <text x="42" y="20" fill="#36D7B7" fontSize="9">BH fades left</text>
          <text x="128" y="20" fill="#f5d24a" fontSize="9">FH fades right</text>
        </svg>
      ),
    },
  ];
  const last = step === steps.length - 1;
  const nav = "rounded-lg px-4 py-2 text-xs font-bold transition";
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm p-4 flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-3 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">How to Play</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <p className="text-[#36D7B7] text-sm font-bold">{step + 1}. {steps[step].title}</p>
        {steps[step].art}
        <p className="text-gray-300 text-xs leading-relaxed min-h-[72px]">{steps[step].caption}</p>
        <div className="flex items-center justify-between pt-1">
          <button type="button" onClick={() => setStep(step - 1)} disabled={step === 0}
            className={`${nav} border border-white/10 text-gray-300 hover:text-white disabled:opacity-30 disabled:hover:text-gray-300`}>
            ◀ Back
          </button>
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === step ? "bg-[#36D7B7]" : "bg-white/15"}`} />
            ))}
          </div>
          <button type="button" onClick={() => (last ? onClose() : setStep(step + 1))}
            className={`${nav} ${last ? "bg-[#36D7B7] hover:bg-[#2bc4a6] text-[#0f1117]" : "bg-[#4B3DFF] hover:bg-[#3a2ee0] text-white"}`}>
            {last ? "Got it ✓" : "Next ▶"}
          </button>
        </div>
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
    <div className="absolute inset-0 z-30 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm p-4 flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-3 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">👥 Challenge Friends</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        {step === "menu" && (
          <>
            <button type="button" onClick={onPassPlay}
              className="w-full text-left rounded-xl bg-[#1a1d23] border border-white/10 hover:border-white/30 px-4 py-3 transition">
              <span className="block text-white font-bold text-sm">🤝 Pass &amp; Play</span>
              <span className="block text-gray-500 text-[11px] mt-0.5">2–4 players take turns on one device.</span>
            </button>
            <button type="button" onClick={() => online && setStep("create")} disabled={!online}
              className={`w-full text-left rounded-xl border px-4 py-3 transition ${online ? "bg-[#1a1d23] border-white/10 hover:border-white/30" : "bg-white/[0.02] border-white/5 opacity-50"}`}>
              <span className="block text-white font-bold text-sm">🌐 Friendly Challenge</span>
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
    <div className="absolute inset-0 z-30 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm p-4 flex items-start justify-center rounded-lg">
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
            <button type="button" onClick={onStart} className={`${btn} w-full`}>▶ Start round</button>
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
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm p-4 flex items-start justify-center rounded-lg">
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
          ▶ Tee off
        </button>
      </div>
    </div>
  );
}

// College Nationals at Winthrop Lake: 3 rounds vs a seeded AI field, top half
// makes the cut after round 2, lowest 3-round total takes the title.
function TournamentPanel({ tournament, onClose, onNew, onAbandon, onPlayRound }: {
  tournament: Tournament | null;
  onClose: () => void;
  onNew: () => void;
  onAbandon: () => void;
  onPlayRound: (t: Tournament) => void;
}) {
  const t = tournament;
  const standings = t && t.myTotals.length > 0 ? tournStandings(t) : null;
  const myRank = standings ? standings.findIndex((r) => r.you) + 1 : 0;
  const champion = t?.finished && t.madeCut && myRank === 1;
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm p-4 flex items-start justify-center rounded-lg">
      <div className="w-full max-w-sm space-y-3 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">🏟 Tournament</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <p className="text-gray-400 text-xs -mt-2">College Nationals · Winthrop Lake · 3 rounds · cut after R2</p>

        {!t ? (
          <>
            <p className="text-gray-300 text-sm">
              Take on a 36-player field over three rounds. The top half survives the cut; the lowest total lifts the trophy.
            </p>
            <button type="button" onClick={onNew} className={`${btn} w-full`}>Start tournament</button>
          </>
        ) : (
          <>
            {champion && (
              <div className="bg-[#f5d24a]/10 border border-[#f5d24a]/40 rounded-xl p-3 text-center">
                <p className="text-[#f5d24a] font-black text-lg">🏆 NATIONAL CHAMPION!</p>
              </div>
            )}
            {t.finished && !t.madeCut && (
              <p className="text-[#e08a3b] text-sm font-semibold text-center">Missed the cut — there&apos;s always next season.</p>
            )}
            {t.finished && t.madeCut && !champion && (
              <p className="text-gray-300 text-sm text-center">Finished <span className="text-white font-bold">#{myRank}</span> of {TOURN_NAMES.length + 1}.</p>
            )}

            {standings ? (
              <div className="bg-[#1a1d23] border border-white/5 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-[11px] tabular-nums">
                  <thead className="sticky top-0 bg-[#1a1d23]">
                    <tr className="text-gray-500 border-b border-white/5">
                      <th className="text-left pl-3 py-1.5 w-8">#</th>
                      <th className="text-left">Player</th>
                      {[0, 1, 2].map((r) => <th key={r} className="text-right pr-1">R{r + 1}</th>)}
                      <th className="text-right pr-3">Tot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((row, i) => (
                      <tr key={row.name} className={`${row.you ? "bg-[#36D7B7]/10 text-[#36D7B7] font-bold" : "text-gray-300"} ${i ? "border-t border-white/5" : ""} ${row.cut ? "opacity-50" : ""}`}>
                        <td className="pl-3 py-1">{row.cut ? "—" : i + 1}</td>
                        <td className="truncate max-w-[110px]">{row.name}{row.cut ? " (cut)" : ""}</td>
                        {[0, 1, 2].map((r) => <td key={r} className="text-right pr-1 font-mono">{row.rounds[r] ?? ""}</td>)}
                        <td className="text-right pr-3 font-mono font-bold">{row.total || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-300 text-sm">Round 1 awaits — the field is warming up.</p>
            )}

            {!t.finished ? (
              <button type="button" onClick={() => onPlayRound(t)} className={`${btn} w-full`}>
                ▶ Play round {t.myTotals.length + 1}
              </button>
            ) : (
              <button type="button" onClick={onNew} className={`${btn} w-full`}>↻ New tournament</button>
            )}
            {!t.finished && (
              <button type="button" onClick={onAbandon} className="w-full text-gray-500 hover:text-gray-300 text-xs py-1 transition">
                Abandon tournament
              </button>
            )}
          </>
        )}
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
function CareerPanel({ career, lastResult, notes, onClose, onStart, onPlay, onSim, onAdvance, onRetire, onAbandon, onSign, onBuyTrain, dismissNotes }: {
  career: Career | null;
  lastResult: EventResult | null;
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
  dismissNotes: () => void;
}) {
  const [name, setName] = useState("");
  const [alloc, setAlloc] = useState<CareerSkills>({ power: 0, control: 0, putt: 0, mental: 0 });
  const [confirm, setConfirm] = useState<"retire" | "abandon" | null>(null);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { setAlloc({ power: 0, control: 0, putt: 0, mental: 0 }); setConfirm(null); }, [career?.season, career?.retired]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const wrap = "absolute inset-0 z-30 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm p-4 flex items-start justify-center rounded-lg";
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
        <p className="text-gray-300 text-sm">Start as a 14-year-old high-school freshman with a bag and a dream. Build your <span className="text-white">power, control, putting</span> and <span className="text-white">mental</span> game over the years — high school, college (Nationals at Winthrop Lake), then the pro tour. Your <span className="text-[#f5d24a]">PDGA rating</span> climbs as you post better tournament rounds. Play the big rounds yourself; sim the rest.</p>
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
          <p className="text-gray-400 text-[11px]">{STAGE_LABEL[career.stage]} · Age {career.age} · Season {career.season + 1}{career.stage === "pro" && career.worldRank ? ` · World #${career.worldRank}` : ""}</p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="text-right leading-tight">
            <span className="block text-[#f5d24a] font-black text-base font-mono leading-none">{career.pdgaRating}</span>
            <span className="block text-gray-500 text-[8px] uppercase tracking-wide">PDGA</span>
          </span>
          <span className="text-[#36D7B7] font-bold text-sm font-mono">{fmtCash(career.cash)}</span>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
      </div>

      {lastResult && (
        <div className={`rounded-lg px-3 py-2 text-sm border ${lastResult.win ? "border-[#f5d24a]/50 bg-[#f5d24a]/10 text-[#f5d24a]" : "border-white/10 bg-white/5 text-gray-200"}`}>
          <div>{lastResult.name}: <span className="font-bold">{placeLabel(lastResult.placed)}</span> of {lastResult.field} · {toPar(lastResult.toPar)} ({lastResult.score}){lastResult.prize > 0 && <span className="text-[#36D7B7]"> · +{fmtCash(lastResult.prize)}</span>}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">
            Beat {lastResult.beatRivals}/{lastResult.rivalCount} rivals{lastResult.winnerName ? ` · ${lastResult.winnerName} took the title` : ""}
            {lastResult.trainBonus > 0 && <span className="text-[#36D7B7]"> · +{lastResult.trainBonus} training pt{lastResult.trainBonus > 1 ? "s" : ""}</span>}
          </div>
        </div>
      )}

      {/* Skills + training */}
      <div className="bg-[#1a1d23] border border-white/5 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wide">Skills · PDGA {career.pdgaRating}</p>
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
                <div className="absolute inset-y-0 left-0 bg-[#36D7B7] rounded" style={{ width: `${val}%` }} />
                <div className="absolute inset-y-0 w-0.5 bg-white/50" style={{ left: `${pot}%` }} />
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
          <p className="text-gray-500 text-[10px] flex-1 leading-snug">Skills <span className="text-gray-300">only rise when you train them</span> — finish events well to earn bonus points. The tick marks potential.</p>
          <button type="button" onClick={onBuyTrain} disabled={career.cash < trainCost}
            className="shrink-0 rounded bg-[#36D7B7]/15 border border-[#36D7B7]/40 text-[#36D7B7] text-[11px] font-bold px-2 py-1 disabled:opacity-30 disabled:border-white/10 disabled:text-gray-500">
            +1 pt · {fmtCash(trainCost)}
          </button>
        </div>
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
                    <button type="button" onClick={() => onPlay(ev)} className="rounded bg-[#4B3DFF] hover:bg-[#3a2ee0] text-white text-xs font-bold px-2.5 py-1">▶ Play</button>
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

// Every fixed course in the app on one page — keeps the title screen short and
// scales as new courses are added to FIXED_COURSES.
function CoursesPanel({ courses, bests, onClose, onPlay }: {
  courses: CourseInfo[];
  bests: Record<string, number | null>;
  onClose: () => void;
  onPlay: (m: Mode) => void;
}) {
  const over = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm p-4 flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-3 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">⛳ Play Courses</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <p className="text-gray-500 text-[11px]">Every course in the app — more on the way.</p>
        {courses.map((c) => {
          const best = bests[c.mode];
          return (
            <div key={c.mode} className="rounded-xl bg-[#1a1d23] border border-white/10 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-white font-bold text-sm truncate">{c.name}</span>
                <span className="text-gray-500 text-[10px] shrink-0">{c.holes} holes · par {c.par}</span>
              </div>
              <p className="text-gray-500 text-[11px] mt-0.5 leading-snug">{c.blurb}</p>
              <div className="flex items-center justify-between mt-2.5">
                <span className="text-[11px] text-gray-400">
                  {best != null ? <>Best <span className="text-[#36D7B7] font-bold">{best}</span> <span className="text-gray-500">({over(best - c.par)})</span></> : "Not played yet"}
                </span>
                <button type="button" onClick={() => onPlay(c.mode)} className="rounded-lg bg-[#4B3DFF] hover:bg-[#3a2ee0] text-white text-sm font-bold px-5 py-1.5 transition">▶ Play</button>
              </div>
            </div>
          );
        })}
        <button type="button" onClick={onClose} className={`${btn} w-full`}>Done</button>
      </div>
    </div>
  );
}

// Career stats computed from the locally-stored round history. Older rounds
// (before per-hole scores were recorded) still count toward totals/averages.
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
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm p-4 flex items-start justify-center rounded-lg">
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
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm p-4 flex items-start justify-center rounded-lg">
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
function PracticePanel({ onClose, onPick, onMini }: {
  onClose: () => void;
  onPick: (m: Mode, holeIdx: number) => void;
  onMini: (kind: "putt" | "target") => void;
}) {
  const [course, setCourse] = useState<Mode>("course");
  // Glendoveer per-hole bests, read once when the panel opens.
  const [holeBest] = useState<(number | null)[]>(() => {
    try {
      const hb = JSON.parse(localStorage.getItem(HOLEBEST_KEY) || "null");
      return Array.isArray(hb) ? hb : [];
    } catch { return []; }
  });
  const holes = course === "winthrop" ? WINTHROP_HOLES : HOLES;
  const seg = (active: boolean) =>
    `flex-1 rounded-md px-2 py-2 text-xs font-bold transition ${active ? "bg-[#4B3DFF] text-white" : "text-gray-400 hover:text-white"}`;
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm p-4 flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-3 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">Practice</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        {/* Skill mini-games */}
        <div className="flex gap-2">
          <button type="button" onClick={() => onMini("putt")} className="flex-1 rounded-lg bg-[#1a1d23] border border-[#36D7B7]/50 hover:border-[#36D7B7] py-2.5 transition">
            <span className="block text-white font-bold text-sm">⛳ Putting</span>
            <span className="block text-gray-500 text-[10px]">sink it to advance</span>
          </button>
          <button type="button" onClick={() => onMini("target")} className="flex-1 rounded-lg bg-[#1a1d23] border border-[#36D7B7]/50 hover:border-[#36D7B7] py-2.5 transition">
            <span className="block text-white font-bold text-sm">🎯 Target</span>
            <span className="block text-gray-500 text-[10px]">hit the bullseye</span>
          </button>
        </div>
        <p className="text-gray-500 text-[11px] font-semibold uppercase tracking-wide pt-1">Or grind a hole</p>
        <div className="flex gap-1 bg-[#1a1d23] border border-white/10 rounded-lg p-1">
          <button type="button" onClick={() => setCourse("course")} className={seg(course === "course")}>Glendoveer</button>
          <button type="button" onClick={() => setCourse("winthrop")} className={seg(course === "winthrop")}>Winthrop</button>
        </div>
        <p className="text-gray-500 text-[11px]">Pick a hole — practice doesn&apos;t count toward bests or boards.</p>
        <div className="grid grid-cols-3 gap-1.5">
          {holes.map((h, i) => {
            const best = course === "course" ? holeBest[i] : null;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onPick(course, i)}
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
  );
}

function SettingsPanel(props: {
  onClose: () => void;
  throwStyle: "BH" | "FH";
  setThrowStyle: (s: "BH" | "FH") => void;
  flightPath: FlightPath;
  setFlightPath: (p: FlightPath) => void;
  musicVolume: number;
  setMusicVolume: (v: number) => void;
  leftHanded: boolean;
  setLeftHanded: (b: boolean) => void;
  showGhost: boolean;
  setShowGhost: (b: boolean) => void;
  advanced: boolean;
  setAdvanced: (b: boolean) => void;
  unlocked: string[];
}) {
  const { onClose, throwStyle, setThrowStyle, flightPath, setFlightPath, musicVolume, setMusicVolume, leftHanded, setLeftHanded, showGhost, setShowGhost, advanced, setAdvanced, unlocked } = props;
  const seg = (active: boolean) =>
    `flex-1 rounded-md px-2 py-2 text-xs font-bold transition ${active ? "bg-[#4B3DFF] text-white" : "text-gray-400 hover:text-white"}`;
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm p-4 flex items-start justify-center rounded-lg">
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

        {!advanced && (
          <div>
            <p className="text-gray-400 text-xs font-semibold mb-1">Default flight</p>
            <div className="flex gap-1 bg-[#1a1d23] border border-white/10 rounded-lg p-1">
              <button type="button" onClick={() => setFlightPath("overstable")} className={seg(flightPath === "overstable")}>Overstable</button>
              <button type="button" onClick={() => setFlightPath("straight")} className={seg(flightPath === "straight")}>Straight</button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setAdvanced(!advanced)}
          className="w-full flex items-center justify-between bg-[#1a1d23] border border-white/10 rounded-lg px-3 py-2.5"
        >
          <span className="text-left">
            <span className="block text-white text-sm font-semibold">Advanced discs</span>
            <span className="block text-gray-500 text-[11px]">Throw real Innova / Discraft discs by their flight numbers</span>
          </span>
          <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded ${advanced ? "bg-[#36D7B7] text-[#0f1117]" : "bg-white/10 text-gray-400"}`}>
            {advanced ? "ON" : "OFF"}
          </span>
        </button>

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
                  <span className="text-white font-semibold">{a.name}</span>
                  <span className="text-gray-500 text-xs truncate">— {a.desc}</span>
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

function AuthPanel(props: {
  onClose: () => void;
  user: { email: string } | null;
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  busy: boolean; error: string | null; message: string | null;
  onSignIn: () => void; onSignUp: () => void; onSignOut: () => void;
}) {
  const { onClose, user, email, setEmail, password, setPassword, busy, error, message, onSignIn, onSignUp, onSignOut } = props;
  const input = "w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#4B3DFF]";
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm p-4 flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-4 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">{user ? "Account" : "Log in"}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        {user ? (
          <>
            <p className="text-gray-300 text-sm">Signed in as <span className="text-white font-semibold break-all">{user.email}</span>.</p>
            <p className="text-[#36D7B7] text-xs font-semibold">✓ Your best scores, hole bests &amp; achievements sync automatically.</p>
            <button type="button" onClick={onSignOut} className="w-full bg-[#1a1d23] border border-white/15 hover:border-white/35 text-white font-bold py-2.5 rounded-lg transition">Log out</button>
          </>
        ) : (
          <>
            <p className="text-gray-400 text-xs">Log in (or create an account) to save your progress and pick it back up on any device.</p>
            <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={input} />
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 6 chars)" className={input} />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            {message && <p className="text-[#36D7B7] text-xs">{message}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={onSignIn} disabled={busy || !email || !password} className="flex-1 bg-[#4B3DFF] hover:bg-[#3a2ee0] text-white font-bold py-2.5 rounded-lg transition disabled:opacity-50">
                {busy ? "…" : "Log in"}
              </button>
              <button type="button" onClick={onSignUp} disabled={busy || !email || !password} className="flex-1 bg-[#36D7B7] hover:bg-[#2bc4a6] text-[#0f1117] font-bold py-2.5 rounded-lg transition disabled:opacity-50">
                {busy ? "…" : "Sign up"}
              </button>
            </div>
            <p className="text-gray-600 text-[11px]">Your scores are also saved on this device without logging in.</p>
          </>
        )}
      </div>
    </div>
  );
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

function drawBasket(ctx: CanvasRenderingContext2D, x: number, y: number, catchR = CATCH_R) {
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.beginPath();
  ctx.arc(x, y, catchR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#9aa0a8";
  ctx.fillRect(Math.round(x) - 1, Math.round(y) - 2, 2, 12);
  ctx.fillStyle = "#7a808a";
  ctx.fillRect(Math.round(x) - 4, Math.round(y) + 10, 8, 2);
  ctx.fillStyle = "#c2c8d0";
  ctx.fillRect(Math.round(x) - 5, Math.round(y) - 8, 10, 3);
  ctx.fillStyle = "#aeb4bd";
  for (let i = -3; i <= 3; i += 3) ctx.fillRect(Math.round(x) + i, Math.round(y) - 5, 1, 5);
}
