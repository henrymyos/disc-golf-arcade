"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { submitArcadeScore, getArcadeLeaderboard } from "@/actions/arcade";
import type { ArcadeScore } from "@/lib/arcade-types";

// ─────────────────────────────────────────────────────────────────────────────
// Retro pixel disc-golf game. You throw from the bottom of the screen toward
// the top across a fixed 9-hole course. Pick a disc (power/fade trade-offs),
// aim with ◄ ►, time the power meter. Scores persist: a personal best in
// localStorage + a saved-by-name leaderboard in Supabase.
// Everything renders to a small portrait canvas upscaled with image-rendering:
// pixelated for the crunchy old-school look.
// ─────────────────────────────────────────────────────────────────────────────

const W = 320;
const H = 448;
const DISC_R = 3;
const CATCH_R = 9;
const STOP_SPEED = 0.35;
const BEST_KEY = "discgolf.best";

// Height physics: a throw arcs up and comes back down. While airborne the disc
// clears water and trees (throw over hazards); once it lands it brakes hard so
// it doesn't keep gliding forever after the fade.
const GRAVITY = 0.08; // downward pull on height per frame (gentler = floatier flight)
const AIRBORNE_H = 3; // above this height, hazards are cleared
const GROUND_FRICTION = 0.8; // hard deceleration once on the ground
const MAX_DRAG = 95; // pull-back distance (internal px) that maps to full power

type Vec = { x: number; y: number };
type Tree = { x: number; y: number; r: number };
type Water = { x: number; y: number; w: number; h: number };
type Hole = { par: number; tee: Vec; basket: Vec; trees: Tree[]; water: Water[] };

const TEE: Vec = { x: 160, y: 416 };

// Fixed course — identical every play.
const HOLES: Hole[] = [
  { par: 3, tee: TEE, basket: { x: 160, y: 90 }, trees: [{ x: 110, y: 300, r: 14 }, { x: 210, y: 300, r: 14 }, { x: 160, y: 205, r: 15 }, { x: 112, y: 130, r: 13 }, { x: 208, y: 130, r: 13 }], water: [] },
  { par: 3, tee: TEE, basket: { x: 96, y: 108 }, trees: [{ x: 178, y: 280, r: 14 }, { x: 124, y: 210, r: 14 }, { x: 214, y: 188, r: 13 }, { x: 70, y: 220, r: 13 }, { x: 156, y: 130, r: 13 }], water: [] },
  { par: 2, tee: TEE, basket: { x: 160, y: 168 }, trees: [{ x: 108, y: 300, r: 14 }, { x: 212, y: 300, r: 14 }, { x: 160, y: 240, r: 13 }], water: [] },
  { par: 4, tee: TEE, basket: { x: 232, y: 86 }, trees: [{ x: 150, y: 320, r: 14 }, { x: 118, y: 210, r: 14 }, { x: 214, y: 206, r: 14 }, { x: 268, y: 138, r: 13 }, { x: 176, y: 150, r: 13 }], water: [{ x: 38, y: 116, w: 86, h: 64 }] },
  { par: 3, tee: TEE, basket: { x: 90, y: 128 }, trees: [{ x: 184, y: 286, r: 14 }, { x: 138, y: 214, r: 14 }, { x: 92, y: 250, r: 13 }, { x: 210, y: 196, r: 13 }, { x: 146, y: 122, r: 13 }], water: [] },
  { par: 3, tee: TEE, basket: { x: 236, y: 138 }, trees: [{ x: 118, y: 286, r: 14 }, { x: 186, y: 214, r: 14 }, { x: 248, y: 252, r: 13 }, { x: 110, y: 196, r: 13 }, { x: 176, y: 120, r: 13 }], water: [] },
  { par: 4, tee: TEE, basket: { x: 160, y: 70 }, trees: [{ x: 106, y: 246, r: 14 }, { x: 214, y: 246, r: 14 }, { x: 160, y: 168, r: 15 }, { x: 114, y: 116, r: 13 }, { x: 206, y: 116, r: 13 }], water: [{ x: 118, y: 322, w: 84, h: 50 }] },
  { par: 3, tee: TEE, basket: { x: 108, y: 100 }, trees: [{ x: 190, y: 268, r: 14 }, { x: 150, y: 196, r: 14 }, { x: 86, y: 232, r: 13 }, { x: 214, y: 188, r: 13 }, { x: 158, y: 118, r: 13 }], water: [] },
  { par: 4, tee: TEE, basket: { x: 222, y: 96 }, trees: [{ x: 120, y: 280, r: 14 }, { x: 188, y: 210, r: 14 }, { x: 252, y: 234, r: 13 }, { x: 150, y: 138, r: 13 }, { x: 240, y: 154, r: 13 }, { x: 100, y: 196, r: 13 }], water: [{ x: 54, y: 150, w: 66, h: 54 }] },
];
const TOTAL_PAR = HOLES.reduce((s, h) => s + h.par, 0);

