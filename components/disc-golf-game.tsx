"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  submitArcadeScore, getArcadeLeaderboard, submitMiniScore, getMiniLeaderboard,
} from "@/actions/arcade";
import type { ArcadeScore } from "@/lib/arcade-types";
import { getSupabase } from "@/lib/supabase/browser";
import {
  BEST_KEY, WBEST_KEY, OBEST_KEY, HOLEBEST_KEY, SETTINGS_KEY, ACH_KEY, HIST_KEY, CAREER_KEY, CAREERS_KEY, CAREER_SLOTS, COINS_KEY, DAILY_KEY, OWNED_KEY, PROFILE_KEY, RANKED_KEY, BAG_KEY, BAGSEEN_KEY, LEVELREWARD_KEY, DAILYSTARS_KEY, DAILYBEST_KEY, COINSEARNED_KEY, COINSSPENT_KEY, UPDATEDAT_KEY, readLocalProgress, applyProgress, mergeProgress, clearLocalProgress, trimDailyStars, trimDailyBests, type Progress,
} from "@/lib/progress";
import {
  dayNumber, claimDailyReward, dailyAvailable, coinsForRound, modeCoinMult, fmtCoins, dailyStarCoins, type DailyReward,
} from "@/lib/discgolf/wallet";
import {
  DEFAULT_AVATAR, avatarOwnKey, playerXp, levelFromXp, type PlayerProfile,
} from "@/lib/discgolf/profile";
import { DEFAULT_TRAIL, trailByKey } from "@/lib/discgolf/trails";
import { contrastRatio, discOutline } from "@/lib/discgolf/contrast";
import {
  DISC_SKINS, BASKET_SKINS, AIM_STYLES, GROUND_THEMES, CELEBRATIONS, DEFAULT_DISC_SKIN, DEFAULT_BASKET_SKIN, DEFAULT_AIM_STYLE, DEFAULT_GROUND_THEME, DEFAULT_CELEBRATION, COSMETIC_PREFIX, cosmeticOwnKey, cosmeticByKey,
} from "@/lib/discgolf/cosmetics";
import {
  applyRankedRound, applyPlacementRound, rolloverSeason, tierFromRP, rankedFieldMean, RANKED_FIELD, PLACEMENT_MIN_RATING, PLACEMENT_MAX_RATING, RANKED_BOARD_KEY, encodeToParScore, TIERS, type RankedState, type RankedResult, type PlacementResult, type SeasonRecord,
} from "@/lib/discgolf/ranked";
import { centralWeekFromDay, centralMonth, centralMonthLabel } from "@/lib/discgolf/time";
import {
  isLegacyHost, transferUrl, readTransferToken, clearTransferToken, CANONICAL_HOST,
} from "@/lib/discgolf/transfer";
import {
  dailyChallenges, weeklyChallenges, roundsThisDay, roundsThisWeek, challengeDone, dailyClaimKey, eventClaimKey, type EventRound,
} from "@/lib/discgolf/events";
import {
  W, H, DISC_R, CATCH_R, MAX_DRAG, CANCEL_R, CANCEL_POWER, HOLES, leaderboardCourse, TOURN_KEY, TOURNAMENTS, tournDef, tournRoundPlayHoles, tournPlace, tournFieldRound, tournLiveStandings, ACHIEVEMENTS, earnedAchievements, achievementReward, scoreLabel, STRAIGHT_SPEED_MUL, releaseSpeedMul, ADV_DISCS, levelUpChoices, validDiscIndex, DEFAULT_DISC_INDEX, BAG_MAX, discIndexByKey, unlockedDiscKeys, reconcileBag, tourVenue, aimAt, camXFor, buildTournGhosts, buildRacerGhosts, ghostPosAt, AudioEngine, dailySeed, dailyStarThresholds, dailyStarsEarned, buildRound, elevAt, vibrate, pxToFeet, distBetween, autoDiscIndex, windAlong, resolvePenalty, treesAtLie, stepFlight, type Vec, type Water, type Hole, type Mode, type Tournament, type TournLiveRow, type Achievement, type FlightPath, type Release, type Flight, type GhostState,
} from "@/lib/discgolf/engine";
import { parseChallenge, challengeParam } from "@/lib/discgolf/challenge";
import { buildReplay, replayFrame, type Replay } from "@/lib/discgolf/replay";
import { saveReplay, loadReplay } from "@/actions/replays";
import {
  newCareer, normalizeCareer, skillMods, momentumAfter, simEvent, recordResult, advanceSeason, retire, IDENTITY_MODS, signSponsor, unsignSponsor, buyTrainingPoint, spendSkillPoint, careerCoins as coinsForFinish, buyCareerDisc, toggleCareerBag, buyCareerCosmetic, equipCareerLook, DEFAULT_CAREER_LOOK, type CareerLook, careerFieldForRound, careerCardRacers, careerLiveStandings, careerHoleLenScale, rankedFieldForRound, rankedPlacementField, rankedCardRacers, type Career, type CareerEvent, type EventResult, type CareerSkills, type FieldPlayer,
} from "@/lib/discgolf/career";
import {
  freshHole, puttHole, targetHole, puttFeet, targetRadiusPx, type GameState, type Screen, type HudInfo,
} from "./game/state";
import {
  readResume, readPlaceMarks, PLACEMARKS_KEY, TOURBEST_KEY, TOURNBEST_KEY, RESUME_KEY, ENTRY_KEY, PLACEMENT_START_RP, writeLobbySession, clearLobbySession, readLobbySession, type ResumeSnap,
} from "./game/storage";
import {
  makeClientId, ghostColorFor, makeLobbyCode, sendThrows, onlineGhostPos, replayCaption, type LobbyPlayer, type OnlineScore, type OnlineGhost,
} from "./game/online";
import {
  CHALLENGE_COURSES, challengeKey, FIXED_COURSES, TOUR_COURSE_INFOS, type CourseInfo,
} from "./game/courses";
import { themeInk, treeStyleFor, drawBasket, drawTree, drawTrail, drawWeather, drawPowerRing } from "./game/draw";
import { Coin, hubCard, titleCardSm, GoalStar, Overlay, btn, ordinal } from "./panels/ui";
import { ChallengePanel, PartyPanel, LobbyPanel } from "./panels/OnlinePanels";
import { HolePracticePicker } from "./panels/HolePracticePicker";
import { TutorialPanel } from "./panels/TutorialPanel";
import { StatsPanel } from "./panels/StatsPanel";
import { LeaderboardPanel } from "./panels/LeaderboardPanel";
import { TournamentPanel } from "./panels/TournamentPanel";
import { CareerSlots, CareerPanel } from "./panels/CareerPanel";
import { CoursesPanel } from "./panels/CoursesPanel";
import { ShopPanel } from "./panels/ShopPanel";
import { BagPanel, LevelUpPanel } from "./panels/BagPanels";
import { ProfilePanel } from "./panels/ProfilePanel";
import { RankedPanel, PlacementReveal, PlacementDots } from "./panels/RankedPanel";
import { ChallengesPanel } from "./panels/ChallengesPanel";
import { SettingsPanel } from "./panels/SettingsPanel";
import { AuthPanel } from "./panels/AuthPanel";
import { AttractBackdrop } from "./menu/AttractBackdrop";
import { DailyButton } from "./menu/DailyButton";
import { BoardNamePrompt } from "./menu/BoardNamePrompt";
import { ControlPanel } from "./play/ControlPanel";
import { postMiniResult, postRoundResult, readBoardChoice, writeBoardChoice, type BoardChoice, type PostOutcome } from "@/lib/leaderboard/post";


// ─────────────────────────────────────────────────────────────────────────────
// Retro pixel disc-golf game. You throw from the bottom of the screen toward
// the top across the 18-hole Glendoveer East course (or a seeded Daily
// Challenge). Drag back to aim/power; pick a disc + flight shape; mind wind,
// elevation and OB. Scores persist: a personal best + per-hole bests +
// achievements in localStorage, and a saved-by-name leaderboard in Supabase.
// Everything renders to a small portrait canvas upscaled with image-rendering:
// pixelated for the crunchy old-school look.
// ─────────────────────────────────────────────────────────────────────────────

