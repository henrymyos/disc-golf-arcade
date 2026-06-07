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
const STOP_SPEED = 0.18;
const BEST_KEY = "discgolf.best";

type Vec = { x: number; y: number };
type Tree = { x: number; y: number; r: number };
type Water = { x: number; y: number; w: number; h: number };
type Hole = { par: number; tee: Vec; basket: Vec; trees: Tree[]; water: Water[] };

const TEE: Vec = { x: 160, y: 416 };

// Fixed course — identical every play.
const HOLES: Hole[] = [
  { par: 3, tee: TEE, basket: { x: 160, y: 90 }, trees: [{ x: 118, y: 250, r: 12 }, { x: 202, y: 200, r: 12 }], water: [] },
  { par: 3, tee: TEE, basket: { x: 96, y: 110 }, trees: [{ x: 170, y: 250, r: 12 }, { x: 120, y: 180, r: 12 }, { x: 210, y: 150, r: 11 }], water: [] },
  { par: 2, tee: TEE, basket: { x: 160, y: 170 }, trees: [], water: [] },
  { par: 4, tee: TEE, basket: { x: 230, y: 82 }, trees: [{ x: 150, y: 300, r: 12 }, { x: 120, y: 180, r: 13 }, { x: 222, y: 200, r: 12 }], water: [{ x: 40, y: 120, w: 90, h: 70 }] },
  { par: 3, tee: TEE, basket: { x: 92, y: 130 }, trees: [{ x: 180, y: 260, r: 12 }, { x: 140, y: 180, r: 12 }], water: [] },
  { par: 3, tee: TEE, basket: { x: 234, y: 140 }, trees: [{ x: 120, y: 260, r: 12 }, { x: 182, y: 190, r: 12 }], water: [] },
  { par: 4, tee: TEE, basket: { x: 160, y: 72 }, trees: [{ x: 110, y: 220, r: 12 }, { x: 210, y: 220, r: 12 }, { x: 160, y: 150, r: 12 }], water: [{ x: 120, y: 300, w: 80, h: 58 }] },
  { par: 3, tee: TEE, basket: { x: 110, y: 100 }, trees: [{ x: 184, y: 250, r: 12 }, { x: 150, y: 172, r: 11 }], water: [] },
  { par: 3, tee: TEE, basket: { x: 220, y: 100 }, trees: [{ x: 120, y: 250, r: 12 }, { x: 182, y: 182, r: 12 }, { x: 250, y: 200, r: 11 }], water: [] },
];
const TOTAL_PAR = HOLES.reduce((s, h) => s + h.par, 0);