// Disc bag — power scales throw speed, `fade` is how many radians the flight
// path curves per frame (the disc bends one way; backhand left, forehand
// right), and friction is glide (higher = floats/rolls farther). Curving is
// capped per throw (MAX_FADE_TURN) so a disc can never loop or fade backward.
type Disc = { key: string; name: string; power: number; arc: number; fade: number; friction: number; color: string; blurb: string };
const DISCS: Disc[] = [
  // `arc` is the vertical launch per unit power. The putter flies flat so it
  // stays low and reaches the basket near the ground (high chance to catch);
  // the driver climbs to sail over hazards.
  { key: "putter", name: "Putter", power: 0.82, arc: 1.2, fade: 0.004, friction: 0.975, color: "#36D7B7", blurb: "Flat, low fade" },
  { key: "mid", name: "Mid", power: 1.0, arc: 2.2, fade: 0.008, friction: 0.984, color: "#f5d24a", blurb: "Balanced" },
  { key: "driver", name: "Driver", power: 1.34, arc: 2.9, fade: 0.014, friction: 0.990, color: "#e23b3b", blurb: "Far, big fade" },
];
// Most the flight path may bend over a single throw (~46°) — keeps fade
// noticeable without ever curving back toward the thrower.
const MAX_FADE_TURN = 0.8;

type Phase = "aim" | "fly" | "holed";
type Screen = "title" | "playing" | "holeComplete" | "gameComplete";

type GameState = {
  holeIndex: number;
  phase: Phase;
  disc: { x: number; y: number; vx: number; vy: number };
  rest: Vec;
  angle: number;
  powerT: number;
  power: number;
  throws: number;
  discIndex: number;
  scores: number[];
  holedAt: number | null;
  fadeTurn: number; // radians the current flight has curved so far
  fadeSign: number; // -1 backhand (left), +1 forehand (right)
  h: number; // current height above the ground
  vh: number; // vertical velocity (height units per frame)
};

// Aim straight at the basket from a given lie.
function aimAt(from: Vec, basket: Vec): number {
  return Math.atan2(basket.y - from.y, basket.x - from.x);
}

function freshHole(holeIndex: number) {
  const basket = HOLES[holeIndex].basket;
  return {
    phase: "aim" as Phase,
    disc: { x: TEE.x, y: TEE.y, vx: 0, vy: 0 },
    rest: { x: TEE.x, y: TEE.y },
    angle: aimAt(TEE, basket), // auto-aimed at the basket
    powerT: 0,
    power: 0,
    throws: 0,
    holedAt: null as number | null,
    fadeTurn: 0,
    fadeSign: -1,
    h: 0,
    vh: 0,
  };
}