export function DiscGolfGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const playAreaRef = useRef<HTMLDivElement | null>(null); // the board's container (sizing + letterbox colour)
  // Dev-only probe: the power the ring was last drawn at (headless checks read it).
  const powerRingDebugRef = useRef<{ drawn: number; at: number } | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __dga?: unknown }).__dga = {
      power: () => stateRef.current?.power ?? null,
      ring: () => powerRingDebugRef.current,
    };
  }, []);
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

  // Everyone starts on the menu as a guest; signing in is optional (the "Sign in
  // to sync" chip and the profile panel). The static initial value keeps SSR/CSR
  // markup identical; an effect moves to the title after mount, and until then
  // `entryResolved` is false and we paint a neutral splash (logo only).
  const [screen, setScreen] = useState<Screen>("landing");
  const [entryResolved, setEntryResolved] = useState(false);
  const [muted, setMuted] = useState(false);
  const [discIndex, setDiscIndex] = useState(DEFAULT_DISC_INDEX); // Buzzz (core mid) by default
  const [throwStyle, setThrowStyle] = useState<"BH" | "FH">("BH");
  const [hud, setHud] = useState<HudInfo>({ hole: 1, par: 3, throws: 0, holes: 18, scores: [], pars: [] });

  // An interrupted solo round to offer "Resume" on the title screen.
  const [resumeRound, setResumeRound] = useState<ResumeSnap | null>(null);

  // End-of-round state
  const [scorecard, setScorecard] = useState<number[]>([]);
  const [finalTotal, setFinalTotal] = useState(0);
  const [finalSeed, setFinalSeed] = useState(0);
  const [finalPracticeHole, setFinalPracticeHole] = useState<number | null>(null);
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
  // Up to CAREER_SLOTS independent career saves. `careerSlot` is the open one
  // (null = the slot picker is showing); `career` mirrors that slot for the hub.
  const [careers, setCareers] = useState<(Career | null)[]>(() => Array(CAREER_SLOTS).fill(null));
  const careersRef = useRef<(Career | null)[]>(careers);
  useEffect(() => { careersRef.current = careers; }, [careers]);
  const [careerSlot, setCareerSlot] = useState<number | null>(null);
  const careerSlotRef = useRef<number | null>(null);
  useEffect(() => { careerSlotRef.current = careerSlot; }, [careerSlot]);
  const [career, setCareer] = useState<Career | null>(null);
  const careerRef = useRef<Career | null>(null);
  useEffect(() => { careerRef.current = career; }, [career]);
  const careerPlayRef = useRef(false); // current round is a played Career event
  const careerEventRef = useRef<CareerEvent | null>(null); // the event being played
  const careerFieldRef = useRef<FieldPlayer[] | null>(null); // the field's per-hole scores (card + live board)
  const rankedPlayRef = useRef(false); // current round is a ranked round (AI field, placement RP)
  const rankedFieldRef = useRef<FieldPlayer[] | null>(null); // the ranked AI field's per-hole scores
  const rankedPlaceSpanRef = useRef<[number, number]>([PLACEMENT_MIN_RATING, PLACEMENT_MAX_RATING]); // rating band of the current placement field (for the estimate)
  const [careerLastResult, setCareerLastResult] = useState<EventResult | null>(null);
  const [careerCoins, setCareerCoins] = useState(0); // account coins paid by the last PLAYED career round (0 when simmed)
  // Write the active career into its slot and persist all slots. A null `c` clears
  // the open slot (abandon). The whole array is saved under CAREERS_KEY; the cloud
  // sync reads it from there (see saveProgress → readLocalProgress).
  const saveCareer = useCallback((c: Career | null) => {
    setCareer(c);
    careerRef.current = c;
    const slot = careerSlotRef.current;
    if (slot == null) return; // no slot open — nothing to persist
    const next = careersRef.current.slice();
    next[slot] = c;
    careersRef.current = next;
    setCareers(next);
    try { localStorage.setItem(CAREERS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);
  // Open a save slot into the hub (an empty slot shows the "Begin career" form).
  const openCareerSlot = useCallback((slot: number) => {
    const c = careersRef.current[slot] ?? null;
    careerSlotRef.current = slot; careerRef.current = c;
    setCareerSlot(slot); setCareer(c);
    setCareerLastResult(null); setCareerNotes([]);
  }, []);
  // Leave the open career → back to the slot picker (the career itself is untouched).
  const leaveCareer = useCallback(() => {
    careerSlotRef.current = null; careerRef.current = null;
    setCareerSlot(null); setCareer(null);
    setCareerLastResult(null); setCareerNotes([]);
  }, []);
  // Delete a save from the picker (or via Abandon in the hub).
  const deleteCareerSlot = useCallback((slot: number) => {
    const next = careersRef.current.slice();
    next[slot] = null;
    careersRef.current = next;
    setCareers(next);
    try { localStorage.setItem(CAREERS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  // ── Online Friendly Challenge lobby (Supabase Realtime) ──
  const [lobby, setLobby] = useState<{ code: string; isHost: boolean; mode: Mode; seed?: number; courseKey: string; courseLabel: string } | null>(null);
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [hostLeft, setHostLeft] = useState(false); // joiner's host dropped before the round started
  const sawHostRef = useRef(false); // we've seen the host present (so a drop is real, not a join flash)
  const [lobbyError, setLobbyError] = useState<string | null>(null); // joiner: bad/dead code → no game found
  const lobbyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [onlineScores, setOnlineScores] = useState<Record<string, OnlineScore>>({});
  const [onlineView, setOnlineView] = useState<{ hole: number; par: number; myId: string } | null>(null);
  const [finalOnline, setFinalOnline] = useState(false);
  const onlineRef = useRef<{ channel: RealtimeChannel; code: string; myId: string; myName: string; isHost: boolean; mode: Mode; seed?: number } | null>(null);
  const onlineScoresRef = useRef<Record<string, OnlineScore>>({});
  // Friends' recorded throws (per player id), replayed as ghost discs on the hole.
  const onlineGhostsRef = useRef<Record<string, OnlineGhost>>({});
  const onlineGhostHoleRef = useRef<number>(-1); // hole the ghost replay clock is keyed to
  const onlineGhostStartRef = useRef<number>(0); // perf time you arrived on that hole
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
      // Use the shared, crash-safe parser (handles malformed encoding + dotted
      // names) rather than a drifting inline copy.
      const c = parseChallenge(new URLSearchParams(location.search).get("ch"));
      if (c) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setChallenge({ mode: c.mode, seed: c.seed, score: c.score, name: c.name });
      }
    } catch { /* ignore malformed links */ }
  }, []);
  const challengeRef = useRef<Challenge | null>(null);
  useEffect(() => { challengeRef.current = challenge; }, [challenge]);
  const [finalPars, setFinalPars] = useState<number[]>(HOLES.map((h) => h.par));
  const [finalMode, setFinalMode] = useState<Mode>("course");
  // Today's Daily-Challenge star result for the finish screen: stars earned this
  // round, the day's (difficulty-adjusted) to-par goals, the day's best so far,
  // and the coin bonus paid for any newly earned star tiers.
  const [finalDailyStars, setFinalDailyStars] = useState<{ earned: number; best: number; thresholds: [number, number, number]; coins: number } | null>(null);
  // Daily-Challenge stars by day index (persisted; per-day best of 1–3).
  const [dayStars, setDayStars] = useState<Record<string, number>>({});
  const [dayBests, setDayBests] = useState<Record<string, number>>({}); // day → best to-par on that day's own Daily
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [winthropBest, setWinthropBest] = useState<number | null>(null);
  const [olympusBest, setOlympusBest] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [leaderboard, setLeaderboard] = useState<ArcadeScore[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  // Leaderboard identity: a guest's remembered choice (a name, or Skip), the
  // open "post under which name?" prompt, and how the last result was handled.
  const [boardChoice, setBoardChoice] = useState<BoardChoice | null>(null);
  const [namePrompt, setNamePrompt] = useState<{ error: string | null; resume: (c: BoardChoice) => void } | null>(null);
  const [postStatus, setPostStatus] = useState<"asking" | "skipped" | null>(null); // round results
  const [postedAs, setPostedAs] = useState<string | null>(null);
  const [miniPost, setMiniPost] = useState<PostOutcome | null>(null);
  // Re-entry points for the name prompt (the posting callbacks resume through these).
  const saveScoreRef = useRef<(c?: BoardChoice) => Promise<void>>(async () => {});
  const runMiniPostRef = useRef<(res: { kind: "putt" | "target"; makes: number; best: number; points: number; coins: number }, c: BoardChoice | null, isActive: () => boolean) => Promise<void>>(async () => {});
  const [shareMsg, setShareMsg] = useState<string | null>(null); // transient share/copy confirmation

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

  // Your saved DEFAULT shot shape (set in Settings) — distinct from the current,
  // in-round shape above. Each hole tees off from these; in-round stance/angle
  // tweaks are temporary and never overwrite the default (see the tee-reset effect).
  const [defaultThrowStyle, setDefaultThrowStyle] = useState<"BH" | "FH">("BH");
  const defaultThrowStyleRef = useRef<"BH" | "FH">("BH");
  useEffect(() => { defaultThrowStyleRef.current = defaultThrowStyle; }, [defaultThrowStyle]);
  const [defaultRelease, setDefaultRelease] = useState<Release>("flat");
  const defaultReleaseRef = useRef<Release>("flat");
  useEffect(() => { defaultReleaseRef.current = defaultRelease; }, [defaultRelease]);

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
  // Monotonic lifetime totals behind the balance, so cross-device sync can merge
  // coins without restoring spent ones or dropping coins earned elsewhere.
  const coinsEarnedRef = useRef(0);
  const coinsSpentRef = useRef(0);
  const [daily, setDaily] = useState<DailyReward | null>(null);
  const [today, setToday] = useState(0); // current day number (set on mount; avoids Date.now() in render)
  const [dailyClaim, setDailyClaim] = useState<{ coins: number; streak: number } | null>(null);
  const [coinReward, setCoinReward] = useState(0); // coins earned by the round just finished
  const [miniResult, setMiniResult] = useState<{ kind: "putt" | "target"; makes: number; best: number; points: number; coins: number } | null>(null);
  const [miniBoard, setMiniBoard] = useState<ArcadeScore[]>([]); // global board for the finished mini (putt / accuracy)
  const [miniSaving, setMiniSaving] = useState(false);
  // Add coins (or spend, with a negative amount): updates state, storage, cloud.
  const addCoins = useCallback((delta: number) => {
    const next = Math.max(0, Math.round(coinsRef.current + delta));
    coinsRef.current = next;
    setCoins(next);
    // Feed the monotonic earned/spent accumulators that back the loss-free merge.
    if (delta > 0) coinsEarnedRef.current += delta;
    else if (delta < 0) coinsSpentRef.current += -delta;
    try {
      localStorage.setItem(COINS_KEY, String(next));
      localStorage.setItem(COINSEARNED_KEY, String(Math.round(coinsEarnedRef.current)));
      localStorage.setItem(COINSSPENT_KEY, String(Math.round(coinsSpentRef.current)));
    } catch { /* ignore */ }
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
  const celebrationRef = useRef<string>(DEFAULT_CELEBRATION);
  useEffect(() => { trailKeyRef.current = profile.trail || DEFAULT_TRAIL; }, [profile.trail]);
  useEffect(() => { discSkinRef.current = profile.discSkin || DEFAULT_DISC_SKIN; }, [profile.discSkin]);
  useEffect(() => { basketSkinRef.current = profile.basketSkin || DEFAULT_BASKET_SKIN; }, [profile.basketSkin]);
  useEffect(() => { aimStyleRef.current = profile.aimStyle || DEFAULT_AIM_STYLE; }, [profile.aimStyle]);
  useEffect(() => { celebrationRef.current = profile.celebration || DEFAULT_CELEBRATION; }, [profile.celebration]);
  const profileRef = useRef(profile);
  useEffect(() => { profileRef.current = profile; }, [profile]);
  // Career rounds wear the career's OWN bought cosmetics; normal play wears your
  // account profile's. These swap the render refs at round start / end.
  const applyCareerLook = useCallback((look: CareerLook) => {
    discSkinRef.current = look.discSkin; basketSkinRef.current = look.basketSkin;
    aimStyleRef.current = look.aimStyle;
    celebrationRef.current = look.celebration; trailKeyRef.current = look.trail;
  }, []);
  const applyAccountLook = useCallback(() => {
    const p = profileRef.current;
    discSkinRef.current = p.discSkin || DEFAULT_DISC_SKIN; basketSkinRef.current = p.basketSkin || DEFAULT_BASKET_SKIN;
    aimStyleRef.current = p.aimStyle || DEFAULT_AIM_STYLE;
    celebrationRef.current = p.celebration || DEFAULT_CELEBRATION; trailKeyRef.current = p.trail || DEFAULT_TRAIL;
  }, []);
  const saveProfile = useCallback((next: PlayerProfile) => {
    setProfile(next);
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);
  const buyAvatar = useCallback((key: string, price: number) => buyItem(avatarOwnKey(key), price), [buyItem]);

  // ── Ranked ladder (lifetime RP + tier, persisted + cloud-synced) ──
  const [ranked, setRanked] = useState<RankedState | null>(null);
  const rankedRef = useRef<RankedState | null>(null);
  const [rankedOpen, setRankedOpen] = useState(false);
  const [rankedResult, setRankedResult] = useState<RankedResult | PlacementResult | null>(null); // outcome of the ranked round just finished (placement or ranked)
  const [placeMarks, setPlaceMarks] = useState<(number | null)[]>([null, null, null]); // finish place per placement round → the dot colors
  const placeMarksRef = useRef<(number | null)[]>(placeMarks);
  useEffect(() => { placeMarksRef.current = placeMarks; }, [placeMarks]);
  const [placementReveal, setPlacementReveal] = useState<PlacementResult | null>(null); // the "you're placed!" celebration after round 3
  const [seasonReward, setSeasonReward] = useState<SeasonRecord | null>(null); // last season's payout, shown as a one-time card

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
  const [hub, setHub] = useState<"home" | "solo" | "online" | "challenge" | "practice" | "holePractice">("home");
  // How many challenge rewards (daily + weekly) are ready to claim (badged).
  const claimableEvents = (() => {
    const hist = history as EventRound[];
    const wk = centralWeekFromDay(today); // the Central week that contains today
    const dayRows = roundsThisDay(hist, today);
    const weekRows = roundsThisWeek(hist, wk);
    const dailyN = dailyChallenges(today).filter((c) => challengeDone(c, dayRows) && !owned.includes(dailyClaimKey(today, c.id))).length;
    const weeklyN = weeklyChallenges(wk).filter((c) => challengeDone(c, weekRows) && !owned.includes(eventClaimKey(wk, c.id))).length;
    return dailyN + weeklyN;
  })();

  // An interrupted solo round shows as a resume banner above the menu. The Daily is
  // deliberately excluded — it's one-and-done, so exiting it means starting over.
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
      const oBest = localStorage.getItem(OBEST_KEY);
      setOlympusBest(oBest && Number.isFinite(Number(oBest)) ? Number(oBest) : null);

      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      if (s.throwStyle === "BH" || s.throwStyle === "FH") { setDefaultThrowStyle(s.throwStyle); setThrowStyle(s.throwStyle); }
      if (s.release === "hyzer" || s.release === "flat" || s.release === "anny") { setDefaultRelease(s.release); setRelease(s.release); }
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
      // Load all career save slots (migrating a legacy single career into slot 0).
      const slotsRaw = JSON.parse(localStorage.getItem(CAREERS_KEY) || "null");
      const legacyCar = JSON.parse(localStorage.getItem(CAREER_KEY) || "null");
      const rawSlots: unknown[] = Array.isArray(slotsRaw) ? slotsRaw : (legacyCar ? [legacyCar] : []);
      const loadedCareers = Array.from({ length: CAREER_SLOTS }, (_, i) => {
        const c = rawSlots[i] as Career | null;
        return c && c.v === 1 && c.skills ? normalizeCareer(c) : null;
      });
      careersRef.current = loadedCareers; setCareers(loadedCareers);
      // One-time: course backgrounds are now fixed per course, so ground themes are
      // no longer purchasable. Refund coins spent on any owned ones and drop them
      // from the owned set (guarded so it runs exactly once).
      try {
        if (!localStorage.getItem("discgolf.groundrefund.v1")) {
          const ownRaw = JSON.parse(localStorage.getItem(OWNED_KEY) || "[]");
          if (Array.isArray(ownRaw)) {
            let refund = 0;
            const kept = ownRaw.filter((k) => {
              const t = GROUND_THEMES.find((g) => cosmeticOwnKey(COSMETIC_PREFIX.ground, g.key) === k);
              if (t) { refund += t.price; return false; }
              return true;
            });
            if (kept.length !== ownRaw.length) localStorage.setItem(OWNED_KEY, JSON.stringify(kept));
            if (refund > 0) localStorage.setItem(COINS_KEY, String((Number(localStorage.getItem(COINS_KEY)) || 0) + refund));
          }
          localStorage.setItem("discgolf.groundrefund.v1", "1");
        }
      } catch { /* ignore */ }
      const coinRaw = localStorage.getItem(COINS_KEY);
      const co = coinRaw != null && Number.isFinite(Number(coinRaw)) ? Number(coinRaw) : 0;
      coinsRef.current = co; setCoins(co);
      // Earned/spent back the balance; legacy saves without them treat the
      // current balance as "earned" so balance = earned − spent still holds.
      const ceRaw = localStorage.getItem(COINSEARNED_KEY);
      coinsEarnedRef.current = ceRaw != null && Number.isFinite(Number(ceRaw)) ? Number(ceRaw) : co;
      const csRaw = localStorage.getItem(COINSSPENT_KEY);
      coinsSpentRef.current = csRaw != null && Number.isFinite(Number(csRaw)) ? Number(csRaw) : 0;
      setDaily(JSON.parse(localStorage.getItem(DAILY_KEY) || "null"));
      setToday(dayNumber(Date.now()));
      const ds = JSON.parse(localStorage.getItem(DAILYSTARS_KEY) || "{}");
      setDayStars(ds && typeof ds === "object" ? ds : {});
      const dbs = JSON.parse(localStorage.getItem(DAILYBEST_KEY) || "{}");
      setDayBests(dbs && typeof dbs === "object" ? dbs : {});
      setBoardChoice(readBoardChoice(localStorage));
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
      // Roll Ranked into the current monthly season — resets the ladder + redoes
      // placement when the month turns over, remembering last season's finish.
      const rankedMonth = centralMonth(Date.now());
      const { state: st, reward: seasonReward } = rolloverSeason(rk && typeof rk === "object" ? rk : null, rankedMonth);
      rankedRef.current = st; setRanked(st);
      if (!rk || rk.season !== rankedMonth) { try { localStorage.setItem(RANKED_KEY, JSON.stringify(st)); } catch { /* ignore */ } }
      // Placement dot colors track the current run; a rollover that wiped
      // placement clears them, otherwise restore where the run left off.
      const pm = st.placeEstimates.length === 0 ? [null, null, null] : readPlaceMarks();
      placeMarksRef.current = pm; setPlaceMarks(pm);
      if (st.placeEstimates.length === 0) { try { localStorage.setItem(PLACEMARKS_KEY, JSON.stringify(pm)); } catch { /* ignore */ } }
      // A season just ended → pay out the gold and show the season-end card.
      if (seasonReward) { addCoins(seasonReward.coins); setSeasonReward(seasonReward); }
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
    // The Daily is one-and-done: exit it and you start over, so never snapshot it.
    if (g.replay || g.mode === "daily" || g.mode === "ranked" || g.practice || g.party || g.online || g.career || tournamentPlayRef.current || challengePlayRef.current || careerPlayRef.current) return;
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
  // Guest-first: open straight to the title menu (no login gate).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setScreen((s) => (s === "landing" ? "title" : s));
    setEntryResolved(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  const [user, setUser] = useState<{ email: string } | null>(null);
  const userRef = useRef<{ email: string } | null>(null);
  useEffect(() => { userRef.current = user; }, [user]);
  // The signed-in session's access token, for posting scores under the account.
  const sessionToken = useCallback(async () => {
    try { return (await supa?.auth.getSession())?.data.session?.access_token ?? null; } catch { return null; }
  }, [supa]);
  const [authOpen, setAuthOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false); // arrived via a password-reset link → set a new password
  // A failed email link (expired or already-used reset/confirmation) bounces back
  // here with the error in the URL hash. Surface it in the auth panel — silently
  // landing on the title screen reads as "the link did nothing".
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof location === "undefined" || !location.hash.includes("error")) return;
    const h = new URLSearchParams(location.hash.slice(1));
    const desc = h.get("error_description") || h.get("error");
    if (!desc) return;
    setAuthErr(h.get("error_code") === "otp_expired"
      ? "That email link has expired. Enter your email and tap Forgot password to get a fresh one."
      : desc);
    setAuthMsg(null);
    setScreen("title");
    setAuthOpen(true);
    window.history.replaceState(null, "", location.pathname + location.search); // strip the error from the URL
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
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
    // Stamp the local change time on every save (even offline) so a later merge
    // can tell which device has the newer preferences/profile.
    try { localStorage.setItem(UPDATEDAT_KEY, String(Date.now())); } catch { /* ignore */ }
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

  // Progress carried over from the old `*.vercel.app` link arrives as a URL token
  // (see lib/discgolf/transfer). Merge it loss-free into this domain's progress —
  // same merge the cloud sign-in uses — then strip the token and confirm.
  const [transferred, setTransferred] = useState(false);
  const [legacyHost, setLegacyHost] = useState(false); // on the old vercel.app link → offer to move progress
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setLegacyHost(isLegacyHost());
    const incoming = readTransferToken();
    if (!incoming) return;
    clearTransferToken();
    applyProgress(mergeProgress(readLocalProgress(), incoming));
    loadLocal();
    void pushCloud(); // if also signed in, push the union to the cloud
    setTransferred(true);
  }, [loadLocal, pushCloud]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
    // An already-registered email comes back as a FAKE user with no identities
    // (Supabase hides account existence) — and no email is sent. Saying "check
    // your email" would strand them waiting for mail that never comes.
    else if (data.user && !data.session && (data.user.identities?.length ?? 0) === 0)
      setAuthErr("An account with this email already exists — log in instead, or tap Forgot password.");
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
    // Supabase reports success even when no account matches (so email addresses
    // can't be probed), so phrase it conditionally — a wrong address otherwise
    // sends people hunting for an email that will never come.
    else setAuthMsg(`If an account exists for ${email}, a reset link is on its way. No email? Check spam, and make sure that's the address you signed up with.`);
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
    // Leaving the account wipes THIS DEVICE'S copy so the next guest session or
    // sign-up starts a fresh account (the cloud keeps the signed-out account's
    // data — logging back in restores it). Device settings are kept. Reload so
    // every in-memory value resets cleanly and we land on the menu as a guest.
    try {
      localStorage.removeItem(ENTRY_KEY);
      [RESUME_KEY, TOURN_KEY, TOURBEST_KEY, TOURNBEST_KEY].forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
    clearLocalProgress();
    if (typeof location !== "undefined") location.reload();
  }, [supa]);

  // Open the sign-in panel (from the "Sign in to sync" chip or the profile).
  const openSignIn = useCallback(() => {
    setAuthErr(null); setAuthMsg(null); setAuthOpen(true);
  }, []);

  // Persist settings + push the music volume to the live engine.
  useEffect(() => {
    audioRef.current?.setMusicVolume(musicVolume);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ throwStyle: defaultThrowStyle, release: defaultRelease, musicVolume, leftHanded, showGhost, muted }));
    } catch { /* ignore */ }
    saveProgress();
  }, [defaultThrowStyle, defaultRelease, musicVolume, leftHanded, showGhost, muted, saveProgress]);

  // Each hole tees off with your DEFAULT shot shape. In-round stance/angle tweaks
  // last only for the hole you're on — reaching the next tee (the screen returns to
  // "playing") snaps the shape back to your saved default, mirroring how the
  // auto-caddie re-clubs the disc for every lie.
  useEffect(() => {
    if (screen !== "playing") return;
    throwStyleRef.current = defaultThrowStyleRef.current;
    releaseRef.current = defaultReleaseRef.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThrowStyle(defaultThrowStyleRef.current);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRelease(defaultReleaseRef.current);
  }, [screen]);

  // Sync the career save to the cloud whenever it changes (debounced; no-op
  // when signed out). localStorage is already written by saveCareer.
  // Sync to the cloud whenever any career slot changes (skip the initial hydration
  // so we don't push an empty array before the saved slots have loaded).
  const careersHydrated = useRef(false);
  useEffect(() => {
    if (!careersHydrated.current) { careersHydrated.current = true; return; }
    saveProgress();
  }, [careers, saveProgress]);
  // Sync coins + daily-reward + owned items + profile + ranked to the cloud on change.
  useEffect(() => { saveProgress(); }, [coins, daily, owned, profile, ranked, bag, bagSeen, levelRewarded, saveProgress]);

  const syncHud = useCallback(() => {
    const g = stateRef.current;
    if (!g) return;
    const hole = g.roundHoles[g.holeIndex];
    setHud({
      hole: g.holeIndex + 1, par: hole.par, throws: g.throws, holes: g.roundHoles.length,
      player: g.party ? g.party.names[g.party.current] : undefined,
      scores: g.roundHoles.map((_, i) => (typeof g.scores[i] === "number" ? g.scores[i] : null)),
      pars: g.roundHoles.map((h) => h.par),
    });
  }, []);

  // Auto-caddie: equip the disc the current lie calls for — a straight driver
  // off the tee, a midrange/putter as the basket gets close. The player can
  // still switch by hand for any shot. Skipped during the putt/target minis.
  const equipForLie = useCallback(() => {
    const g = stateRef.current;
    if (!g || g.mini) return;
    const hole = g.roundHoles[g.holeIndex];
    // Club for the lie: distance to the basket, the slope AT this lie, and the
    // wind along the shot (headwind → club up, tailwind → club down).
    const i = autoDiscIndex(distBetween(g.rest, hole.basket), activeBagRef.current, elevAt(hole, g.rest.y), windAlong(hole, g.rest));
    g.discIndex = i;
    discIndexRef.current = i;
    setDiscIndex(i);
    // A tree you've come to rest right behind is "ghosted": you throw through it
    // (real-life gap past the trunk), and it's drawn translucent so you can see.
    g.ghostTrees = treesAtLie(hole, g.rest.x, g.rest.y);
  }, []);

  // Auto-caddie for the practice minis (putting / accuracy): equip the disc the
  // station's distance calls for and reflect it everywhere — the game state the
  // throw reads (g.discIndex / discIndexRef) AND the React state the UI shows, so
  // the disc on screen always matches the one that flies. (equipForLie bails out
  // during minis; this is its mini-specific counterpart, run from a fresh tee.)
  const equipForMini = useCallback((g: GameState, hole: Hole) => {
    const i = autoDiscIndex(distBetween(g.rest, hole.basket), activeBagRef.current, elevAt(hole, g.rest.y), windAlong(hole, g.rest));
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
    rankedPlayRef.current = false; // ranked uses its own launcher (startRankedRound)
    const seed = seedOverride ?? (m === "daily" ? dailySeed() : (Math.random() * 1e9) | 0);
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
      ghostRef.current = m === "course" || m === "winthrop" || m === "olympus" ? JSON.parse(localStorage.getItem(`discgolf.ghost.${m}`) || "null") : null;
    } catch { ghostRef.current = null; }
    setSaved(false); setPostStatus(null);
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

  // Start the next unplayed round of a tournament. Tournaments are played straight
  // through — there's no save-and-continue; you finish the event in one sitting or
  // abandon it (see the abandon-on-leave effect below).
  const playTournamentRound = useCallback((t: Tournament) => {
    const def = tournDef(t.id);
    if (!def) return;
    const rd = def.rounds[t.myTotals.length];
    if (!rd) return;
    setTournamentOpen(false);
    // Tour rounds play their fixed venue seed; Glendoveer/Winthrop get a per-round
    // seed so each round's pins/wind differ.
    const seed = rd.seed ?? ((t.seed + t.myTotals.length * 1013904223) | 0);
    startGame(rd.mode, seed);
    tournamentPlayRef.current = true;
  }, [startGame]);

  // Leaving a tournament before it's finished abandons it: the moment we're back on
  // the title with an unfinished event in hand (Home from the results, quitting a
  // round, or a reload that restored one), drop it. So you either play the whole
  // tournament through or forfeit — never resume a half-finished one.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (screen === "title" && tournament && !tournament.finished) saveTournament(null);
  }, [screen, tournament, saveTournament]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Play a ranked round: a FRESH course every time, against an AI field whose
  // strength scales with your tier, with live standings + ghost racers on-course
  // (placement drives your RP). Its own launcher so it can wire up the field; play
  // as many as you like.
  const startRankedRound = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new AudioEngine();
      audioRef.current.setMusicVolume(musicVolume);
    }
    audioRef.current.resume();
    audioRef.current.setMuted(muted);
    audioRef.current.startMusic();
    challengePlayRef.current = false;
    tournamentPlayRef.current = false;
    careerPlayRef.current = false;
    rankedPlayRef.current = true;
    modeRef.current = "ranked";
    // Catch a month rollover that happened since load (e.g. the app stayed open
    // across midnight on the 1st) so this round counts in the right season.
    {
      const month = centralMonth(Date.now());
      if ((rankedRef.current?.season ?? 0) !== month) {
        const { state: rolled, reward } = rolloverSeason(rankedRef.current, month);
        rankedRef.current = rolled; setRanked(rolled);
        try { localStorage.setItem(RANKED_KEY, JSON.stringify(rolled)); } catch { /* ignore */ }
        if (reward) { addCoins(reward.coins); setSeasonReward(reward); }
      }
    }
    const seed = (Math.random() * 1e9) | 0; // a brand-new course each round
    const roundHoles = buildRound(seed, "ranked");
    // Your first rounds are placement. Round 1 is a fixed SILVER-level field; each
    // later placement round re-centers on your PROJECTED division (its tier mean
    // ±14) — beat them and the next field is harder, lose and it's easier. After
    // you're placed, the field scales to your tier as usual.
    const rk = rankedRef.current;
    if (rk?.placed) {
      rankedFieldRef.current = rankedFieldForRound(seed, rankedFieldMean(rk.rp), RANKED_FIELD, roundHoles);
    } else {
      const done = rk?.placeEstimates?.length ?? 0;
      const mean = rankedFieldMean(done === 0 ? PLACEMENT_START_RP : (rk?.rp ?? 0)); // round 1 = Silver, then your projection
      const span: [number, number] = [mean - 14, mean + 14];
      rankedPlaceSpanRef.current = span;
      rankedFieldRef.current = rankedPlacementField(seed, RANKED_FIELD, roundHoles, span[0], span[1]);
    }
    ghostsRef.current = null;
    const discIndex = validDiscIndex(discIndexRef.current, bagRef.current);
    discIndexRef.current = discIndex;
    setDiscIndex(discIndex);
    stateRef.current = {
      holeIndex: 0, scores: [], discIndex, roundPaths: [],
      mode: "ranked", skill: IDENTITY_MODS, seed, roundHoles, ...freshHole(roundHoles[0]),
    };
    ghostRef.current = null;
    setSaved(false); setPostStatus(null);
    setSaveErr(null);
    setIsNewBest(false);
    setNewAchievements([]);
    setHoleBestNote(null);
    setPartyView(null);
    setOnlineView(null);
    setTournLiveView(null); // clear any prior round's live board until the first hole completes
    setSettingsOpen(false);
    setRankedOpen(false);
    clearResume();
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
    rankedPlayRef.current = false;
    careerEventRef.current = ev;
    // Deterministic seed per (career, event) so a replay plays the same course.
    // Tour events carry their own course seed (it also drives the venue + par).
    let seed = ev.seed;
    if (seed == null) {
      let h = c.seed >>> 0;
      for (let i = 0; i < ev.id.length; i++) h = (Math.imul(h, 31) + ev.id.charCodeAt(i)) >>> 0;
      seed = h | 0;
    }
    // Early-career courses play short so you can compete without a distance driver.
    const roundHoles = buildRound(seed, ev.mode, careerHoleLenScale(c));
    // The field reacts to this course's wind/slope/hazards (card + live board).
    careerFieldRef.current = careerFieldForRound(c, ev, roundHoles);
    // Career carries its OWN bag (its separate disc collection), not your account bag.
    const careerBag = c.bag.length ? c.bag : ["aviar", "buzzz", "teebird"];
    activeBagRef.current = careerBag;
    setActiveBag(careerBag);
    applyCareerLook(c.look ?? DEFAULT_CAREER_LOOK); // wear the career's bought cosmetics
    const discIndex = validDiscIndex(discIndexRef.current, careerBag);
    discIndexRef.current = discIndex;
    setDiscIndex(discIndex);
    stateRef.current = {
      holeIndex: 0, scores: [], discIndex, roundPaths: [],
      mode: ev.mode, skill: skillMods(c.skills),
      career: { eventId: ev.id, eventName: ev.name, venue: ev.venue, character: ev.character, emoji: ev.emoji },
      lenScale: careerHoleLenScale(c),
      seed, roundHoles, ...freshHole(roundHoles[0]),
    };
    ghostRef.current = null;
    setSaved(false); setPostStatus(null);
    setSaveErr(null);
    setIsNewBest(false);
    setNewAchievements([]);
    setHoleBestNote(null);
    setPartyView(null);
    setOnlineView(null);
    setCareerOpen(false);
    setScreen("playing");
    syncHud();
  }, [muted, musicVolume, syncHud, applyCareerLook]);

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
      ghostRef.current = snap.mode === "course" || snap.mode === "winthrop" || snap.mode === "olympus" ? JSON.parse(localStorage.getItem(`discgolf.ghost.${snap.mode}`) || "null") : null;
    } catch { ghostRef.current = null; }
    setSaved(false); setPostStatus(null);
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
    setSaved(false); setPostStatus(null);
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
    challengePlayRef.current = false; tournamentPlayRef.current = false; careerPlayRef.current = false; rankedPlayRef.current = false;
    const hole = kind === "putt" ? puttHole(0) : targetHole(0);
    stateRef.current = {
      holeIndex: 0, scores: [], discIndex: 0, roundPaths: [],
      mode: "course", skill: IDENTITY_MODS, seed: 0, roundHoles: [hole], practice: true,
      mini: { kind, station: 0, makes: 0, best: 0, points: 0, attempts: 0, total: 10 },
      ...freshHole(hole),
    };
    if (stateRef.current) stateRef.current.phase = "aim"; // skip the fly-over intro
    if (stateRef.current) equipForMini(stateRef.current, hole); // right disc for the opening distance
    ghostRef.current = null;
    careerFieldRef.current = null;
    setMiniResult(null);
    setPartyView(null); setOnlineView(null); setSettingsOpen(false);
    setScreen("playing");
    syncHud();
  }, [muted, musicVolume, syncHud, equipForMini]);

  // When a practice mini ends, post the result to its global board (putts made /
  // accuracy points), then load that board for the results card. Guests are
  // asked once for a name (or Skip, which posts nothing); signed-in players post
  // under their account. Re-runs each time a new result appears.
  const runMiniPost = useCallback(async (res: NonNullable<typeof miniResult>, choice: BoardChoice | null, isActive: () => boolean) => {
    setMiniSaving(true);
    let out: PostOutcome;
    try {
      out = await postMiniResult(res, { signedIn: !!userRef.current, accountName: profileRef.current?.name ?? "", choice, getToken: sessionToken }, submitMiniScore);
    } catch { out = { status: "error", error: "Couldn't save the score — please try again.", reserved: false }; }
    if (!isActive()) return;
    setMiniPost(out);
    if (out.status === "ask" || (out.status === "error" && out.reserved)) {
      if (out.status === "error") { writeBoardChoice(localStorage, null); setBoardChoice(null); }
      setNamePrompt({ error: out.status === "error" ? out.error : null, resume: (c) => void runMiniPostRef.current(res, c, isActive) });
    }
    const lb = await getMiniLeaderboard(res.kind).catch(() => [] as ArcadeScore[]);
    if (!isActive()) return;
    setMiniBoard(lb);
    setMiniSaving(false);
  }, [sessionToken]);
  useEffect(() => { runMiniPostRef.current = runMiniPost; }, [runMiniPost]);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!miniResult) { setMiniBoard([]); setMiniSaving(false); setMiniPost(null); return; }
    let active = true;
    setMiniBoard([]);
    setMiniPost(null);
    void runMiniPost(miniResult, readBoardChoice(localStorage), () => active);
    return () => { active = false; };
  }, [miniResult, runMiniPost]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
    setSaved(false); setPostStatus(null);
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
    if (lobbyTimerRef.current) { clearTimeout(lobbyTimerRef.current); lobbyTimerRef.current = null; }
    setLobbyError(null);
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
    onlineGhostsRef.current = {}; // fresh round → clear any prior ghosts
    onlineGhostHoleRef.current = -1;
    setOnlineScores(onlineScoresRef.current);
    stateRef.current = {
      holeIndex: 0, scores: [], discIndex, roundPaths: [],
      mode: m, skill: IDENTITY_MODS, seed, roundHoles, online: true,
      ...freshHole(roundHoles[0]),
    };
    ghostRef.current = null;
    setSaved(false); setPostStatus(null);
    setSaveErr(null);
    setIsNewBest(false);
    setNewAchievements([]);
    setHoleBestNote(null);
    setPartyView(null);
    setOnlineView(null);
    setHub("home");
    setScreen("playing");
    syncHud();
  }, [muted, musicVolume, syncHud]);

  // Join a Realtime channel for a lobby code: presence drives the roster,
  // broadcast carries the start signal and live scores.
  const connectLobby = useCallback((code: string, myName: string, isHost: boolean, m: Mode, seed?: number, courseLabel?: string) => {
    if (!supa) return false;
    const myId = makeClientId();
    const channel = supa.channel(`dga-lobby-${code}`, {
      config: { presence: { key: myId }, broadcast: { self: false } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const st = channel.presenceState() as unknown as Record<string, LobbyPlayer[]>;
        const players = Object.values(st).map((arr) => arr[0]).filter(Boolean);
        setLobbyPlayers(players);
        // Prune the abandoned scorecard/ghosts of a player who left and rejoined
        // under a new client id: an entry whose id has left presence while a
        // PRESENT player carries the same name is that player's earlier card, so
        // drop it rather than showing them twice in the live standings. An absent
        // id with no present namesake is kept — a finished player's score stays
        // on the board, and a briefly-disconnected phone isn't wrongly wiped.
        const present = new Set(players.map((p) => p.id));
        const nameHolder = new Map(players.map((p) => [p.name, p.id]));
        const stale = (id: string, name: string) => {
          if (present.has(id)) return false;
          const holder = nameHolder.get(name);
          return holder != null && holder !== id;
        };
        const scores = onlineScoresRef.current;
        const keep = Object.entries(scores).filter(([id, s]) => !stale(id, s.name));
        if (keep.length !== Object.keys(scores).length) {
          onlineScoresRef.current = Object.fromEntries(keep);
          setOnlineScores(onlineScoresRef.current);
        }
        for (const [id, g] of Object.entries(onlineGhostsRef.current)) {
          if (stale(id, g.name)) delete onlineGhostsRef.current[id];
        }
        // If we're a joiner and the host disappears before the round starts, flag
        // it so the lobby can offer to leave instead of waiting forever. Only after
        // we've actually seen the host, so a join-time sync flash doesn't trip it.
        if (!isHost && !onlineStartedRef.current) {
          const hasHost = players.some((p) => p.host);
          if (hasHost) {
            sawHostRef.current = true;
            if (lobbyTimerRef.current) { clearTimeout(lobbyTimerRef.current); lobbyTimerRef.current = null; }
            setLobbyError(null);
          }
          setHostLeft(sawHostRef.current && !hasHost);
        }
      })
      .on("broadcast", { event: "start" }, ({ payload }) => {
        beginOnlineRound(payload.seed as number, payload.mode as Mode);
      })
      .on("broadcast", { event: "hello" }, () => {
        // A peer just joined. If a round is already underway, ANY in-round peer
        // re-sends the start signal so the joiner catches up — not just the host,
        // because a player who left mid-round (including the host themselves) and
        // rejoins by code re-enters as a plain joiner in a lobby that may have no
        // host anymore. They start fresh on hole 1 while everyone else plays on.
        // Duplicate re-sends are harmless: beginOnlineRound ignores a seed it has
        // already begun.
        const started = onlineStartedRef.current;
        if (started) {
          void channel.send({ type: "broadcast", event: "start", payload: { seed: started.seed, mode: started.mode } });
        }
      })
      .on("broadcast", { event: "score" }, ({ payload }) => {
        const p = payload as OnlineScore & { id: string };
        // Don't trust the peer's self-reported total/thru — recompute them from
        // the per-hole scores so a buggy or tampered client can't inject bogus
        // standings.
        const scores = Array.isArray(p.scores) ? p.scores.filter((n) => Number.isFinite(n)) : [];
        const total = scores.reduce((a, b) => a + b, 0);
        const name = typeof p.name === "string" ? p.name.slice(0, 24) : "Player";
        onlineScoresRef.current = { ...onlineScoresRef.current, [p.id]: { name, scores, total, thru: scores.length } };
        setOnlineScores(onlineScoresRef.current);
      })
      .on("broadcast", { event: "throw" }, ({ payload }) => {
        // A peer's recorded flight paths for a hole. Store them per player/hole so
        // we can replay their ghost. Sanitize: cap shots/points and coerce to nums.
        const p = payload as { id?: unknown; name?: unknown; hole?: unknown; paths?: unknown };
        if (typeof p.id !== "string" || typeof p.hole !== "number" || !Array.isArray(p.paths)) return;
        if (p.id === onlineRef.current?.myId) return; // never ghost yourself
        const paths: Vec[][] = p.paths.slice(0, 8).map((pa) =>
          (Array.isArray(pa) ? pa : []).slice(0, 30)
            .map((pt) => ({ x: Number((pt as Vec)?.x), y: Number((pt as Vec)?.y) }))
            .filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y)),
        ).filter((pa) => pa.length > 0);
        if (!paths.length) return;
        const name = typeof p.name === "string" ? p.name.slice(0, 24) : "Player";
        const store = onlineGhostsRef.current;
        const gd = store[p.id] ?? { name, color: ghostColorFor(p.id), holes: {} };
        gd.name = name;
        const cur = gd.holes[p.hole] ?? { shots: [], arrivals: [] };
        for (let i = cur.shots.length; i < paths.length; i++) cur.arrivals[i] = performance.now();
        cur.shots = paths;
        gd.holes[p.hole] = cur;
        store[p.id] = gd;
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ id: myId, name: myName, host: isHost, mode: m, courseLabel });
          // Ask whoever's already here whether a round is in progress.
          void channel.send({ type: "broadcast", event: "hello", payload: { id: myId } });
          // Joiner: if no host shows up shortly, the code was wrong or the game is
          // gone — surface that instead of leaving them on "Connecting…" forever.
          if (!isHost) {
            if (lobbyTimerRef.current) clearTimeout(lobbyTimerRef.current);
            lobbyTimerRef.current = setTimeout(() => {
              if (!onlineStartedRef.current && !sawHostRef.current) {
                setLobbyError("No game found with that code. Double-check it and try again.");
              }
            }, 9000);
          }
        }
      });
    onlineRef.current = { channel, code, myId, myName, isHost, mode: m, seed };
    return true;
  }, [supa, beginOnlineRound]);

  const createLobby = useCallback((name: string) => {
    const code = makeLobbyCode();
    const c = CHALLENGE_COURSES[0]; // default to Glendoveer; host re-picks in the lobby
    const who = name.trim() || "Host";
    if (!connectLobby(code, who, true, c.mode, c.seed, c.name)) return;
    setLobbyPlayers([{ id: "self", name: who, host: true, mode: c.mode, courseLabel: c.name }]);
    setLobby({ code, isHost: true, mode: c.mode, seed: c.seed, courseKey: challengeKey(c), courseLabel: c.name });
    writeLobbySession({ code, name: who, isHost: true, mode: c.mode, seed: c.seed, courseKey: challengeKey(c), courseLabel: c.name });
  }, [connectLobby]);

  const joinLobby = useCallback((code: string, name: string) => {
    const c = code.trim().toUpperCase();
    const who = name.trim() || "Player";
    if (!connectLobby(c, who, false, "winthrop")) return;
    setLobby({ code: c, isHost: false, mode: "winthrop", courseKey: "winthrop", courseLabel: "Winthrop Lake" });
    writeLobbySession({ code: c, name: who, isHost: false, mode: "winthrop", seed: undefined, courseKey: "winthrop", courseLabel: "Winthrop Lake" });
  }, [connectLobby]);

  // Host picks a course from the lobby dropdown: update our ref + presence (so
  // joiners see the new course name) and the lobby state (so our dropdown reflects
  // it). The actual seed/mode ride out in the "start" broadcast at round start.
  const pickCourse = useCallback((c: CourseInfo) => {
    const o = onlineRef.current;
    if (!o || !o.isHost) return;
    o.mode = c.mode;
    o.seed = c.seed;
    void o.channel.track({ id: o.myId, name: o.myName, host: true, mode: c.mode, courseLabel: c.name });
    setLobby((lb) => (lb ? { ...lb, mode: c.mode, seed: c.seed, courseKey: challengeKey(c), courseLabel: c.name } : lb));
    writeLobbySession({ code: o.code, name: o.myName, isHost: true, mode: c.mode, seed: c.seed, courseKey: challengeKey(c), courseLabel: c.name });
  }, []);

  const startOnlineHost = useCallback(() => {
    const o = onlineRef.current;
    if (!o) return;
    // Tour venues carry a fixed seed (that's what makes them that course); the two
    // fixed venues get a fresh random seed each game for varied pin placements.
    const seed = o.seed ?? ((Math.random() * 1e9) | 0);
    void o.channel.send({ type: "broadcast", event: "start", payload: { seed, mode: o.mode } });
    beginOnlineRound(seed, o.mode);
  }, [beginOnlineRound]);

  const leaveLobby = useCallback(() => {
    clearLobbySession(); // an explicit leave shouldn't auto-rejoin next launch
    const o = onlineRef.current;
    if (o) void supa?.removeChannel(o.channel);
    onlineRef.current = null;
    onlineScoresRef.current = {};
    onlineGhostsRef.current = {};
    onlineGhostHoleRef.current = -1;
    onlineStartedRef.current = null;
    sawHostRef.current = false;
    if (lobbyTimerRef.current) { clearTimeout(lobbyTimerRef.current); lobbyTimerRef.current = null; }
    setLobbyError(null);
    setHostLeft(false);
    setLobby(null);
    setLobbyPlayers([]);
    setOnlineScores({});
  }, [supa]);

  // Tear down any live lobby channel if the component unmounts mid-session, so
  // the Realtime subscription doesn't leak.
  useEffect(() => () => { const o = onlineRef.current; if (o) void supa?.removeChannel(o.channel); }, [supa]);

  // On first mount, rejoin the lobby you were last in — a reload / relaunch (or
  // the OS killing the PWA in the background) otherwise drops you back on the
  // title screen. The session is cleared on an explicit leave and expires after
  // LOBBY_TTL, so this only fires for a genuinely live one. If the host already
  // started the round, connectLobby's "hello" ping pulls us straight into it.
  const reconnectedRef = useRef(false);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (reconnectedRef.current || !supa || onlineRef.current) return;
    reconnectedRef.current = true;
    const s = readLobbySession();
    if (!s || !connectLobby(s.code, s.name, s.isHost, s.mode, s.seed, s.courseLabel)) return;
    setLobby({ code: s.code, isHost: s.isHost, mode: s.mode, seed: s.seed, courseKey: s.courseKey, courseLabel: s.courseLabel });
    setLobbyPlayers([{ id: "self", name: s.name, host: s.isHost, mode: s.mode, courseLabel: s.courseLabel }]);
    setScreen("title"); // the lobby panel only renders on the title screen
  }, [supa, connectLobby]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const selectDisc = useCallback((i: number) => {
    // Only discs carried in the bag are selectable during a round.
    if (!ADV_DISCS[i] || !activeBagRef.current.includes(ADV_DISCS[i].key)) return;
    setDiscIndex(i);
    if (stateRef.current) stateRef.current.discIndex = i;
  }, []);

  // ── Round replays (lib/discgolf/replay.ts) ──
  const [lastReplay, setLastReplay] = useState<Replay | null>(null); // the round just finished
  const [replayView, setReplayView] = useState<{ data: Replay; ended: boolean; speed: number; fromResults: boolean } | null>(null); // watching one now
  const [replayLink, setReplayLink] = useState<string | null>(null);
  const [replayBusy, setReplayBusy] = useState(false);
  const [pendingReplay, setPendingReplay] = useState<Replay | null>(null); // opened from a ?rp= link
  const [replayLoadErr, setReplayLoadErr] = useState<string | null>(null);

  const startReplay = useCallback((r: Replay, fromResults = false) => {
    const roundHoles = buildRound(r.seed, r.mode, r.scale ?? 1);
    if (roundHoles.length !== r.paths.length) { setReplayLoadErr("This replay is from a different version of the course."); return; }
    audioRef.current?.resume();
    challengePlayRef.current = false;
    tournamentPlayRef.current = false;
    careerPlayRef.current = false;
    rankedPlayRef.current = false;
    ghostRef.current = null;
    ghostsRef.current = null;
    stateRef.current = {
      holeIndex: 0, scores: [], discIndex: discIndexRef.current, roundPaths: [],
      mode: r.mode, skill: IDENTITY_MODS, seed: r.seed, roundHoles, ...freshHole(roundHoles[0]),
      replay: { data: r, clock: 0, lastT: 0, speed: 1, lastFlying: -1, ended: false },
    };
    setReplayView({ data: r, ended: false, speed: 1, fromResults });
    setPendingReplay(null);
    setPauseMenu(null);
    setScreen("playing");
    syncHud();
  }, [syncHud]);

  const setReplaySpeed = useCallback((speed: number) => {
    const rp = stateRef.current?.replay;
    if (rp) rp.speed = speed;
    setReplayView((v) => (v ? { ...v, speed } : v));
  }, []);
  const skipReplayHole = useCallback(() => {
    const g = stateRef.current;
    if (!g?.replay) return;
    if (g.phase === "intro") g.introT = 1e6; // jump past the fly-over
    else g.replay.clock = 1e9;             // finish the hole on the next frame
  }, []);
  const endReplay = useCallback(() => {
    const back = replayView?.fromResults;
    setReplayView(null);
    stateRef.current = null;
    audioRef.current?.stopMusic();
    if (!back) try { window.history.replaceState(null, "", location.pathname); } catch { /* ignore */ }
    setScreen(back ? "gameComplete" : "title");
  }, [replayView]);

  const shareReplay = useCallback(async () => {
    if (!lastReplay || replayBusy) return;
    setReplayBusy(true);
    try {
      let link = replayLink;
      if (!link) {
        const res = await saveReplay(lastReplay);
        if ("error" in res) { setShareMsg(res.error); window.setTimeout(() => setShareMsg(null), 4000); return; }
        link = `${location.origin}${location.pathname}?rp=${res.id}`;
        setReplayLink(link);
      }
      const total = lastReplay.scores.reduce((a, b) => a + b, 0);
      const par = lastReplay.pars.reduce((a, b) => a + b, 0);
      const d = total - par;
      const text = `Watch my ${total} (${d === 0 ? "E" : d > 0 ? `+${d}` : d}) on Disc Golf Arcade`;
      const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
      if (nav.share) { try { await nav.share({ title: "Disc Golf Arcade replay", text, url: link }); return; } catch { /* cancelled → copy instead */ } }
      let copied = false;
      try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(link); copied = true; } } catch { /* not allowed → show it */ }
      setShareMsg(copied ? "Replay link copied" : link);
      window.setTimeout(() => setShareMsg(null), copied ? 2600 : 15000);
    } finally {
      setReplayBusy(false);
    }
  }, [lastReplay, replayBusy, replayLink]);

  // ?rp=<id> opens a shared replay (after a tap, so audio + fullscreen behave).
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("rp");
    if (!id) return;
    let alive = true;
    loadReplay(id).then((r) => {
      if (!alive) return;
      if (r) setPendingReplay(r); else setReplayLoadErr("That replay link has expired or is broken.");
    }).catch(() => { if (alive) setReplayLoadErr("Couldn't load that replay."); });
    return () => { alive = false; };
  }, []);

  const throwDisc = useCallback(() => {
    const g = stateRef.current;
    if (!g || g.phase !== "aim") return;
    const disc = ADV_DISCS[g.discIndex];
    // Each disc flies its baked-in shape (e.g. Nuke OS overstable, Destroyer
    // straight).
    g.path = "straight";
    g.release = releaseRef.current;
    // Slower launch + extra glide (disc friction) so it floats across the
    // fairway. Straight throws carry farther; the hole's slope acts on the
    // disc in-flight (see SLOPE_PULL in stepFlight), not on the launch.
    const pathMul = (g.path === "straight" ? STRAIGHT_SPEED_MUL : 1) * releaseSpeedMul(g.release);
    // Career skills bend the shot: low control adds a random release-angle error
    // within the aim cone. (momentum is retired → mo is always 1.)
    const mo = g.momentum ?? 1;
    const speed = disc.power * (1.2 + g.power * 3.35) * pathMul * g.skill.speedMul * mo;
    const spread = (g.skill.aimSpread ?? 0) / mo;
    const angle = g.angle + (Math.random() * 2 - 1) * spread;
    g.disc.vx = Math.cos(angle) * speed;
    g.disc.vy = Math.sin(angle) * speed;
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
    // Every solo round can be watched back (and shared) from the results screen.
    if (g && !g.practice && !g.party && !g.online && !g.mini && !g.replay && scores.length === g.roundHoles.length) {
      setLastReplay(buildReplay({
        mode: g.mode, seed: g.seed, scale: g.lenScale, name: profileRef.current.name || "A friend",
        label: g.career?.eventName, scores, pars: g.roundHoles.map((h) => h.par),
        // A resumed round only recorded the holes played since resuming — the
        // earlier ones play back as an empty fly-over.
        paths: (() => {
          const rec = [...g.roundPaths, g.shotPaths];
          return [...Array.from({ length: Math.max(0, g.roundHoles.length - rec.length) }, () => []), ...rec].slice(-g.roundHoles.length);
        })(),
      }));
    } else {
      setLastReplay(null);
    }
    setReplayLink(null);
    setCoinReward(0);
    setRankedResult(null);
    // A played Career event: record the result against the career and pop back
    // to the hub instead of the normal results / leaderboard flow.
    if (g?.career && careerPlayRef.current) {
      careerPlayRef.current = false;
      rankedPlayRef.current = false;
      setActiveBag(bagRef.current); // career round over — the rack goes back to your account bag
      applyAccountLook(); // and the cosmetics go back to your account look
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
        // The one thing that does cross over: playing a career round pays account
        // coins by where you FINISH (win big, mid-pack less), so the mode still
        // feeds your wallet — reward harder play, not just an under-par score.
        const reward = coinsForFinish(ev.importance, result.placed, result.field);
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

    // Personal bests are tracked per fixed course — Glendoveer, Winthrop and
    // Olympus each have their own key (the daily course changes every day).
    if (!practice && (mode === "course" || mode === "winthrop" || mode === "olympus")) {
      const key = mode === "course" ? BEST_KEY : mode === "winthrop" ? WBEST_KEY : OBEST_KEY;
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
      else if (mode === "winthrop") setWinthropBest(best);
      else setOlympusBest(best);
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

    // Daily Challenge stars — three to-par goals tuned to how hard today's nine
    // holes play (see dailyStarThresholds). Only today's own daily counts (a
    // replayed challenge link from a past day earns nothing) and the day keeps
    // its best result. Written before saveProgress below so the cloud sync
    // (readLocalProgress) picks it up.
    if (!practice && mode === "daily" && g && g.seed === dailySeed()) {
      const toPar = total - pars.reduce((s, n) => s + n, 0);
      const thresholds = dailyStarThresholds(g.seed);
      const earned = dailyStarsEarned(g.seed, toPar);
      let map: Record<string, number> = {};
      try { map = JSON.parse(localStorage.getItem(DAILYSTARS_KEY) || "{}") ?? {}; } catch { /* ignore */ }
      const prev = map[g.seed] ?? 0;
      // Newly reached star tiers pay their coin bounty — as the difference from
      // the day's previous best, so each tier pays at most once per day.
      const starBonus = Math.max(0, dailyStarCoins(earned) - dailyStarCoins(prev));
      if (starBonus > 0) addCoins(starBonus);
      if (earned > prev) {
        map = trimDailyStars({ ...map, [g.seed]: earned });
        try { localStorage.setItem(DAILYSTARS_KEY, JSON.stringify(map)); } catch { /* ignore */ }
      }
      setDayStars(map);
      // Today's best to-par (also what the Daily streak counts).
      let bests: Record<string, number> = {};
      try { bests = JSON.parse(localStorage.getItem(DAILYBEST_KEY) || "{}") ?? {}; } catch { /* ignore */ }
      if (bests[g.seed] == null || toPar < bests[g.seed]) {
        bests = trimDailyBests({ ...bests, [g.seed]: toPar });
        try { localStorage.setItem(DAILYBEST_KEY, JSON.stringify(bests)); } catch { /* ignore */ }
      }
      setDayBests(bests);
      setFinalDailyStars({ earned, best: Math.max(earned, prev), thresholds, coins: starBonus });
    } else {
      setFinalDailyStars(null);
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
        const fieldTotals = [...t.fieldTotals, tournFieldRound(t.seed, roundIdx, tournRoundPlayHoles(t.seed, roundIdx, def.rounds[roundIdx]))];
        let madeCut = t.madeCut;
        let finished = false;
        if (hasCut && roundIdx === 1) {
          const sums = [myTotals[0] + myTotals[1], ...fieldTotals[0].map((_, i) => fieldTotals[0][i] + fieldTotals[1][i])];
          const sorted = [...sums].sort((a, b) => a - b);
          const line = sorted[Math.floor(sorted.length / 2) - 1];
          madeCut = myTotals[0] + myTotals[1] <= line;
          if (!madeCut) { finished = true; fieldTotals.push(tournFieldRound(t.seed, 2, tournRoundPlayHoles(t.seed, 2, def.rounds[2]))); } // field plays on
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
    // Ranked posts to a single global all-time board (handled in saveScore), not a
    // per-round course board — so skip the per-seed fetch and show the field instead.
    if (!practice && mode !== "ranked") void getArcadeLeaderboard(leaderboardCourse(mode, g?.seed ?? 0)).then(setLeaderboard).catch(() => {});
    // Ranked round: place against the AI field → RP (placement + streak bonus), so
    // you climb or fall the tiers. Your best to-par still posts to the global board.
    if (!practice && mode === "ranked" && rankedFieldRef.current) {
      const toPar = total - pars.reduce((s, n) => s + n, 0);
      const field = rankedFieldRef.current;
      const place = 1 + field.filter((p) => p.total < total).length; // ties favor you
      // Placement rounds calibrate your starting rank; after that it's normal RP.
      const inPlacement = !(rankedRef.current?.placed ?? false);
      const [spanLo, spanHi] = rankedPlaceSpanRef.current;
      const { state, result } = inPlacement
        ? applyPlacementRound(rankedRef.current, place, field.length + 1, toPar, spanLo, spanHi)
        : applyRankedRound(rankedRef.current, place, field.length + 1, toPar);
      rankedRef.current = state; setRanked(state);
      try { localStorage.setItem(RANKED_KEY, JSON.stringify(state)); } catch { /* ignore */ }
      setRankedResult(result);
      // Record this placement round's finish for the dot tracker (round 1 starts
      // a fresh run), and fire the reveal once the third round lands.
      if ("placement" in result) {
        const marks = result.round === 1 ? [null, null, null] : placeMarksRef.current.slice();
        marks[result.round - 1] = place;
        placeMarksRef.current = marks; setPlaceMarks(marks);
        try { localStorage.setItem(PLACEMARKS_KEY, JSON.stringify(marks)); } catch { /* ignore */ }
        if (result.placed) setPlacementReveal(result);
      }
    } else {
      setRankedResult(null);
    }
    if (!practice) saveProgress(); // sync best/achievements/history to the cloud if signed in
    // Coins for a counting round (more for going low). Career events pay cash,
    // not coins, and are handled in their own branch above.
    if (!practice) {
      const reward = coinsForRound(total - pars.reduce((s, n) => s + n, 0), pars.length, modeCoinMult(mode));
      setCoinReward(reward);
      addCoins(reward);
    }
  }, [saveProgress, saveTournament, clearResume, saveCareer, addCoins, applyAccountLook]);

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
    applyAccountLook(); // and account cosmetics
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
  }, [saveCareer, clearResume, applyAccountLook]);

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
    if (g.replay) { startReplay(g.replay.data, replayView?.fromResults ?? false); return; }
    audioRef.current?.resume();
    stateRef.current = {
      ...g,
      holeIndex: 0,
      scores: [],
      roundPaths: [],
      momentum: 1, // fresh round → neutral momentum
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
  }, [syncHud, startReplay, replayView]);

  const exitToHome = useCallback(() => {
    audioRef.current?.stopMusic();
    if (stateRef.current?.replay) { setReplayView(null); stateRef.current = null; setPauseMenu(null); setScreen("title"); return; }
    if (stateRef.current?.online) leaveLobby();
    tournamentPlayRef.current = false;
    rankedPlayRef.current = false;
    const wasCareer = careerPlayRef.current;
    careerPlayRef.current = false;
    if (wasCareer) { setActiveBag(bagRef.current); applyAccountLook(); } // restore the account bag + cosmetics
    setPauseMenu(null);
    setResumeRound(readResume()); // surface "Resume" if we left a solo round mid-way
    if (wasCareer) setCareerOpen(true); // bail back to the career hub
    setScreen("title");
  }, [leaveLobby, applyAccountLook]);

  // Submit the finished round to its leaderboard (auto-triggered when the
  // results screen shows). Signed-in players post under their account; guests
  // post under their chosen name, are asked once, or skipped.
  const saveScore = useCallback(async (choiceOverride?: BoardChoice) => {
    if (saving || saved) return;
    setSaving(true);
    setSaveErr(null);
    try {
      // Ranked posts to ONE global all-time board, scored by best to-par (encoded
      // into the board's stroke range) so it's comparable across the fresh courses.
      const isRanked = finalMode === "ranked";
      const course = isRanked ? RANKED_BOARD_KEY : leaderboardCourse(finalMode, finalSeed);
      const strokes = isRanked ? encodeToParScore(finalTotal - finalPars.reduce((s, n) => s + n, 0)) : finalTotal;
      const out = await postRoundResult(
        { strokes, course },
        { signedIn: !!user, accountName: profile.name, choice: choiceOverride ?? readBoardChoice(localStorage), getToken: sessionToken },
        submitArcadeScore,
      );
      if (out.status === "ask" || (out.status === "error" && out.reserved)) {
        if (out.status === "error") { writeBoardChoice(localStorage, null); setBoardChoice(null); }
        setPostStatus("asking");
        setNamePrompt({ error: out.status === "error" ? out.error : null, resume: (c) => { setPostStatus(null); void saveScoreRef.current(c); } });
        return;
      }
      if (out.status === "skipped") { setPostStatus("skipped"); return; }
      if (out.status === "error") { setSaveErr(out.error); return; }
      setPostedAs(out.as);
      setSaved(true);
      if (!isRanked) {
        const lb = await getArcadeLeaderboard(course);
        setLeaderboard(lb);
      }
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [saving, saved, user, profile.name, finalTotal, finalMode, finalSeed, finalPars, sessionToken]);
  useEffect(() => { saveScoreRef.current = saveScore; }, [saveScore]);

  // Auto-save the round to the leaderboard when the results screen appears
  // (skips practice / pass-&-play / online matches, and a pending or skipped ask).
  useEffect(() => {
    if (screen !== "gameComplete") return;
    if (finalPracticeHole != null || finalParty || finalOnline) return;
    if (saved || saving || postStatus) return;
    void saveScore();
  }, [screen, finalPracticeHole, finalParty, finalOnline, saved, saving, postStatus, saveScore]);

  // The guest answered the name prompt: remember it and carry on posting.
  const answerNamePrompt = useCallback((c: BoardChoice) => {
    writeBoardChoice(localStorage, c);
    setBoardChoice(c);
    const p = namePrompt;
    setNamePrompt(null);
    p?.resume(c);
  }, [namePrompt]);
  // "Post my scores" after an earlier Skip: forget the Skip and ask again.
  const reaskBoardName = useCallback((resume: (c: BoardChoice) => void) => {
    writeBoardChoice(localStorage, null);
    setBoardChoice(null);
    setNamePrompt({ error: null, resume });
  }, []);
  // The name the boards show for this player (highlights "my" row).
  const myBoardName = user ? (profile.name.trim() || "Player") : boardChoice?.kind === "name" ? boardChoice.name : null;

  // Share a challenge link that replays this exact round (mode + seed).
  // Render the finished round to an image and share it (or download as fallback).
  const shareCard = useCallback(async () => {
    const total = finalTotal;
    const parTotal = finalPars.reduce((s, n) => s + n, 0);
    const over = total - parTotal;
    const nHoles = finalPars.length;
    const isDaily = finalMode === "daily";
    const courseLabel = isDaily ? "Daily Challenge" : finalMode === "winthrop" ? "Winthrop Lake" : finalMode === "olympus" ? "Olympus" : finalMode === "ranked" ? "Ranked" : finalMode === "tour" ? tourVenue(finalSeed) : "Glendoveer East";
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

    const flash = (msg: string) => { setShareMsg(msg); window.setTimeout(() => setShareMsg(null), 2200); };
    const where = isDaily ? "today's Daily Challenge" : courseLabel;
    // A replay link when the mode supports it (course/winthrop/daily), else just the app.
    const canLink = finalMode === "course" || finalMode === "winthrop" || finalMode === "olympus" || finalMode === "daily";
    const link = `${location.origin}${location.pathname}${canLink ? `?ch=${challengeParam(finalMode, finalSeed, total, profile.name.trim() || "A friend")}` : ""}`;
    const shareText = `I shot ${total} (${os(over)}) on ${where}! ${link}`;
    await new Promise<void>((resolve) => {
      cv.toBlob(async (blob) => {
        if (!blob) return resolve();
        // 1) Native share sheet with the scorecard image (mobile). If the sheet
        //    opens we're done — success OR cancel — we never fall back to a download.
        try {
          const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
          const file = new File([blob], "discgolf-scorecard.png", { type: "image/png" });
          if (nav.canShare?.({ files: [file] })) {
            await nav.share({ files: [file], title: "Disc Golf", text: `I shot ${total} (${os(over)}) on ${where}!` });
            return resolve();
          }
        } catch { return resolve(); /* cancelled/failed — do nothing (no download) */ }
        // 2) No share sheet (desktop): copy to the clipboard instead of downloading —
        //    the scorecard image if the browser allows it, otherwise the challenge link.
        try {
          const CI = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
          if (CI && navigator.clipboard?.write) {
            await navigator.clipboard.write([new CI({ [blob.type]: blob })]);
            flash("Scorecard copied to clipboard");
            return resolve();
          }
        } catch { /* image clipboard unsupported — fall back to a text link */ }
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(shareText);
            flash("Share link copied to clipboard");
            return resolve();
          }
        } catch { /* ignore */ }
        flash("Sharing isn't available here");
        resolve();
      }, "image/png");
    });
  }, [finalTotal, finalPars, finalMode, finalSeed, scorecard, profile.name]);

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
      } else if (rankedPlayRef.current && rankedFieldRef.current) {
        if (ghostsRef.current?.holeIndex !== g.holeIndex) {
          const racers = rankedCardRacers(rankedFieldRef.current, g.holeIndex);
          ghostsRef.current = buildRacerGhosts(g.seed >>> 0, g.holeIndex, hole, racers, performance.now());
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

      // Replay: fly the disc along the recorded paths instead of the physics.
      if (g.replay) {
        const rp = g.replay;
        const now = performance.now();
        if (!rp.ended) rp.clock += (rp.lastT ? Math.min(100, now - rp.lastT) : 0) * rp.speed;
        rp.lastT = now;
        const shots = rp.data.paths[g.holeIndex] ?? [];
        const fr = replayFrame(shots, rp.clock);
        g.phase = "fly"; // hides the aim line; draws the disc (and live trail) in flight
        g.disc.x = fr.x; g.disc.y = fr.y; g.disc.vx = 0; g.disc.vy = 0;
        g.h = fr.lift;
        g.shotPaths = shots.filter((p) => p.length).slice(0, fr.done);
        g.trailBuf = fr.trail;
        const throws = fr.done + (fr.flying >= 0 ? 1 : 0);
        if (fr.flying >= 0 && fr.flying !== rp.lastFlying) { audioRef.current?.sfx("throw"); }
        if (fr.flying < 0 && rp.lastFlying >= 0 && fr.done === shots.filter((p) => p.length).length) audioRef.current?.sfx("chains");
        rp.lastFlying = fr.flying;
        if (throws !== g.throws) { g.throws = throws; syncHud(); }
        if (fr.finished && !rp.ended) {
          if (g.holeIndex + 1 < g.roundHoles.length) {
            // Like normal play: a hole's score joins the card as you walk off it
            // (the last hole stays live on the HUD via g.throws).
            g.scores[g.holeIndex] = rp.data.scores[g.holeIndex];
            g.holeIndex += 1;
            Object.assign(g, freshHole(g.roundHoles[g.holeIndex]));
            rp.clock = 0; rp.lastT = 0; rp.lastFlying = -1;
          } else {
            rp.ended = true;
            setReplayView((v) => (v ? { ...v, ended: true } : v));
          }
          syncHud();
        }
        return;
      }

      if (g.phase === "aim") {
        // Aim + power are driven by the pointer drag handlers; nothing to do here.
      } else if (g.phase === "fly") {
        const d = g.disc;
        const disc = ADV_DISCS[g.discIndex];
        const f: Flight = { x: d.x, y: d.y, vx: d.vx, vy: d.vy, h: g.h, vh: g.vh, fadeTurn: g.fadeTurn };
        const res = stepFlight(f, disc, g.fadeSign, g.path, hole, g.release, { catchR: g.skill.catchR * (g.momentum ?? 1), windMul: g.skill.windMul, ghostTrees: g.ghostTrees });
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
              Object.assign(g, freshHole(nh)); g.mini = m; g.phase = "aim"; equipForMini(g, nh);
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
            else { const nh = targetHole(m.station + 1); m.station += 1; g.roundHoles[0] = nh; Object.assign(g, freshHole(nh)); g.mini = m; g.phase = "aim"; equipForMini(g, nh); syncHud(); }
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
          if (g.online && onlineRef.current) sendThrows(onlineRef.current, g.holeIndex, g.shotPaths);
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
          // resolvePenalty encapsulates the rule (water/ob kind, +1 stroke, and
          // the new lie: drop zone if any, else the last in-bounds point).
          const pen = resolvePenalty(res.status, hole, { x: f.x, y: f.y }, g.trailBuf, g.rest);
          const inWater = pen.kind === "water";
          audioRef.current?.sfx(inWater ? "water" : "tree");
          vibrate(60);
          spawnBurst(
            f.x, f.y,
            inWater ? ["#5b8fc4", "#9cc4e8", "#3a6ea5"] : ["#cfd8dc", "#9aa4b2"],
            inWater ? 16 : 8, inWater ? 1.8 : 1.2,
          );
          shake(inWater ? 3 : 2);
          const lie = pen.lie ?? g.rest;
          g.throws += pen.strokes;
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
          if (g.online && onlineRef.current) sendThrows(onlineRef.current, g.holeIndex, g.shotPaths);
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
          const pen = resolvePenalty("stop", hole, { x: d.x, y: d.y }, g.trailBuf, g.rest);
          if (pen.kind === "sand") {
            g.throws += pen.strokes;
            g.flash = { text: "HAZARD", at: performance.now() };
            spawnBurst(d.x, d.y, ["#d9c089", "#c4a96b"], 12, 1.4);
            audioRef.current?.sfx("tree");
            vibrate(60);
            syncHud();
          }
          g.shotPaths.push(g.trailBuf);
          g.trailBuf = [];
          if (g.online && onlineRef.current) sendThrows(onlineRef.current, g.holeIndex, g.shotPaths);
          g.angle = aimAt(g.rest, hole.basket); // auto-aim at the basket
          g.phase = "aim";
          equipForLie(); // re-club for the new lie
        }
      } else if (g.phase === "holed") {
        if (g.holedAt && performance.now() - g.holedAt > 850) {
          g.scores[g.holeIndex] = g.throws;
          // Momentum was retired with the Mental skill, so this is always neutral (1)
          // now — kept wired so the call site is ready if momentum ever returns.
          g.momentum = momentumAfter(g.skill, g.throws, g.roundHoles[g.holeIndex].par);
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
          } else if (rankedPlayRef.current && rankedFieldRef.current) {
            // Ranked: live board of you vs the AI field after each hole.
            const myScores = g.scores.slice(0, g.holeIndex + 1).map((x) => x ?? 0);
            const parThru = g.roundHoles.slice(0, g.holeIndex + 1).reduce((s, h) => s + h.par, 0);
            const rows = careerLiveStandings(rankedFieldRef.current, "You", myScores, g.holeIndex + 1, parThru);
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
      const ground = cosmeticByKey(GROUND_THEMES, hole.theme ?? DEFAULT_GROUND_THEME) ?? GROUND_THEMES[0];
      const ink = themeInk(ground.fairway); // high-contrast ink for the basket ring + aim line
      const treeStyle = treeStyleFor(hole.theme); // per-course tree palette (winter, autumn, ...)

      // Everything outside the fairway is rough — out of bounds normally, or
      // olive-tinted hazard ground on rope-lined holes (+1, play where it lies).
      ctx.fillStyle = hole.roughIsHazard ? "#535426" : ground.rough;
      ctx.fillRect(0, 0, W, H);
      // Letterbox the spare space around the board in the same colour.
      const area = playAreaRef.current;
      if (area && area.dataset.letterbox !== ctx.fillStyle) { area.dataset.letterbox = String(ctx.fillStyle); area.style.backgroundColor = String(ctx.fillStyle); }
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

      // Grass OB islands — ovals of ROUGH inside the fairway, colored exactly
      // like the out-of-bounds rough beyond the ribbon (same ground color, same
      // mowing bands, same white OB line) so they read as the side OB reaching
      // in. Land in one and it plays exactly like water OB.
      // Everything is clipped to the fairway corridor, so an oval that overlaps
      // the ribbon edge merges seamlessly with the side OB. Two clips at
      // slightly different radii make the junction clean: the rough FILL clips
      // a hair OUTSIDE the boundary so it swallows the ribbon's white edge line
      // (and its antialiased seam) where the oval crosses it, while the white
      // OUTLINE clips a hair INSIDE so it terminates flush against the side OB
      // line instead of drawing a bubble on top of the rough.
      if (hole.obZones?.length) {
        const corridorAt = (rad: number) => {
          const p = new Path2D();
          for (const fw of [hole.fairway, ...(hole.fairways ?? [])]) {
            for (let i = 0; i < fw.length - 1; i++) {
              const ax = fw[i].x, ay = fw[i].y, bx = fw[i + 1].x, by = fw[i + 1].y;
              const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 8));
              for (let s = 0; s <= steps; s++) {
                const x = ax + ((bx - ax) * s) / steps, y = ay + ((by - ay) * s) / steps - cam;
                p.moveTo(x + rad, y);
                p.arc(x, y, rad, 0, Math.PI * 2);
              }
            }
          }
          return p;
        };
        const ovalOf = (ob: Water) => { ctx.beginPath(); ctx.ellipse(ob.x + ob.w / 2, ob.y - cam + ob.h / 2, ob.w / 2, ob.h / 2, 0, 0, Math.PI * 2); };

        // Pass 1 — rough fill + mowing bands, spilling just past the boundary.
        ctx.save();
        ctx.clip(corridorAt(hole.fwWidth / 2 + 4));
        for (const ob of hole.obZones) {
          ovalOf(ob);
          ctx.fillStyle = ground.rough;
          ctx.fill();
          // Bands phase-locked to the outer rough's world-space bands.
          ctx.save();
          ovalOf(ob);
          ctx.clip();
          ctx.fillStyle = ground.roughBand;
          for (let y = Math.floor(ob.y / 32) * 32; y < ob.y + ob.h; y += 32) {
            ctx.fillRect(ob.x, y - cam, ob.w, 16);
          }
          ctx.restore();
        }
        ctx.restore();

        // Pass 2 — white OB outline + tag, stopping just inside the boundary.
        ctx.save();
        ctx.clip(corridorAt(hole.fwWidth / 2 - 1));
        for (const ob of hole.obZones) {
          ovalOf(ob);
          ctx.strokeStyle = "#eef1e6"; // the same white OB line as the ribbon edge
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.lineWidth = 1;
          ctx.fillStyle = "rgba(238,241,230,0.9)";
          ctx.font = "bold 6px ui-monospace, monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("OB", ob.x + ob.w / 2, ob.y - cam + ob.h / 2 + 0.5);
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
        }
        ctx.restore();
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
      drawBasket(ctx, hole.basket.x + rattle, hole.basket.y - cam, g.skill.catchR * (g.momentum ?? 1), cosmeticByKey(BASKET_SKINS, basketSkinRef.current), ink.ring);
      for (const tr of hole.trees) {
        // A tree you're stuck right behind goes translucent — a cue that this
        // throw passes through it (the aim line runs straight on through, too).
        const ghosted = g.ghostTrees?.includes(tr);
        if (ghosted) ctx.globalAlpha = 0.4;
        drawTree(ctx, { x: tr.x, y: tr.y - cam, r: tr.r }, treeStyle);
        if (ghosted) ctx.globalAlpha = 1;
      }

      // Tournament rivals playing the hole alongside you (simulated field).
      if ((tournamentPlayRef.current || careerPlayRef.current || rankedPlayRef.current) && ghostsRef.current?.holeIndex === g.holeIndex) {
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

      // Friends' ghosts: replay each peer's recorded throws on this hole. The
      // replay clock resets whenever you arrive on a new hole, so a hole a friend
      // has already played re-throws from the start when you get there; throws
      // made live (while you're both here) animate as they land.
      if (g.online) {
        if (onlineGhostHoleRef.current !== g.holeIndex) {
          onlineGhostHoleRef.current = g.holeIndex;
          onlineGhostStartRef.current = performance.now();
        }
        const now = performance.now();
        const myId = onlineRef.current?.myId;
        ctx.textAlign = "center";
        for (const id in onlineGhostsRef.current) {
          if (id === myId) continue;
          const gd = onlineGhostsRef.current[id];
          const gs = gd.holes[g.holeIndex];
          if (!gs) continue;
          const pos = onlineGhostPos(gs, onlineGhostStartRef.current, now);
          if (!pos) continue;
          const sx = pos.x;
          const sy = pos.y - cam;
          const dy = sy - pos.lift;
          ctx.globalAlpha = 0.45; // shadow
          ctx.fillStyle = "rgba(0,0,0,0.35)";
          ctx.beginPath();
          ctx.ellipse(sx, sy, 2.2, 1.3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.9; // disc
          ctx.fillStyle = gd.color;
          ctx.beginPath();
          ctx.arc(sx, dy, 2.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.fillRect(Math.round(sx) - 0.5, Math.round(dy) - 0.5, 1, 1);
          ctx.globalAlpha = 0.85; // name tag
          ctx.font = "5px ui-monospace, monospace";
          ctx.fillStyle = "rgba(0,0,0,0.65)";
          ctx.fillText(gd.name, sx + 0.4, dy - 5.6);
          ctx.fillStyle = gd.color;
          ctx.fillText(gd.name, sx, dy - 6);
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
        const path: FlightPath = "straight";
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
          const mo = g.momentum ?? 1;
          const speed = aimDisc.power * (1.2 + power * 3.35) * pathMul * g.skill.speedMul * mo;
          const spread = (g.skill.aimSpread ?? 0) / mo;
          const eCatchR = g.skill.catchR * mo;
          // Trace a full flight from a given launch angle.
          const trace = (ang: number) => {
            const f: Flight = { x: g.disc.x, y: g.disc.y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, h: 0, vh: power * aimDisc.arc, fadeTurn: 0 };
            const out: { x: number; y: number }[] = [{ x: f.x, y: f.y }];
            for (let i = 0; i < 360; i++) { const r = stepFlight(f, aimDisc, sign, path, hole, releaseRef.current, { catchR: eCatchR, windMul: g.skill.windMul, ghostTrees: g.ghostTrees, preview: true }); out.push({ x: f.x, y: f.y }); if (r.status !== "fly") break; }
            return out;
          };
          // Trace the centre flight first so the cone can match its drawn length.
          const pts = trace(g.angle);
          // Only reveal the first half of the flight, fading from solid to gone.
          const shown = Math.max(2, Math.floor(pts.length * 0.5));
          // Control cone: low control fans the aim into a range your disc might
          // actually go. Draw a filled amber wedge + bold edges so the possible
          // landing area is clear (collapses to nothing at 99 control). The edges
          // run exactly as far as the main aim line and fade out alongside it.
          if (spread > 0.002) {
            const left = trace(g.angle - spread);
            const right = trace(g.angle + spread);
            const n = Math.max(2, Math.min(shown, left.length, right.length));
            // Filled wedge — the area the disc could end up in.
            ctx.beginPath();
            ctx.moveTo(left[0].x, left[0].y - cam);
            for (let i = 1; i < n; i++) ctx.lineTo(left[i].x, left[i].y - cam);
            for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y - cam);
            ctx.closePath();
            ctx.fillStyle = "rgba(240,170,70,0.15)";
            ctx.fill();
            // Bold edges bounding the spread — same reach + fade as the aim line.
            ctx.lineWidth = 2;
            ctx.strokeStyle = "rgb(245,180,80)";
            for (const ep of [left, right]) {
              for (let i = 0; i < n - 1; i++) {
                ctx.globalAlpha = Math.max(0.04, 0.9 * (1 - Math.pow(i / (shown - 1), 1.4)));
                ctx.beginPath();
                ctx.moveTo(ep[i].x, ep[i].y - cam);
                ctx.lineTo(ep[i + 1].x, ep[i + 1].y - cam);
                ctx.stroke();
              }
            }
            ctx.globalAlpha = 1;
          }
          const aimStyle = cosmeticByKey(AIM_STYLES, aimStyleRef.current) ?? AIM_STYLES[0];
          // Keep your chosen aim-line color unless it's too low-contrast on this
          // course's fairway (e.g. white on snow); only then fall back to the dark
          // ink that matches the basket ring. A darker, well-contrasting pick stays.
          const aimColor = ink.onLight && contrastRatio(aimStyle.color, ground.fairway) < 3 ? ink.line : aimStyle.color;
          ctx.lineWidth = 2;
          ctx.strokeStyle = aimColor;
          if (aimStyle.dash) ctx.setLineDash(aimStyle.dash);
          if (aimStyle.glow && aimColor === aimStyle.color) { ctx.shadowBlur = 6; ctx.shadowColor = aimStyle.color; }
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

        // Slider track + knob (the pull-back handle). Neutral white so it never
        // reads as a disc-color change — the only color cue is red in the cancel zone.
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(dsx, dsy);
        ctx.lineTo(kx, ky);
        ctx.stroke();
        ctx.fillStyle = inCancel ? "#e23b3b" : dr.active ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.7)";
        ctx.beginPath();
        ctx.arc(kx, ky, dr.active ? 5 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.stroke();
        ctx.lineWidth = 1;
        // Power ring (0–100% of a full pull) just outside the cancel circle.
        if (dr.active && !inCancel) {
          drawPowerRing(ctx, dsx, dsy, CANCEL_R + 5, g.power);
          if (process.env.NODE_ENV !== "production") powerRingDebugRef.current = { drawn: g.power, at: performance.now() };
        }
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
      // Two-tone edge on skin × course pairs where the body alone is under 3:1
      // (Ember on Olympus sand, Shadow on Night, Sky on Snow…): a ring in the
      // shade that contrasts with the body, wrapped in the opposite shade, so
      // one of them always separates the disc from the ground. Drawn after
      // restore() so the glow skins' halo doesn't blur it.
      const outline = discOutline(skin.body, [ground.fairway, ground.stripe, ground.rough]);
      if (outline) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = outline.outer;
        ctx.beginPath();
        ctx.arc(g.disc.x, discY, DISC_R + 1.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = outline.inner;
        ctx.beginPath();
        ctx.arc(g.disc.x, discY, DISC_R + 0.5, 0, Math.PI * 2);
        ctx.stroke();
      }
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

      // Weather (screen space, over the world but under the HUD) gives each course
      // its own atmosphere — light rain or drifting snow per the hole's scene.
      drawWeather(ctx, hole.weather, performance.now());

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
        ctx.fillStyle = ground.rough; // rough (themed)
        ctx.fillRect(ox, oy, mw, mh);
        // curved fairway ribbon(s)
        ctx.strokeStyle = ground.fairway;
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
        ctx.fillStyle = treeStyle.base;
        for (const tr of hole.trees) {
          ctx.beginPath();
          ctx.arc(ox + tr.x * s, oy + tr.y * s, Math.max(1.4, tr.r * s), 0, Math.PI * 2);
          ctx.fill();
        }
        // viewport window (tracks both camera axes)
        ctx.strokeStyle = ink.ring;
        ctx.lineWidth = 1;
        ctx.strokeRect(ox + camX * s + 0.5, oy + cam * s + 0.5, Math.min(mw, W * s) - 1, Math.min(mh, H * s) - 1);
        // tournament rivals
        if ((tournamentPlayRef.current || careerPlayRef.current || rankedPlayRef.current) && ghostsRef.current?.holeIndex === g.holeIndex) {
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
        ctx.fillStyle = ink.line;
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
  }, [syncHud, persistResume, addCoins, equipForLie, equipForMini]);

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
    if (!g || g.phase !== "aim" || g.replay) return;
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
  const finalBest = finalMode === "course" ? bestScore : finalMode === "winthrop" ? winthropBest : finalMode === "olympus" ? olympusBest : finalMode === "tour" ? (tourBests[finalSeed] ?? null) : null;
  const overStr = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
  // Today's Daily star goals (difficulty-adjusted, same for everyone) and the
  // stars already banked today — for the Daily Challenge menu card. Deferred to
  // the Single Player page so the daily hole pool isn't built on first paint.
  const todayStars = today ? (dayStars[today] ?? 0) : 0;
  const todayGoals = useMemo(() => (hub === "solo" && today ? dailyStarThresholds(today) : null), [hub, today]);

  return (
    <div className="app-root w-full bg-[#0f1117] flex flex-col select-none overflow-hidden">
      {/* Play area — canvas fills the available space, keeping its aspect ratio.
          Phones: the board sits flush on the controls and full width; any spare
          height above it is letterboxed in the course's own rough colour (set
          from the render loop), not the page background. */}
      <div
        ref={playAreaRef}
        className="relative flex-1 min-h-0 min-w-0 flex items-end justify-center lg:items-center lg:p-2"
        // Keep the board (and its top status pill) clear of the notch / Dynamic
        // Island in a home-screen PWA — pad down past the top safe area.
        style={{ paddingTop: "max(env(safe-area-inset-top), 0.5rem)" }}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={onCanvasDown}
          className="max-h-full max-w-full bg-[#4a8a3a] lg:rounded-lg lg:border lg:border-white/10"
          style={{ imageRendering: "pixelated", touchAction: "none" }}
        />

        {/* Boot splash: shown until the entry effect decides landing vs. title, so
            returning players never see the login front door flash by. Matches the
            landing/title gradient + logo, so it reads as the app loading. */}
        {!entryResolved && (
          <div className="absolute inset-0 rounded-lg bg-gradient-to-b from-[#1c2233] via-[#141926] to-[#0f1117]">
            <div
              className="min-h-full flex items-center justify-center px-5"
              style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)", paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
            >
              <div className="flex flex-col items-center text-center animate-pulse">
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
              </div>
            </div>
          </div>
        )}

        {screen === "title" && (
          <>
          {/* Settings gear — top-right on every title hub (wherever the logo + profile show) */}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="absolute z-10 w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 active:bg-white/15 text-gray-300 hover:text-white text-lg transition"
            // Pin to the top-right of the app's centered mobile-width column (the
            // same 480px frame the in-round HUD caps at), not the window edge — on
            // a wide desktop the window's corner is nowhere near the app. The max()
            // keeps it 12px from the screen edge on phones.
            style={{ top: "max(env(safe-area-inset-top), 0.5rem)", right: "max(0.75rem, calc(50% - 240px + 0.75rem))" }}
          >
            ⚙
          </button>
          <div className="absolute inset-0 overflow-y-auto rounded-lg bg-gradient-to-b from-[#1c2233] via-[#141926] to-[#0f1117]">
            <AttractBackdrop />
            <div
              className="relative min-h-full flex items-start justify-center px-5"
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
                  <div className="w-full mt-7 flex items-stretch gap-2">
                  <button
                    type="button"
                    onClick={() => setProfileOpen(true)}
                    className="min-w-0 flex-1 flex items-center gap-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 transition text-left"
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
                  {/* Optional account: sign in to sync across devices. Guests play
                      everything; this is the only place the menu asks. */}
                  {supa && !user && (
                    <button
                      type="button"
                      onClick={openSignIn}
                      className="shrink-0 rounded-xl border border-[#36D7B7]/40 bg-[#36D7B7]/10 hover:bg-[#36D7B7]/20 px-2.5 text-[11px] font-bold leading-tight text-[#36D7B7] transition"
                    >
                      ☁ Sign in<br />to sync
                    </button>
                  )}
                  </div>
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
                  {challenge.mode === "course" ? "Glendoveer" : challenge.mode === "winthrop" ? "Winthrop Lake" : challenge.mode === "olympus" ? "Olympus" : "a Daily course"} — play it!
                </button>
              )}

              {/* Resume an interrupted solo round (the Daily is excluded — exiting
                  it restarts, so it never offers a resume). */}
              {resumeBanner && (
                <button
                  type="button"
                  onClick={() => startResume(resumeBanner)}
                  className="w-full rounded-xl border border-[#36D7B7]/60 bg-[#36D7B7]/15 hover:bg-[#36D7B7]/25 text-white font-bold py-3 px-3 mt-4 transition text-sm"
                >
                  ↻ Continue round · {resumeBanner.mode === "course" ? "Glendoveer" : resumeBanner.mode === "winthrop" ? "Winthrop Lake" : resumeBanner.mode === "olympus" ? "Olympus" : resumeBanner.mode === "tour" ? tourVenue(resumeBanner.seed) : resumeBanner.mode === "ranked" ? "Ranked" : "round"} · hole {resumeBanner.scores.length + 1}
                </button>
              )}

              {/* On the old vercel.app link with progress to move: one click ships it
                  to the canonical domain (localStorage can't cross origins on its own). */}
              {legacyHost && (coins > 0 || owned.length > 0 || history.length > 0 || careers.some(Boolean) || ranked != null) && (
                <div className="w-full rounded-xl border border-[#f5d24a]/50 bg-[#f5d24a]/10 px-3 py-3 mt-4 text-left">
                  <p className="text-[#f5d24a] font-bold text-sm">You&apos;re on the old link</p>
                  <p className="text-gray-300 text-xs mt-0.5">This site moved to {CANONICAL_HOST}. Bring your scores, coins, discs, and rank along.</p>
                  <button
                    type="button"
                    onClick={() => { window.location.href = transferUrl(); }}
                    className="mt-2 w-full rounded-lg bg-[#f5d24a] hover:bg-[#ecc63a] text-[#1a1d23] font-bold py-2 transition text-sm"
                  >
                    Move my progress to {CANONICAL_HOST} →
                  </button>
                </div>
              )}

              {/* Confirmation after a transfer is merged in on the new domain. */}
              {transferred && (
                <div className="w-full rounded-xl border border-[#36D7B7]/50 bg-[#36D7B7]/10 px-3 py-3 mt-4 text-center">
                  <p className="text-[#36D7B7] font-bold text-sm">✓ Progress moved over</p>
                  <p className="text-gray-300 text-xs mt-0.5">Your scores, coins, discs, and rank came with you.</p>
                </div>
              )}

              {/* Hub: three category cards keep the menu uncluttered */}
              {hub === "home" && (
                <>
                  <div className={`w-full flex flex-col gap-3 ${menuTopMargin}`}>
                    <DailyButton
                      stars={todayStars}
                      best={today ? (dayBests[today] ?? null) : null}
                      streak={0}
                      onPlay={() => startGame("daily")}
                    />
                    <button type="button" onClick={() => setHub("solo")} className={hubCard}>
                      <span className="font-black text-lg">Single Player</span>
                    </button>
                    <button type="button" onClick={() => setHub("online")} className={hubCard}>
                      <span className="font-black text-lg">Online</span>
                    </button>
                    <button type="button" onClick={() => setHub("practice")} className={hubCard}>
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
                <div className={`w-full flex flex-col gap-3 ${menuTopMargin}`}>
                  <button type="button" onClick={() => setHub("home")} className={`${titleCardSm} !flex-none self-start px-3`}>‹ Back</button>
                  <button type="button" onClick={() => startGame("daily")} className={`${hubCard} !flex-col gap-1 !py-4`}>
                    <span className="font-black text-lg">Daily Challenge</span>
                    {todayGoals && (
                      <span className="flex items-center justify-center gap-1">
                        {todayGoals.map((t, i) => (
                          <GoalStar key={i} lit={todayStars > i} label={overStr(t)} size={44} />
                        ))}
                      </span>
                    )}
                  </button>
                  <button type="button" onClick={() => setCoursesOpen(true)} className={hubCard}>
                    <span className="font-black text-lg">Challenge the Arcade</span>
                  </button>
                  <button type="button" onClick={() => { setCareerLastResult(null); setCareerNotes([]); leaveCareer(); setCareerOpen(true); }} className={hubCard}>
                    <span className="font-black text-lg">Career</span>
                  </button>
                  <button type="button" onClick={() => setTournamentOpen(true)} className={hubCard}>
                    <span className="font-black text-lg">Tournaments{tournament && !tournament.finished ? ` · ${tournDef(tournament.id)?.name ?? ""} R${tournament.myTotals.length + 1}` : ""}</span>
                  </button>
                </div>
              )}

              {/* Online & Compete page */}
              {hub === "online" && (
                <div className={`w-full flex flex-col gap-3 ${menuTopMargin}`}>
                  <button type="button" onClick={() => setHub("home")} className={`${titleCardSm} !flex-none self-start px-3`}>‹ Back</button>
                  <button type="button" onClick={() => setHub("challenge")} className={hubCard}>
                    <span className="font-black text-lg">Challenge Friends</span>
                  </button>
                  <button type="button" onClick={() => setRankedOpen(true)} className={hubCard}>
                    <span className="font-black text-lg">Ranked</span>
                  </button>
                </div>
              )}

              {/* Challenge Friends — an inline page so the logo/profile stay above */}
              {hub === "challenge" && (
                <div className={`w-full ${menuTopMargin}`}>
                  <ChallengePanel
                    online={!!supa}
                    onBack={() => setHub("online")}
                    onCreate={() => createLobby(profile.name)}
                    onJoin={(code) => joinLobby(code, profile.name)}
                  />
                </div>
              )}

              {/* Practice page — skills + grind any hole, logo/profile stay above */}
              {hub === "practice" && (
                <div className={`w-full flex flex-col gap-3 ${menuTopMargin}`}>
                  <button type="button" onClick={() => setHub("home")} className={`${titleCardSm} !flex-none self-start px-3`}>‹ Back</button>
                  <button type="button" onClick={() => setTutorialOpen(true)} className={hubCard}>
                    <span className="font-black text-lg">How to Play</span>
                  </button>
                  <button type="button" onClick={() => startMini("putt")} className={hubCard}>
                    <span className="font-black text-lg">Putting</span>
                  </button>
                  <button type="button" onClick={() => startMini("target")} className={hubCard}>
                    <span className="font-black text-lg">Accuracy</span>
                  </button>
                  <button type="button" onClick={() => setHub("holePractice")} className={hubCard}>
                    <span className="font-black text-lg">Hole Practice</span>
                  </button>
                </div>
              )}

              {/* Hole Practice — pick any hole on any course (inline, logo/profile stay above) */}
              {hub === "holePractice" && (
                <div className={`w-full ${menuTopMargin}`}>
                  <HolePracticePicker
                    onBack={() => setHub("practice")}
                    onPick={(m, i, seed) => startPractice(m, i, seed)}
                  />
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
            // Furthest-along first, then lowest score — so someone who quit a few
            // holes in (low `thru`) can't sit on top with an artificially small total.
            .sort((a, b) => (b.thru - a.thru) || (a.total - b.total));
          const maxThru = rows.reduce((m, r) => Math.max(m, r.thru), 0);
          const lead = rows.filter((r) => r.thru === maxThru).reduce((m, r) => Math.min(m, r.total), Infinity);
          return (
            <Overlay onTap={nextHole}>
              <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-[0.15em]">Hole {onlineView.hole + 1}</p>
              <p className="text-[#36D7B7] font-black text-2xl leading-none">{sl.emoji && `${sl.emoji} `}{sl.name}</p>
              <div className="w-full max-w-[260px] space-y-1 pt-1">
                {rows.map((r) => (
                  <div key={r.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1.5 text-sm">
                    <span className="text-white font-semibold truncate">{r.thru === maxThru && r.total === lead ? "👑 " : ""}{r.id === onlineView.myId ? `${r.name} (you)` : r.name}</span>
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
              {/* Round scorecard so far — a row per nine; non-pars boxed + color-coded
                  (birdie-or-better green, bogey-or-worse red). */}
              {hud.pars.length > 0 && (
                <div className="w-full max-w-[280px] bg-black/25 border border-white/15 rounded-xl px-2.5 py-2.5 space-y-1.5">
                  {(hud.pars.length > 9 ? [[0, 9], [9, hud.pars.length]] : [[0, hud.pars.length]]).map(([from, to]) => {
                    const cells = hud.pars.slice(from, to);
                    return (
                      <div key={from} className="grid gap-x-1 gap-y-0.5 justify-center items-center" style={{ gridTemplateColumns: `repeat(${cells.length}, 22px)` }}>
                        {/* Hole numbers */}
                        {cells.map((_, i) => (
                          <span key={`n${from + i}`} className="text-center text-[10px] font-semibold leading-none text-gray-300">{from + i + 1}</span>
                        ))}
                        {/* Divider under the numbers, above the pars */}
                        <div className="col-span-full border-t border-white/15" />
                        {/* Par per hole */}
                        {cells.map((p, i) => (
                          <span key={`p${from + i}`} className="text-center text-[9px] leading-none text-gray-500">{p}</span>
                        ))}
                        {/* Score cells — non-pars boxed + color-coded */}
                        {cells.map((p, i) => {
                          const idx = from + i;
                          const s = hud.scores[idx];
                          const diff = s == null ? null : s - p;
                          const boxed = diff != null && diff !== 0;
                          // Under par climbs green → cyan → blue (birdie, eagle, albatross+);
                          // over par deepens red → dark red → brown (bogey, double, triple+).
                          const color =
                            diff == null ? "#5b6270" :
                            diff <= -3 ? "#4d7fff" :   // albatross or better — blue
                            diff === -2 ? "#20b8d8" :  // eagle — green-blue
                            diff === -1 ? "#36D7B7" :  // birdie — green
                            diff === 0 ? "#e5e7eb" :   // par
                            diff === 1 ? "#e23b3b" :   // bogey — red
                            diff === 2 ? "#b02525" :   // double bogey — darker red
                            "#7d2b1e";                 // triple or worse — dark red / brown
                          return (
                            <span
                              key={`s${idx}`}
                              className={`w-[22px] h-[22px] flex items-center justify-center text-[11px] font-mono font-bold leading-none border ${boxed ? "rounded-md" : ""}`}
                              style={{ color, borderColor: boxed ? color : "transparent" }}
                            >
                              {s ?? "·"}
                            </span>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
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

        {namePrompt && (
          <BoardNamePrompt
            initialName={profile.name.trim()}
            error={namePrompt.error}
            canSignIn={!!supa && !user}
            onPost={(name) => answerNamePrompt({ kind: "name", name })}
            onSkip={() => answerNamePrompt({ kind: "skip" })}
            onSignIn={() => { setNamePrompt(null); setPostStatus(null); openSignIn(); }}
          />
        )}

        {statsOpen && <StatsPanel onClose={() => setStatsOpen(false)} />}

        {boardsOpen && <LeaderboardPanel onClose={() => setBoardsOpen(false)} />}

        {partyOpen && (
          <PartyPanel
            onClose={() => setPartyOpen(false)}
            onStart={(m, names) => { setPartyOpen(false); startParty(m, names); }}
          />
        )}


        {/* Lobby (shown on the title screen until the host starts) */}
        {screen === "title" && lobby && (
          <LobbyPanel
            lobby={lobby}
            players={lobbyPlayers}
            hostLeft={hostLeft}
            error={lobbyError}
            courses={CHALLENGE_COURSES}
            onPickCourse={pickCourse}
            onStart={startOnlineHost}
            onLeave={leaveLobby}
          />
        )}

        {tournamentOpen && (
          <TournamentPanel
            tournaments={TOURNAMENTS}
            active={tournament}
            bests={tournBests}
            onStart={(def) => {
              // Starting a tournament drops you straight into round 1 — you play the
              // whole event through in one sitting (no save-and-continue).
              const t: Tournament = { id: def.id, seed: def.seed, round: 0, myTotals: [], fieldTotals: [], madeCut: true, finished: false };
              saveTournament(t);
              playTournamentRound(t);
            }}
            onAbandon={() => saveTournament(null)}
            onPlayRound={playTournamentRound}
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

        {seasonReward && (() => {
          const tier = TIERS.find((t) => t.key === seasonReward.tierKey) ?? TIERS[0];
          return (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0f1117]/85 backdrop-blur-sm rounded-lg px-6" onClick={() => setSeasonReward(null)}>
              <div className="text-center">
                <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">{centralMonthLabel(seasonReward.season)} · season complete</p>
                <p className="text-7xl my-2 leading-none">{tier.emoji}</p>
                <p className="font-black text-2xl" style={{ color: tier.color }}>Finished {tier.name}</p>
                <p className="text-[#f5d24a] font-black text-3xl mt-3">+{seasonReward.coins} <Coin className="!w-6 !h-6 align-[-2px]" /></p>
                <p className="text-gray-300 text-sm mt-2">Season reward · earned the {tier.name} badge 🏅</p>
                <button type="button" onClick={() => setSeasonReward(null)} className={`${btn} mt-4`}>Claim</button>
              </div>
            </div>
          );
        })()}

        {careerOpen && careerSlot == null && (
          <CareerSlots
            careers={careers}
            onPick={openCareerSlot}
            onDelete={deleteCareerSlot}
            onBack={() => setCareerOpen(false)}
          />
        )}

        {careerOpen && careerSlot != null && (
          <CareerPanel
            key={careerSlot}
            career={career}
            lastResult={careerLastResult}
            lastCoins={careerCoins}
            notes={careerNotes}
            onClose={leaveCareer}
            onStart={startNewCareer}
            onPlay={(ev) => { const c = careerRef.current; if (c) startCareerEvent(c, ev); }}
            onSim={simCareerEvent}
            onAllocateSkill={(k, d) => { const c = careerRef.current; if (c) saveCareer(spendSkillPoint(c, k, d)); }}
            onAdvance={() => advanceCareerSeason({})}
            onRetire={() => { const c = careerRef.current; if (c) saveCareer(retire(c)); }}
            onAbandon={() => { saveCareer(null); leaveCareer(); }}
            onSign={(id) => { const c = careerRef.current; if (c) saveCareer(signSponsor(c, id)); }}
            onUnsign={(id) => { const c = careerRef.current; if (c) saveCareer(unsignSponsor(c, id)); }}
            onBuyTrain={() => { const c = careerRef.current; if (c) saveCareer(buyTrainingPoint(c)); }}
            onBuyDisc={(key) => { const c = careerRef.current; if (c) saveCareer(buyCareerDisc(c, key)); }}
            onToggleBag={(key) => { const c = careerRef.current; if (c) saveCareer(toggleCareerBag(c, key)); }}
            onBuyCosmetic={(ownKey, cost) => { const c = careerRef.current; if (c) saveCareer(buyCareerCosmetic(c, ownKey, cost)); }}
            onEquipLook={(slot, key) => { const c = careerRef.current; if (c) saveCareer(equipCareerLook(c, slot, key)); }}
            dismissNotes={() => setCareerNotes([])}
          />
        )}

        {coursesOpen && (
          <CoursesPanel
            courses={FIXED_COURSES}
            tourCourses={TOUR_COURSE_INFOS}
            bests={{ course: bestScore, winthrop: winthropBest, olympus: olympusBest }}
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
            olympusBest={olympusBest}
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
            onPlay={startRankedRound}
            onClose={() => setRankedOpen(false)}
          />
        )}

        {placementReveal && (
          <PlacementReveal result={placementReveal} marks={placeMarks} onClose={() => setPlacementReveal(null)} />
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

        {settingsOpen && (
          <SettingsPanel
            onClose={() => setSettingsOpen(false)}
            throwStyle={defaultThrowStyle} setThrowStyle={setDefaultThrowStyle}
            release={defaultRelease} setRelease={setDefaultRelease}
            musicVolume={musicVolume} setMusicVolume={setMusicVolume}
            leftHanded={leftHanded} setLeftHanded={setLeftHanded}
            showGhost={showGhost} setShowGhost={setShowGhost}
            muted={muted} onToggleSound={toggleMute}
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

      {/* Replay controls replace the disc rack while watching a recorded round */}
      {screen === "playing" && replayView && (() => {
        const cap = replayCaption(replayView.data);
        const onHole = replayView.data.scores[hud.hole - 1];
        return (
          <div className="shrink-0 w-full border-t border-white/10 bg-[#13161b]">
            <div className="mx-auto w-full max-w-[480px] px-3 pt-2.5 pb-[max(calc(env(safe-area-inset-bottom)+0.4rem),1.25rem)] flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#36D7B7]">▶ Replay</span>
                <span className="text-[11px] text-gray-400 truncate min-w-0">{replayView.data.name} · {cap.course} · {cap.score}</span>
              </div>
              <div className="text-white text-sm font-bold">
                {replayView.ended ? "Round complete" : `Hole ${hud.hole} of ${hud.holes} · par ${hud.par}${onHole ? ` · scored ${onHole}` : ""}`}
              </div>
              <div className="flex gap-2">
                {replayView.ended ? (<>
                  <button type="button" onClick={() => startReplay(replayView.data, replayView.fromResults)} className="flex-1 bg-[#1a1d23] border border-white/15 hover:border-white/35 text-white font-bold py-2.5 rounded-lg transition text-sm">↻ Watch again</button>
                  <button type="button" onClick={endReplay} className={`${btn} flex-1 !mt-0 !py-2.5 text-sm`}>Done</button>
                </>) : (<>
                  <button type="button" onClick={() => setReplaySpeed(replayView.speed === 1 ? 2 : 1)} className="flex-1 bg-[#1a1d23] border border-white/15 hover:border-white/35 text-white font-bold py-2.5 rounded-lg transition text-sm">{replayView.speed === 1 ? "2× speed" : "1× speed"}</button>
                  <button type="button" onClick={skipReplayHole} className="flex-1 bg-[#1a1d23] border border-white/15 hover:border-white/35 text-white font-bold py-2.5 rounded-lg transition text-sm">Skip hole ›</button>
                  <button type="button" onClick={endReplay} className="flex-1 bg-[#1a1d23] border border-white/15 hover:border-white/35 text-white font-bold py-2.5 rounded-lg transition text-sm">Exit</button>
                </>)}
              </div>
            </div>
          </div>
        );
      })()}

      {/* A shared replay link (?rp=) waits for a tap so audio can start. */}
      {(pendingReplay || replayLoadErr) && screen !== "playing" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1117]/85 backdrop-blur-sm px-6">
          <div className="w-full max-w-[300px] bg-[#1a1d23] border border-white/15 rounded-xl p-5 flex flex-col gap-3 text-center">
            {pendingReplay ? (<>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#36D7B7]">Shared replay</div>
              <div className="text-white font-black text-xl">{pendingReplay.name}</div>
              <div className="text-gray-300 text-sm">{replayCaption(pendingReplay).course} · {replayCaption(pendingReplay).score}</div>
              <button type="button" onClick={() => startReplay(pendingReplay)} className={`${btn} w-full !mt-1`}>▶ Watch round</button>
              <button type="button" onClick={() => { setPendingReplay(null); try { window.history.replaceState(null, "", location.pathname); } catch { /* ignore */ } }} className="text-gray-400 text-xs hover:text-white">Not now</button>
            </>) : (<>
              <div className="text-white font-bold">{replayLoadErr}</div>
              <button type="button" onClick={() => { setReplayLoadErr(null); try { window.history.replaceState(null, "", location.pathname); } catch { /* ignore */ } }} className={`${btn} w-full !mt-1`}>OK</button>
            </>)}
          </div>
        </div>
      )}

      {/* Control panel: disc rack + flight/stance/mute — only while in a round */}
      {(screen === "playing" || screen === "holeComplete") && !replayView && (
        <ControlPanel
          activeBag={activeBag}
          discIndex={discIndex}
          onSelectDisc={selectDisc}
          release={release}
          onRelease={setRelease}
          throwStyle={throwStyle}
          onThrowStyle={setThrowStyle}
          onMenu={() => { const g = stateRef.current; setPauseMenu({ canRestart: !!g && !g.online && !g.mini && !tournamentPlayRef.current && !careerPlayRef.current, isCareer: careerPlayRef.current }); }}
        />
      )}

      {/* Results: scorecard + save + leaderboard */}
      {/* Practice mini-game results */}
      {levelUp && (
        <LevelUpPanel level={levelUp.level} choices={levelUp.choices} bagHasRoom={bag.length < BAG_MAX} onPick={claimLevelUp} />
      )}

      {miniResult && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-start sm:items-center justify-center bg-[#0f1117]/95 backdrop-blur-sm px-6 pt-[max(env(safe-area-inset-top),1.5rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
          <div className="w-full max-w-xs text-center space-y-3 my-auto">
            <p className="text-5xl">{miniResult.kind === "putt" ? "⛳" : "🎯"}</p>
            <h2 className="text-white font-black text-2xl">{miniResult.kind === "putt" ? "Putting Practice" : "Accuracy Practice"}</h2>
            {miniResult.kind === "putt" ? (
              <p className="text-gray-300">You sank <span className="text-[#36D7B7] font-bold">{miniResult.makes}</span> putt{miniResult.makes === 1 ? "" : "s"} — longest <span className="text-white font-bold">{miniResult.best} ft</span>.</p>
            ) : (
              <p className="text-gray-300">You scored <span className="text-[#f5d24a] font-bold">{miniResult.points}</span> points over 10 throws.</p>
            )}
            <p className="text-[#f5d24a] font-bold text-lg">+{miniResult.coins} <Coin className="!w-4 !h-4" /></p>
            {/* Global leaderboard for this mini (most putts made / most accuracy points) */}
            <div className="bg-[#1a1d23] border border-white/5 rounded-2xl overflow-hidden text-left">
              <p className="text-white font-bold text-sm px-4 py-2.5 border-b border-white/5">
                🏆 {miniResult.kind === "putt" ? "Putting leaderboard" : "Accuracy leaderboard"}
              </p>
              {miniSaving && miniBoard.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">Loading the board…</p>
              ) : miniBoard.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">No scores yet — be the first!</p>
              ) : (
                <ol>
                  {miniBoard.slice(0, 8).map((row, i) => {
                    const mine = myBoardName != null && row.name === myBoardName;
                    return (
                      <li
                        key={`${row.name}-${row.created_at}`}
                        className={`flex items-center gap-3 px-4 py-2 text-sm ${i !== 0 ? "border-t border-white/5" : ""} ${mine ? "bg-[#36D7B7]/10" : ""}`}
                      >
                        <span className="text-gray-400 font-mono w-6 text-right">{i + 1}</span>
                        <span className={`flex-1 truncate ${mine ? "text-[#36D7B7] font-bold" : "text-white"}`}>{row.name}</span>
                        <span className="text-white font-mono font-bold w-16 text-right">{row.strokes}{miniResult.kind === "putt" ? " made" : " pts"}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
            {miniPost?.status === "posted" && <p className="text-center text-[#36D7B7] text-xs font-semibold">Posted as {miniPost.as} ✓</p>}
            {miniPost?.status === "skipped" && (
              <p className="text-center text-gray-400 text-xs">
                Not posted (you chose Skip).{" "}
                <button type="button" onClick={() => reaskBoardName((c) => void runMiniPost(miniResult, c, () => true))} className="text-[#36D7B7] font-semibold hover:underline">Post my scores</button>
              </p>
            )}
            {miniPost?.status === "error" && !miniPost.reserved && <p className="text-center text-red-400 text-xs">{miniPost.error}</p>}
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
                  ? `${finalMode === "winthrop" ? "Winthrop Lake" : finalMode === "olympus" ? "Olympus" : finalMode === "tour" ? tourVenue(finalSeed) : "Glendoveer East"} · hole ${finalPracticeHole} · par ${finalParTotal}`
                  : finalIsDaily
                    ? `Today's course · ${finalPars.length} holes · par ${finalParTotal}`
                    : finalMode === "ranked"
                      ? `Ranked · ${finalPars.length} holes · par ${finalParTotal}`
                      : finalMode === "tour"
                        ? `${tourVenue(finalSeed)} · ${finalPars.length} holes · par ${finalParTotal}`
                        : `${finalMode === "winthrop" ? "Winthrop Lake" : finalMode === "olympus" ? "Olympus" : "Glendoveer East"} · 18 holes · par ${finalParTotal}`}
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
                  <p className="text-[#f5d24a] text-sm font-bold mt-1">+{coinReward} <Coin /></p>
                )}
                {/* Daily stars — the day's three to-par goals, lit as earned. */}
                {finalDailyStars && (
                  <div className="mt-2.5 inline-block bg-[#1a1d23] border border-white/10 rounded-xl px-5 py-2.5">
                    <div className="flex items-center justify-center gap-1.5">
                      {finalDailyStars.thresholds.map((t, i) => (
                        <GoalStar key={i} lit={finalDailyStars.earned > i} label={overStr(t)} size={44} />
                      ))}
                    </div>
                    {finalDailyStars.coins > 0 && (
                      <p className="text-[#f5d24a] text-sm font-bold mt-1">+{finalDailyStars.coins} <Coin /> star bonus</p>
                    )}
                    <p className="text-gray-400 text-[10px] mt-1.5">
                      {finalDailyStars.earned === 3
                        ? "All 3 stars — today's course, conquered!"
                        : finalDailyStars.best > finalDailyStars.earned
                          ? `Best today: ${finalDailyStars.best}★ · goals tuned to today's course`
                          : "Goals are tuned to today's course difficulty"}
                    </p>
                  </div>
                )}
              </>)}
              {finalMode === "ranked" && rankedResult && (() => {
                const r = rankedResult;
                // Placement round: show the projected (or final) rank, not an RP delta.
                if ("placement" in r) {
                  return (
                    <div className="mt-3 bg-[#1a1d23] border border-white/10 rounded-xl px-4 py-3 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-black text-lg">{r.placed ? "🏅 Placement complete!" : `Placement ${r.round}/${r.rounds}`}</span>
                        <span className="font-mono font-bold text-sm text-gray-300">{ordinal(r.place)} of {r.field}</span>
                      </div>
                      <div className="my-3"><PlacementDots marks={placeMarks} done={r.round} total={r.rounds} /></div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xl leading-none">{r.tier.emoji}</span>
                        <span className="font-bold text-sm" style={{ color: r.tier.color }}>{r.placed ? "" : "Projected: "}{r.tier.name}</span>
                      </div>
                      <p className="text-gray-400 text-[11px] mt-1.5">
                        {r.placed
                          ? `You've been placed in ${r.tier.name}. Ranked rounds from here move your RP up or down.`
                          : `${r.remaining} placement round${r.remaining === 1 ? "" : "s"} to go — your projected rank adjusts as you play.`}
                      </p>
                    </div>
                  );
                }
                const tr = tierFromRP(ranked?.rp ?? 0);
                return (
                  <div className="mt-3 bg-[#1a1d23] border border-white/10 rounded-xl px-4 py-3 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-black text-lg">{r.win ? "🏆 1st place!" : r.podium ? `${ordinal(r.place)} place!` : `Finished ${ordinal(r.place)} of ${r.field}`}</span>
                      <span className="font-mono font-bold text-sm" style={{ color: r.rpDelta > 0 ? "#36D7B7" : r.rpDelta < 0 ? "#e08a3b" : "#9aa0aa" }}>{r.rpDelta > 0 ? "+" : ""}{r.rpDelta} RP</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xl leading-none">{tr.tier.emoji}</span>
                      <span className="font-bold text-sm" style={{ color: tr.tier.color }}>{tr.tier.name}</span>
                      <span className="text-gray-400 font-mono text-[11px]">{ranked?.rp ?? 0} RP</span>
                      {r.tierUp && <span className="text-[#36D7B7] text-[11px] font-bold">▲ Promoted!</span>}
                      {r.tierDown && <span className="text-[#e08a3b] text-[11px] font-bold">▼ Demoted</span>}
                    </div>
                    {r.streak >= 2 && <p className="text-[#f5d24a] text-[11px] font-bold mt-1.5">🔥 {r.streak}-podium streak{r.bonus > 0 ? ` · +${r.bonus} bonus RP` : ""}</p>}
                    {r.weight > 1.05 && <p className="text-[#6cb6ff] text-[11px] font-bold mt-1.5">⚡ Settling in · ×{r.weight.toFixed(1)} RP (early rounds count more)</p>}
                  </div>
                );
              })()}
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
            {finalOnline && (() => {
              const holeCount = finalPars.length;
              // Players who completed every hole rank above anyone who left early,
              // and only a finisher can take the 🏆 — leaving mid-round with a
              // partial (low) total no longer "wins".
              const rows = Object.entries(onlineScores)
                .map(([id, s]) => ({ id, ...s, done: s.thru >= holeCount }))
                .sort((a, b) => (a.done === b.done ? a.total - b.total : a.done ? -1 : 1));
              const winnerId = rows.find((r) => r.done)?.id;
              return (
                <div className="bg-[#1a1d23] border border-white/5 rounded-2xl overflow-hidden">
                  {rows.map((row, i) => (
                    <div key={row.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${i ? "border-t border-white/5" : ""}`}>
                      <span className="text-gray-400 font-mono w-5">{i + 1}</span>
                      <span className="text-white font-semibold flex-1 truncate">{row.id === winnerId ? "🏆 " : ""}{row.name}{row.done ? "" : " · left"}</span>
                      <span className="text-gray-500 font-mono text-xs">thru {row.thru}</span>
                      <span className="text-gray-400 font-mono">{overStr(row.total - finalParTotal)}</span>
                      <span className="text-white font-mono font-bold w-8 text-right">{row.total}</span>
                    </div>
                  ))}
                </div>
              );
            })()}

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
            <div className="bg-[#1a1d23] border border-white/5 rounded-2xl p-3 space-y-3">
              {/* One continuous 1–18 card (front nine / back nine rows so it fits on a
                  phone) — no Out/In split totals, just the holes and one grand total. */}
              {(finalPars.length > 9
                ? [{ from: 0, to: 9 }, { from: 9, to: 18 }]
                : [{ from: 0, to: finalPars.length }]
              ).map(({ from, to }) => {
                const cells = finalPars.slice(from, to);
                return (
                  <div key={from}>
                    {/* Same look as the in-round card: hole # / line / par / boxed, color-coded score. */}
                    <div className="grid gap-x-1 gap-y-0.5 justify-center items-center" style={{ gridTemplateColumns: `repeat(${cells.length}, 24px)` }}>
                      {cells.map((_, i) => (
                        <span key={`n${from + i}`} className="text-center text-[10px] font-semibold leading-none text-gray-300">{from + i + 1}</span>
                      ))}
                      <div className="col-span-full border-t border-white/15" />
                      {cells.map((p, i) => (
                        <span key={`p${from + i}`} className="text-center text-[9px] leading-none text-gray-500">{p}</span>
                      ))}
                      {cells.map((p, i) => {
                        const s = scorecard[from + i];
                        const diff = s == null ? null : s - p;
                        const boxed = diff != null && diff !== 0;
                        // Under par climbs green → cyan → blue; over par deepens red → dark red → brown.
                        const color =
                          diff == null ? "#5b6270" :
                          diff <= -3 ? "#4d7fff" :
                          diff === -2 ? "#20b8d8" :
                          diff === -1 ? "#36D7B7" :
                          diff === 0 ? "#e5e7eb" :
                          diff === 1 ? "#e23b3b" :
                          diff === 2 ? "#b02525" :
                          "#7d2b1e";
                        return (
                          <span key={`s${from + i}`} className={`w-6 h-6 flex items-center justify-center text-[11px] font-mono font-bold leading-none border ${boxed ? "rounded-md" : ""}`} style={{ color, borderColor: boxed ? color : "transparent" }}>{s ?? "–"}</span>
                        );
                      })}
                    </div>
                  </div>
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
              <p className="text-center text-[#36D7B7] text-sm font-semibold">Saved to the leaderboard as {postedAs ?? myBoardName} ✓</p>
            ) : postStatus === "skipped" ? (
              <p className="text-center text-gray-400 text-sm">
                Not posted (you chose Skip).{" "}
                <button type="button" onClick={() => reaskBoardName((c) => { setPostStatus(null); void saveScore(c); })} className="text-[#36D7B7] font-semibold hover:underline">Post my scores</button>
              </p>
            ) : postStatus === "asking" ? (
              <p className="text-center text-gray-400 text-sm">Choose a leaderboard name to post this round.</p>
            ) : saveErr ? (
              <button type="button" onClick={() => void saveScore()} disabled={saving}
                className="w-full bg-[#1a1d23] border border-white/15 hover:border-white/35 text-white text-sm font-semibold py-2 rounded-lg transition disabled:opacity-50">
                {saving ? "Saving…" : "Retry save"}
              </button>
            ) : (
              <p className="text-center text-gray-400 text-sm">{saving ? "Saving to the leaderboard…" : "Saving…"}</p>
            )}
            {saveErr && !saved && <p className="text-red-400 text-xs text-center">{saveErr}</p>}

            {finalMode === "ranked" ? (
              <div className="bg-[#1a1d23] border border-white/5 rounded-2xl overflow-hidden">
                <p className="text-white font-bold text-sm px-4 py-2.5 border-b border-white/5">🏁 Final standings · you vs the field</p>
                <ol>
                  {careerLiveStandings(rankedFieldRef.current ?? [], "You", scorecard, finalPars.length, finalParTotal).slice(0, 10).map((row, i) => (
                    <li
                      key={`${row.name}-${row.rank}`}
                      className={`flex items-center gap-3 px-4 py-2 text-sm ${i !== 0 ? "border-t border-white/5" : ""} ${row.you ? "bg-[#36D7B7]/10" : ""}`}
                    >
                      <span className={`font-mono w-6 text-right ${row.rank === 1 ? "text-[#f5d24a]" : "text-gray-400"}`}>{row.rank}</span>
                      <span className={`flex-1 truncate ${row.you ? "text-[#36D7B7] font-bold" : "text-white"}`}>{row.rank === 1 ? "👑 " : ""}{row.name}</span>
                      <span className="text-gray-400 font-mono">{overStr(row.toPar)}</span>
                      <span className="text-white font-mono font-bold w-8 text-right">{row.total}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
            <div className="bg-[#1a1d23] border border-white/5 rounded-2xl overflow-hidden">
              <p className="text-white font-bold text-sm px-4 py-2.5 border-b border-white/5">
                🏆 {finalIsDaily ? "Today's leaderboard" : finalMode === "tour" ? `${tourVenue(finalSeed)} leaderboard` : `${finalMode === "winthrop" ? "Winthrop Lake" : finalMode === "olympus" ? "Olympus" : "Glendoveer East"} leaderboard`}
              </p>
              {leaderboard.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">No scores yet — be the first!</p>
              ) : (
                <ol>
                  {leaderboard.slice(0, 10).map((row, i) => {
                    const mine = myBoardName != null && row.name === myBoardName;
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
            )}
            </>)}

            <div className="flex flex-wrap justify-center gap-2">
              {finalPracticeHole != null ? (
                <button type="button" onClick={() => startPractice(finalMode, finalPracticeHole - 1, finalSeed)} className={btn}>↻ Retry hole</button>
              ) : finalTournament ? (
                tournament && !tournament.finished ? (
                  // More rounds to go — continue straight into the next one (the only
                  // way forward; leaving now would forfeit the event).
                  <button type="button" onClick={() => { const t = tournamentRef.current; if (t) playTournamentRound(t); }} className={btn}>
                    ▶ Play round {tournament.myTotals.length + 1} of {tournDef(tournament.id)?.rounds.length ?? tournament.myTotals.length + 1}
                  </button>
                ) : (
                  <button type="button" onClick={() => { audioRef.current?.stopMusic(); setScreen("title"); setTournamentOpen(true); }} className={btn}>
                    🏟 Standings
                  </button>
                )
              ) : finalOnline ? (
                <button type="button" onClick={() => { audioRef.current?.stopMusic(); setScreen("title"); }} className={btn}>
                  🎉 Back to lobby
                </button>
              ) : finalMode === "ranked" ? (
                // Ranked's only way onward is back to the ladder — no replay/home here.
                <button type="button" onClick={() => { audioRef.current?.stopMusic(); setScreen("title"); setRankedOpen(true); }} className={btn}>🏅 Back to Ranked</button>
              ) : (
                <button type="button" onClick={() => (finalMode === "tour" ? startGame("tour", finalSeed) : startGame())} className={btn}>↻ Play again</button>
              )}
              <button type="button" onClick={shareCard} aria-label="Share card" title="Share card" className="mt-1 flex items-center justify-center bg-[#1a1d23] border border-white/15 hover:border-white/35 text-white px-3.5 py-3 rounded-lg transition">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 -mt-px" aria-hidden="true">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <path d="m16 6-4-4-4 4" />
                  <path d="M12 2v13" />
                </svg>
              </button>
              {lastReplay && (
                <div className="w-full flex justify-center gap-2">
                  <button type="button" onClick={() => startReplay(lastReplay, true)}
                    className="mt-1 bg-[#1a1d23] border border-white/15 hover:border-white/35 text-white font-bold px-4 py-2.5 rounded-lg transition text-sm">
                    ▶ Watch replay
                  </button>
                  <button type="button" onClick={() => void shareReplay()} disabled={replayBusy}
                    className="mt-1 bg-[#1a1d23] border border-white/15 hover:border-white/35 text-white font-bold px-4 py-2.5 rounded-lg transition text-sm disabled:opacity-50">
                    {replayBusy ? "Saving…" : "🔗 Share replay"}
                  </button>
                </div>
              )}
              {shareMsg && <p className="text-[#36D7B7] text-[11px] text-center -mt-0.5 break-all select-all">{shareMsg}</p>}
              {finalMode !== "ranked" && (
                <button
                  type="button"
                  onClick={() => { audioRef.current?.stopMusic(); if (finalOnline) leaveLobby(); setScreen("title"); }}
                  className="mt-1 bg-[#1a1d23] border border-white/15 hover:border-white/35 text-white font-bold px-6 py-3 rounded-lg transition"
                >
                  🏠 Home
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