// Disc bag — power scales throw speed, `fade` is how many radians the flight
// path curves per frame (the disc bends one way; backhand left, forehand
// right), and friction is glide (higher = floats/rolls farther). Curving is
// capped per throw (MAX_FADE_TURN) so a disc can never loop or fade backward.
type Disc = { key: string; name: string; power: number; fade: number; friction: number; color: string; blurb: string };
const DISCS: Disc[] = [
  { key: "putter", name: "Putter", power: 0.82, fade: 0.004, friction: 0.971, color: "#36D7B7", blurb: "Short, low fade" },
  { key: "mid", name: "Mid", power: 1.0, fade: 0.008, friction: 0.980, color: "#f5d24a", blurb: "Balanced" },
  { key: "driver", name: "Driver", power: 1.34, fade: 0.014, friction: 0.987, color: "#e23b3b", blurb: "Far, big fade" },
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

export function DiscGolfGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const aimDirRef = useRef<0 | -1 | 1>(0);
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

  // Load personal best once.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BEST_KEY);
      if (raw) {
        const n = Number(raw);
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
    const speed = disc.power * (1.7 + g.power * 4.6);
    g.disc.vx = Math.cos(g.angle) * speed;
    g.disc.vy = Math.sin(g.angle) * speed;
    g.rest = { x: g.disc.x, y: g.disc.y };
    // Backhand fades left, forehand fades right (relative to "up the screen").
    g.fadeSign = throwStyleRef.current === "BH" ? -1 : 1;
    g.fadeTurn = 0;
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
        if (screenRef.current === "playing") throwDisc();
        else if (screenRef.current === "title") startGame();
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
  }, [throwDisc, startGame, nextHole, selectDisc]);

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
        const left = keysRef.current.has("ArrowLeft") || aimDirRef.current === -1;
        const right = keysRef.current.has("ArrowRight") || aimDirRef.current === 1;
        if (left) g.angle -= 0.03;
        if (right) g.angle += 0.03;
        g.powerT = (g.powerT + 0.025) % 2;
        g.power = g.powerT <= 1 ? g.powerT : 2 - g.powerT;
      } else if (g.phase === "fly") {
        const d = g.disc;
        const disc = DISCS[g.discIndex];
        d.x += d.vx;
        d.y += d.vy;
        const sp = Math.hypot(d.vx, d.vy);
        // Fade by *rotating* the velocity (so speed only ever decreases — never a
        // backward push), capped so the path can't curve past MAX_FADE_TURN.
        if (sp > 0.6 && Math.abs(g.fadeTurn) < MAX_FADE_TURN) {
          const a = g.fadeSign * disc.fade;
          const cos = Math.cos(a);
          const sin = Math.sin(a);
          const nvx = d.vx * cos - d.vy * sin;
          const nvy = d.vx * sin + d.vy * cos;
          d.vx = nvx;
          d.vy = nvy;
          g.fadeTurn += a;
        }
        d.vx *= disc.friction;
        d.vy *= disc.friction;

        // Basket catch — chains grab the disc; skip the rest of this step.
        if (Math.hypot(d.x - hole.basket.x, d.y - hole.basket.y) < CATCH_R) {
          g.phase = "holed";
          g.holedAt = performance.now();
          d.vx = 0;
          d.vy = 0;
          d.x = hole.basket.x;
          d.y = hole.basket.y;
          audioRef.current?.sfx("basket");
          return;
        }

        // Tree bounce
        for (const tr of hole.trees) {
          const dist = Math.hypot(d.x - tr.x, d.y - tr.y);
          const min = tr.r + DISC_R;
          if (dist < min && dist > 0) {
            const nx = (d.x - tr.x) / dist;
            const ny = (d.y - tr.y) / dist;
            d.x = tr.x + nx * min;
            d.y = tr.y + ny * min;
            const dot = d.vx * nx + d.vy * ny;
            d.vx = (d.vx - 2 * dot * nx) * 0.45;
            d.vy = (d.vy - 2 * dot * ny) * 0.45;
            audioRef.current?.sfx("tree");
          }
        }

        // Water / OB → penalty stroke, reset to last lie
        let penalized = false;
        for (const wt of hole.water) {
          if (d.x > wt.x && d.x < wt.x + wt.w && d.y > wt.y && d.y < wt.y + wt.h) {
            penalized = true;
            break;
          }
        }
        const oob = d.x < 2 || d.x > W - 2 || d.y < 2 || d.y > H - 2;
        if (penalized || oob) {
          audioRef.current?.sfx(penalized ? "water" : "tree");
          g.throws += 1;
          d.x = g.rest.x;
          d.y = g.rest.y;
          d.vx = 0;
          d.vy = 0;
          g.angle = aimAt(g.rest, hole.basket); // re-aim at the basket
          g.phase = "aim";
          syncHud();
        } else if (g.phase === "fly" && Math.hypot(d.vx, d.vy) < STOP_SPEED) {
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

      // Aim indicator
      if (g.phase === "aim") {
        const len = 16 + g.power * 46;
        const ex = g.disc.x + Math.cos(g.angle) * len;
        const ey = g.disc.y + Math.sin(g.angle) * len;
        ctx.strokeStyle = "#ffffff";
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(g.disc.x, g.disc.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(Math.round(ex) - 1, Math.round(ey) - 1, 3, 3);
      }

      // Disc
      const disc = DISCS[g.discIndex];
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(g.disc.x, g.disc.y, DISC_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = disc.color;
      ctx.fillRect(Math.round(g.disc.x) - 1, Math.round(g.disc.y) - 1, 2, 2);

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

      // Power meter
      if (g.phase === "aim") {
        const bw = 160;
        const bx = (W - bw) / 2;
        const by = H - 12;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(bx - 2, by - 2, bw + 4, 10);
        ctx.fillStyle = "#222";
        ctx.fillRect(bx, by, bw, 6);
        ctx.fillStyle = g.power < 0.5 ? "#36D7B7" : g.power < 0.8 ? "#f5d24a" : "#e23b3b";
        ctx.fillRect(bx, by, bw * g.power, 6);
      }
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

  const finalOver = finalTotal - TOTAL_PAR;
  const overStr = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);

  return (
    <div className="min-h-screen w-full bg-[#0f1117] flex flex-col items-center justify-center gap-4 p-4 select-none">
      <div className="relative" style={{ aspectRatio: `${W} / ${H}`, height: "min(72vh, 600px)" }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="h-full w-full rounded-lg border border-white/10 bg-[#4a8a3a]"
          style={{ imageRendering: "pixelated" }}
        />

        {screen === "title" && (
          <Overlay>
            <h1 className="text-white font-black text-3xl sm:text-4xl tracking-tight">
              <span className="text-[#36D7B7]">DISC</span> GOLF
            </h1>
            <p className="text-gray-300 text-xs sm:text-sm max-w-xs">
              9 holes. Throw bottom → top. Pick a disc, aim with ◄ ►, time the power bar, sink the basket.
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

      {/* Disc selector + controls (hidden on the results screen) */}
      {screen !== "gameComplete" && (
        <div className="w-full max-w-[420px] flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            {DISCS.map((d, i) => (
              <button
                key={d.key}
                type="button"
                onClick={() => selectDisc(i)}
                className={`rounded-lg border px-2 py-1.5 text-left transition ${
                  i === discIndex ? "border-white/40 bg-white/10" : "border-white/10 hover:border-white/25"
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                  {d.name}
                  <span className="ml-auto text-[10px] text-gray-500">{i + 1}</span>
                </span>
                <span className="block text-[10px] text-gray-400 mt-0.5">{d.blurb}</span>
              </button>
            ))}
          </div>

          {/* Backhand / forehand — fades left / right */}
          <div className="flex gap-1 bg-[#1a1d23] border border-white/10 rounded-lg p-1">
            {([
              { key: "BH", label: "Backhand", hint: "fades ◄ left" },
              { key: "FH", label: "Forehand", hint: "fades right ►" },
            ] as const).map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setThrowStyle(s.key)}
                aria-pressed={throwStyle === s.key}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-bold transition ${
                  throwStyle === s.key ? "bg-[#4B3DFF] text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {s.label} <span className="font-normal text-[10px] opacity-80">{s.hint}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 justify-center">
            <button
              type="button"
              aria-label="Aim left"
              onPointerDown={() => (aimDirRef.current = -1)}
              onPointerUp={() => (aimDirRef.current = 0)}
              onPointerLeave={() => (aimDirRef.current = 0)}
              className="bg-[#1a1d23] border border-white/10 text-white text-xl w-16 h-12 rounded-lg active:bg-white/10"
            >
              ◄
            </button>
            <button
              type="button"
              onClick={() => {
                if (screen === "playing") throwDisc();
                else if (screen === "title") startGame();
                else if (screen === "holeComplete") nextHole();
              }}
              className="bg-[#4B3DFF] hover:bg-[#3a2ee0] text-white font-bold text-lg flex-1 max-w-[200px] h-12 rounded-lg transition"
            >
              {screen === "playing" ? "THROW" : "▶"}
            </button>
            <button
              type="button"
              aria-label="Aim right"
              onPointerDown={() => (aimDirRef.current = 1)}
              onPointerUp={() => (aimDirRef.current = 0)}
              onPointerLeave={() => (aimDirRef.current = 0)}
              className="bg-[#1a1d23] border border-white/10 text-white text-xl w-16 h-12 rounded-lg active:bg-white/10"
            >
              ►
            </button>
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? "Unmute" : "Mute"}
              className="bg-[#1a1d23] border border-white/10 text-white w-12 h-12 rounded-lg active:bg-white/10"
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
  ctx.fillStyle = "#5a3a1a";
  ctx.fillRect(Math.round(tr.x) - 1, Math.round(tr.y), 3, tr.r + 4);
  ctx.fillStyle = "#2f6b2a";
  ctx.beginPath();
  ctx.arc(tr.x, tr.y, tr.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3f8a37";
  ctx.beginPath();
  ctx.arc(tr.x - tr.r * 0.3, tr.y - tr.r * 0.3, tr.r * 0.5, 0, Math.PI * 2);
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