// ── Audio engine: chiptune loop + SFX, all synthesized ───────────────────────
class AudioEngine {
  ctx: AudioContext;
  master: GainNode;
  musicGain: GainNode;
  private step = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.22;
    this.musicGain.connect(this.master);
  }

  private note(freq: number, dur: number, type: OscillatorType, gain: number, dest: AudioNode) {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain: number) {
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  private static MELODY = [
    72, 76, 79, 76, 74, 77, 81, 77,
    72, 76, 79, 84, 81, 79, 76, 74,
  ];
  private static BASS = [48, 0, 55, 0, 53, 0, 50, 0, 48, 0, 55, 0, 53, 0, 50, 0];
  private static midi(n: number) {
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  startMusic() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const m = AudioEngine.MELODY[this.step % AudioEngine.MELODY.length];
      const b = AudioEngine.BASS[this.step % AudioEngine.BASS.length];
      if (m) this.note(AudioEngine.midi(m), 0.18, "square", 0.5, this.musicGain);
      if (b) this.note(AudioEngine.midi(b), 0.22, "triangle", 0.7, this.musicGain);
      this.step++;
    }, 200);
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  setMuted(muted: boolean) {
    this.master.gain.value = muted ? 0 : 0.5;
  }

  resume() {
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  sfx(name: "throw" | "tree" | "water" | "basket" | "win") {
    switch (name) {
      case "throw": {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(660, t);
        osc.frequency.exponentialRampToValueAtTime(220, t + 0.18);
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        osc.connect(g);
        g.connect(this.master);
        osc.start(t);
        osc.stop(t + 0.22);
        break;
      }
      case "tree":
        this.note(140, 0.12, "square", 0.4, this.master);
        break;
      case "water":
        this.noise(0.3, 0.35);
        break;
      case "basket":
        [72, 76, 79].forEach((n, i) =>
          setTimeout(() => this.note(AudioEngine.midi(n), 0.18, "square", 0.5, this.master), i * 70),
        );
        break;
      case "win":
        [72, 74, 76, 79, 84].forEach((n, i) =>
          setTimeout(() => this.note(AudioEngine.midi(n), 0.22, "square", 0.5, this.master), i * 110),
        );
        break;
    }
  }

  close() {
    this.stopMusic();
    void this.ctx.close();
  }
}

// Pure one-frame flight step — the single source of truth for disc physics, so
// the on-screen trajectory preview matches the real flight exactly. Mutates the
// passed flight object; returns what happened this frame.
type Flight = { x: number; y: number; vx: number; vy: number; h: number; vh: number; fadeTurn: number };
type StepStatus = "fly" | "stop" | "hole" | "oob" | "water";

function stepFlight(f: Flight, disc: Disc, fadeSign: number, hole: Hole): { status: StepStatus; treeHit: boolean } {
  f.x += f.vx;
  f.y += f.vy;
  f.h += f.vh;
  f.vh -= GRAVITY;
  if (f.h <= 0) {
    f.h = 0;
    f.vh = 0;
  }
  const airborne = f.h > AIRBORNE_H;
  const sp = Math.hypot(f.vx, f.vy);
  if (airborne && sp > 0.6 && Math.abs(f.fadeTurn) < MAX_FADE_TURN) {
    const a = fadeSign * disc.fade;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const nvx = f.vx * cos - f.vy * sin;
    const nvy = f.vx * sin + f.vy * cos;
    f.vx = nvx;
    f.vy = nvy;
    f.fadeTurn += a;
  }
  const friction = airborne ? disc.friction : GROUND_FRICTION;
  f.vx *= friction;
  f.vy *= friction;

  if (f.x < 2 || f.x > W - 2 || f.y < 2 || f.y > H - 2) return { status: "oob", treeHit: false };

  // Trees are tall — they block at ANY height, so you must go around them.
  let treeHit = false;
  for (const tr of hole.trees) {
    const dist = Math.hypot(f.x - tr.x, f.y - tr.y);
    const min = tr.r + DISC_R;
    if (dist < min && dist > 0) {
      const nx = (f.x - tr.x) / dist;
      const ny = (f.y - tr.y) / dist;
      f.x = tr.x + nx * min;
      f.y = tr.y + ny * min;
      const dot = f.vx * nx + f.vy * ny;
      f.vx = (f.vx - 2 * dot * nx) * 0.45;
      f.vy = (f.vy - 2 * dot * ny) * 0.45;
      treeHit = true;
    }
  }

  // The basket and water only interact when the disc is low (you carry water).
  if (!airborne) {
    if (Math.hypot(f.x - hole.basket.x, f.y - hole.basket.y) < CATCH_R) return { status: "hole", treeHit };
    for (const wt of hole.water) {
      if (f.x > wt.x && f.x < wt.x + wt.w && f.y > wt.y && f.y < wt.y + wt.h) return { status: "water", treeHit };
    }
    if (sp < STOP_SPEED) return { status: "stop", treeHit };
  }
  return { status: "fly", treeHit };
}

export function DiscGolfGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  // Drag-to-throw (Wii-golf style): pull back to set power + aim, release to throw.
  const dragRef = useRef<{ active: boolean; cx: number; cy: number }>({ active: false, cx: 0, cy: 0 });
  const audioRef = useRef<AudioEngine | null>(null);
  const rafRef = useRef<number>(0);

  const [screen, setScreen] = useState<Screen>("title");
  const [muted, setMuted] = useState(false);
  const [discIndex, setDiscIndex] = useState(1); // Mid by default
  const [throwStyle, setThrowStyle] = useState<"BH" | "FH">("BH");
  const [hud, setHud] = useState({ hole: 1, par: 3, throws: 0 });

  // End-of-round state
  const [scorecard, setScorecard] = useState<number[]>([]);
  const [finalTotal, setFinalTotal] = useState(0);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [leaderboard, setLeaderboard] = useState<ArcadeScore[]>([]);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const screenRef = useRef<Screen>("title");
  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  const discIndexRef = useRef(1);
  useEffect(() => {
    discIndexRef.current = discIndex;
  }, [discIndex]);

  const throwStyleRef = useRef<"BH" | "FH">("BH");
  useEffect(() => {
    throwStyleRef.current = throwStyle;
  }, [throwStyle]);

  // Load personal best once, after mount. Done in an effect (not a lazy
  // initializer) so server and first client render agree — avoids a hydration
  // mismatch on the "Your best" line.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BEST_KEY);
      if (raw) {
        const n = Number(raw);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (Number.isFinite(n)) setBestScore(n);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const syncHud = useCallback(() => {
    const g = stateRef.current;
    if (!g) return;
    setHud({ hole: g.holeIndex + 1, par: HOLES[g.holeIndex].par, throws: g.throws });
  }, []);

  const startGame = useCallback(() => {
    if (!audioRef.current) audioRef.current = new AudioEngine();
    audioRef.current.resume();
    audioRef.current.setMuted(muted);
    audioRef.current.startMusic();
    stateRef.current = { holeIndex: 0, scores: [], discIndex: discIndexRef.current, ...freshHole(0) };
    setSaved(false);
    setSaveErr(null);
    setIsNewBest(false);
    setScreen("playing");
    syncHud();
  }, [muted, syncHud]);

  const selectDisc = useCallback((i: number) => {
    setDiscIndex(i);
    if (stateRef.current) stateRef.current.discIndex = i;
  }, []);

  const throwDisc = useCallback(() => {
    const g = stateRef.current;
    if (!g || g.phase !== "aim") return;
    const disc = DISCS[g.discIndex];
    // Slower launch + extra glide (disc friction) so it floats across the fairway.
    const speed = disc.power * (1.2 + g.power * 3.35);
    g.disc.vx = Math.cos(g.angle) * speed;
    g.disc.vy = Math.sin(g.angle) * speed;
    g.rest = { x: g.disc.x, y: g.disc.y };
    // Backhand fades left, forehand fades right (relative to "up the screen").
    g.fadeSign = throwStyleRef.current === "BH" ? -1 : 1;
    g.fadeTurn = 0;
    // Launch upward — height scales with power and the disc's arc, so a putter
    // stays low (lands near the basket to catch) while a driver climbs to clear
    // hazards.
    g.h = 0;
    g.vh = g.power * disc.arc;
    g.throws += 1;
    g.phase = "fly";
    audioRef.current?.sfx("throw");
    syncHud();
  }, [syncHud]);

  const finishGame = useCallback((scores: number[]) => {
    const total = scores.reduce((s, n) => s + n, 0);
    setScorecard(scores);
    setFinalTotal(total);
    // Personal best
    let prior: number | null = null;
    try {
      const raw = localStorage.getItem(BEST_KEY);
      prior = raw ? Number(raw) : null;
      if (prior != null && !Number.isFinite(prior)) prior = null;
    } catch {
      /* ignore */
    }
    const newBest = prior == null || total < prior;
    const best = newBest ? total : prior!;
    try {
      localStorage.setItem(BEST_KEY, String(best));
    } catch {
      /* ignore */
    }
    setBestScore(best);
    setIsNewBest(newBest);
    audioRef.current?.sfx("win");
    setScreen("gameComplete");
    void getArcadeLeaderboard().then(setLeaderboard).catch(() => {});
  }, []);

  const nextHole = useCallback(() => {
    const g = stateRef.current;
    if (!g) return;
    if (g.holeIndex + 1 >= HOLES.length) {
      finishGame(g.scores.slice());
      return;
    }
    g.holeIndex += 1;
    Object.assign(g, freshHole(g.holeIndex));
    g.discIndex = discIndexRef.current;
    setScreen("playing");
    syncHud();
  }, [syncHud, finishGame]);

  const saveScore = useCallback(async () => {
    if (saving || saved) return;
    setSaving(true);
    setSaveErr(null);
    try {
      await submitArcadeScore(nameInput, finalTotal);
      setSaved(true);
      const lb = await getArcadeLeaderboard();
      setLeaderboard(lb);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [saving, saved, nameInput, finalTotal]);

  // Keyboard
  useEffect(() => {
    function onDown(e: KeyboardEvent) {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Enter"].includes(e.key)) e.preventDefault();
      keysRef.current.add(e.key);
      if (e.key >= "1" && e.key <= "3") selectDisc(Number(e.key) - 1);
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

    function update() {
      const g = stateRef.current;
      if (!g || screenRef.current !== "playing") return;
      const hole = HOLES[g.holeIndex];

      if (g.phase === "aim") {
        // Aim + power are driven by the pointer drag handlers; nothing to do here.
      } else if (g.phase === "fly") {
        const d = g.disc;
        const disc = DISCS[g.discIndex];
        const f: Flight = { x: d.x, y: d.y, vx: d.vx, vy: d.vy, h: g.h, vh: g.vh, fadeTurn: g.fadeTurn };
        const res = stepFlight(f, disc, g.fadeSign, hole);
        d.x = f.x;
        d.y = f.y;
        d.vx = f.vx;
        d.vy = f.vy;
        g.h = f.h;
        g.vh = f.vh;
        g.fadeTurn = f.fadeTurn;
        if (res.treeHit) audioRef.current?.sfx("tree");

        if (res.status === "hole") {
          g.phase = "holed";
          g.holedAt = performance.now();
          d.vx = 0;
          d.vy = 0;
          d.x = hole.basket.x;
          d.y = hole.basket.y;
          audioRef.current?.sfx("basket");
        } else if (res.status === "oob" || res.status === "water") {
          audioRef.current?.sfx(res.status === "water" ? "water" : "tree");
          g.throws += 1;
          d.x = g.rest.x;
          d.y = g.rest.y;
          d.vx = 0;
          d.vy = 0;
          g.h = 0;
          g.vh = 0;
          g.angle = aimAt(g.rest, hole.basket);
          g.phase = "aim";
          syncHud();
        } else if (res.status === "stop") {
          d.vx = 0;
          d.vy = 0;
          g.rest = { x: d.x, y: d.y };
          g.angle = aimAt(g.rest, hole.basket); // auto-aim at the basket
          g.phase = "aim";
        }
      } else if (g.phase === "holed") {
        if (g.holedAt && performance.now() - g.holedAt > 850) {
          g.scores[g.holeIndex] = g.throws;
          setScreen("holeComplete");
          syncHud();
        }
      }
    }

    function draw() {
      const g = stateRef.current;
      if (!g) return;
      const hole = HOLES[g.holeIndex];

      for (let y = 0; y < H; y += 14) {
        ctx.fillStyle = (y / 14) % 2 === 0 ? "#4a8a3a" : "#3f7e31";
        ctx.fillRect(0, y, W, 14);
      }
      ctx.fillStyle = "#356b29";
      ctx.fillRect(0, 0, W, 4);
      ctx.fillRect(0, H - 4, W, 4);
      ctx.fillRect(0, 0, 4, H);
      ctx.fillRect(W - 4, 0, 4, H);

      for (const wt of hole.water) {
        ctx.fillStyle = "#3a6ea5";
        ctx.fillRect(wt.x, wt.y, wt.w, wt.h);
        ctx.fillStyle = "#5b8fc4";
        for (let i = 0; i < wt.h; i += 6) ctx.fillRect(wt.x + 2, wt.y + 3 + i, wt.w - 6, 1);
      }

      // Tee pad
      ctx.fillStyle = "#caa46a";
      ctx.fillRect(hole.tee.x - 7, hole.tee.y - 5, 14, 10);
      ctx.fillStyle = "#8a6a3a";
      ctx.fillRect(hole.tee.x - 7, hole.tee.y - 5, 14, 2);

      drawBasket(ctx, hole.basket.x, hole.basket.y);
      for (const tr of hole.trees) drawTree(ctx, tr);

      // Aim: the exact predicted flight path (simulated with the real physics)
      // plus a visible pull-back slider/knob on the disc.
      if (g.phase === "aim") {
        const dr = dragRef.current;
        const aimDisc = DISCS[g.discIndex];
        const sign = throwStyleRef.current === "BH" ? -1 : 1;

        // Knob position: where you've pulled to (clamped), or a resting handle
        // just below the disc inviting a pull.
        let kx: number;
        let ky: number;
        let power: number;
        if (dr.active) {
          let pullX = dr.cx - g.disc.x;
          let pullY = dr.cy - g.disc.y;
          const dist = Math.hypot(pullX, pullY) || 0.0001;
          const cl = Math.min(dist, MAX_DRAG);
          pullX = (pullX / dist) * cl;
          pullY = (pullY / dist) * cl;
          kx = g.disc.x + pullX;
          ky = g.disc.y + pullY;
          power = cl / MAX_DRAG;
        } else {
          kx = g.disc.x;
          ky = g.disc.y + 26;
          power = 0;
        }

        // Exact trajectory — simulate the real flight forward, draw it solid
        // early and fading out toward the end (so the precise landing is fuzzy).
        if (dr.active && power > 0.04) {
          const speed = aimDisc.power * (1.2 + power * 3.35);
          const f: Flight = {
            x: g.disc.x, y: g.disc.y,
            vx: Math.cos(g.angle) * speed, vy: Math.sin(g.angle) * speed,
            h: 0, vh: power * aimDisc.arc, fadeTurn: 0,
          };
          const pts: { x: number; y: number }[] = [{ x: f.x, y: f.y }];
          for (let i = 0; i < 360; i++) {
            const r = stepFlight(f, aimDisc, sign, hole);
            pts.push({ x: f.x, y: f.y });
            if (r.status !== "fly") break;
          }
          // Only reveal the first half of the flight, fading from solid to gone —
          // so you commit to a line without seeing exactly where it lands.
          const shown = Math.max(2, Math.floor(pts.length * 0.5));
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#ffffff";
          for (let i = 0; i < shown - 1; i++) {
            const t = i / (shown - 1);
            ctx.globalAlpha = Math.max(0.04, 0.95 * (1 - Math.pow(t, 1.4)));
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }

        // Slider track + knob (the pull-back handle), colored by power.
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(g.disc.x, g.disc.y);
        ctx.lineTo(kx, ky);
        ctx.stroke();
        const pc = power < 0.5 ? "#36D7B7" : power < 0.85 ? "#f5d24a" : "#e23b3b";
        ctx.fillStyle = dr.active ? pc : "rgba(255,255,255,0.7)";
        ctx.beginPath();
        ctx.arc(kx, ky, dr.active ? 5 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.stroke();
        ctx.lineWidth = 1;
      }

      // Shadow on the ground + disc lifted by its height. The gap between them
      // shows how high the disc is flying (so you can read carries over water).
      const disc = DISCS[g.discIndex];
      const shadowR = Math.max(1.5, DISC_R - g.h * 0.03);
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath();
      ctx.ellipse(g.disc.x, g.disc.y, shadowR, shadowR * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      const discY = g.disc.y - g.h;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(g.disc.x, discY, DISC_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = disc.color;
      ctx.fillRect(Math.round(g.disc.x) - 1, Math.round(discY) - 1, 2, 2);

      // HUD
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, W, 14);
      ctx.fillStyle = "#fff";
      ctx.font = "8px monospace";
      ctx.textBaseline = "middle";
      const over = g.scores.reduce((s, n) => s + n, 0) - HOLES.slice(0, g.holeIndex).reduce((s, h) => s + h.par, 0);
      const overStr = over === 0 ? "E" : over > 0 ? `+${over}` : `${over}`;
      ctx.fillText(`H${g.holeIndex + 1}/9`, 6, 7);
      ctx.fillText(`PAR ${hole.par}`, 70, 7);
      ctx.fillText(`THR ${g.throws}`, 140, 7);
      ctx.fillText(`TOT ${overStr}`, 220, 7);
    }

    function frame() {
      update();
      draw();
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [syncHud]);

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
    const pullX = px - g.disc.x;
    const pullY = py - g.disc.y;
    const dist = Math.hypot(pullX, pullY);
    g.power = Math.min(1, dist / MAX_DRAG);
    if (dist > 4) g.angle = Math.atan2(-pullY, -pullX); // throw opposite the pull
  }, []);
  function onCanvasDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (screenRef.current !== "playing") return;
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
      if (g.phase === "aim" && g.power > 0.06) throwDisc();
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

  const finalOver = finalTotal - TOTAL_PAR;
  const overStr = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);

  return (
    <div className="h-[100dvh] w-full bg-[#0f1117] flex flex-col select-none overflow-hidden">
      {/* Play area — canvas fills the available space, keeping its aspect ratio */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center p-2">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={onCanvasDown}
          className="max-h-full max-w-full rounded-lg border border-white/10 bg-[#4a8a3a]"
          style={{ imageRendering: "pixelated", touchAction: "none" }}
        />

        {screen === "title" && (
          <Overlay>
            <h1 className="text-white font-black text-3xl sm:text-4xl tracking-tight">
              <span className="text-[#36D7B7]">DISC</span> GOLF
            </h1>
            <p className="text-gray-300 text-xs sm:text-sm max-w-xs">
              9 holes. <span className="text-white font-semibold">Drag back</span> from the disc to aim &amp; set
              power, then release to throw. The arrow shows your line and fade.
            </p>
            {bestScore != null && (
              <p className="text-[#36D7B7] text-xs font-semibold">
                Your best: {bestScore} ({overStr(bestScore - TOTAL_PAR)})
              </p>
            )}
            <button type="button" onClick={startGame} className={btn}>▶ Start</button>
          </Overlay>
        )}

        {screen === "holeComplete" && (
          <Overlay>
            <p className="text-[#36D7B7] font-bold text-xl">Hole {hud.hole} complete</p>
            <p className="text-white text-sm">
              {hud.throws} throws · par {hud.par}{" "}
              {hud.throws < hud.par ? "🐦 birdie!" : hud.throws === hud.par ? "par" : "bogey"}
            </p>
            <button type="button" onClick={nextHole} className={btn}>
              {hud.hole >= HOLES.length ? "See results ▶" : "Next hole ▶"}
            </button>
          </Overlay>
        )}
      </div>

      {/* Compact footer: disc + stance + mute (hidden on the results screen) */}
      {screen !== "gameComplete" && (
        <div className="shrink-0 w-full max-w-[480px] mx-auto px-3 pb-[max(env(safe-area-inset-bottom),0.6rem)] pt-1 flex flex-col gap-2">
          <p className="text-center text-[11px] text-gray-400 leading-none">Drag back to aim &amp; throw</p>
          <div className="grid grid-cols-3 gap-2">
            {DISCS.map((d, i) => (
              <button
                key={d.key}
                type="button"
                onClick={() => selectDisc(i)}
                title={d.blurb}
                className={`rounded-lg border px-2 py-2 flex items-center gap-1.5 text-xs font-bold transition ${
                  i === discIndex ? "border-white/40 bg-white/10 text-white" : "border-white/10 text-gray-300 hover:border-white/25"
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                <span className="truncate">{d.name}</span>
                <span className="ml-auto text-[10px] text-gray-500">{i + 1}</span>
              </button>
            ))}
          </div>

          <div className="flex items-stretch gap-2">
            <div className="flex-1 flex gap-1 bg-[#1a1d23] border border-white/10 rounded-lg p-1">
              {([
                { key: "BH", label: "Backhand ◄" },
                { key: "FH", label: "► Forehand" },
              ] as const).map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setThrowStyle(s.key)}
                  aria-pressed={throwStyle === s.key}
                  className={`flex-1 rounded-md px-2 py-2 text-xs font-bold transition ${
                    throwStyle === s.key ? "bg-[#4B3DFF] text-white" : "text-gray-400 hover:text-white"
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
              className="bg-[#1a1d23] border border-white/10 text-white w-12 rounded-lg active:bg-white/10"
            >
              {muted ? "🔇" : "🔊"}
            </button>
          </div>
        </div>
      )}

      {/* Results: scorecard + save + leaderboard */}
      {screen === "gameComplete" && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm p-4 flex items-start sm:items-center justify-center">
          <div className="w-full max-w-lg space-y-4 my-auto">
            <div className="text-center">
              <h2 className="text-white font-black text-2xl">Round complete!</h2>
              <p className="text-[#36D7B7] font-bold text-lg">
                {finalTotal} throws · {finalOver === 0 ? "Even par" : overStr(finalOver)}
                {isNewBest && <span className="ml-2 text-[#f5d24a]">★ New best!</span>}
              </p>
              {bestScore != null && !isNewBest && (
                <p className="text-gray-400 text-xs mt-0.5">Your best: {bestScore} ({overStr(bestScore - TOTAL_PAR)})</p>
              )}
            </div>

            {/* Scorecard */}
            <div className="bg-[#1a1d23] border border-white/5 rounded-2xl p-3 overflow-x-auto">
              <table className="w-full text-center text-xs">
                <thead>
                  <tr className="text-gray-400">
                    <th className="text-left font-semibold py-1 pr-2">Hole</th>
                    {HOLES.map((_, i) => (
                      <th key={i} className="font-semibold px-1">{i + 1}</th>
                    ))}
                    <th className="font-semibold pl-2">Σ</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-gray-400">
                    <td className="text-left py-1 pr-2">Par</td>
                    {HOLES.map((h, i) => (
                      <td key={i} className="px-1">{h.par}</td>
                    ))}
                    <td className="pl-2 font-mono">{TOTAL_PAR}</td>
                  </tr>
                  <tr className="text-white font-semibold">
                    <td className="text-left py-1 pr-2">You</td>
                    {scorecard.map((s, i) => {
                      const diff = s - HOLES[i].par;
                      const color = diff < 0 ? "#36D7B7" : diff > 1 ? "#e23b3b" : diff === 1 ? "#f5d24a" : "#ffffff";
                      return (
                        <td key={i} className="px-1 font-mono" style={{ color }}>{s}</td>
                      );
                    })}
                    <td className="pl-2 font-mono">{finalTotal}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Save score */}
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

            {/* Leaderboard */}
            <div className="bg-[#1a1d23] border border-white/5 rounded-2xl overflow-hidden">
              <p className="text-white font-bold text-sm px-4 py-2.5 border-b border-white/5">🏆 Leaderboard</p>
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
                      <span className="text-gray-400 font-mono">{overStr(row.strokes - TOTAL_PAR)}</span>
                      <span className="text-white font-mono font-bold w-8 text-right">{row.strokes}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="flex justify-center gap-2">
              <button type="button" onClick={startGame} className={btn}>↻ Play again</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btn =
  "mt-1 bg-[#4B3DFF] hover:bg-[#3a2ee0] text-white font-bold px-6 py-3 rounded-lg transition";

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 rounded-lg text-center px-4">
      {children}
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

function drawBasket(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.beginPath();
  ctx.arc(x, y, CATCH_R, 0, Math.PI * 2);
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
